import 'package:flutter/material.dart';

import 'app/app_controller.dart';
import 'app/lich_nhac_app.dart';
import 'data/app_database.dart';
import 'data/reminder_service.dart';
import 'data/task_repository.dart';

void main() {
  WidgetsFlutterBinding.ensureInitialized();
  final controller = AppController(
    TaskRepository(AppDatabase()),
    ReminderService(),
  );
  runApp(LichNhacApp(controller: controller));
}
