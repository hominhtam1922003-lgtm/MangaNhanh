import 'dart:async';
import 'package:flutter/material.dart';

import '../app/app_controller.dart';
import '../models/task.dart';
import '../models/task_query.dart';
import '../widgets/task_list.dart';

class TasksView extends StatefulWidget {
  const TasksView({
    super.key,
    required this.controller,
    required this.onEdit,
    required this.onToggle,
  });
  final AppController controller;
  final ValueChanged<Task> onEdit;
  final ValueChanged<Task> onToggle;

  @override
  State<TasksView> createState() => _TasksViewState();
}

class _TasksViewState extends State<TasksView> {
  Timer? _debounce;
  @override
  void dispose() {
    _debounce?.cancel();
    super.dispose();
  }

  String _search = '';
  TaskFilter _filter = TaskFilter.all;
  TaskCategory? _category;
  TaskSort _sort = TaskSort.deadline;

  @override
  Widget build(BuildContext context) {
    final tasks = queryTasks(
      widget.controller.tasks,
      now: DateTime.now(),
      search: _search,
      filter: _filter,
      category: _category,
      sort: _sort,
    );
    return CustomScrollView(
      slivers: [
        SliverToBoxAdapter(
          child: Padding(
            padding: const EdgeInsets.all(16),
            child: Column(
              crossAxisAlignment: CrossAxisAlignment.start,
              children: [
                TextField(
                  decoration: const InputDecoration(
                    labelText: 'Tìm theo tiêu đề',
                    prefixIcon: Icon(Icons.search),
                  ),
                  onChanged: (value) {
                    _debounce?.cancel();
                    _debounce = Timer(const Duration(milliseconds: 180), () {
                      if (mounted) {
                        setState(() => _search = value);
                      }
                    });
                  },
                ),
                const SizedBox(height: 12),
                Wrap(
                  spacing: 8,
                  runSpacing: 4,
                  children: TaskFilter.values
                      .map(
                        (value) => ChoiceChip(
                          label: Text(value.label),
                          selected: value == _filter,
                          onSelected: (_) => setState(() => _filter = value),
                        ),
                      )
                      .toList(),
                ),
                const SizedBox(height: 16),
                DropdownButtonFormField<String>(
                  initialValue: _category?.name ?? 'all',
                  isExpanded: true,
                  decoration: const InputDecoration(labelText: 'Danh mục'),
                  items: [
                    const DropdownMenuItem(
                      value: 'all',
                      child: Text('Tất cả danh mục'),
                    ),
                    ...TaskCategory.values.map(
                      (value) => DropdownMenuItem(
                        value: value.name,
                        child: Text(value.label),
                      ),
                    ),
                  ],
                  onChanged: (value) => setState(
                    () => _category = value == 'all'
                        ? null
                        : TaskCategory.values.byName(value!),
                  ),
                ),
                const SizedBox(height: 12),
                DropdownButtonFormField<TaskSort>(
                  initialValue: _sort,
                  isExpanded: true,
                  decoration: const InputDecoration(labelText: 'Sắp xếp'),
                  items: TaskSort.values
                      .map(
                        (value) => DropdownMenuItem(
                          value: value,
                          child: Text(value.label),
                        ),
                      )
                      .toList(),
                  onChanged: (value) => setState(() => _sort = value!),
                ),
                const SizedBox(height: 16),
                Text(
                  '${tasks.length} công việc',
                  style: Theme.of(context).textTheme.titleMedium,
                ),
              ],
            ),
          ),
        ),
        if (tasks.isEmpty)
          SliverToBoxAdapter(
            child: EmptyState(
              title: widget.controller.tasks.isEmpty
                  ? 'Bắt đầu từ một việc nhỏ'
                  : 'Không có kết quả',
              message: widget.controller.tasks.isEmpty
                  ? 'Thêm công việc đầu tiên bằng nút +.'
                  : 'Thử từ khóa khác hoặc thay đổi bộ lọc.',
            ),
          ),
        SliverList(
          delegate: SliverChildBuilderDelegate(
            (context, index) => TaskCard(
              key: ValueKey(tasks[index].id),
              task: tasks[index],
              onEdit: widget.onEdit,
              onToggle: widget.onToggle,
              busy: widget.controller.busy,
            ),
            childCount: tasks.length,
          ),
        ),
        const SliverToBoxAdapter(child: SizedBox(height: 100)),
      ],
    );
  }
}
