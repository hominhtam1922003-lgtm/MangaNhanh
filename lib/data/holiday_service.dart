import 'package:flutter_local_notifications/flutter_local_notifications.dart';
import 'package:timezone/timezone.dart' as tz;
import '../models/holiday.dart';
import 'notification_hub.dart';
import 'task_repository.dart';

class HolidayService {
  HolidayService(this.repository);
  final TaskRepository repository;
  Future<String?> schedule({bool requestPermission = false}) async {
    try {
      await NotificationHub.cancelNamespace('holiday:');
      final enabled = await repository.setting('holiday.enabled') == 'true';
      if (!enabled) {
        return null;
      }
      await NotificationHub.initialize(timezone: true);
      if (requestPermission && !await NotificationHub.requestPermission()) {
        return 'Đã lưu cài đặt. Quyền thông báo chưa được cấp.';
      }
      final before =
          int.tryParse(await repository.setting('holiday.before') ?? '') ?? 1;
      final all = await repository.setting('holiday.all') == 'true';
      final now = tz.TZDateTime.now(tz.local);
      final holidays = [
        ...holidaysForYear(now.year),
        ...holidaysForYear(now.year + 1),
      ];
      for (final holiday in holidays) {
        if (!all && !holiday.publicHoliday) {
          continue;
        }
        final at = tz.TZDateTime(
          tz.local,
          holiday.date.year,
          holiday.date.month,
          holiday.date.day - before,
          9,
        );
        if (!at.isAfter(now) || at.difference(now) > const Duration(days: 370))
          continue;
        await NotificationHub.plugin.zonedSchedule(
          id: holiday.id,
          title: 'Sắp đến ${holiday.title}',
          body:
              'Còn $before ngày • ${holiday.description}. Kiểm tra lịch nghỉ thực tế tại cơ quan của bạn.',
          scheduledDate: at,
          androidScheduleMode: AndroidScheduleMode.inexactAllowWhileIdle,
          notificationDetails: const NotificationDetails(
            android: AndroidNotificationDetails(
              'holiday_reminders',
              'Nhắc ngày lễ',
              icon: 'ic_notification',
              channelDescription: 'Ngày lễ và ngày kỷ niệm Việt Nam',
              importance: Importance.defaultImportance,
            ),
          ),
          payload: 'holiday:${holiday.id}',
        );
      }
      return null;
    } catch (_) {
      return 'Chưa cập nhật được nhắc ngày lễ. Hãy kiểm tra quyền thông báo và mở lại ứng dụng.';
    }
  }
}
