import 'package:flutter/material.dart';

import '../app/app_controller.dart';
import '../models/task.dart';
import '../models/task_query.dart';
import '../widgets/task_list.dart';
import '../widgets/depth_card.dart';
import '../models/holiday.dart';
import '../models/vietnamese_calendar.dart';

class TodayView extends StatelessWidget {
  const TodayView({
    super.key,
    required this.controller,
    required this.onEdit,
    required this.onToggle,
    this.onWeather,
    this.onHolidays,
    this.onPlanner,
  });
  final AppController controller;
  final ValueChanged<Task> onEdit;
  final ValueChanged<Task> onToggle;
  final VoidCallback? onWeather, onHolidays, onPlanner;

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
          padding: const EdgeInsets.fromLTRB(16, 16, 16, 8),
          child: DepthCard(
            hero: true,
            child: Column(
              crossAxisAlignment: CrossAxisAlignment.start,
              children: [
                const Text(
                  'LỊCH NHẮC',
                  style: TextStyle(
                    letterSpacing: 3,
                    fontWeight: FontWeight.w500,
                  ),
                ),
                const SizedBox(height: 12),
                const Text(
                  'Một ngày có kế hoạch',
                  style: TextStyle(fontSize: 26, fontWeight: FontWeight.w600),
                ),
                const SizedBox(height: 12),
                Text('Hôm nay, ${displayDate(now)}'),
                if (now.year >= 1900 && now.year <= 2100)
                  Text(solarToLunar(now).label),
                ...holidaysOn(now).map((h) => Text('✦ ${h.title}')),
              ],
            ),
          ),
        ),
        Padding(
          padding: const EdgeInsets.symmetric(horizontal: 16, vertical: 8),
          child: Wrap(
            spacing: 8,
            runSpacing: 8,
            children: [
              ActionChip(
                avatar: const Icon(Icons.cloud_outlined, size: 18),
                label: const Text('Thời tiết'),
                onPressed: onWeather,
              ),
              ActionChip(
                avatar: const Icon(Icons.celebration_outlined, size: 18),
                label: const Text('Lịch lễ'),
                onPressed: onHolidays,
              ),
              ActionChip(
                avatar: const Icon(Icons.auto_awesome, size: 18),
                label: const Text('Gemini'),
                onPressed: onPlanner,
              ),
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
