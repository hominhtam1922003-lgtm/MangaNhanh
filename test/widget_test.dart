import 'package:flutter/material.dart';
import 'package:flutter_localizations/flutter_localizations.dart';
import 'package:flutter_test/flutter_test.dart';
import 'package:sqflite_common_ffi/sqflite_ffi.dart';
import 'package:lich_nhac/app/weather_controller.dart';
import 'package:lich_nhac/data/weather_api.dart';
import 'package:lich_nhac/data/weather_background.dart';
import 'package:lich_nhac/models/weather.dart';
import 'package:lich_nhac/features/weather/weather_screen.dart';
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

  testWidgets('Thời tiết không tràn màn hình nhỏ khi tăng cỡ chữ', (
    tester,
  ) async {
    tester.view.physicalSize = const Size(320, 640);
    tester.view.devicePixelRatio = 1;
    addTearDown(tester.view.resetPhysicalSize);
    addTearDown(tester.view.resetDevicePixelRatio);
    final previousErrorHandler = FlutterError.onError;
    FlutterError.onError = (details) {
      debugPrint(details.toString());
      previousErrorHandler?.call(details);
    };
    addTearDown(() => FlutterError.onError = previousErrorHandler);
    final weather = WeatherController(
      controller.repository,
      WeatherApi(),
      WeatherBackground(),
    );
    addTearDown(weather.dispose);
    final now = DateTime.now().toUtc();
    final epoch = now.millisecondsSinceEpoch ~/ 1000;
    weather.data = WeatherData.fromApi(
      {
        'timezone': 'Asia/Ho_Chi_Minh',
        'utc_offset_seconds': 25200,
        'current': {
          'time': epoch,
          'temperature_2m': 31,
          'relative_humidity_2m': 80,
          'wind_speed_10m': 12,
          'weather_code': 0,
        },
        'hourly': {
          'time': List.generate(24, (i) => epoch + i * 3600),
          'temperature_2m': List.filled(24, 31),
          'precipitation_probability': List.filled(24, 80),
        },
        'daily': {
          'time': List.generate(7, (i) => epoch + i * 86400),
          'temperature_2m_min': List.filled(7, 25),
          'temperature_2m_max': List.filled(7, 34),
          'precipitation_probability_max': List.filled(7, 80),
          'weather_code': List.filled(7, 61),
        },
      },
      WeatherPlace.myTho,
      now,
    );
    await tester.pumpWidget(
      host(
        Builder(
          builder: (context) => MediaQuery(
            data: MediaQuery.of(
              context,
            ).copyWith(textScaler: const TextScaler.linear(1.5)),
            child: Scaffold(body: WeatherScreen(controller: weather)),
          ),
        ),
      ),
    );
    expect(tester.takeException(), isNull);
    for (var i = 0; i < 12; i++) {
      await tester.drag(find.byType(Scrollable).first, const Offset(0, -350));
      await tester.pumpAndSettle();
      expect(tester.takeException(), isNull);
    }
  });

  testWidgets(
    'Ngang rộng dùng rail, lịch có âm từng ô và không kéo giãn vuông',
    (tester) async {
      tester.view.physicalSize = const Size(1440, 800);
      tester.view.devicePixelRatio = 1;
      addTearDown(tester.view.resetPhysicalSize);
      addTearDown(tester.view.resetDevicePixelRatio);
      await tester.pumpWidget(host(HomeScreen(controller: controller)));
      expect(find.byType(NavigationRail), findsOneWidget);
      expect(find.byType(NavigationBar), findsNothing);
      await tester.tap(find.text('Lịch').last);
      await tester.pumpAndSettle();
      final grid = tester.widget<GridView>(find.byType(GridView));
      final delegate =
          grid.gridDelegate as SliverGridDelegateWithFixedCrossAxisCount;
      expect(delegate.mainAxisExtent, lessThan(100));
      expect(find.text('Số nhỏ: âm lịch'), findsOneWidget);
      expect(tester.takeException(), isNull);
    },
  );

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
      find.widgetWithText(SwitchListTile, 'Bật nhắc việc'),
    );
    expect(reminder.onChanged, isNull);
    await tester.ensureVisible(find.text('Lưu công việc'));
    await tester.tap(find.text('Lưu công việc'));
    await tester.pumpAndSettle();
    expect(find.text('Vui lòng nhập tiêu đề công việc.'), findsOneWidget);
    expect(tester.takeException(), isNull);
  });
}
