import 'task.dart';

enum TaskFilter {
  all('Tất cả'),
  pending('Chưa xong'),
  completed('Đã xong'),
  overdue('Quá hạn');

  const TaskFilter(this.label);
  final String label;
}

enum TaskSort {
  deadline('Hạn gần nhất'),
  priority('Ưu tiên cao trước');

  const TaskSort(this.label);
  final String label;
}

String searchText(String text) {
  var value = text.toLowerCase();
  const groups = [
    'àáạảãâầấậẩẫăằắặẳẵ',
    'èéẹẻẽêềếệểễ',
    'ìíịỉĩ',
    'òóọỏõôồốộổỗơờớợởỡ',
    'ùúụủũưừứựửữ',
    'ỳýỵỷỹ',
    'đ',
  ];
  const plain = ['a', 'e', 'i', 'o', 'u', 'y', 'd'];
  for (var i = 0; i < groups.length; i++) {
    value = value.replaceAll(RegExp('[${groups[i]}]'), plain[i]);
  }
  return value.replaceAll(RegExp(r'[\u0300-\u036f]'), '');
}

// Không có giờ: xếp cuối ngày, nhưng chỉ quá hạn từ ngày tiếp theo.
int compareDeadline(Task a, Task b) {
  final day = a.dueDate.compareTo(b.dueDate);
  if (day != 0) {
    return day;
  }
  final time = (a.dueMinutes ?? 1440).compareTo(b.dueMinutes ?? 1440);
  if (time != 0) {
    return time;
  }
  final priority = b.priority.index.compareTo(a.priority.index);
  return priority != 0 ? priority : (a.id ?? 0).compareTo(b.id ?? 0);
}

List<Task> queryTasks(
  Iterable<Task> tasks, {
  required DateTime now,
  TaskFilter filter = TaskFilter.all,
  String search = '',
  TaskCategory? category,
  DateTime? date,
  TaskSort sort = TaskSort.deadline,
}) {
  final needle = searchText(search.trim());
  final result = tasks.where((task) {
    if (category != null && task.category != category) {
      return false;
    }
    if (date != null && !sameDay(task.dueDate, date)) {
      return false;
    }
    if (!searchText(task.title).contains(needle)) {
      return false;
    }
    return switch (filter) {
      TaskFilter.all => true,
      TaskFilter.pending => !task.completed,
      TaskFilter.completed => task.completed,
      TaskFilter.overdue => task.isOverdue(now),
    };
  }).toList();
  result.sort((a, b) {
    if (sort == TaskSort.priority) {
      final priority = b.priority.index.compareTo(a.priority.index);
      if (priority != 0) {
        return priority;
      }
    }
    return compareDeadline(a, b);
  });
  return result;
}
