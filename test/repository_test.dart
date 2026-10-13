import 'dart:io';

import 'package:flutter_test/flutter_test.dart';
import 'package:lich_nhac/data/app_database.dart';
import 'package:lich_nhac/data/task_repository.dart';
import 'package:lich_nhac/models/task.dart';
import 'package:sqflite_common_ffi/sqflite_ffi.dart';

void main() {
  late Directory directory;
  late AppDatabase database;
  late TaskRepository repository;
  late String path;

  setUpAll(sqfliteFfiInit);
  setUp(() async {
    directory = await Directory.systemTemp.createTemp('lich_nhac_test_');
    path = '${directory.path}/test.db';
    database = AppDatabase(factory: databaseFactoryFfi, path: path);
    repository = TaskRepository(database);
  });
  tearDown(() async {
    await database.close();
    await directory.delete(recursive: true);
  });

  test('Cài lần đầu không có dữ liệu mẫu, schema có phiên bản', () async {
    expect(await repository.load(), isEmpty);
    expect(await repository.loadTheme(), 'system');
    expect(
      await (await database.open()).getVersion(),
      AppDatabase.schemaVersion,
    );
  });

  test('Nâng cấp schema v1 lên v2 giữ nguyên công việc cũ', () async {
    final oldDb = await databaseFactoryFfi.openDatabase(
      path,
      options: OpenDatabaseOptions(
        version: 1,
        onCreate: (db, _) async {
          await db.execute('''
          CREATE TABLE tasks (
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            title TEXT NOT NULL, notes TEXT NOT NULL,
            due_date TEXT NOT NULL, due_minutes INTEGER,
            category TEXT NOT NULL, priority TEXT NOT NULL,
            completed INTEGER NOT NULL, reminder INTEGER NOT NULL
          )
        ''');
        },
      ),
    );
    await oldDb.insert(
      'tasks',
      Task(
        title: 'Dữ liệu v1',
        dueDate: DateTime(2026, 10, 13),
        dueMinutes: 900,
        reminder: true,
      ).toMap(),
    );
    await oldDb.close();
    final restored = (await repository.load()).single;
    expect(restored.title, 'Dữ liệu v1');
    expect(restored.dueMinutes, 900);
    expect(restored.reminder, isTrue);
    expect(await (await database.open()).getVersion(), 2);
    expect(await repository.loadTheme(), 'system');
    await repository.saveTheme('dark');
    expect(await repository.loadTheme(), 'dark');
  });

  test('Thêm, sửa, hoàn thành, xóa', () async {
    await repository.save(
      Task(title: 'Việc mới', dueDate: DateTime(2026, 10, 13)),
    );
    var tasks = await repository.load();
    final id = tasks.single.id;
    expect(id, isNotNull);
    await repository.save(
      Task(
        id: id,
        title: 'Đã sửa',
        notes: 'Nội dung',
        dueDate: DateTime(2026, 10, 14),
        dueMinutes: 480,
        reminder: true,
        category: TaskCategory.work,
        priority: TaskPriority.high,
      ),
    );
    tasks = await repository.load();
    expect(tasks.single.title, 'Đã sửa');
    expect(tasks.single.reminder, isTrue);
    await repository.save(tasks.single.withCompleted(true));
    expect((await repository.load()).single.completed, isTrue);
    await repository.delete(id!);
    expect(await repository.load(), isEmpty);
  });

  test(
    'Lưu kế hoạch AI nhiều việc và từ chối toàn bộ nhóm không hợp lệ',
    () async {
      await repository.saveMany([
        Task(title: 'A', dueDate: DateTime(2026)),
        Task(title: 'B', dueDate: DateTime(2026)),
      ]);
      expect((await repository.load()).length, 2);
      await expectLater(
        repository.saveMany([
          Task(title: 'C', dueDate: DateTime(2026)),
          Task(title: ' ', dueDate: DateTime(2026)),
        ]),
        throwsArgumentError,
      );
      expect((await repository.load()).length, 2);
    },
  );

  test('Cài đặt thời tiết tồn tại qua mở lại và mất khi xóa toàn bộ', () async {
    await repository.setSetting('weather.settings', '{"enabled":true}');
    await database.close();
    expect(await repository.setting('weather.settings'), '{"enabled":true}');
    await repository.clear();
    expect(await repository.setting('weather.settings'), isNull);
  });

  test('Đóng/mở database giữ công việc và giao diện', () async {
    await repository.save(
      Task(
        title: 'Bền vững',
        dueDate: DateTime(2026, 10, 13),
        dueMinutes: 1200,
        reminder: true,
      ),
    );
    await repository.saveTheme('dark');
    await database.close();
    database = AppDatabase(factory: databaseFactoryFfi, path: path);
    repository = TaskRepository(database);
    final task = (await repository.load()).single;
    expect(task.title, 'Bền vững');
    expect(task.dueDate, DateTime(2026, 10, 13));
    expect(task.dueMinutes, 1200);
    expect(task.reminder, isTrue);
    expect(await repository.loadTheme(), 'dark');
  });

  test('Từ chối tiêu đề không hợp lệ, giữ dữ liệu cũ', () async {
    await repository.save(Task(title: 'Hợp lệ', dueDate: DateTime(2026)));
    await expectLater(
      repository.save(Task(title: ' ', dueDate: DateTime(2026))),
      throwsArgumentError,
    );
    expect((await repository.load()).single.title, 'Hợp lệ');
  });

  test('Xóa toàn bộ công việc và cài đặt; không tái dùng ID', () async {
    await repository.save(Task(title: 'A', dueDate: DateTime(2026)));
    final oldId = (await repository.load()).single.id!;
    await repository.saveTheme('light');
    await repository.clear();
    expect(await repository.load(), isEmpty);
    expect(await repository.loadTheme(), 'system');
    await repository.save(Task(title: 'B', dueDate: DateTime(2026)));
    expect((await repository.load()).single.id!, greaterThan(oldId));
  });
}
