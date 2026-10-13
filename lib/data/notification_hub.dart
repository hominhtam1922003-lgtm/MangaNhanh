import 'package:flutter/services.dart';
import 'package:flutter_local_notifications/flutter_local_notifications.dart';
import 'package:timezone/data/latest.dart' as tz_data;
import 'package:timezone/timezone.dart' as tz;

class NotificationHub {
  static final plugin = FlutterLocalNotificationsPlugin();
  static bool _initialized = false;

  static Future<void> initialize({bool timezone = false}) async {
    if (!_initialized) {
      await plugin.initialize(
        settings: const InitializationSettings(
          android: AndroidInitializationSettings('ic_notification'),
        ),
      );
      _initialized = true;
    }
    if (timezone) {
      tz_data.initializeTimeZones();
      final name = await const MethodChannel(
        'vn.lichnhac.app/timezone',
      ).invokeMethod<String>('getTimeZone');
      if (name == null) {
        throw StateError('Không xác định được múi giờ.');
      }
      try {
        tz.setLocalLocation(tz.getLocation(name));
      } on tz.LocationNotFoundException {
        final match = RegExp(r'^GMT([+-])(\d{2}):(\d{2})$').firstMatch(name);
        if (match == null) {
          rethrow;
        }
        final minutes =
            (int.parse(match[2]!) * 60 + int.parse(match[3]!)) *
            (match[1] == '-' ? -1 : 1);
        tz.setLocalLocation(
          tz.Location(name, [tz.minTime], [0], [
            tz.TimeZone(
              Duration(minutes: minutes),
              isDst: false,
              abbreviation: name,
            ),
          ]),
        );
      }
    }
  }

  static Future<bool> requestPermission() async {
    await initialize();
    return await plugin
            .resolvePlatformSpecificImplementation<
              AndroidFlutterLocalNotificationsPlugin
            >()
            ?.requestNotificationsPermission() ??
        false;
  }

  static Future<void> cancelNamespace(String prefix) async {
    await initialize();
    for (final notification in await plugin.pendingNotificationRequests()) {
      if (notification.payload?.startsWith(prefix) ?? false) {
        await plugin.cancel(id: notification.id);
      }
    }
  }
}
