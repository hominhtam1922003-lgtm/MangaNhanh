import 'package:flutter/material.dart';
import '../../app/app_controller.dart';
import '../../data/gemini_service.dart';
import '../../data/weather_api.dart';
import '../../models/task.dart';
import '../../widgets/depth_card.dart';
import '../../widgets/task_list.dart';
import '../task_editor.dart';

class PlannerScreen extends StatefulWidget {
  const PlannerScreen({super.key, required this.controller});
  final AppController controller;
  @override
  State<PlannerScreen> createState() => _PlannerScreenState();
}

class _PlannerScreenState extends State<PlannerScreen> {
  final _service = GeminiService();
  final _key = TextEditingController(), _request = TextEditingController();
  bool _hasKey = false, _busy = true, _includeTasks = false;
  String _model = 'gemini-2.5-flash';
  List<String> _models = ['gemini-2.5-flash'];
  List<Task> _drafts = [];
  final _selected = <int>{};
  String? _message;
  @override
  void initState() {
    super.initState();
    _load();
  }

  @override
  void dispose() {
    _key.dispose();
    _request.dispose();
    super.dispose();
  }

  Future<void> _load() async {
    try {
      final key = await _service.hasKey();
      final model =
          await widget.controller.repository.setting('gemini.model') ?? _model;
      if (mounted)
        setState(() {
          _hasKey = key;
          _model = model;
          _models = [model];
        });
    } catch (_) {
      _message = 'Chưa đọc được cấu hình bảo mật. Hãy thử lại.';
    } finally {
      if (mounted) {
        setState(() => _busy = false);
      }
    }
  }

  Future<void> _action(Future<void> Function() action) async {
    if (_busy) {
      return;
    }
    setState(() {
      _busy = true;
      _message = null;
    });
    try {
      await action();
    } catch (e) {
      if (mounted)
        setState(
          () => _message = e is UserMessage
              ? e.message
              : 'Chưa thực hiện được thao tác. Dữ liệu công việc không bị thay đổi.',
        );
    } finally {
      if (mounted) {
        setState(() => _busy = false);
      }
    }
  }

  Future<void> _saveKey() => _action(() async {
    await _service.saveKey(_key.text);
    _key.clear();
    if (mounted)
      setState(() {
        _hasKey = true;
        _message = 'Đã lưu key trong vùng lưu trữ bảo mật trên thiết bị.';
      });
  });
  Future<void> _modelsLoad() => _action(() async {
    final models = await _service.models();
    if (models.isEmpty)
      throw const UserMessage(
        'Không có mô hình hỗ trợ tạo nội dung cho key này.',
      );
    final selected = models.contains(_model)
        ? _model
        : models.firstWhere(
            (m) => m.contains('flash') && !m.contains('preview'),
            orElse: () => models.first,
          );
    await widget.controller.repository.setSetting('gemini.model', selected);
    if (mounted)
      setState(() {
        _models = models;
        _model = selected;
        _message = 'Đã lấy danh sách mô hình từ Google.';
      });
  });
  Future<void> _generate() => _action(() async {
    final result = await _service.plan(
      _request.text,
      _model,
      contextTasks: _includeTasks
          ? widget.controller.tasks.where((t) => !t.completed).take(30).toList()
          : [],
    );
    if (mounted)
      setState(() {
        _drafts = result;
        _selected.clear();
        _selected.addAll(List.generate(result.length, (i) => i));
      });
  });
  Future<void> _savePlan() async {
    final tasks = _selected.toList()..sort();
    if (tasks.isEmpty) {
      return;
    }
    final confirm = await confirmAction(
      context,
      title: 'Lưu kế hoạch đã chọn?',
      message:
          'Thêm ${tasks.length} công việc vào SQLite trên thiết bị. Các công việc chưa bật thông báo; bạn có thể bật sau khi lưu.',
      confirmLabel: 'Xác nhận lưu',
    );
    if (!confirm || !mounted) {
      return;
    }
    await _action(() async {
      await widget.controller.saveMany(tasks.map((i) => _drafts[i]).toList());
      if (mounted)
        setState(() {
          _drafts = [];
          _selected.clear();
          _message = 'Đã lưu kế hoạch. Bạn có thể xem trong Công việc.';
        });
    });
  }

  void _editDraft(int index) {
    Navigator.of(context).push(
      MaterialPageRoute<void>(
        builder: (_) => TaskEditor(
          controller: widget.controller,
          task: _drafts[index],
          onDraftSaved: (task) {
            if (mounted) {
              setState(() => _drafts[index] = task);
            }
          },
        ),
      ),
    );
  }

  @override
  Widget build(BuildContext context) => Scaffold(
    appBar: AppBar(title: const Text('Trợ lý Gemini')),
    body: SingleChildScrollView(
      padding: const EdgeInsets.all(16),
      child: Column(
        crossAxisAlignment: CrossAxisAlignment.stretch,
        children: [
          const DepthCard(
            hero: true,
            child: Column(
              crossAxisAlignment: CrossAxisAlignment.start,
              children: [
                Icon(Icons.auto_awesome, size: 38),
                SizedBox(height: 12),
                Text(
                  'Từ ý tưởng đến kế hoạch',
                  style: TextStyle(fontSize: 24, fontWeight: FontWeight.w600),
                ),
                SizedBox(height: 8),
                Text(
                  'AI chỉ tạo bản nháp. Bạn kiểm tra, sửa và xác nhận trước khi lưu.',
                ),
              ],
            ),
          ),
          const SizedBox(height: 16),
          ExpansionTile(
            initiallyExpanded: !_hasKey,
            title: Text(
              _hasKey ? 'API key đã lưu trên máy' : 'Thiết lập Gemini API key',
            ),
            childrenPadding: const EdgeInsets.all(8),
            children: [
              TextField(
                controller: _key,
                obscureText: true,
                enableSuggestions: false,
                autocorrect: false,
                decoration: const InputDecoration(
                  labelText: 'API key của riêng bạn',
                  helperText: 'Không gửi key trong chat hoặc đưa lên GitHub.',
                ),
              ),
              const SizedBox(height: 12),
              Wrap(
                spacing: 8,
                children: [
                  FilledButton(
                    onPressed: _busy ? null : _saveKey,
                    child: const Text('Lưu key an toàn'),
                  ),
                  TextButton(
                    onPressed: _busy || !_hasKey
                        ? null
                        : () => _action(() async {
                            await _service.deleteKey();
                            if (mounted) {
                              setState(() => _hasKey = false);
                            }
                          }),
                    child: const Text('Xóa key'),
                  ),
                ],
              ),
              const Text(
                'Key được mã hóa bằng cơ chế lưu trữ bảo mật Android. Không bảo đảm an toàn tuyệt đối trên thiết bị bị root. '
                'Google có quota/điều khoản riêng; không bắt buộc bật thanh toán.',
              ),
            ],
          ),
          OutlinedButton.icon(
            onPressed: _busy || !_hasKey ? null : _modelsLoad,
            icon: const Icon(Icons.refresh),
            label: const Text('Kiểm tra key và tải mô hình'),
          ),
          const SizedBox(height: 12),
          DropdownButtonFormField<String>(
            key: ValueKey(_model),
            initialValue: _model,
            isExpanded: true,
            decoration: const InputDecoration(labelText: 'Mô hình'),
            items: _models
                .map(
                  (m) => DropdownMenuItem(
                    value: m,
                    child: Text(m, overflow: TextOverflow.ellipsis),
                  ),
                )
                .toList(),
            onChanged: _busy
                ? null
                : (m) => _action(() async {
                    await widget.controller.repository.setSetting(
                      'gemini.model',
                      m!,
                    );
                    if (mounted) {
                      setState(() => _model = m);
                    }
                  }),
          ),
          const SizedBox(height: 20),
          TextField(
            controller: _request,
            minLines: 4,
            maxLines: 8,
            maxLength: 4000,
            decoration: const InputDecoration(
              labelText: 'Bạn muốn lên kế hoạch gì?',
              hintText:
                  'Ví dụ: Tuần sau giúp tôi chia lịch ôn thi và tập thể dục.',
            ),
          ),
          CheckboxListTile(
            contentPadding: EdgeInsets.zero,
            title: const Text('Gửi lịch hiện có để tránh trùng'),
            subtitle: const Text(
              'Tối đa 30 việc chưa xong: tiêu đề, ngày và giờ. Không gửi ghi chú, GPS hoặc thời tiết.',
            ),
            value: _includeTasks,
            onChanged: _busy ? null : (v) => setState(() => _includeTasks = v!),
          ),
          const Text(
            'Khi bấm Tạo bản nháp, nội dung yêu cầu và phần lịch bạn cho phép sẽ được gửi đến Google Gemini. '
            'AI có thể đưa ngày giờ hoặc gợi ý sai; hãy kiểm tra trước khi lưu.',
          ),
          const SizedBox(height: 12),
          FilledButton.icon(
            onPressed: _busy || !_hasKey ? null : _generate,
            icon: const Icon(Icons.auto_awesome),
            label: const Text('Tạo bản nháp'),
          ),
          if (_busy)
            const Padding(
              padding: EdgeInsets.all(12),
              child: LinearProgressIndicator(),
            ),
          if (_message != null)
            Padding(
              padding: const EdgeInsets.symmetric(vertical: 16),
              child: Text(_message!),
            ),
          if (_drafts.isNotEmpty) ...[
            const SizedBox(height: 20),
            Text(
              'Xem và sửa ${_drafts.length} bản nháp',
              style: Theme.of(context).textTheme.titleLarge,
            ),
            ...List.generate(_drafts.length, (i) {
              final task = _drafts[i];
              return Card(
                child: ListTile(
                  leading: Checkbox(
                    value: _selected.contains(i),
                    onChanged: _busy
                        ? null
                        : (v) => setState(() {
                            if (v!) {
                              _selected.add(i);
                            } else {
                              _selected.remove(i);
                            }
                          }),
                  ),
                  title: Text(task.title),
                  subtitle: Text(
                    '${displayDate(task.dueDate)} • ${task.dueMinutes == null ? 'Cả ngày' : displayTime(task.dueMinutes!)}\n${task.category.label} • ${task.priority.label}',
                  ),
                  trailing: const Icon(Icons.edit_outlined),
                  onTap: _busy ? null : () => _editDraft(i),
                ),
              );
            }),
            FilledButton.icon(
              onPressed: _busy || _selected.isEmpty ? null : _savePlan,
              icon: const Icon(Icons.check),
              label: Text('Xem xác nhận và lưu ${_selected.length} việc'),
            ),
          ],
          const SizedBox(height: 32),
        ],
      ),
    ),
  );
}
