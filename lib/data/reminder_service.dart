import 'dart:convert';
import 'package:flutter_local_notifications/flutter_local_notifications.dart';
import 'package:timezone/timezone.dart' as tz;

import '../models/task.dart';
import 'notification_hub.dart';
import 'alarm_bridge.dart';

class ReminderService {
  ReminderService({AlarmBridge? alarms}) : alarms = alarms ?? AlarmBridge();
  final AlarmBridge alarms;
  Future<void> cancelAll() async {
    try {
      await alarms.clear();
    } finally {
      await NotificationHub.initialize();
      await NotificationHub.plugin.cancelAll();
    }
  }

  String _signature(Task task) =>
      'task:${task.id}:${base64Url.encode(utf8.encode(jsonEncode({'title': task.title, 'date': localDateKey(task.dueDate), 'time': task.dueMinutes, 'category': task.category.name, 'timezone': tz.local.name, 'alarm': task.alarm})))}';

  Future<String?> reconcile(
    List<Task> tasks, {
    bool requestPermission = false,
  }) async {
    try {
      await NotificationHub.initialize(timezone: true);
      final android = NotificationHub.plugin
          .resolvePlatformSpecificImplementation<
            AndroidFlutterLocalNotificationsPlugin
          >();
      final alarmReady = await alarms.sync(tasks);
      if (requestPermission && !await NotificationHub.requestPermission()) {
        await NotificationHub.cancelNamespace('task:');
        return 'Đã lưu công việc. Quyền thông báo chưa được cấp; bạn có thể bật trong cài đặt Android.';
      }
      final alarmFallback =
          tasks.any(
            (t) =>
                t.alarm &&
                t.reminder &&
                !t.completed &&
                t.dueAt?.isAfter(DateTime.now()) == true,
          ) &&
          !alarmReady;
      final now = tz.TZDateTime.now(tz.local);
      final enabled = await android?.areNotificationsEnabled() ?? true;
      final dates = <int, tz.TZDateTime>{};
      final byId = {
        for (final task in tasks)
          if (task.id != null) task.id!: task,
      };
      for (final task in tasks) {
        if (!task.reminder ||
            task.completed ||
            task.dueMinutes == null ||
            (task.alarm && alarmReady)) {
          continue;
        }
        final date = tz.TZDateTime(
          tz.local,
          task.dueDate.year,
          task.dueDate.month,
          task.dueDate.day,
          task.dueMinutes! ~/ 60,
          task.dueMinutes! % 60,
        );
        if (date.isAfter(now)) dates[task.id!] = date;
      }
      if (!enabled) {
        await NotificationHub.cancelNamespace('task:');
        return dates.isEmpty
            ? null
            : 'Thông báo đang bị tắt trong cài đặt Android. Dữ liệu vẫn được lưu.';
      }
      final pending = await NotificationHub.plugin
          .pendingNotificationRequests();
      final unchanged = <int>{};
      for (final notification in pending) {
        if (!(notification.payload?.startsWith('task:') ?? false)) {
          continue;
        }
        final task = byId[notification.id];
        if (task != null &&
            dates.containsKey(notification.id) &&
            notification.payload == _signature(task)) {
          unchanged.add(notification.id);
        } else {
          await NotificationHub.plugin.cancel(id: notification.id);
        }
      }
      // Giữ nhắc đã hiện cho việc chưa xong; hủy khi xóa, hoàn thành hoặc thay hạn.
      for (final notification
          in await NotificationHub.plugin.getActiveNotifications()) {
        if (notification.channelId != 'task_reminders' &&
            !(notification.payload?.startsWith('task:') ?? false)) {
          continue;
        }
        final task = byId[notification.id];
        if (task == null ||
            task.completed ||
            !task.reminder ||
            (task.alarm && alarmReady) ||
            notification.payload != _signature(task)) {
          if (notification.id != null) {
            await NotificationHub.plugin.cancel(id: notification.id!);
          }
        }
      }
      for (final entry in dates.entries) {
        if (unchanged.contains(entry.key)) {
          continue;
        }
        final task = byId[entry.key]!;
        await NotificationHub.plugin.zonedSchedule(
          id: task.id!,
          title: task.title,
          body:
              'Đến hạn lúc ${displayTime(task.dueMinutes!)} • ${task.category.label}',
          scheduledDate: entry.value,
          notificationDetails: const NotificationDetails(
            android: AndroidNotificationDetails(
              'task_reminders',
              'Nhắc công việc',
              channelDescription: 'Thông báo khi công việc đến hạn',
              importance: Importance.high,
              priority: Priority.high,
              icon: 'ic_notification',
            ),
          ),
          androidScheduleMode: AndroidScheduleMode.inexactAllowWhileIdle,
          payload: _signature(task),
        );
      }
      return alarmFallback
          ? 'Công việc đã lưu. Chưa có quyền báo thức chính xác; đang dùng thông báo thường. Mở Tiện ích → Báo thức để cấp quyền.'
          : null;
    } catch (_) {
      return 'Dữ liệu đã lưu, nhưng chưa thể cập nhật nhắc việc. Hãy mở lại ứng dụng và kiểm tra quyền thông báo.';
    }
  }
}
