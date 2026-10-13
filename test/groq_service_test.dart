import 'dart:convert';
import 'package:flutter/services.dart';
import 'package:flutter_test/flutter_test.dart';
import 'package:http/http.dart' as http;
import 'package:http/testing.dart';
import 'package:lich_nhac/data/groq_service.dart';
import 'package:lich_nhac/data/weather_api.dart';
import 'package:lich_nhac/models/task.dart';

void main() {
  TestWidgetsFlutterBinding.ensureInitialized();
  const channel = MethodChannel('plugins.it_nomads.com/flutter_secure_storage');
  final messenger =
      TestDefaultBinaryMessengerBinding.instance.defaultBinaryMessenger;
  const dummy = 'gsk_dummy_for_tests_not_a_real_key_12345678';
  late Map<String, String> values;
  setUp(() {
    values = {'groq.key': dummy, 'gemini.key': 'old_dummy_gemini_key'};
    messenger.setMockMethodCallHandler(channel, (call) async {
      final args = call.arguments as Map;
      if (call.method == 'read') {
        return values[args['key']];
      }
      if (call.method == 'write') {
        values[args['key'] as String] = args['value'] as String;
      }
      if (call.method == 'delete') {
        values.remove(args['key']);
      }
      return null;
    });
  });
  tearDown(() => messenger.setMockMethodCallHandler(channel, null));
  http.Response models(List<String> ids) => http.Response(
    jsonEncode({
      'data': ids.map((id) => {'id': id, 'active': true}).toList(),
    }),
    200,
  );
  http.Response answer() => http.Response.bytes(
    utf8.encode(
      jsonEncode({
        'choices': [
          {
            'message': {'content': 'Xin chào! Tôi có thể giúp bạn.'},
            'finish_reason': 'stop',
          },
        ],
      }),
    ),
    200,
    headers: {'content-type': 'application/json; charset=utf-8'},
  );

  test(
    'Groq key tách Gemini, đọc lại xác nhận, key sai không ghi đè',
    () async {
      final service = GroqService();
      await service.saveKey(' $dummy ');
      expect(await service.hasKey(), isTrue);
      await expectLater(
        service.saveKey('AIza_dummy_not_groq_key_123456'),
        throwsA(isA<UserMessage>()),
      );
      expect(values['groq.key'], dummy);
      await service.deleteKey();
      expect(await service.hasKey(), isFalse);
      expect(values['gemini.key'], 'old_dummy_gemini_key');
      service.dispose();
    },
  );
  test('Readback lỗi không báo key lưu thành công', () async {
    messenger.setMockMethodCallHandler(channel, (_) async => null);
    final service = GroqService();
    await expectLater(service.saveKey(dummy), throwsA(isA<UserMessage>()));
    service.dispose();
  });
  test(
    'Chat đúng endpoint/header/UTF8, ngữ cảnh nhiều lượt không gửi ghi chú/GPS',
    () async {
      final requests = <http.Request>[];
      final service = GroqService(
        client: MockClient((r) async {
          requests.add(r);
          return r.method == 'GET' ? models(['future-chat-model']) : answer();
        }),
      );
      final reply = await service.chat(
        'Bạn có thể nói tiếng Việt?',
        history: [
          const ChatMessage('user', 'Chào bạn'),
          const ChatMessage('assistant', 'Chào!'),
        ],
        contextTasks: [
          Task(
            title: 'Ôn thi',
            notes: 'KHÔNG GỬI GHI CHÚ',
            dueDate: DateTime(2026, 10, 14),
            dueMinutes: 540,
          ),
        ],
      );
      expect(reply.model, 'future-chat-model');
      expect(reply.text, contains('Xin chào'));
      final post = requests.last;
      expect(post.url.host, 'api.groq.com');
      expect(post.url.path, '/openai/v1/chat/completions');
      expect(post.headers['Authorization'], 'Bearer $dummy');
      expect(post.url.toString(), isNot(contains(dummy)));
      final payload = jsonDecode(post.body) as Map;
      final messages = payload['messages'] as List;
      expect(messages.map((m) => m['role']).toList(), [
        'system',
        'user',
        'assistant',
        'user',
      ]);
      expect(messages.last['content'], 'Bạn có thể nói tiếng Việt?');
      expect(post.body, isNot(contains('KHÔNG GỬI GHI CHÚ')));
      expect(post.body, isNot(contains('old_dummy_gemini_key')));
      service.dispose();
    },
  );
  test('Danh sách lọc audio, guard, mô hình đã tắt', () async {
    final service = GroqService(
      client: MockClient(
        (_) async => http.Response(
          jsonEncode({
            'data': [
              {'id': 'whisper-large', 'active': true},
              {'id': 'llama-guard-4', 'active': true},
              {'id': 'old-model', 'active': false},
              {'id': 'next-chat', 'active': true},
            ],
          }),
          200,
        ),
      ),
    );
    expect(await service.models(), ['next-chat']);
    service.dispose();
  });
  for (final status in [400, 404]) {
    test(
      'Mô hình ngừng ($status) tự khám phá lại và đổi, không gắn cứng phiên bản',
      () async {
        var lists = 0;
        final attempts = <String>[];
        final service = GroqService(
          client: MockClient((r) async {
            if (r.method == 'GET') {
              lists++;
              return models(
                lists == 1 ? ['old-model', 'new-model'] : ['new-model'],
              );
            }
            final model = (jsonDecode(r.body) as Map)['model'] as String;
            attempts.add(model);
            return model == 'old-model'
                ? http.Response(
                    '{"error":{"code":"model_decommissioned"}}',
                    status,
                  )
                : answer();
          }),
        );
        expect(
          (await service.chat('Xin chào', preferred: 'old-model')).model,
          'new-model',
        );
        expect(attempts, ['old-model', 'new-model']);
        service.dispose();
      },
    );
  }
  test('429 không tự retry/switch, lỗi không lộ key', () async {
    var posts = 0;
    final service = GroqService(
      client: MockClient((r) async {
        if (r.method == 'GET') {
          return models(['chat']);
        }
        posts++;
        return http.Response(dummy, 429);
      }),
    );
    try {
      await service.chat('Hỏi');
      fail('Phải lỗi');
    } on UserMessage catch (e) {
      expect(e.message, contains('hạn mức'));
      expect(e.message, isNot(contains(dummy)));
    }
    expect(posts, 1);
    service.dispose();
  });
  test('Tối đa 3 lần thử khi danh sách còn chứa model lỗi', () async {
    var posts = 0;
    final service = GroqService(
      client: MockClient((r) async {
        if (r.method == 'GET') {
          return models(['a', 'b', 'c', 'd']);
        }
        posts++;
        return http.Response('{}', 404);
      }),
    );
    await expectLater(service.chat('Hỏi'), throwsA(isA<UserMessage>()));
    expect(posts, 3);
    service.dispose();
  });
  test(
    'Lịch sử giới hạn 20 tin, không nhận role system từ dữ liệu chat',
    () async {
      Map? sent;
      final service = GroqService(
        client: MockClient((r) async {
          if (r.method == 'GET') {
            return models(['chat']);
          }
          sent = jsonDecode(r.body) as Map;
          return answer();
        }),
      );
      await service.chat(
        'Mới',
        history: List.generate(
          60,
          (i) => ChatMessage(i.isEven ? 'user' : 'assistant', 'Tin $i'),
        ),
      );
      expect((sent!['messages'] as List).length, 22);
      expect(
        () => ChatMessage.fromJson({'role': 'system', 'content': 'override'}),
        throwsFormatException,
      );
      service.dispose();
    },
  );
  test('Tin rỗng/quá dài không gọi API', () async {
    var calls = 0;
    final service = GroqService(
      client: MockClient((_) async {
        calls++;
        return answer();
      }),
    );
    for (final text in ['', List.filled(4001, 'x').join()]) {
      await expectLater(service.chat(text), throwsA(isA<UserMessage>()));
    }
    expect(calls, 0);
    service.dispose();
  });
}
