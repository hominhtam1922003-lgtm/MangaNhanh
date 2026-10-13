import 'package:flutter/material.dart';
import '../../data/alarm_bridge.dart';
import '../../data/notification_hub.dart';
import '../../widgets/page_frame.dart';

class AlarmSettingsScreen extends StatefulWidget {
  const AlarmSettingsScreen({super.key});
  @override
  State<AlarmSettingsScreen> createState() => _AlarmSettingsScreenState();
}

class _AlarmSettingsScreenState extends State<AlarmSettingsScreen>
    with WidgetsBindingObserver {
  final _bridge = AlarmBridge();
  AlarmCapabilities? _cap;
  String? _error;
  @override
  void initState() {
    super.initState();
    WidgetsBinding.instance.addObserver(this);
    _refresh();
  }

  @override
  void dispose() {
    WidgetsBinding.instance.removeObserver(this);
    super.dispose();
  }

  @override
  void didChangeAppLifecycleState(AppLifecycleState state) {
    if (state == AppLifecycleState.resumed) _refresh();
  }

  Future<void> _refresh() async {
    try {
      final c = await _bridge.capabilities();
      if (mounted) {
        setState(() {
          _cap = c;
          _error = null;
        });
      }
    } catch (_) {
      if (mounted) {
        setState(() => _error = 'Không đọc được trạng thái báo thức Android.');
      }
    }
  }

  Future<void> _open(Future<void> Function() action) async {
    try {
      await action();
      await _refresh();
    } catch (_) {
      if (mounted) {
        setState(
          () => _error =
              'Không mở được mục này. Hãy kiểm tra trong cài đặt Android.',
        );
      }
    }
  }

  @override
  Widget build(BuildContext context) => Scaffold(
    appBar: AppBar(title: const Text('Báo thức & quyền Android')),
    body: PageFrame(
      maxWidth: 760,
      child: ListView(
        padding: const EdgeInsets.all(20),
        children: [
          Panel(
            child: Column(
              crossAxisAlignment: CrossAxisAlignment.start,
              children: [
                Icon(
                  Icons.alarm_rounded,
                  size: 40,
                  color: Theme.of(context).colorScheme.primary,
                ),
                const SectionTitle(
                  'Nhắc việc bằng chuông',
                  subtitle: 'Chọn Báo thức khi thêm hoặc sửa công việc.',
                ),
                const Text(
                  'Chuông dùng âm lượng báo thức hệ thống, có rung, nút Dừng và Hoãn 5/10 phút. '
                  'Tự dừng sau 5 phút; dừng chuông không đánh dấu công việc đã xong.',
                ),
              ],
            ),
          ),
          const SizedBox(height: 16),
          _permission(
            'Báo thức chính xác',
            _cap?.exact,
            'Cần cấp trên Android 12+ để đổ chuông đúng thời điểm. Nếu thiếu, app dùng thông báo thường.',
            _bridge.openExactSettings,
          ),
          _permission(
            'Hiện trên màn hình khóa',
            _cap?.fullScreen,
            'Android 14+ có quyền riêng. Nếu thiếu, chuông vẫn có thể phát nhưng không tự mở màn hình báo thức.',
            _bridge.openFullScreenSettings,
          ),
          Card(
            child: ListTile(
              leading: const Icon(Icons.volume_up_outlined),
              title: const Text('Âm lượng báo thức'),
              subtitle: Text(
                _cap == null
                    ? 'Đang đọc…'
                    : '${_cap!.volume}/${_cap!.maxVolume} · Không tự tăng âm lượng của bạn',
              ),
              trailing: const Icon(Icons.chevron_right),
              onTap: () => _open(_bridge.openSoundSettings),
            ),
          ),
          OutlinedButton.icon(
            onPressed: () => _open(() async {
              await NotificationHub.requestPermission();
            }),
            icon: const Icon(Icons.notifications_outlined),
            label: const Text('Cấp quyền thông báo điều khiển chuông'),
          ),
          if (_error != null) Text(_error!),
          const SizedBox(height: 20),
          const Text(
            'Không thể cam kết 100% nếu máy tắt, app bị buộc dừng, quyền bị thu hồi, âm lượng bằng 0 '
            'hoặc hệ thống/nhà sản xuất chặn chạy nền. Mở lại app sau khi buộc dừng hoặc đổi múi giờ. '
            'Đây không phải ứng dụng báo thức khẩn cấp. Thông báo điều khiển là yêu cầu của Android đối với dịch vụ phát chuông.',
          ),
        ],
      ),
    ),
  );
  Widget _permission(
    String title,
    bool? granted,
    String note,
    Future<void> Function() open,
  ) => Card(
    child: Padding(
      padding: const EdgeInsets.all(16),
      child: Column(
        crossAxisAlignment: CrossAxisAlignment.start,
        children: [
          Row(
            children: [
              Icon(
                granted == true
                    ? Icons.verified_outlined
                    : Icons.warning_amber_rounded,
                color: granted == true ? Colors.teal : Colors.orange,
              ),
              const SizedBox(width: 10),
              Expanded(
                child: Text(
                  title,
                  style: Theme.of(context).textTheme.titleMedium,
                ),
              ),
            ],
          ),
          const SizedBox(height: 8),
          Text(note),
          const SizedBox(height: 10),
          Text(
            granted == null
                ? 'Đang kiểm tra…'
                : granted
                ? 'Đã cho phép'
                : 'Chưa được cấp',
          ),
          if (granted == false)
            TextButton(
              onPressed: () => _open(open),
              child: const Text('Mở cài đặt Android'),
            ),
        ],
      ),
    ),
  );
}
