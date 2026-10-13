import 'package:flutter/material.dart';

import '../app/app_controller.dart';
import '../app/weather_controller.dart';
import '../models/task.dart';
import '../widgets/task_list.dart';
import 'calendar_view.dart';
import 'utility_view.dart';
import 'weather/weather_screen.dart';
import 'holidays/holidays_screen.dart';
import 'planner/planner_screen.dart';
import 'task_editor.dart';
import 'tasks_view.dart';
import 'today_view.dart';

class HomeScreen extends StatefulWidget {
  const HomeScreen({super.key, required this.controller, this.weather});
  final AppController controller;
  final WeatherController? weather;

  @override
  State<HomeScreen> createState() => _HomeScreenState();
}

class _HomeScreenState extends State<HomeScreen> {
  int _index = 0;
  DateTime _selectedDate = dateOnly(DateTime.now());
  static const _titles = [
    'Hôm nay',
    'Lịch',
    'Công việc',
    'Thời tiết',
    'Tiện ích',
  ];

  void _edit(Task task) => _openEditor(task: task);

  void _openEditor({Task? task, DateTime? date}) {
    Navigator.of(context).push(
      MaterialPageRoute<void>(
        builder: (_) => TaskEditor(
          controller: widget.controller,
          task: task,
          initialDate: date,
        ),
      ),
    );
  }

  Future<void> _toggle(Task task) async {
    try {
      await widget.controller.toggle(task);
    } catch (_) {
      if (mounted) {
        showError(context);
      }
    }
  }

  @override
  Widget build(BuildContext context) {
    final controller = widget.controller;
    return Scaffold(
      appBar: AppBar(
        title: Text(_titles[_index]),
        actions: [
          if (_index == 0)
            const Padding(
              padding: EdgeInsets.only(right: 20),
              child: Center(child: Text('Lịch Nhắc')),
            ),
        ],
      ),
      body: SafeArea(
        child: controller.loading
            ? const Center(
                child: CircularProgressIndicator(
                  semanticsLabel: 'Đang tải dữ liệu',
                ),
              )
            : controller.error != null
            ? Center(
                child: SingleChildScrollView(
                  child: Column(
                    mainAxisSize: MainAxisSize.min,
                    children: [
                      EmptyState(
                        title: 'Chưa thể mở dữ liệu',
                        message: controller.error!,
                      ),
                      FilledButton(
                        onPressed: controller.initialize,
                        child: const Text('Thử lại'),
                      ),
                    ],
                  ),
                ),
              )
            : Column(
                children: [
                  if (controller.notice != null)
                    Material(
                      color: Theme.of(context).colorScheme.secondaryContainer,
                      child: Padding(
                        padding: const EdgeInsets.fromLTRB(16, 8, 4, 8),
                        child: Row(
                          children: [
                            Expanded(child: Text(controller.notice!)),
                            IconButton(
                              tooltip: 'Đóng thông báo',
                              onPressed: controller.dismissNotice,
                              icon: const Icon(Icons.close),
                            ),
                          ],
                        ),
                      ),
                    ),
                  if (controller.busy) const LinearProgressIndicator(),
                  Expanded(
                    child: IndexedStack(
                      index: _index,
                      children: [
                        TodayView(
                          controller: controller,
                          onEdit: _edit,
                          onToggle: _toggle,
                          onWeather: () => setState(() => _index = 3),
                          onHolidays: () => Navigator.push(
                            context,
                            MaterialPageRoute<void>(
                              builder: (_) => HolidaysScreen(
                                repository: controller.repository,
                              ),
                            ),
                          ),
                          onPlanner: () => Navigator.push(
                            context,
                            MaterialPageRoute<void>(
                              builder: (_) =>
                                  PlannerScreen(controller: controller),
                            ),
                          ),
                        ),
                        CalendarView(
                          controller: controller,
                          onEdit: _edit,
                          onToggle: _toggle,
                          onDateChanged: (day) => _selectedDate = day,
                          onAdd: (day) => _openEditor(date: day),
                        ),
                        TasksView(
                          controller: controller,
                          onEdit: _edit,
                          onToggle: _toggle,
                        ),
                        widget.weather == null
                            ? const EmptyState(
                                title: 'Thời tiết',
                                message: 'Chọn vị trí để xem dự báo.',
                              )
                            : WeatherScreen(controller: widget.weather!),
                        UtilityView(controller: controller),
                      ],
                    ),
                  ),
                ],
              ),
      ),
      floatingActionButton:
          _index >= 3 || controller.loading || controller.error != null
          ? null
          : FloatingActionButton(
              tooltip: 'Thêm công việc',
              onPressed: controller.busy
                  ? null
                  : () => _openEditor(
                      date: _index == 1
                          ? _selectedDate
                          : dateOnly(DateTime.now()),
                    ),
              child: const Icon(Icons.add),
            ),
      bottomNavigationBar: NavigationBar(
        selectedIndex: _index,
        onDestinationSelected: (index) => setState(() => _index = index),
        destinations: const [
          NavigationDestination(
            icon: Icon(Icons.today_outlined),
            selectedIcon: Icon(Icons.today),
            label: 'Hôm nay',
          ),
          NavigationDestination(
            icon: Icon(Icons.calendar_month_outlined),
            selectedIcon: Icon(Icons.calendar_month),
            label: 'Lịch',
          ),
          NavigationDestination(
            icon: Icon(Icons.checklist_outlined),
            selectedIcon: Icon(Icons.checklist),
            label: 'Việc',
          ),
          NavigationDestination(
            icon: Icon(Icons.cloud_outlined),
            selectedIcon: Icon(Icons.cloud),
            label: 'Thời tiết',
          ),
          NavigationDestination(
            icon: Icon(Icons.widgets_outlined),
            selectedIcon: Icon(Icons.widgets),
            label: 'Tiện ích',
          ),
        ],
      ),
    );
  }
}
