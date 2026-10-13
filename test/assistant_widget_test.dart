import 'package:flutter/material.dart';
import 'package:flutter_localizations/flutter_localizations.dart';
import 'package:flutter_test/flutter_test.dart';
import 'package:sqflite_common_ffi/sqflite_ffi.dart';
import 'package:lich_nhac/app/app_controller.dart';
import 'package:lich_nhac/data/app_database.dart';
import 'package:lich_nhac/data/task_repository.dart';
import 'package:lich_nhac/data/reminder_service.dart';
import 'package:lich_nhac/data/groq_service.dart';
import 'package:lich_nhac/models/task.dart';
import 'package:lich_nhac/features/assistant/assistant_screen.dart';

class FakeGroq extends GroqService {
  final received = <String>[];
  @override
  Future<bool> hasKey() async => true;
  @override
  Future<List<String>> models() async => ['actual-discovered-model'];
  @override
  Future<GroqReply> chat(
    String text, {
    String preferred = '',
    List<ChatMessage> history = const [],
    List<Task> contextTasks = const [],
  }) async {
    received.add(text);
    return const GroqReply(
      'Tôi nghe bạn. Bạn muốn trao đổi điều gì?',
      'actual-discovered-model',
    );
  }
}

void main() {
  late AppDatabase database;
  late AppController controller;
  late FakeGroq service;
  setUp(() {
    sqfliteFfiInit();
    database = AppDatabase(
      factory: databaseFactoryFfi,
      path: inMemoryDatabasePath,
    );
    controller = AppController(TaskRepository(database), ReminderService());
    service = FakeGroq();
  });
  tearDown(() async {
    controller.dispose();
    service.dispose();
    await database.close();
  });
  Widget host({double keyboard = 0}) => MaterialApp(
    locale: const Locale('vi'),
    supportedLocales: const [Locale('vi')],
    localizationsDelegates: GlobalMaterialLocalizations.delegates,
    home: Builder(
      builder: (context) => MediaQuery(
        data: MediaQuery.of(context).copyWith(
          textScaler: const TextScaler.linear(1.5),
          viewInsets: EdgeInsets.only(bottom: keyboard),
        ),
        child: AssistantScreen(controller: controller, service: service),
      ),
    ),
  );
  testWidgets(
    'Chat nhỏ/chữ lớn, gửi/nhận thật qua service và lưu SQLite, không tự tạo việc',
    (tester) async {
      tester.view.physicalSize = const Size(320, 640);
      tester.view.devicePixelRatio = 1;
      addTearDown(tester.view.resetPhysicalSize);
      addTearDown(tester.view.resetDevicePixelRatio);
      await tester.pumpWidget(host());
      await tester.pumpAndSettle();
      expect(tester.takeException(), isNull);
      await tester.enterText(
        find.byType(TextFormField),
        'Chào bạn, tôi muốn hỏi',
      );
      await tester.tap(find.byTooltip('Gửi tin nhắn'));
      await tester.pumpAndSettle();
      expect(service.received, ['Chào bạn, tôi muốn hỏi']);
      expect(
        find.text('Tôi nghe bạn. Bạn muốn trao đổi điều gì?'),
        findsOneWidget,
      );
      expect(
        await controller.repository.setting('groq.chat'),
        contains('Chào bạn'),
      );
      expect(await controller.repository.load(), isEmpty);
      expect(tester.takeException(), isNull);
    },
  );
  testWidgets('Composer khi mở bàn phím không tràn màn nhỏ', (tester) async {
    tester.view.physicalSize = const Size(320, 640);
    tester.view.devicePixelRatio = 1;
    addTearDown(tester.view.resetPhysicalSize);
    addTearDown(tester.view.resetDevicePixelRatio);
    await tester.pumpWidget(host(keyboard: 260));
    await tester.pumpAndSettle();
    expect(tester.takeException(), isNull);
  });
}
