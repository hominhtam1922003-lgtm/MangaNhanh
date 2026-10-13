import 'package:flutter/material.dart';
import '../../data/holiday_service.dart';
import '../../data/task_repository.dart';
import '../../models/holiday.dart';
import '../../models/task.dart';
import '../../widgets/depth_card.dart';

class HolidaysScreen extends StatefulWidget {
  const HolidaysScreen({super.key, required this.repository});
  final TaskRepository repository;
  @override
  State<HolidaysScreen> createState() => _HolidaysScreenState();
}

class _HolidaysScreenState extends State<HolidaysScreen> {
  int _year = DateTime.now().year, _before = 1;
  bool _enabled = false, _all = false, _busy = true;
  String? _message;
  @override
  void initState() {
    super.initState();
    _load();
  }

  Future<void> _load() async {
    try {
      final enabled = await widget.repository.setting('holiday.enabled');
      final all = await widget.repository.setting('holiday.all');
      final before =
          int.tryParse(
            await widget.repository.setting('holiday.before') ?? '',
          ) ??
          1;
      if (mounted) {
        setState(() {
          _enabled = enabled == 'true';
          _all = all == 'true';
          _before = [1, 3, 7].contains(before) ? before : 1;
        });
      }
    } catch (_) {
      _message = 'Chưa đọc được cài đặt. Hãy thử lại.';
    } finally {
      if (mounted) {
        setState(() => _busy = false);
      }
    }
  }

  Future<void> _save() async {
    setState(() => _busy = true);
    try {
      await widget.repository.setSetting('holiday.enabled', '$_enabled');
      await widget.repository.setSetting('holiday.all', '$_all');
      await widget.repository.setSetting('holiday.before', '$_before');
      final message = await HolidayService(
        widget.repository,
      ).schedule(requestPermission: _enabled);
      if (mounted) {
        setState(() => _message = message ?? 'Đã cập nhật nhắc ngày lễ.');
      }
    } catch (_) {
      if (mounted) {
        setState(() => _message = 'Chưa lưu được cài đặt. Vui lòng thử lại.');
      }
    } finally {
      if (mounted) {
        setState(() => _busy = false);
      }
    }
  }

  @override
  Widget build(BuildContext context) => Scaffold(
    appBar: AppBar(title: const Text('Ngày lễ Việt Nam')),
    body: ListView(
      padding: const EdgeInsets.all(16),
      children: [
        const DepthCard(
          child: Column(
            crossAxisAlignment: CrossAxisAlignment.start,
            children: [
              Icon(Icons.celebration_outlined, size: 36),
              SizedBox(height: 12),
              Text(
                'Nhớ những ngày đặc biệt',
                style: TextStyle(fontSize: 22, fontWeight: FontWeight.bold),
              ),
              SizedBox(height: 8),
              Text(
                'Lịch âm Việt Nam dùng UTC+7, hỗ trợ 1900–2100. '
                'Ngày lễ không đồng nghĩa với lịch nghỉ bù chính thức.',
              ),
            ],
          ),
        ),
        SwitchListTile(
          title: const Text('Nhắc trước ngày lễ'),
          subtitle: const Text(
            'Lúc 09:00, dùng lịch thông báo không chính xác',
          ),
          value: _enabled,
          onChanged: _busy ? null : (v) => setState(() => _enabled = v),
        ),
        SwitchListTile(
          title: const Text('Bao gồm ngày kỷ niệm'),
          subtitle: const Text('Nếu tắt, chỉ nhắc các ngày lễ chính'),
          value: _all,
          onChanged: _busy ? null : (v) => setState(() => _all = v),
        ),
        DropdownButtonFormField<int>(
          initialValue: _before,
          key: ValueKey(_before),
          decoration: const InputDecoration(labelText: 'Nhắc trước'),
          items: [1, 3, 7]
              .map((n) => DropdownMenuItem(value: n, child: Text('$n ngày')))
              .toList(),
          onChanged: _busy ? null : (v) => setState(() => _before = v!),
        ),
        const SizedBox(height: 12),
        FilledButton.icon(
          onPressed: _busy ? null : _save,
          icon: const Icon(Icons.notifications_outlined),
          label: const Text('Lưu nhắc ngày lễ'),
        ),
        if (_message != null)
          Padding(padding: const EdgeInsets.all(12), child: Text(_message!)),
        if (_busy) const LinearProgressIndicator(),
        Row(
          children: [
            IconButton(
              tooltip: 'Năm trước',
              onPressed: _year <= 1900 ? null : () => setState(() => _year--),
              icon: const Icon(Icons.chevron_left),
            ),
            Expanded(
              child: Text(
                'Năm $_year',
                textAlign: TextAlign.center,
                style: Theme.of(context).textTheme.titleLarge,
              ),
            ),
            IconButton(
              tooltip: 'Năm sau',
              onPressed: _year >= 2100 ? null : () => setState(() => _year++),
              icon: const Icon(Icons.chevron_right),
            ),
          ],
        ),
        ...holidaysForYear(_year).map(
          (h) => Card(
            child: ListTile(
              leading: Icon(
                h.publicHoliday
                    ? Icons.flag_outlined
                    : Icons.celebration_outlined,
              ),
              title: Text(h.title),
              subtitle: Text('${displayDate(h.date)}\n${h.description}'),
              isThreeLine: true,
            ),
          ),
        ),
      ],
    ),
  );
}
