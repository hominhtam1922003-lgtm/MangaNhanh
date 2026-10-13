import 'dart:convert';
import 'package:flutter/material.dart';
import 'package:flutter/services.dart';
import '../../app/app_controller.dart';
import '../../data/groq_service.dart';
import '../../data/weather_api.dart';
import '../../widgets/page_frame.dart';
import '../../widgets/vietnamese_input.dart';
import '../../widgets/task_list.dart';
import '../task_editor.dart';

class AssistantScreen extends StatefulWidget {
  const AssistantScreen({super.key, required this.controller, this.service});
  final AppController controller;
  final GroqService? service;
  @override
  State<AssistantScreen> createState() => _AssistantScreenState();
}

class _AssistantScreenState extends State<AssistantScreen> {
  late final GroqService _service = widget.service ?? GroqService();
  final _input = TextEditingController(), _scroll = ScrollController();
  List<ChatMessage> _messages = [];
  List<String> _models = [];
  String _model = '';
  bool _hasKey = false, _busy = true, _includeTasks = false;
  String? _error;
  @override
  void initState() {
    super.initState();
    _load();
  }

  @override
  void dispose() {
    _input.dispose();
    _scroll.dispose();
    if (widget.service == null) {
      _service.dispose();
    }
    super.dispose();
  }

  Future<void> _load() async {
    try {
      final raw = await widget.controller.repository.setting('groq.chat');
      if (raw != null) {
        _messages = (jsonDecode(raw) as List)
            .map((m) => ChatMessage.fromJson(m as Map<String, dynamic>))
            .toList();
      }
      _model = await widget.controller.repository.setting('groq.model') ?? '';
      _hasKey = await _service.hasKey();
      if (_hasKey) {
        await _discover();
      }
    } catch (e) {
      _error = _safeError(e);
    } finally {
      if (mounted) {
        setState(() => _busy = false);
        _bottom();
      }
    }
  }

  String _safeError(Object e) => e is UserMessage
      ? e.message
      : 'Chưa hoàn tất thao tác. Dữ liệu vẫn giữ trên máy.';
  Future<void> _discover() async {
    final models = await _service.models();
    final model = GroqService.selectModel(models, _model);
    await widget.controller.repository.setSetting('groq.model', model);
    if (mounted) {
      setState(() {
        _models = models;
        _model = model;
      });
    }
  }

  void _bottom() => WidgetsBinding.instance.addPostFrameCallback((_) {
    if (mounted && _scroll.hasClients) {
      _scroll.animateTo(
        _scroll.position.maxScrollExtent,
        duration: const Duration(milliseconds: 200),
        curve: Curves.easeOut,
      );
    }
  });
  Future<void> _send() async {
    final text = _input.text;
    if (_busy || text.trim().isEmpty) {
      return;
    }
    setState(() {
      _busy = true;
      _error = null;
    });
    try {
      final result = await _service.chat(
        text,
        preferred: _model,
        history: _messages,
        contextTasks: _includeTasks
            ? widget.controller.tasks
                  .where((t) => !t.completed)
                  .take(30)
                  .toList()
            : [],
      );
      if (!mounted) {
        return;
      }
      final next = [
        ..._messages,
        ChatMessage('user', text.trim()),
        ChatMessage('assistant', result.text),
      ];
      final kept = next
          .skip(next.length > 100 ? next.length - 100 : 0)
          .toList();
      // Phản hồi vẫn được hiển thị nếu chỉ việc ghi SQLite thất bại, không gửi lại API.
      setState(() {
        _messages = kept;
        _model = result.model;
        if (!_models.contains(result.model)) {
          _models.add(result.model);
        }
      });
      if (_input.text == text) {
        _input.clear();
      }
      _bottom();
      try {
        await widget.controller.repository.setSetting(
          'groq.chat',
          jsonEncode(kept.map((m) => m.toJson()).toList()),
        );
        await widget.controller.repository.setSetting(
          'groq.model',
          result.model,
        );
      } catch (_) {
        if (mounted) {
          setState(
            () => _error =
                'Đã nhận trả lời nhưng chưa lưu được lịch sử trên máy. Không cần gửi lại câu hỏi.',
          );
        }
      }
    } catch (e) {
      if (mounted) {
        setState(() => _error = _safeError(e));
      }
    } finally {
      if (mounted) {
        setState(() => _busy = false);
      }
    }
  }

  Future<void> _clear() async {
    if (!await confirmAction(
          context,
          title: 'Xóa cuộc trò chuyện?',
          message:
              'Xóa lịch sử trên thiết bị. Không xóa dữ liệu đã gửi cho GroqCloud và không xóa công việc.',
          confirmLabel: 'Xóa',
        ) ||
        !mounted) {
      return;
    }
    try {
      await widget.controller.repository.setSetting('groq.chat', '[]');
      if (mounted) {
        setState(() {
          _messages = [];
          _error = null;
        });
      }
    } catch (e) {
      if (mounted) {
        setState(() => _error = _safeError(e));
      }
    }
  }

  Future<void> _settings() async {
    await Navigator.push(
      context,
      MaterialPageRoute<void>(builder: (_) => _AISettings(service: _service)),
    );
    if (!mounted) {
      return;
    }
    setState(() {
      _busy = true;
      _error = null;
    });
    try {
      _hasKey = await _service.hasKey();
      if (_hasKey) {
        await _discover();
      } else {
        _models = [];
        _model = '';
      }
    } catch (e) {
      if (mounted) {
        _error = _safeError(e);
      }
    } finally {
      if (mounted) {
        setState(() => _busy = false);
      }
    }
  }

  @override
  Widget build(BuildContext context) => Scaffold(
    appBar: AppBar(
      title: const Text('Trợ lý AI'),
      actions: [
        IconButton(
          tooltip: 'Cuộc trò chuyện mới',
          onPressed: _busy ? null : _clear,
          icon: const Icon(Icons.add_comment_outlined),
        ),
        IconButton(
          tooltip: 'Cài đặt AI',
          onPressed: _busy ? null : _settings,
          icon: const Icon(Icons.tune_rounded),
        ),
      ],
    ),
    body: SafeArea(
      child: PageFrame(
        maxWidth: 960,
        child: Column(
          children: [
            Padding(
              padding: const EdgeInsets.fromLTRB(16, 8, 16, 8),
              child: Row(
                children: [
                  const Icon(Icons.auto_awesome, size: 20),
                  const SizedBox(width: 8),
                  Expanded(
                    child: Text(
                      _hasKey
                          ? 'GroqCloud · ${_model.isEmpty ? 'Đang chọn mô hình' : _model}'
                          : 'GroqCloud · Chưa thiết lập key',
                      style: Theme.of(context).textTheme.bodySmall,
                    ),
                  ),
                  TextButton(
                    onPressed: _busy ? null : _settings,
                    child: const Text('Thiết lập'),
                  ),
                ],
              ),
            ),
            Expanded(
              child: _messages.isEmpty
                  ? ListView(
                      padding: const EdgeInsets.all(24),
                      children: [
                        const Icon(Icons.forum_outlined, size: 54),
                        const SizedBox(height: 20),
                        Text(
                          'Bạn muốn hỏi gì hôm nay?',
                          textAlign: TextAlign.center,
                          style: Theme.of(context).textTheme.headlineSmall,
                        ),
                        const SizedBox(height: 12),
                        const Text(
                          'Trò chuyện, giải thích bài học, tìm ý tưởng hoặc cùng lên kế hoạch. AI có thể sai; không tự tạo việc hay đặt chuông.',
                          textAlign: TextAlign.center,
                        ),
                        const SizedBox(height: 20),
                        Wrap(
                          alignment: WrapAlignment.center,
                          spacing: 8,
                          runSpacing: 8,
                          children: [
                            for (final text in [
                              'Giải thích dễ hiểu một chủ đề',
                              'Giúp tôi lên kế hoạch tuần này',
                              'Gợi ý cách tập trung khi học',
                            ])
                              ActionChip(
                                label: Text(text),
                                onPressed: () => _input.text = text,
                              ),
                          ],
                        ),
                        if (!_hasKey)
                          Padding(
                            padding: const EdgeInsets.only(top: 24),
                            child: FilledButton.icon(
                              onPressed: _busy ? null : _settings,
                              icon: const Icon(Icons.key),
                              label: const Text('Nhập GroqCloud API key'),
                            ),
                          ),
                      ],
                    )
                  : ListView.builder(
                      controller: _scroll,
                      padding: const EdgeInsets.symmetric(
                        horizontal: 16,
                        vertical: 12,
                      ),
                      itemCount: _messages.length,
                      itemBuilder: (context, i) {
                        final message = _messages[i],
                            user = message.role == 'user';
                        return Align(
                          alignment: user
                              ? Alignment.centerRight
                              : Alignment.centerLeft,
                          child: ConstrainedBox(
                            constraints: const BoxConstraints(maxWidth: 700),
                            child: Padding(
                              padding: const EdgeInsets.only(bottom: 14),
                              child: Panel(
                                color: user
                                    ? Theme.of(
                                        context,
                                      ).colorScheme.primaryContainer
                                    : null,
                                padding: const EdgeInsets.all(16),
                                child: Column(
                                  crossAxisAlignment: CrossAxisAlignment.start,
                                  children: [
                                    Row(
                                      children: [
                                        Expanded(
                                          child: Text(
                                            user ? 'Bạn' : 'Trợ lý AI',
                                            style: const TextStyle(
                                              fontWeight: FontWeight.w700,
                                            ),
                                          ),
                                        ),
                                        PopupMenuButton<String>(
                                          tooltip: 'Thao tác tin nhắn',
                                          onSelected: (value) async {
                                            if (value == 'copy') {
                                              await Clipboard.setData(
                                                ClipboardData(
                                                  text: message.content,
                                                ),
                                              );
                                            } else if (mounted) {
                                              Navigator.push(
                                                context,
                                                MaterialPageRoute<void>(
                                                  builder: (_) => TaskEditor(
                                                    controller:
                                                        widget.controller,
                                                    initialNotes:
                                                        message.content,
                                                  ),
                                                ),
                                              );
                                            }
                                          },
                                          itemBuilder: (_) => const [
                                            PopupMenuItem(
                                              value: 'copy',
                                              child: Text('Sao chép'),
                                            ),
                                            PopupMenuItem(
                                              value: 'task',
                                              child: Text(
                                                'Tạo công việc từ tin nhắn',
                                              ),
                                            ),
                                          ],
                                        ),
                                      ],
                                    ),
                                    SelectableText(message.content),
                                  ],
                                ),
                              ),
                            ),
                          ),
                        );
                      },
                    ),
            ),
            if (_busy) const LinearProgressIndicator(),
            if (_error != null)
              Padding(
                padding: const EdgeInsets.symmetric(
                  horizontal: 16,
                  vertical: 8,
                ),
                child: Text(
                  _error!,
                  maxLines: 2,
                  overflow: TextOverflow.ellipsis,
                  style: TextStyle(color: Theme.of(context).colorScheme.error),
                ),
              ),
            if (_hasKey && MediaQuery.viewInsetsOf(context).bottom == 0)
              Padding(
                padding: const EdgeInsets.symmetric(horizontal: 16),
                child: Row(
                  children: [
                    Checkbox(
                      value: _includeTasks,
                      onChanged: _busy
                          ? null
                          : (v) => setState(() => _includeTasks = v!),
                    ),
                    const Expanded(
                      child: Text(
                        'Cho AI tham khảo tối đa 30 việc chưa xong',
                        style: TextStyle(fontSize: 12),
                      ),
                    ),
                  ],
                ),
              ),
            Padding(
              padding: const EdgeInsets.fromLTRB(16, 4, 16, 4),
              child: Row(
                crossAxisAlignment: CrossAxisAlignment.end,
                children: [
                  Expanded(
                    child: VietnameseInput(
                      controller: _input,
                      label: 'Nhắn cho trợ lý AI',
                      minLines: 1,
                      maxLines: MediaQuery.viewInsetsOf(context).bottom > 0
                          ? 2
                          : 4,
                      maxLength: 4000,
                    ),
                  ),
                  const SizedBox(width: 10),
                  Padding(
                    padding: const EdgeInsets.only(bottom: 28),
                    child: IconButton.filled(
                      tooltip: 'Gửi tin nhắn',
                      onPressed: _busy || !_hasKey ? null : _send,
                      icon: const Icon(Icons.arrow_upward_rounded),
                    ),
                  ),
                ],
              ),
            ),
            if (MediaQuery.viewInsetsOf(context).bottom == 0)
              const Padding(
                padding: EdgeInsets.fromLTRB(16, 0, 16, 8),
                child: Text(
                  'Bấm Gửi: câu hỏi và tối đa 20 tin gần đây được gửi đến GroqCloud. Lịch sử giữ tối đa 100 tin trên máy. Không gửi key trong chat.',
                  style: TextStyle(fontSize: 10),
                ),
              ),
          ],
        ),
      ),
    ),
  );
}

class _AISettings extends StatefulWidget {
  const _AISettings({required this.service});
  final GroqService service;
  @override
  State<_AISettings> createState() => _AISettingsState();
}

class _AISettingsState extends State<_AISettings> {
  final _key = TextEditingController();
  bool _busy = true, _hasKey = false;
  String? _status;
  @override
  void initState() {
    super.initState();
    _read();
  }

  Future<void> _read() async {
    try {
      _hasKey = await widget.service.hasKey();
    } catch (_) {
      _status = 'Chưa đọc được vùng lưu trữ bảo mật.';
    } finally {
      if (mounted) {
        setState(() => _busy = false);
      }
    }
  }

  @override
  void dispose() {
    _key.dispose();
    super.dispose();
  }

  Future<void> _action(Future<void> Function() action) async {
    setState(() {
      _busy = true;
      _status = null;
    });
    try {
      await action();
    } catch (e) {
      if (mounted) {
        setState(
          () => _status = e is UserMessage
              ? e.message
              : 'Chưa hoàn tất thao tác. Hãy thử lại.',
        );
      }
    } finally {
      if (mounted) {
        setState(() => _busy = false);
        if (_status != null)
          ScaffoldMessenger.of(
            context,
          ).showSnackBar(SnackBar(content: Text(_status!)));
      }
    }
  }

  @override
  Widget build(BuildContext context) => Scaffold(
    appBar: AppBar(title: const Text('Cài đặt AI · GroqCloud')),
    body: PageFrame(
      maxWidth: 720,
      child: ListView(
        padding: const EdgeInsets.all(20),
        children: [
          const SectionTitle(
            'Kết nối trợ lý AI',
            subtitle: 'Dùng GroqCloud API, không phải Gemini hay Grok của xAI.',
          ),
          const Text(
            'Tạo key của bạn tại console.groq.com/keys. GroqCloud có hạn mức và điều khoản riêng; app không tự bật thanh toán.',
          ),
          const SizedBox(height: 16),
          Panel(
            child: Text(
              _hasKey
                  ? 'Key GroqCloud đã lưu trên thiết bị. Ô nhập trống là để bảo mật.'
                  : 'Chưa lưu GroqCloud API key.',
            ),
          ),
          const SizedBox(height: 16),
          VietnameseInput(
            controller: _key,
            obscureText: true,
            label: _hasKey ? 'Key mới để thay thế' : 'GroqCloud API key',
            hint: 'gsk_…',
          ),
          const SizedBox(height: 12),
          Wrap(
            spacing: 8,
            runSpacing: 8,
            children: [
              FilledButton(
                onPressed: _busy
                    ? null
                    : () => _action(() async {
                        await widget.service.saveKey(_key.text);
                        if (mounted) {
                          _key.clear();
                          setState(() {
                            _hasKey = true;
                            _status =
                                'Đã lưu và xác nhận đọc lại key. Kiểm tra kết nối để xác thực với GroqCloud.';
                          });
                        }
                      }),
                child: const Text('Lưu key an toàn'),
              ),
              OutlinedButton(
                onPressed: _busy || !_hasKey
                    ? null
                    : () => _action(() async {
                        final models = await widget.service.models();
                        if (mounted) {
                          setState(
                            () => _status =
                                'GroqCloud đã trả ${models.length} mô hình chat. Khi gửi, app tự chọn mô hình khả dụng.',
                          );
                        }
                      }),
                child: const Text('Kiểm tra kết nối'),
              ),
              TextButton(
                onPressed: _busy || !_hasKey
                    ? null
                    : () async {
                        if (!await confirmAction(
                              context,
                              title: 'Xóa GroqCloud key?',
                              message:
                                  'Trợ lý sẽ ngừng gọi API cho tới khi nhập key mới. Lịch sử và công việc vẫn giữ.',
                              confirmLabel: 'Xóa',
                            ) ||
                            !mounted) {
                          return;
                        }
                        await _action(() async {
                          await widget.service.deleteKey();
                          if (mounted) {
                            setState(() {
                              _hasKey = false;
                              _status = 'Đã xóa GroqCloud API key.';
                            });
                          }
                        });
                      },
                child: const Text('Xóa key'),
              ),
            ],
          ),
          if (_busy) const LinearProgressIndicator(),
          if (_status != null)
            Padding(
              padding: const EdgeInsets.symmetric(vertical: 16),
              child: Text(_status!),
            ),
          const SizedBox(height: 16),
          const Text(
            'Key chỉ ở vùng lưu trữ bảo mật Android và header gửi đến api.groq.com, không nhúng trong APK. '
            'Key Gemini cũ không bị xóa hoặc gửi cho GroqCloud. Nội dung chat lưu trong SQLite, không mã hóa riêng. '
            'Xóa trò chuyện trên máy không xóa dữ liệu nhà cung cấp đã nhận. Không gửi thông tin nhạy cảm; AI có thể trả lời sai.',
          ),
        ],
      ),
    ),
  );
}
