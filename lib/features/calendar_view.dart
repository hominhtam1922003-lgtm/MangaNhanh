import 'package:flutter/material.dart';

import '../app/app_controller.dart';
import '../models/task.dart';
import '../models/task_query.dart';
import '../widgets/task_list.dart';

class CalendarView extends StatefulWidget {
  const CalendarView({
    super.key,
    required this.controller,
    required this.onEdit,
    required this.onToggle,
    required this.onDateChanged,
    required this.onAdd,
  });
  final AppController controller;
  final ValueChanged<Task> onEdit;
  final ValueChanged<Task> onToggle;
  final ValueChanged<DateTime> onDateChanged;
  final ValueChanged<DateTime> onAdd;

  @override
  State<CalendarView> createState() => _CalendarViewState();
}

class _CalendarViewState extends State<CalendarView> {
  DateTime _selected = dateOnly(DateTime.now());
  late DateTime _month = DateTime(_selected.year, _selected.month);

  void _select(DateTime day) {
    setState(() {
      _selected = day;
      _month = DateTime(day.year, day.month);
    });
    widget.onDateChanged(day);
  }

  void _move(int delta) =>
      setState(() => _month = DateTime(_month.year, _month.month + delta));

  @override
  Widget build(BuildContext context) {
    final now = DateTime.now();
    final scheme = Theme.of(context).colorScheme;
    final firstCell = DateTime(_month.year, _month.month, 2 - _month.weekday);
    final tasks = queryTasks(
      widget.controller.tasks,
      now: now,
      date: _selected,
    );
    final taskDays = widget.controller.tasks
        .map((task) => localDateKey(task.dueDate))
        .toSet();
    return ListView(
      padding: const EdgeInsets.only(bottom: 100),
      children: [
        Padding(
          padding: const EdgeInsets.symmetric(horizontal: 12, vertical: 8),
          child: Row(
            children: [
              IconButton(
                tooltip: 'Tháng trước',
                onPressed: _month.year <= 1900 && _month.month == 1
                    ? null
                    : () => _move(-1),
                icon: const Icon(Icons.chevron_left),
              ),
              Expanded(
                child: Text(
                  'Tháng ${_month.month}, ${_month.year}',
                  textAlign: TextAlign.center,
                  style: Theme.of(context).textTheme.titleMedium,
                ),
              ),
              IconButton(
                tooltip: 'Tháng sau',
                onPressed: _month.year >= 9999 && _month.month == 12
                    ? null
                    : () => _move(1),
                icon: const Icon(Icons.chevron_right),
              ),
            ],
          ),
        ),
        Align(
          alignment: Alignment.centerRight,
          child: TextButton.icon(
            onPressed: () => _select(dateOnly(now)),
            icon: const Icon(Icons.today),
            label: const Text('Về hôm nay'),
          ),
        ),
        Padding(
          padding: const EdgeInsets.symmetric(horizontal: 16),
          child: Column(
            children: [
              Row(
                children: ['T2', 'T3', 'T4', 'T5', 'T6', 'T7', 'CN']
                    .map((label) => Expanded(child: Center(child: Text(label))))
                    .toList(),
              ),
              const SizedBox(height: 8),
              GridView.builder(
                shrinkWrap: true,
                physics: const NeverScrollableScrollPhysics(),
                gridDelegate: const SliverGridDelegateWithFixedCrossAxisCount(
                  crossAxisCount: 7,
                  mainAxisSpacing: 4,
                  crossAxisSpacing: 4,
                ),
                itemCount: 42,
                itemBuilder: (context, index) {
                  // DateTime cộng theo ngày lịch, không cộng 24h qua ranh giới DST.
                  final day = DateTime(
                    firstCell.year,
                    firstCell.month,
                    firstCell.day + index,
                  );
                  final selected = sameDay(day, _selected);
                  final today = sameDay(day, now);
                  final hasTask = taskDays.contains(localDateKey(day));
                  final color = selected
                      ? scheme.onPrimary
                      : day.month != _month.month
                      ? scheme.outline
                      : scheme.onSurface;
                  return Semantics(
                    label:
                        '${displayDate(day)}${hasTask ? ', có công việc' : ''}',
                    selected: selected,
                    button: true,
                    child: Material(
                      color: selected
                          ? scheme.primary
                          : scheme.surfaceContainerLow,
                      shape: RoundedRectangleBorder(
                        borderRadius: BorderRadius.circular(12),
                        side: today
                            ? BorderSide(color: scheme.primary, width: 2)
                            : BorderSide.none,
                      ),
                      child: InkWell(
                        borderRadius: BorderRadius.circular(12),
                        onTap: day.year < 1900 || day.year > 9999
                            ? null
                            : () => _select(day),
                        child: Column(
                          mainAxisAlignment: MainAxisAlignment.center,
                          children: [
                            Flexible(
                              child: FittedBox(
                                child: Text(
                                  '${day.day}',
                                  style: TextStyle(color: color),
                                ),
                              ),
                            ),
                            const SizedBox(height: 3),
                            Container(
                              width: 5,
                              height: 5,
                              decoration: BoxDecoration(
                                shape: BoxShape.circle,
                                color: hasTask ? color : Colors.transparent,
                              ),
                            ),
                          ],
                        ),
                      ),
                    ),
                  );
                },
              ),
              const SizedBox(height: 10),
              const Text(
                '• Ngày có công việc hoặc deadline',
                textAlign: TextAlign.center,
              ),
            ],
          ),
        ),
        Padding(
          padding: const EdgeInsets.fromLTRB(20, 20, 20, 8),
          child: Text(
            'Ngày ${displayDate(_selected)} • ${tasks.length} công việc',
            style: Theme.of(context).textTheme.titleMedium,
          ),
        ),
        Padding(
          padding: const EdgeInsets.symmetric(horizontal: 16, vertical: 8),
          child: OutlinedButton.icon(
            onPressed: widget.controller.busy
                ? null
                : () => widget.onAdd(_selected),
            icon: const Icon(Icons.add),
            label: const Text('Thêm cho ngày này'),
          ),
        ),
        TaskList(
          tasks: tasks,
          onEdit: widget.onEdit,
          onToggle: widget.onToggle,
          busy: widget.controller.busy,
          emptyTitle: 'Ngày này chưa có kế hoạch',
          emptyMessage: 'Chọn “Thêm cho ngày này” để lên lịch công việc.',
        ),
      ],
    );
  }
}
