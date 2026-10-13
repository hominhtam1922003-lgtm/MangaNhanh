import '../models/task.dart';
import 'app_database.dart';

class TaskRepository {
  TaskRepository(this.database);
  final AppDatabase database;

  Future<List<Task>> load() async {
    final db = await database.open();
    final rows = await db.query('tasks', orderBy: 'due_date, due_minutes, id');
    return rows.map(Task.fromMap).toList();
  }

  Future<void> save(Task task) async {
    final error = validateTitle(task.title);
    if (error != null) {
      throw ArgumentError(error);
    }
    final db = await database.open();
    if (task.id == null) {
      await db.insert('tasks', task.toMap());
    } else {
      final count = await db.update(
        'tasks',
        task.toMap(),
        where: 'id = ?',
        whereArgs: [task.id],
      );
      if (count != 1) {
        throw StateError('Công việc không còn tồn tại.');
      }
    }
  }

  Future<void> saveMany(List<Task> tasks) async {
    for (final task in tasks) {
      final error = validateTitle(task.title);
      if (error != null) {
        throw ArgumentError(error);
      }
    }
    final db = await database.open();
    await db.transaction((txn) async {
      for (final task in tasks) {
        await txn.insert('tasks', task.toMap());
      }
    });
  }

  Future<String?> setting(String key) async {
    final db = await database.open();
    final rows = await db.query('settings', where: 'key = ?', whereArgs: [key]);
    return rows.isEmpty ? null : rows.first['value'] as String;
  }

  Future<void> setSetting(String key, String value) async {
    final db = await database.open();
    await db.rawInsert(
      'INSERT OR REPLACE INTO settings(key, value) VALUES(?, ?)',
      [key, value],
    );
  }

  Future<void> delete(int id) async {
    final db = await database.open();
    await db.delete('tasks', where: 'id = ?', whereArgs: [id]);
  }

  Future<String> loadTheme() async {
    final db = await database.open();
    final rows = await db.query(
      'settings',
      where: 'key = ?',
      whereArgs: ['theme'],
    );
    return rows.isEmpty ? 'system' : rows.first['value'] as String;
  }

  Future<void> saveTheme(String value) async {
    final db = await database.open();
    await db.rawInsert(
      'INSERT OR REPLACE INTO settings(key, value) VALUES(?, ?)',
      ['theme', value],
    );
  }

  Future<void> clear() async {
    final db = await database.open();
    await db.transaction((txn) async {
      await txn.delete('tasks');
      await txn.delete('settings');
      // Không reset AUTOINCREMENT để ID của thông báo cũ không bị tái sử dụng.
    });
  }
}
