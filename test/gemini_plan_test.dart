import 'dart:convert';
import 'package:flutter_test/flutter_test.dart';
import 'package:lich_nhac/data/gemini_service.dart';

void main() {
  Map<String, dynamic> task() => {
    'title': 'Ôn tập',
    'notes': 'Chương 1',
    'date': '2026-10-20',
    'time': '09:30',
    'category': 'study',
    'priority': 'high',
  };
  test('Kế hoạch chỉ là nháp, không tự bật nhắc hoặc hoàn thành', () {
    final result = parsePlan(
      jsonEncode({
        'tasks': [task()],
      }),
    ).single;
    expect(result.id, isNull);
    expect(result.reminder, isFalse);
    expect(result.completed, isFalse);
    expect(result.dueMinutes, 570);
  });
  test('Từ chối ngày không tồn tại và giờ sai', () {
    for (final change in [
      {'date': '2026-02-30'},
      {'time': '25:00'},
      {'date': '20/10/2026'},
    ]) {
      expect(
        () => parsePlan(
          jsonEncode({
            'tasks': [task()..addAll(change)],
          }),
        ),
        throwsFormatException,
      );
    }
  });
  test('Từ chối tiêu đề rỗng, danh mục sai, quá 10 công việc', () {
    expect(
      () => parsePlan(
        jsonEncode({
          'tasks': [task()..['title'] = ' '],
        }),
      ),
      throwsFormatException,
    );
    expect(
      () => parsePlan(
        jsonEncode({
          'tasks': [task()..['category'] = 'unknown'],
        }),
      ),
      throwsA(isA<ArgumentError>()),
    );
    expect(
      () => parsePlan(jsonEncode({'tasks': List.generate(11, (_) => task())})),
      throwsFormatException,
    );
  });
}
