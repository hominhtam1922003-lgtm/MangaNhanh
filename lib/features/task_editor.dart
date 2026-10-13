import 'package:flutter/material.dart';

import '../app/app_controller.dart';
import '../models/task.dart';
import '../widgets/task_list.dart';

class TaskEditor extends StatefulWidget {
  const TaskEditor({
    super.key,
    required this.controller,
    this.task,
    this.initialDate,
    this.onDraftSaved,
  });
  final AppController controller;
  final Task? task;
  final DateTime? initialDate;
  final ValueChanged<Task>? onDraftSaved;

  @override
  State<TaskEditor> createState() => _TaskEditorState();
}

class _TaskEditorState extends State<TaskEditor> {
  final _form = GlobalKey<FormState>();
  final _titleFocus = FocusNode();
  late final TextEditingController _title;
  late final TextEditingController _notes;
  late DateTime _date;
  int? _minutes;
  late TaskCategory _category;
  late TaskPriority _priority;
  late bool _completed;
  late bool _reminder;
  bool _saving = false;

  @override
  void initState() {
    super.initState();
    final task = widget.task;
    _title = TextEditingController(text: task?.title ?? '');
    _notes = TextEditingController(text: task?.notes ?? '');
    _date = task?.dueDate ?? dateOnly(widget.initialDate ?? DateTime.now());
    _minutes = task?.dueMinutes;
    _category = task?.category ?? TaskCategory.personal;
    _priority = task?.priority ?? TaskPriority.medium;
    _completed = task?.completed ?? false;
    _reminder = task?.reminder ?? false;
  }

  @override
  void dispose() {
    _titleFocus.dispose();
    _title.dispose();
    _notes.dispose();
    super.dispose();
  }

  Future<void> _pickDate() async {
    final date = await showDatePicker(
      context: context,
      initialDate: _date,
      firstDate: DateTime(1900),
      lastDate: DateTime(9999, 12, 31),
      helpText: 'Chọn ngày đến hạn',
    );
    if (date != null && mounted) {
      setState(() => _date = date);
    }
  }

  Future<void> _pickTime() async {
    final time = await showTimePicker(
      context: context,
      initialTime: _minutes == null
          ? TimeOfDay.now()
          : TimeOfDay(hour: _minutes! ~/ 60, minute: _minutes! % 60),
      helpText: 'Chọn giờ đến hạn',
      builder: (context, child) => MediaQuery(
        data: MediaQuery.of(context).copyWith(alwaysUse24HourFormat: true),
        child: child!,
      ),
    );
    if (time != null && mounted) {
      setState(() => _minutes = time.hour * 60 + time.minute);
    }
  }

  Future<void> _save() async {
    if (!_form.currentState!.validate()) {
      _titleFocus.requestFocus();
      return;
    }
    setState(() => _saving = true);
    try {
      final task = Task(
        id: widget.task?.id,
        title: _title.text.trim(),
        notes: _notes.text.trim(),
        dueDate: _date,
        dueMinutes: _minutes,
        category: _category,
        priority: _priority,
        completed: _completed,
        reminder: widget.onDraftSaved == null && _reminder && _minutes != null,
      );
      if (widget.onDraftSaved != null) {
        widget.onDraftSaved!(task);
      } else {
        await widget.controller.save(task);
      }
      if (mounted) {
        Navigator.pop(context);
      }
    } catch (_) {
      if (mounted) {
        showError(context);
      }
    } finally {
      if (mounted) {
        setState(() => _saving = false);
      }
    }
  }

  Future<void> _delete() async {
    final confirmed = await confirmAction(
      context,
      title: 'Xóa công việc?',
      message:
          '“${widget.task!.title}” sẽ bị xóa khỏi thiết bị và hủy thông báo nhắc.',
      confirmLabel: 'Xóa',
    );
    if (!confirmed || !mounted) {
      return;
    }
    setState(() => _saving = true);
    try {
      await widget.controller.delete(widget.task!);
      if (mounted) {
        Navigator.pop(context);
      }
    } catch (_) {
      if (mounted) {
        showError(context);
      }
    } finally {
      if (mounted) {
        setState(() => _saving = false);
      }
    }
  }

  @override
  Widget build(BuildContext context) => PopScope(
    canPop: !_saving,
    child: Scaffold(
      appBar: AppBar(
        title: Text(widget.task == null ? 'Thêm công việc' : 'Sửa công việc'),
        actions: [
          if (widget.task?.id != null)
            IconButton(
              tooltip: 'Xóa công việc',
              onPressed: _saving ? null : _delete,
              icon: const Icon(Icons.delete_outline),
            ),
        ],
      ),
      body: SafeArea(
        child: AbsorbPointer(
          absorbing: _saving,
          child: Form(
            key: _form,
            child: SingleChildScrollView(
              padding: const EdgeInsets.all(16),
              child: Column(
                crossAxisAlignment: CrossAxisAlignment.stretch,
                children: [
                  TextFormField(
                    controller: _title,
                    focusNode: _titleFocus,
                    maxLength: 100,
                    validator: validateTitle,
                    textCapitalization: TextCapitalization.sentences,
                    decoration: const InputDecoration(
                      labelText: 'Tiêu đề *',
                      hintText: 'Bạn cần làm gì?',
                    ),
                  ),
                  const SizedBox(height: 12),
                  TextFormField(
                    controller: _notes,
                    minLines: 3,
                    maxLines: 6,
                    decoration: const InputDecoration(
                      labelText: 'Ghi chú (không bắt buộc)',
                    ),
                  ),
                  const SizedBox(height: 16),
                  ListTile(
                    contentPadding: EdgeInsets.zero,
                    leading: const Icon(Icons.calendar_today_outlined),
                    title: const Text('Ngày đến hạn *'),
                    subtitle: Text(displayDate(_date)),
                    trailing: const Icon(Icons.edit_outlined),
                    onTap: _pickDate,
                  ),
                  ListTile(
                    contentPadding: EdgeInsets.zero,
                    leading: const Icon(Icons.schedule),
                    title: const Text('Giờ đến hạn'),
                    subtitle: Text(
                      _minutes == null
                          ? 'Không có giờ • cả ngày'
                          : displayTime(_minutes!),
                    ),
                    onTap: _pickTime,
                    trailing: _minutes == null
                        ? const Icon(Icons.add)
                        : IconButton(
                            tooltip: 'Bỏ giờ đến hạn',
                            icon: const Icon(Icons.close),
                            onPressed: () => setState(() {
                              _minutes = null;
                              _reminder = false;
                            }),
                          ),
                  ),
                  const SizedBox(height: 16),
                  DropdownButtonFormField<TaskCategory>(
                    initialValue: _category,
                    isExpanded: true,
                    decoration: const InputDecoration(labelText: 'Danh mục'),
                    items: TaskCategory.values
                        .map(
                          (value) => DropdownMenuItem(
                            value: value,
                            child: Text(value.label),
                          ),
                        )
                        .toList(),
                    onChanged: (value) => setState(() => _category = value!),
                  ),
                  const SizedBox(height: 16),
                  DropdownButtonFormField<TaskPriority>(
                    initialValue: _priority,
                    isExpanded: true,
                    decoration: const InputDecoration(labelText: 'Mức ưu tiên'),
                    items: TaskPriority.values
                        .map(
                          (value) => DropdownMenuItem(
                            value: value,
                            child: Text(value.label),
                          ),
                        )
                        .toList(),
                    onChanged: (value) => setState(() => _priority = value!),
                  ),
                  const SizedBox(height: 12),
                  SwitchListTile(
                    contentPadding: EdgeInsets.zero,
                    title: const Text('Đã hoàn thành'),
                    value: _completed,
                    onChanged: (value) => setState(() => _completed = value),
                  ),
                  SwitchListTile(
                    contentPadding: EdgeInsets.zero,
                    title: const Text('Nhắc bằng thông báo'),
                    subtitle: Text(
                      _minutes == null
                          ? 'Chọn giờ đến hạn để bật nhắc việc.'
                          : 'Nhắc tại giờ đến hạn. Android có thể gửi trễ để tiết kiệm pin.',
                    ),
                    value: _reminder && _minutes != null,
                    onChanged: _minutes == null
                        ? null
                        : (value) => setState(() => _reminder = value),
                  ),
                  if (_reminder &&
                      _minutes != null &&
                      !DateTime(
                        _date.year,
                        _date.month,
                        _date.day,
                        _minutes! ~/ 60,
                        _minutes! % 60,
                      ).isAfter(DateTime.now()))
                    const Padding(
                      padding: EdgeInsets.symmetric(vertical: 8),
                      child: Text(
                        'Thời điểm này đã qua. Công việc vẫn được lưu nhưng không có thông báo mới.',
                      ),
                    ),
                  const SizedBox(height: 20),
                  FilledButton.icon(
                    onPressed: _saving ? null : _save,
                    icon: _saving
                        ? const SizedBox(
                            width: 18,
                            height: 18,
                            child: CircularProgressIndicator(strokeWidth: 2),
                          )
                        : const Icon(Icons.check),
                    label: Text(
                      _saving
                          ? 'Đang lưu…'
                          : widget.onDraftSaved == null
                          ? 'Lưu công việc'
                          : 'Lưu bản nháp',
                    ),
                  ),
                  const SizedBox(height: 24),
                ],
              ),
            ),
          ),
        ),
      ),
    ),
  );
}
