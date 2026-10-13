import 'package:flutter/material.dart';

import '../models/task.dart';

class EmptyState extends StatelessWidget {
  const EmptyState({super.key, required this.title, required this.message});
  final String title;
  final String message;

  @override
  Widget build(BuildContext context) => Padding(
    padding: const EdgeInsets.symmetric(horizontal: 24, vertical: 32),
    child: Column(
      mainAxisSize: MainAxisSize.min,
      children: [
        Icon(
          Icons.event_available_outlined,
          size: 48,
          color: Theme.of(context).colorScheme.primary,
        ),
        const SizedBox(height: 16),
        Text(
          title,
          textAlign: TextAlign.center,
          style: Theme.of(context).textTheme.titleMedium,
        ),
        const SizedBox(height: 8),
        Text(message, textAlign: TextAlign.center),
      ],
    ),
  );
}

class TaskList extends StatelessWidget {
  const TaskList({
    super.key,
    required this.tasks,
    required this.onEdit,
    required this.onToggle,
    this.busy = false,
    this.emptyTitle = 'Chưa có công việc',
    this.emptyMessage = 'Chạm nút + để thêm kế hoạch đầu tiên của bạn.',
  });
  final List<Task> tasks;
  final ValueChanged<Task> onEdit;
  final ValueChanged<Task> onToggle;
  final bool busy;
  final String emptyTitle;
  final String emptyMessage;

  @override
  Widget build(BuildContext context) {
    if (tasks.isEmpty) {
      return EmptyState(title: emptyTitle, message: emptyMessage);
    }
    final colors = Theme.of(context).colorScheme;
    return Column(
      children: tasks.map((task) {
        final overdue = task.isOverdue(DateTime.now());
        return Card(
          margin: const EdgeInsets.symmetric(horizontal: 16, vertical: 4),
          child: ListTile(
            contentPadding: const EdgeInsets.fromLTRB(4, 8, 12, 8),
            leading: Semantics(
              label:
                  '${task.completed ? 'Đánh dấu chưa xong' : 'Hoàn thành'}: ${task.title}',
              child: Checkbox(
                value: task.completed,
                onChanged: busy ? null : (_) => onToggle(task),
              ),
            ),
            title: Text(
              task.title,
              style: TextStyle(
                decoration: task.completed ? TextDecoration.lineThrough : null,
              ),
            ),
            subtitle: Padding(
              padding: const EdgeInsets.only(top: 6),
              child: Column(
                crossAxisAlignment: CrossAxisAlignment.start,
                children: [
                  Text(
                    '${displayDate(task.dueDate)} • '
                    '${task.dueMinutes == null ? 'Cả ngày' : displayTime(task.dueMinutes!)}',
                    style: TextStyle(color: overdue ? colors.error : null),
                  ),
                  const SizedBox(height: 4),
                  Wrap(
                    spacing: 8,
                    runSpacing: 4,
                    children: [
                      Text(task.category.label),
                      Text(
                        'Ưu tiên ${task.priority.label.toLowerCase()}',
                        style: TextStyle(
                          fontWeight: task.priority == TaskPriority.high
                              ? FontWeight.bold
                              : FontWeight.normal,
                        ),
                      ),
                      if (overdue)
                        Text('Quá hạn', style: TextStyle(color: colors.error)),
                      if (task.completed) const Text('Đã xong'),
                      if (task.reminder && !task.completed)
                        const Icon(
                          Icons.notifications_active_outlined,
                          size: 16,
                        ),
                    ],
                  ),
                ],
              ),
            ),
            onTap: busy ? null : () => onEdit(task),
          ),
        );
      }).toList(),
    );
  }
}

Future<bool> confirmAction(
  BuildContext context, {
  required String title,
  required String message,
  required String confirmLabel,
}) async =>
    await showDialog<bool>(
      context: context,
      builder: (context) => AlertDialog(
        title: Text(title),
        content: Text(message),
        actions: [
          TextButton(
            onPressed: () => Navigator.pop(context, false),
            child: const Text('Hủy'),
          ),
          FilledButton(
            onPressed: () => Navigator.pop(context, true),
            child: Text(confirmLabel),
          ),
        ],
      ),
    ) ??
    false;

void showError(BuildContext context) {
  ScaffoldMessenger.of(context).showSnackBar(
    const SnackBar(
      content: Text(
        'Không thể lưu thay đổi. Vui lòng thử lại. Dữ liệu cũ được giữ nguyên.',
      ),
    ),
  );
}
