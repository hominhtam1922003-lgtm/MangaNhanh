import 'package:flutter/services.dart';
import 'package:flutter_test/flutter_test.dart';
import 'package:http/testing.dart';
import 'package:http/http.dart' as http;
import 'package:lich_nhac/data/gemini_service.dart';
import 'package:lich_nhac/data/weather_api.dart';

void main() {
  TestWidgetsFlutterBinding.ensureInitialized();
  const channel = MethodChannel('plugins.it_nomads.com/flutter_secure_storage');
  final messenger =
      TestDefaultBinaryMessengerBinding.instance.defaultBinaryMessenger;
  const dummy = 'dummy_only_for_test_not_a_real_key_123456';
  late Map<String, String> values;
  setUp(() {
    values = {};
    messenger.setMockMethodCallHandler(channel, (call) async {
      final args = call.arguments as Map;
      if (call.method == 'write') {
        values[args['key'] as String] = args['value'] as String;
      }
      if (call.method == 'read') return values[args['key']];
      if (call.method == 'delete') values.remove(args['key']);
      return null;
    });
  });
  tearDown(() => messenger.setMockMethodCallHandler(channel, null));
  test(
    'Lưu, xác nhận đọc lại, mở service mới, xóa key; lưu không gọi mạng',
    () async {
      var calls = 0;
      final service = GeminiService(
        client: MockClient((_) async {
          calls++;
          return http.Response('', 200);
        }),
      );
      await service.saveKey(' $dummy ');
      expect(values['gemini.key'], dummy);
      expect(await GeminiService().hasKey(), isTrue);
      expect(calls, 0);
      await service.deleteKey();
      expect(await service.hasKey(), isFalse);
    },
  );
  test('Không báo thành công khi storage đọc lại sai', () async {
    messenger.setMockMethodCallHandler(channel, (_) async => null);
    await expectLater(
      GeminiService().saveKey(dummy),
      throwsA(isA<UserMessage>()),
    );
  });
  test('Lỗi Android lưu key trả thông báo an toàn, không lộ key', () async {
    messenger.setMockMethodCallHandler(
      channel,
      (_) async => throw PlatformException(code: 'storage', message: dummy),
    );
    try {
      await GeminiService().saveKey(dummy);
      fail('Phải báo lỗi');
    } on UserMessage catch (e) {
      expect(e.message, isNot(contains(dummy)));
      expect(e.message, contains('không lưu được'));
    }
  });
  test('Key ngắn/khoảng trắng không ghi đè key cũ', () async {
    values['gemini.key'] = dummy;
    for (final key in ['abc', '$dummy bad']) {
      await expectLater(
        GeminiService().saveKey(key),
        throwsA(isA<UserMessage>()),
      );
    }
    expect(values['gemini.key'], dummy);
  });
  test('Đã lưu không có nghĩa Google chấp nhận key', () async {
    await GeminiService().saveKey(dummy);
    final service = GeminiService(
      client: MockClient((_) async => http.Response('{}', 403)),
    );
    expect(await service.hasKey(), isTrue);
    await expectLater(service.models(), throwsA(isA<UserMessage>()));
    expect(await service.hasKey(), isTrue);
  });
}
