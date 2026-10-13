import 'package:flutter_test/flutter_test.dart';
import 'package:lich_nhac/models/task.dart';

void main() {
  group('Quá hạn theo ngày địa phương', () {
    final date = DateTime(2026, 10, 13);
    test('Không có giờ: chưa quá hạn trong suốt ngày đến hạn', () {
      final task = Task(title: 'Cả ngày', dueDate: date);
      expect(task.isOverdue(DateTime(2026, 10, 13)), isFalse);
      expect(task.isOverdue(DateTime(2026, 10, 13, 23, 59, 59)), isFalse);
    });
    test('Không có giờ: quá hạn từ 00:00 ngày tiếp theo', () {
      final task = Task(title: 'Cả ngày', dueDate: date);
      expect(task.isOverdue(DateTime(2026, 10, 14)), isTrue);
    });
    test('Có giờ: trước hạn, đúng hạn và sau hạn', () {
      final task = Task(title: 'Hẹn', dueDate: date, dueMinutes: 9 * 60 + 30);
      expect(task.isOverdue(DateTime(2026, 10, 13, 9, 29)), isFalse);
      expect(task.isOverdue(DateTime(2026, 10, 13, 9, 30)), isFalse);
      expect(task.isOverdue(DateTime(2026, 10, 13, 9, 30, 1)), isTrue);
    });
    test('Đã hoàn thành không quá hạn', () {
      final task = Task(
        title: 'Xong',
        dueDate: date,
        dueMinutes: 0,
        completed: true,
      );
      expect(task.isOverdue(DateTime(2026, 10, 14)), isFalse);
    });
    test('Ngày tương lai không quá hạn', () {
      expect(
        Task(title: 'Mai', dueDate: DateTime(2026, 10, 14)).isOverdue(date),
        isFalse,
      );
    });
    test('Qua tháng, qua năm và ngày nhuận', () {
      expect(
        Task(
          title: 'Năm cũ',
          dueDate: DateTime(2025, 12, 31),
        ).isOverdue(DateTime(2026, 1, 1)),
        isTrue,
      );
      expect(
        Task(
          title: 'Nhuận',
          dueDate: DateTime(2024, 2, 29),
        ).isOverdue(DateTime(2024, 3, 1)),
        isTrue,
      );
    });
  });

  test('Lưu và đọc ngày/giờ địa phương, danh mục và trạng thái', () {
    final task = Task(
      id: 42,
      title: ' Học Dart ',
      notes: 'Ghi chú',
      dueDate: DateTime(2026, 10, 13, 18),
      dueMinutes: 1215,
      category: TaskCategory.study,
      priority: TaskPriority.high,
      completed: true,
      reminder: true,
    );
    final map = task.toMap();
    expect(map['due_date'], '2026-10-13');
    expect(map['due_minutes'], 1215);
    final restored = Task.fromMap(map);
    expect(restored.title, 'Học Dart');
    expect(restored.dueDate, DateTime(2026, 10, 13));
    expect(restored.dueAt, DateTime(2026, 10, 13, 20, 15));
    expect(restored.category, TaskCategory.study);
    expect(restored.priority, TaskPriority.high);
    expect(restored.completed, isTrue);
    expect(restored.reminder, isTrue);
  });

  test('Không lưu nhắc khi không có giờ', () {
    expect(
      Task(
        title: 'Việc',
        dueDate: DateTime(2026),
        reminder: true,
      ).toMap()['reminder'],
      0,
    );
  });

  test('Đổi trạng thái giữ nguyên dữ liệu nhắc và giờ', () {
    final task = Task(
      id: 7,
      title: 'Việc',
      dueDate: DateTime(2026),
      dueMinutes: 600,
      notes: 'Ghi chú',
      reminder: true,
    );
    final completed = task.withCompleted(true);
    expect(completed.completed, isTrue);
    expect(completed.id, 7);
    expect(completed.dueMinutes, 600);
    expect(completed.reminder, isTrue);
    expect(completed.notes, 'Ghi chú');
  });

  test('Tiêu đề bắt buộc, tối đa 100 ký tự', () {
    expect(validateTitle(null), isNotNull);
    expect(validateTitle('  \n '), isNotNull);
    expect(validateTitle('a' * 100), isNull);
    expect(validateTitle('a' * 101), isNotNull);
    expect(validateTitle(' Học bài '), isNull);
  });
}
