import 'package:flutter/material.dart';
import '../app/app_controller.dart';
import '../models/task.dart';
import '../models/task_query.dart';
import '../models/holiday.dart';
import '../models/vietnamese_calendar.dart';
import '../widgets/task_list.dart';
import '../widgets/page_frame.dart';

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
  final ValueChanged<Task> onEdit, onToggle;
  final ValueChanged<DateTime> onDateChanged, onAdd;
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
    final now = DateTime.now(), scheme = Theme.of(context).colorScheme;
    final first = DateTime(_month.year, _month.month, 2 - _month.weekday);
    final tasks = queryTasks(
      widget.controller.tasks,
      now: now,
      date: _selected,
    );
    final days = <String, int>{};
    for (final t in widget.controller.tasks) {
      final k = localDateKey(t.dueDate);
      days[k] = (days[k] ?? 0) + 1;
    }
    final calendar = Panel(
      padding: const EdgeInsets.all(12),
      child: Column(
        children: [
          Row(
            children: [
              IconButton(
                tooltip: 'Tháng trước',
                onPressed: _month.year == 1900 && _month.month == 1
                    ? null
                    : () => _move(-1),
                icon: const Icon(Icons.chevron_left),
              ),
              Expanded(
                child: Text(
                  'Tháng ${_month.month} · ${_month.year}',
                  textAlign: TextAlign.center,
                  style: Theme.of(
                    context,
                  ).textTheme.titleLarge?.copyWith(fontWeight: FontWeight.w700),
                ),
              ),
              IconButton(
                tooltip: 'Tháng sau',
                onPressed: _month.year == 9999 && _month.month == 12
                    ? null
                    : () => _move(1),
                icon: const Icon(Icons.chevron_right),
              ),
            ],
          ),
          Row(
            mainAxisAlignment: MainAxisAlignment.spaceBetween,
            children: [
              const Flexible(
                child: Text(
                  'Dương lịch · âm lịch UTC+7',
                  style: TextStyle(fontSize: 12),
                ),
              ),
              TextButton(
                onPressed: () => _select(dateOnly(now)),
                child: const Text('Hôm nay'),
              ),
            ],
          ),
          const SizedBox(height: 8),
          Row(
            children: ['T2', 'T3', 'T4', 'T5', 'T6', 'T7', 'CN']
                .asMap()
                .entries
                .map(
                  (e) => Expanded(
                    child: Center(
                      child: Text(
                        e.value,
                        style: TextStyle(
                          fontSize: 12,
                          fontWeight: FontWeight.w600,
                          color: e.key == 6 ? scheme.error : scheme.outline,
                        ),
                      ),
                    ),
                  ),
                )
                .toList(),
          ),
          const SizedBox(height: 8),
          GridView.builder(
            shrinkWrap: true,
            physics: const NeverScrollableScrollPhysics(),
            gridDelegate: SliverGridDelegateWithFixedCrossAxisCount(
              crossAxisCount: 7,
              mainAxisExtent: MediaQuery.textScalerOf(context).scale(66),
              mainAxisSpacing: 4,
              crossAxisSpacing: 3,
            ),
            itemCount: 42,
            itemBuilder: (context, i) {
              final day = DateTime(first.year, first.month, first.day + i);
              final selected = sameDay(day, _selected),
                  today = sameDay(day, now);
              final count = days[localDateKey(day)] ?? 0,
                  holiday = holidaysOn(day).isNotEmpty;
              final lunar = day.year >= 1900 && day.year <= 2100
                  ? solarToLunar(day)
                  : null;
              final color = selected
                  ? scheme.onPrimary
                  : day.month != _month.month
                  ? scheme.outline
                  : day.weekday == 7
                  ? scheme.error
                  : scheme.onSurface;
              return Semantics(
                label:
                    '${displayDate(day)}, ${lunar?.label ?? 'ngoài phạm vi âm lịch'}${count > 0 ? ', $count công việc' : ''}${holiday ? ', ngày lễ' : ''}',
                selected: selected,
                button: true,
                child: Material(
                  color: selected
                      ? scheme.primary
                      : today
                      ? scheme.primaryContainer
                      : scheme.surface,
                  shape: RoundedRectangleBorder(
                    borderRadius: BorderRadius.circular(14),
                    side: today && !selected
                        ? BorderSide(color: scheme.primary)
                        : BorderSide.none,
                  ),
                  child: InkWell(
                    borderRadius: BorderRadius.circular(14),
                    onTap: () => _select(day),
                    child: Column(
                      mainAxisAlignment: MainAxisAlignment.center,
                      children: [
                        Text(
                          '${day.day}',
                          style: TextStyle(
                            fontSize: 16,
                            color: color,
                            fontWeight: FontWeight.w700,
                          ),
                        ),
                        Text(
                          lunar == null
                              ? '—'
                              : lunar.day == 1
                              ? '1/${lunar.month}${lunar.leap ? '*' : ''}'
                              : '${lunar.day}',
                          style: TextStyle(
                            fontSize: 10,
                            color: selected
                                ? scheme.onPrimary.withValues(alpha: .8)
                                : color.withValues(alpha: .65),
                          ),
                        ),
                        const SizedBox(height: 4),
                        Row(
                          mainAxisAlignment: MainAxisAlignment.center,
                          children: [
                            if (count > 0)
                              _dot(
                                selected ? scheme.onPrimary : scheme.primary,
                              ),
                            if (holiday)
                              _dot(
                                selected
                                    ? const Color(0xFFFFDB8D)
                                    : const Color(0xFFDD9C35),
                              ),
                          ],
                        ),
                      ],
                    ),
                  ),
                ),
              );
            },
          ),
          const SizedBox(height: 14),
          Wrap(
            spacing: 16,
            children: [
              Text(
                '● Công việc',
                style: TextStyle(fontSize: 12, color: scheme.primary),
              ),
              const Text(
                '● Ngày lễ',
                style: TextStyle(fontSize: 12, color: Color(0xFFBB842A)),
              ),
              const Text('Số nhỏ: âm lịch', style: TextStyle(fontSize: 12)),
            ],
          ),
        ],
      ),
    );
    final agenda = Column(
      crossAxisAlignment: CrossAxisAlignment.stretch,
      children: [
        SectionTitle(
          displayDate(_selected),
          subtitle: _selected.year >= 1900 && _selected.year <= 2100
              ? solarToLunar(_selected).label
              : 'Âm lịch hỗ trợ 1900–2100',
        ),
        ...holidaysOn(_selected).map(
          (h) => Card(
            child: ListTile(
              leading: const Icon(Icons.celebration_outlined),
              title: Text(h.title),
            ),
          ),
        ),
        OutlinedButton.icon(
          onPressed: () => widget.onAdd(_selected),
          icon: const Icon(Icons.add),
          label: const Text('Thêm cho ngày này'),
        ),
        const SizedBox(height: 12),
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
    return LayoutBuilder(
      builder: (context, box) => SingleChildScrollView(
        padding: const EdgeInsets.fromLTRB(16, 12, 16, 100),
        child: box.maxWidth >= 880
            ? Row(
                crossAxisAlignment: CrossAxisAlignment.start,
                children: [
                  Expanded(flex: 6, child: calendar),
                  const SizedBox(width: 24),
                  Expanded(flex: 4, child: agenda),
                ],
              )
            : Column(children: [calendar, agenda]),
      ),
    );
  }

  Widget _dot(Color c) => Container(
    width: 5,
    height: 5,
    margin: const EdgeInsets.symmetric(horizontal: 2),
    decoration: BoxDecoration(color: c, shape: BoxShape.circle),
  );
}
