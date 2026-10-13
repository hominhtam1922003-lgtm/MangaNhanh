import 'package:flutter_test/flutter_test.dart';
import 'package:lich_nhac/models/task.dart';
import 'package:lich_nhac/models/task_query.dart';

void main() {
  final now = DateTime(2026, 10, 13, 12);
  final tasks = [
    Task(
      id: 1,
      title: 'Học Flutter',
      dueDate: DateTime(2026, 10, 13),
      dueMinutes: 900,
      category: TaskCategory.study,
      priority: TaskPriority.high,
    ),
    Task(
      id: 2,
      title: 'Gửi báo cáo',
      dueDate: DateTime(2026, 10, 12),
      category: TaskCategory.work,
    ),
    Task(
      id: 3,
      title: 'Mua sách',
      dueDate: DateTime(2026, 10, 13),
      completed: true,
      priority: TaskPriority.low,
    ),
    Task(
      id: 4,
      title: 'Học bài',
      dueDate: DateTime(2026, 10, 13),
      dueMinutes: 600,
      category: TaskCategory.study,
    ),
    Task(id: 5, title: 'Cả ngày', dueDate: DateTime(2026, 10, 13)),
  ];
  List<int?> ids(List<Task> result) => result.map((t) => t.id).toList();

  test('Tất cả sắp xếp theo ngày, giờ; cả ngày xếp cuối', () {
    expect(ids(queryTasks(tasks, now: now)), [2, 4, 1, 5, 3]);
  });
  test('Lọc chưa xong', () {
    expect(ids(queryTasks(tasks, now: now, filter: TaskFilter.pending)), [
      2,
      4,
      1,
      5,
    ]);
  });
  test('Lọc đã xong', () {
    expect(ids(queryTasks(tasks, now: now, filter: TaskFilter.completed)), [3]);
  });
  test('Lọc quá hạn không lấy cả ngày hôm nay hoặc đã xong', () {
    expect(ids(queryTasks(tasks, now: now, filter: TaskFilter.overdue)), [
      2,
      4,
    ]);
  });
  test('Tìm tiêu đề không phân biệt hoa thường, bỏ khoảng trắng ngoài', () {
    expect(ids(queryTasks(tasks, now: now, search: '  HỌC  ')), [4, 1]);
  });
  test('Kết hợp tìm kiếm, trạng thái, ngày và danh mục', () {
    expect(
      ids(
        queryTasks(
          tasks,
          now: now,
          search: 'học',
          filter: TaskFilter.overdue,
          category: TaskCategory.study,
          date: now,
        ),
      ),
      [4],
    );
  });
  test('Lọc ngày không phụ thuộc phần giờ của ngày được chọn', () {
    expect(ids(queryTasks(tasks, now: now, date: DateTime(2026, 10, 13, 23))), [
      4,
      1,
      5,
      3,
    ]);
  });
  test('Ưu tiên cao trước, cùng ưu tiên xếp theo hạn', () {
    expect(ids(queryTasks(tasks, now: now, sort: TaskSort.priority)), [
      1,
      2,
      4,
      5,
      3,
    ]);
  });
  test('Không sửa thứ tự đầu vào', () {
    queryTasks(tasks, now: now);
    expect(ids(tasks), [1, 2, 3, 4, 5]);
  });
  test('Không có kết quả và danh sách trống', () {
    expect(queryTasks(tasks, now: now, search: 'Không tồn tại'), isEmpty);
    expect(queryTasks([], now: now), isEmpty);
  });
}
