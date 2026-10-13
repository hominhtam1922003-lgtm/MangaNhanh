import 'package:flutter/services.dart';
import 'package:flutter_local_notifications/flutter_local_notifications.dart';
import 'package:timezone/data/latest.dart' as tz_data;
import 'package:timezone/timezone.dart' as tz;

import '../models/task.dart';

class ReminderService {
  final _plugin = FlutterLocalNotificationsPlugin();
  static const _timezone = MethodChannel('vn.lichnhac.app/timezone');
  bool _initialized = false;

  Future<void> _initialize() async {
    if (_initialized) {
      return;
    }
    tz_data.initializeTimeZones();
    await _plugin.initialize(
      const InitializationSettings(
        android: AndroidInitializationSettings('ic_notification'),
      ),
    );
    _initialized = true;
  }

  Future<void> _updateTimeZone() async {
    final name = await _timezone.invokeMethod<String>('getTimeZone');
    if (name == null) {
      throw StateError('Không xác định được múi giờ thiết bị.');
    }
    try {
      tz.setLocalLocation(tz.getLocation(name));
    } on tz.LocationNotFoundException {
      // Android có thể trả tên GMT+07:00 thay vì tên IANA.
      // Chỉ dùng offset cho các vùng cố định, không fallback UTC cho vùng DST.
      final match = RegExp(r'^GMT([+-])(\d{2}):(\d{2})$').firstMatch(name);
      if (match == null) {
        rethrow;
      }
      final minutes =
          (int.parse(match[2]!) * 60 + int.parse(match[3]!)) *
          (match[1] == '-' ? -1 : 1);
      tz.setLocalLocation(
        tz.Location(name, [tz.minTime], [0], [
          tz.TimeZone(minutes * 60 * 1000, isDst: false, abbreviation: name),
        ]),
      );
    }
  }

  Future<String?> reconcile(
    List<Task> tasks, {
    bool requestPermission = false,
  }) async {
    try {
      await _initialize();
      // Hủy lịch cũ trước, kể cả nếu việc đọc múi giờ sau đó thất bại.
      // Công việc đã xóa/hoàn thành không được giữ lại lịch nhắc cũ.
      await _plugin.cancelAll();
      await _updateTimeZone();
      final android = _plugin
          .resolvePlatformSpecificImplementation<
            AndroidFlutterLocalNotificationsPlugin
          >();
      if (requestPermission) {
        final granted = await android?.requestNotificationsPermission();
        if (granted == false) {
          return 'Đã lưu công việc. Quyền thông báo chưa được cấp; '
              'bạn có thể bật trong cài đặt Android.';
        }
      }
      final now = tz.TZDateTime.now(tz.local);
      final enabled = await android?.areNotificationsEnabled() ?? true;
      var hasFutureReminder = false;
      for (final task in tasks) {
        if (!task.reminder || task.completed || task.dueMinutes == null) {
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
        if (!date.isAfter(now)) {
          continue;
        }
        hasFutureReminder = true;
        if (!enabled) {
          continue;
        }
        await _plugin.zonedSchedule(
          task.id!,
          task.title,
          'Đến hạn lúc ${displayTime(task.dueMinutes!)} • ${task.category.label}',
          date,
          const NotificationDetails(
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
