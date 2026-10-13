import 'package:flutter/material.dart';
import '../app/app_controller.dart';
import '../widgets/depth_card.dart';
import '../widgets/page_frame.dart';
import 'holidays/holidays_screen.dart';
import 'planner/planner_screen.dart';
import 'settings_view.dart';
import 'alarms/alarm_settings_screen.dart';

class UtilityView extends StatelessWidget {
  const UtilityView({super.key, required this.controller});
  final AppController controller;
  @override
  Widget build(BuildContext context) => ListView(
    padding: const EdgeInsets.all(16),
    children: [
      const DepthCard(
        hero: true,
        child: Column(
          crossAxisAlignment: CrossAxisAlignment.start,
          children: [
            Icon(Icons.widgets_outlined, size: 36),
            SizedBox(height: 12),
            Text(
              'Một nhịp sống chủ động',
              style: TextStyle(fontSize: 25, fontWeight: FontWeight.w600),
            ),
            SizedBox(height: 8),
            Text('Lịch lễ, trợ lý lập kế hoạch và cài đặt của riêng bạn.'),
          ],
        ),
      ),
      const SizedBox(height: 20),
      Card(
        child: ListTile(
          leading: const Icon(Icons.alarm_rounded),
          title: const Text('Báo thức & quyền Android'),
          subtitle: const Text('Đổ chuông, màn hình khóa, dừng và hoãn'),
          trailing: const Icon(Icons.chevron_right),
          onTap: () => Navigator.push(
            context,
            MaterialPageRoute<void>(
              builder: (_) => const AlarmSettingsScreen(),
            ),
          ),
        ),
      ),
      Card(
        child: ListTile(
          leading: const Icon(Icons.celebration_outlined),
          title: const Text('Ngày lễ Việt Nam'),
          subtitle: const Text('Tết, Giỗ Tổ, Trung thu và các ngày đặc biệt'),
          trailing: const Icon(Icons.chevron_right),
          onTap: () => Navigator.push(
            context,
            MaterialPageRoute<void>(
              builder: (_) => HolidaysScreen(repository: controller.repository),
            ),
          ),
        ),
      ),
      Card(
        child: ListTile(
          leading: const Icon(Icons.auto_awesome),
          title: const Text('Trợ lý Gemini'),
          subtitle: const Text(
            'Tạo bản nháp kế hoạch, bạn xác nhận trước khi lưu',
          ),
          trailing: const Icon(Icons.chevron_right),
          onTap: () => Navigator.push(
            context,
            MaterialPageRoute<void>(
              builder: (_) => PlannerScreen(controller: controller),
            ),
          ),
        ),
      ),
      Card(
        child: ListTile(
          leading: const Icon(Icons.settings_outlined),
          title: const Text('Cài đặt'),
          subtitle: const Text('Giao diện, riêng tư và dữ liệu trên thiết bị'),
          trailing: const Icon(Icons.chevron_right),
          onTap: () => Navigator.push(
            context,
            MaterialPageRoute<void>(
              builder: (_) => Scaffold(
                appBar: AppBar(title: const Text('Cài đặt')),
                body: PageFrame(
                  maxWidth: 820,
                  child: SettingsView(controller: controller),
                ),
              ),
            ),
          ),
        ),
      ),
      const SizedBox(height: 20),
      const Text(
        'Công việc và lịch lễ hoạt động khi mất mạng. Thời tiết và Gemini cần internet. '
        'Dữ liệu thời tiết luôn ghi nguồn và thời điểm; AI không tự lưu hoặc sửa lịch của bạn.',
      ),
    ],
  );
}
