import 'package:flutter/material.dart';
import 'package:flutter_localizations/flutter_localizations.dart';
import 'package:flutter_test/flutter_test.dart';
import 'package:sqflite_common_ffi/sqflite_ffi.dart';
import 'package:lich_nhac/app/app_controller.dart';
import 'package:lich_nhac/data/app_database.dart';
import 'package:lich_nhac/data/reminder_service.dart';
import 'package:lich_nhac/data/task_repository.dart';
import 'package:lich_nhac/features/home_screen.dart';
import 'package:lich_nhac/features/task_editor.dart';

Widget host(Widget child) => MaterialApp(
  locale: const Locale('vi'),
  supportedLocales: const [Locale('vi')],
  localizationsDelegates: GlobalMaterialLocalizations.delegates,
  theme: ThemeData(useMaterial3: true),
  home: child,
);

void main() {
  late AppController controller;
  setUp(() {
    controller = AppController(
      TaskRepository(AppDatabase(factory: databaseFactoryFfi)),
      ReminderService(),
    );
    controller.loading = false;
  });
  tearDown(() => controller.dispose());

  testWidgets('Bốn màn hình trên điện thoại nhỏ không tràn giao diện', (
    tester,
  ) async {
    tester.view.physicalSize = const Size(320, 640);
    tester.view.devicePixelRatio = 1;
    addTearDown(tester.view.resetPhysicalSize);
    addTearDown(tester.view.resetDevicePixelRatio);
    await tester.pumpWidget(host(HomeScreen(controller: controller)));
    await tester.scrollUntilVisible(
      find.text('Hôm nay chưa có công việc'),
      150,
      scrollable: find.byType(Scrollable).first,
    );
    expect(find.text('Hôm nay chưa có công việc'), findsOneWidget);
    expect(tester.takeException(), isNull);
    for (final label in ['Lịch', 'Việc', 'Tiện ích']) {
      await tester.tap(find.text(label).last);
      await tester.pumpAndSettle();
      expect(tester.takeException(), isNull);
    }
  });

  testWidgets('Form thêm kiểm tra tiêu đề và không bật nhắc khi chưa có giờ', (
    tester,
  ) async {
    await tester.pumpWidget(
      host(
        TaskEditor(controller: controller, initialDate: DateTime(2026, 10, 13)),
      ),
    );
    expect(find.text('13/10/2026'), findsOneWidget);
    final reminder = tester.widget<SwitchListTile>(
      find.widgetWithText(SwitchListTile, 'Nhắc bằng thông báo'),
    );
    expect(reminder.onChanged, isNull);
    await tester.ensureVisible(find.text('Lưu công việc'));
    await tester.tap(find.text('Lưu công việc'));
    await tester.pumpAndSettle();
    expect(find.text('Vui lòng nhập tiêu đề công việc.'), findsOneWidget);
    expect(tester.takeException(), isNull);
  });
}
