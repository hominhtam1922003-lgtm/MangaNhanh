import 'package:flutter/material.dart';

import '../app/app_controller.dart';
import '../widgets/task_list.dart';

class SettingsView extends StatefulWidget {
  const SettingsView({super.key, required this.controller});
  final AppController controller;

  @override
  State<SettingsView> createState() => _SettingsViewState();
}

class _SettingsViewState extends State<SettingsView> {
  bool _saving = false;

  Future<void> _theme(ThemeMode mode) async {
    setState(() => _saving = true);
    try {
      await widget.controller.setTheme(mode);
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

  Future<void> _clear() async {
    final confirmed = await confirmAction(
      context,
      title: 'Xóa toàn bộ dữ liệu?',
      message:
          'Tất cả công việc, cache thời tiết, vị trí, cài đặt và Gemini API key trên thiết bị sẽ bị xóa. '
          'Các thông báo nhắc sẽ được hủy. Không thể hoàn tác.',
      confirmLabel: 'Xóa toàn bộ',
    );
    if (!confirmed || !mounted) {
      return;
    }
    setState(() => _saving = true);
    try {
      await widget.controller.clear();
      if (mounted) {
        ScaffoldMessenger.of(context).showSnackBar(
          const SnackBar(content: Text('Đã xóa toàn bộ dữ liệu.')),
        );
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
  Widget build(BuildContext context) => ListView(
    padding: const EdgeInsets.all(20),
    children: [
      Text('Giao diện', style: Theme.of(context).textTheme.titleLarge),
      const SizedBox(height: 16),
      DropdownButtonFormField<ThemeMode>(
        key: ValueKey(widget.controller.themeMode),
        initialValue: widget.controller.themeMode,
        isExpanded: true,
        decoration: const InputDecoration(labelText: 'Chế độ hiển thị'),
        items: const [
          DropdownMenuItem(
            value: ThemeMode.system,
            child: Text('Theo hệ thống'),
          ),
          DropdownMenuItem(value: ThemeMode.light, child: Text('Sáng')),
          DropdownMenuItem(value: ThemeMode.dark, child: Text('Tối')),
        ],
        onChanged: _saving ? null : (value) => _theme(value!),
      ),
      const SizedBox(height: 28),
      const Card(
        child: Padding(
          padding: EdgeInsets.all(16),
          child: Column(
            crossAxisAlignment: CrossAxisAlignment.start,
            children: [
              Icon(Icons.lock_outline),
              SizedBox(height: 12),
              Text('Dữ liệu của bạn ở trên thiết bị'),
              SizedBox(height: 8),
              Text(
                'Công việc hoạt động ngoại tuyến, không cần tài khoản. '
                'Công việc và cài đặt không tự đồng bộ sang máy khác. '
                'Thời tiết dùng internet và gửi tọa độ đã chọn tới Open-Meteo. Gemini chỉ gửi nội dung khi bạn yêu cầu. '
                'Gỡ ứng dụng hoặc xóa dữ liệu ứng dụng sẽ làm mất dữ liệu.',
              ),
            ],
          ),
        ),
      ),
      const SizedBox(height: 20),
      const Text(
        'Nhắc việc sử dụng lịch thông báo không chính xác. '
        'Android có thể trì hoãn khi tiết kiệm pin. Sau khi buộc dừng ứng dụng, '
        'hãy mở lại để khôi phục lịch nhắc. Khi đổi múi giờ, mở lại ứng dụng '
        'để lịch nhắc được tính theo múi giờ mới.',
      ),
      const SizedBox(height: 28),
      OutlinedButton.icon(
        style: OutlinedButton.styleFrom(
          foregroundColor: Theme.of(context).colorScheme.error,
        ),
        onPressed: _saving || widget.controller.busy ? null : _clear,
        icon: const Icon(Icons.delete_forever_outlined),
        label: const Text('Xóa toàn bộ dữ liệu'),
      ),
      if (_saving)
        const Padding(
          padding: EdgeInsets.all(12),
          child: Center(child: CircularProgressIndicator()),
        ),
      const SizedBox(height: 24),
      const Text('Lịch Nhắc • Phiên bản 1.1.0', textAlign: TextAlign.center),
    ],
  );
}
