import 'dart:async';

import 'package:flutter/material.dart';

import '../data/reminder_service.dart';
import '../data/task_repository.dart';
import '../models/task.dart';

class AppController extends ChangeNotifier {
  AppController(this.repository, this.reminders, {this.clearExtras});
  final Future<void> Function()? clearExtras;
  final TaskRepository repository;
  final ReminderService reminders;
  List<Task> _tasks = [];
  List<Task> get tasks => List.unmodifiable(_tasks);
  ThemeMode themeMode = ThemeMode.system;
  bool loading = true;
  bool busy = false;
  String? error;
  String? notice;
  Timer? _clock;

  Future<void> initialize() async {
    loading = true;
    error = null;
    notifyListeners();
    try {
      _tasks = await repository.load();
      final theme = await repository.loadTheme();
      themeMode = ThemeMode.values.firstWhere(
        (m) => m.name == theme,
        orElse: () => ThemeMode.system,
      );
      notice = await reminders.reconcile(_tasks);
      _clock ??= Timer.periodic(
        const Duration(seconds: 30),
        (_) => notifyListeners(),
      );
    } catch (_) {
      error =
          'Không thể đọc dữ liệu trên thiết bị. Hãy thử lại. '
          'Ứng dụng không tự xóa dữ liệu của bạn.';
    } finally {
      loading = false;
      notifyListeners();
    }
  }

  Future<void> refresh() async {
    if (busy || loading || error != null) {
      return;
    }
    try {
      await _change(() async {});
    } catch (_) {
      notice = 'Không thể tải lại dữ liệu. Hãy thử đóng và mở lại ứng dụng.';
      notifyListeners();
    }
  }

  Future<void> _change(
    Future<void> Function() action, {
    bool requestPermission = false,
  }) async {
    if (busy) {
      throw StateError('Vui lòng đợi thao tác trước hoàn tất.');
    }
    busy = true;
    notifyListeners();
    try {
      await action();
      _tasks = await repository.load();
      notice = await reminders.reconcile(
        _tasks,
        requestPermission: requestPermission,
      );
    } finally {
      busy = false;
      notifyListeners();
    }
  }

  Future<void> save(Task task) => _change(
    () => repository.save(task),
    requestPermission:
        task.reminder && task.dueMinutes != null && !task.completed,
  );

  Future<void> saveMany(List<Task> tasks) =>
      _change(() => repository.saveMany(tasks));

  Future<void> toggle(Task task) => save(task.withCompleted(!task.completed));
  Future<void> delete(Task task) => _change(() => repository.delete(task.id!));

  Future<void> setTheme(ThemeMode mode) async {
    await repository.saveTheme(mode.name);
    themeMode = mode;
    notifyListeners();
  }

  Future<void> clear() => _change(() async {
    await repository.clear();
    try {
      await reminders.cancelAll();
    } finally {
      await clearExtras?.call();
      themeMode = ThemeMode.system;
    }
  });

  void dismissNotice() {
    notice = null;
    notifyListeners();
  }

  @override
  void dispose() {
    _clock?.cancel();
    super.dispose();
  }
}
