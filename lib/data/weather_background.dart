import 'dart:ui';

import 'package:flutter/widgets.dart';
import 'package:flutter_local_notifications/flutter_local_notifications.dart';
import 'package:workmanager/workmanager.dart';

import '../models/weather.dart';
import 'app_database.dart';
import 'notification_hub.dart';
import 'task_repository.dart';
import 'weather_api.dart';

@pragma('vm:entry-point')
void weatherDispatcher() {
  Workmanager().executeTask((task, inputData) async {
    WidgetsFlutterBinding.ensureInitialized();
    DartPluginRegistrant.ensureInitialized();
    final database = AppDatabase();
    try {
      final repository = TaskRepository(database);
      final value = await repository.setting('weather.settings');
      if (value == null) {
        return true;
      }
      final settings = WeatherSettings.decode(value);
      if (!settings.enabled) {
        return true;
      }
      final data = await WeatherApi().fetch(settings.place);
      await repository.setSetting('weather.cache', data.encode());
      await repository.setSetting(
        'weather.background',
        DateTime.now().toUtc().toIso8601String(),
      );
      await sendWeatherAlerts(repository, settings, data);
      return true;
    } catch (_) {
      return false; // WorkManager thử lại theo chính sách nền của Android.
    } finally {
      await database.close();
    }
  });
}

Future<void> sendWeatherAlerts(
  TaskRepository repository,
  WeatherSettings settings,
  WeatherData data,
) async {
  final now = DateTime.now().toUtc();
  final alerts = evaluateWeather(data, settings, now);
  if (alerts.isEmpty) {
    return;
  }
  await NotificationHub.initialize();
  final enabled =
      await NotificationHub.plugin
          .resolvePlatformSpecificImplementation<
            AndroidFlutterLocalNotificationsPlugin
          >()
          ?.areNotificationsEnabled() ??
      false;
  if (!enabled) {
    return;
  }
  const ids = {
    'rain': 1600000001,
    'heat': 1600000002,
    'wind': 1600000003,
    'sun': 1600000004,
  };
  for (final alert in alerts) {
    final key = 'weather.alert.${alert.type}';
    final last = DateTime.tryParse(await repository.setting(key) ?? '');
    if (last != null && now.difference(last) < const Duration(hours: 4))
      continue;
    final local = data.placeTime(alert.at);
    await NotificationHub.plugin.show(
      id: ids[alert.type]!,
      title: alert.title,
      body:
          '${settings.place.name} • khoảng ${local.hour.toString().padLeft(2, '0')}:${local.minute.toString().padLeft(2, '0')}. '
          '${alert.message} Nguồn: Open-Meteo, đây là dự báo.',
      notificationDetails: const NotificationDetails(
        android: AndroidNotificationDetails(
          'weather_alerts',
          'Cảnh báo thời tiết',
          channelDescription: 'Dự báo mưa, nắng nóng và gió mạnh',
          importance: Importance.high,
          priority: Priority.high,
          icon: 'ic_notification',
        ),
      ),
      payload: 'weather:${alert.type}',
    );
    await repository.setSetting(key, now.toIso8601String());
  }
}

class WeatherBackground {
  bool _ready = false;
  Future<void> configure(bool enabled) async {
    if (!_ready) {
      await Workmanager().initialize(weatherDispatcher);
      _ready = true;
    }
    await Workmanager().cancelByUniqueName('lich_nhac_weather');
    if (enabled) {
      await Workmanager().registerPeriodicTask(
        'lich_nhac_weather',
        'weather_check',
        frequency: const Duration(minutes: 15),
        constraints: Constraints(networkType: NetworkType.connected),
      );
    }
  }
}
