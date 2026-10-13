import 'package:flutter/material.dart';
import 'package:flutter_secure_storage/flutter_secure_storage.dart';

import 'app/app_controller.dart';
import 'app/lich_nhac_app.dart';
import 'app/weather_controller.dart';
import 'data/app_database.dart';
import 'data/reminder_service.dart';
import 'data/task_repository.dart';
import 'data/weather_api.dart';
import 'data/weather_background.dart';

void main() {
  WidgetsFlutterBinding.ensureInitialized();
  final repository = TaskRepository(AppDatabase());
  final weather = WeatherController(
    repository,
    WeatherApi(),
    WeatherBackground(),
  );
  final controller = AppController(
    repository,
    ReminderService(),
    clearExtras: () async {
      await weather.reset();
      await const FlutterSecureStorage().deleteAll();
    },
  );
  runApp(LichNhacApp(controller: controller, weather: weather));
}
