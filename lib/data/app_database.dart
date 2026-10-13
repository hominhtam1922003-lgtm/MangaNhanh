import 'package:path/path.dart' as p;
import 'package:sqflite/sqflite.dart';

class AppDatabase {
  AppDatabase({DatabaseFactory? factory, this.path})
    : _factory = factory ?? databaseFactory;

  static const schemaVersion = 3;
  final DatabaseFactory _factory;
  final String? path;
  Database? _database;

  Future<Database> open() async {
    return _database ??= await _factory.openDatabase(
      path ?? p.join(await _factory.getDatabasesPath(), 'lich_nhac.db'),
      options: OpenDatabaseOptions(
        version: schemaVersion,
        onCreate: (db, version) => _migrate(db, 0, version),
        onUpgrade: _migrate,
      ),
    );
  }

  // sqflite thực thi onCreate/onUpgrade trong transaction.
  // Mỗi bước thêm schema, tuyệt đối không drop bảng hoặc dữ liệu người dùng.
  static Future<void> _migrate(
    Database db,
    int oldVersion,
    int newVersion,
  ) async {
    for (var version = oldVersion + 1; version <= newVersion; version++) {
      switch (version) {
        case 1:
          await db.execute('''
            CREATE TABLE tasks (
              id INTEGER PRIMARY KEY AUTOINCREMENT,
              title TEXT NOT NULL CHECK(length(trim(title)) BETWEEN 1 AND 100),
              notes TEXT NOT NULL DEFAULT '',
              due_date TEXT NOT NULL,
              due_minutes INTEGER CHECK(due_minutes BETWEEN 0 AND 1439),
              category TEXT NOT NULL,
              priority TEXT NOT NULL,
              completed INTEGER NOT NULL DEFAULT 0 CHECK(completed IN (0, 1)),
              reminder INTEGER NOT NULL DEFAULT 0 CHECK(reminder IN (0, 1))
            )
          ''');
        case 2:
          await db.execute('CREATE INDEX tasks_due_date ON tasks(due_date)');
          await db.execute('''
            CREATE TABLE settings (key TEXT PRIMARY KEY, value TEXT NOT NULL)
          ''');
        case 3:
          await db.execute(
            'ALTER TABLE tasks ADD COLUMN alarm INTEGER NOT NULL DEFAULT 0 CHECK(alarm IN (0, 1))',
          );
        default:
          // Từ chối schema chưa định nghĩa, rollback thay vì làm mất dữ liệu.
          throw StateError('Không có migration cho schema phiên bản $version.');
      }
    }
  }

  Future<void> close() async {
    await _database?.close();
    _database = null;
  }
}
