enum TaskCategory {
  personal('Cá nhân'),
  study('Học tập'),
  work('Công việc'),
  other('Khác');

  const TaskCategory(this.label);
  final String label;
}

enum TaskPriority {
  low('Thấp'),
  medium('Trung bình'),
  high('Cao');

  const TaskPriority(this.label);
  final String label;
}

DateTime dateOnly(DateTime date) => DateTime(date.year, date.month, date.day);

bool sameDay(DateTime a, DateTime b) => dateOnly(a) == dateOnly(b);

String localDateKey(DateTime date) =>
    '${date.year.toString().padLeft(4, '0')}-${date.month.toString().padLeft(2, '0')}-${date.day.toString().padLeft(2, '0')}';

String displayDate(DateTime date) =>
    '${date.day.toString().padLeft(2, '0')}/${date.month.toString().padLeft(2, '0')}/${date.year}';

String displayTime(int minutes) =>
    '${(minutes ~/ 60).toString().padLeft(2, '0')}:${(minutes % 60).toString().padLeft(2, '0')}';

class Task {
  Task({
    this.id,
    required this.title,
    this.notes = '',
    required DateTime dueDate,
    this.dueMinutes,
    this.category = TaskCategory.personal,
    this.priority = TaskPriority.medium,
    this.completed = false,
    this.reminder = false,
    this.alarm = false,
  }) : dueDate = dateOnly(dueDate);

  final int? id;
  final String title;
  final String notes;
  final DateTime dueDate;
  final int? dueMinutes;
  final TaskCategory category;
  final TaskPriority priority;
  final bool completed;
  final bool reminder;
  final bool alarm;

  DateTime? get dueAt => dueMinutes == null
      ? null
      : DateTime(
          dueDate.year,
          dueDate.month,
          dueDate.day,
          dueMinutes! ~/ 60,
          dueMinutes! % 60,
        );

  bool isOverdue(DateTime now) {
    if (completed) {
      return false;
    }
    return dueAt?.isBefore(now) ?? dueDate.isBefore(dateOnly(now));
  }

  Task withCompleted(bool value) => Task(
    id: id,
    title: title,
    notes: notes,
    dueDate: dueDate,
    dueMinutes: dueMinutes,
    category: category,
    priority: priority,
    completed: value,
    reminder: reminder,
    alarm: alarm,
  );

  Map<String, Object?> toMap() => {
    if (id != null) 'id': id,
    'title': title.trim(),
    'notes': notes,
    'due_date': localDateKey(dueDate),
    'due_minutes': dueMinutes,
    'category': category.name,
    'priority': priority.name,
    'completed': completed ? 1 : 0,
    'reminder': reminder && dueMinutes != null ? 1 : 0,
    'alarm': alarm && reminder && dueMinutes != null ? 1 : 0,
  };

  factory Task.fromMap(Map<String, Object?> map) => Task(
    id: map['id'] as int,
    title: map['title'] as String,
    notes: map['notes'] as String,
    dueDate: DateTime.parse(map['due_date'] as String),
    dueMinutes: map['due_minutes'] as int?,
    category: TaskCategory.values.byName(map['category'] as String),
    priority: TaskPriority.values.byName(map['priority'] as String),
    completed: map['completed'] == 1,
    reminder: map['reminder'] == 1,
    alarm: map['alarm'] == 1,
  );
}

String? validateTitle(String? value) {
  final title = value?.trim() ?? '';
  if (title.isEmpty) {
    return 'Vui lòng nhập tiêu đề công việc.';
  }
  if (title.runes.length > 100) {
    return 'Tiêu đề không được quá 100 ký tự.';
  }
  return null;
}
