import 'package:flutter_local_notifications/flutter_local_notifications.dart';
import 'package:timezone/timezone.dart' as tz;

import '../models/task.dart';
import 'notification_hub.dart';

class ReminderService {
  Future<void> cancelAll() async {
    await NotificationHub.initialize();
    await NotificationHub.plugin.cancelAll();
  }

  Future<String?> reconcile(
    List<Task> tasks, {
    bool requestPermission = false,
  }) async {
    try {
      await NotificationHub.cancelNamespace('task:');
      await NotificationHub.initialize(timezone: true);
      final android = NotificationHub.plugin
          .resolvePlatformSpecificImplementation<
            AndroidFlutterLocalNotificationsPlugin
          >();
      if (requestPermission && !await NotificationHub.requestPermission()) {
        return 'Đã lưu công việc. Quyền thông báo chưa được cấp; '
            'bạn có thể bật trong cài đặt Android.';
      }
      final now = tz.TZDateTime.now(tz.local);
      final enabled = await android?.areNotificationsEnabled() ?? true;
      var hasFutureReminder = false;
      for (final task in tasks) {
        if (!task.reminder || task.completed || task.dueMinutes == null)
          continue;
        final date = tz.TZDateTime(
          tz.local,
          task.dueDate.year,
          task.dueDate.month,
          task.dueDate.day,
          task.dueMinutes! ~/ 60,
          task.dueMinutes! % 60,
        );
        if (!date.isAfter(now)) {
          continue;
        }
        hasFutureReminder = true;
        if (!enabled) {
          continue;
        }
        await NotificationHub.plugin.zonedSchedule(
          id: task.id!,
          title: task.title,
          body:
              'Đến hạn lúc ${displayTime(task.dueMinutes!)} • ${task.category.label}',
          scheduledDate: date,
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
          payload: 'task:${task.id}',
        );
      }
      if (!enabled && hasFutureReminder) {
        return 'Thông báo đang bị tắt trong cài đặt Android. Dữ liệu vẫn được lưu.';
      }
      return null;
    } catch (_) {
      return 'Dữ liệu đã lưu, nhưng chưa thể cập nhật nhắc việc. '
          'Hãy mở lại ứng dụng và kiểm tra quyền thông báo.';
    }
  }
}
