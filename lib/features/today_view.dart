import 'package:flutter/material.dart';

import '../app/app_controller.dart';
import '../models/task.dart';
import '../models/task_query.dart';
import '../widgets/task_list.dart';

class TodayView extends StatelessWidget {
  const TodayView({
    super.key,
    required this.controller,
    required this.onEdit,
    required this.onToggle,
  });
  final AppController controller;
  final ValueChanged<Task> onEdit;
  final ValueChanged<Task> onToggle;

  @override
  Widget build(BuildContext context) {
    final now = DateTime.now();
    final today = queryTasks(controller.tasks, now: now, date: now);
    final pending = controller.tasks.where((t) => !t.completed).length;
    final completed = controller.tasks.where((t) => t.completed).length;
    final overdue = controller.tasks.where((t) => t.isOverdue(now)).length;
    return ListView(
      padding: const EdgeInsets.only(bottom: 100),
      children: [
        Padding(
          padding: const EdgeInsets.fromLTRB(20, 16, 20, 8),
          child: Column(
            crossAxisAlignment: CrossAxisAlignment.start,
            children: [
              Text(
                'Một ngày có kế hoạch',
                style: Theme.of(context).textTheme.headlineSmall,
              ),
              const SizedBox(height: 8),
              Text('Hôm nay, ${displayDate(now)}'),
            ],
          ),
        ),
        Padding(
          padding: const EdgeInsets.all(16),
          child: Wrap(
            spacing: 8,
            runSpacing: 8,
            children: [
              _stat(
                context,
                'Chưa xong',
                pending,
                Icons.radio_button_unchecked,
              ),
              _stat(context, 'Đã xong', completed, Icons.check_circle_outline),
              _stat(context, 'Quá hạn', overdue, Icons.warning_amber_outlined),
            ],
          ),
        ),
        Padding(
          padding: const EdgeInsets.fromLTRB(20, 0, 20, 12),
          child: Text(
            'Đến hạn hôm nay (${today.length})',
            style: Theme.of(context).textTheme.titleMedium,
          ),
        ),
        TaskList(
          tasks: today,
          onEdit: onEdit,
          onToggle: onToggle,
          busy: controller.busy,
          emptyTitle: 'Hôm nay chưa có công việc',
          emptyMessage:
              'Bạn có thể nghỉ ngơi hoặc thêm một kế hoạch mới bằng nút +.',
        ),
      ],
    );
  }

  Widget _stat(BuildContext context, String label, int count, IconData icon) =>
      Container(
        padding: const EdgeInsets.symmetric(horizontal: 14, vertical: 12),
        decoration: BoxDecoration(
          color: Theme.of(context).colorScheme.surfaceContainer,
          borderRadius: BorderRadius.circular(16),
        ),
        child: Row(
          mainAxisSize: MainAxisSize.min,
          children: [
            Icon(icon, size: 20),
            const SizedBox(width: 8),
            Text('$count $label'),
          ],
        ),
      );
}
