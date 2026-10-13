import 'package:flutter/material.dart';
import 'package:flutter_localizations/flutter_localizations.dart';

import '../features/home_screen.dart';
import 'app_controller.dart';
import 'weather_controller.dart';
import '../data/holiday_service.dart';

class LichNhacApp extends StatefulWidget {
  const LichNhacApp({super.key, required this.controller, this.weather});
  final AppController controller;
  final WeatherController? weather;

  @override
  State<LichNhacApp> createState() => _LichNhacAppState();
}

class _LichNhacAppState extends State<LichNhacApp> with WidgetsBindingObserver {
  @override
  void initState() {
    super.initState();
    WidgetsBinding.instance.addObserver(this);
    _initialize();
  }

  Future<void> _initialize() async {
    await widget.controller.initialize();
    if (widget.controller.error == null) {
      await widget.weather?.initialize();
      await HolidayService(widget.controller.repository).schedule();
    }
  }

  @override
  void didChangeAppLifecycleState(AppLifecycleState state) {
    if (state == AppLifecycleState.resumed) {
      widget.controller.refresh();
      widget.weather?.loadCache().catchError((Object _) {});
      HolidayService(widget.controller.repository).schedule();
    }
  }

  @override
  void dispose() {
    WidgetsBinding.instance.removeObserver(this);
    widget.controller.dispose();
    widget.weather?.dispose();
    super.dispose();
  }

  ThemeData _theme(Brightness brightness) {
    final scheme = ColorScheme.fromSeed(
      seedColor: const Color(0xFF4262C5),
      brightness: brightness,
    );
    return ThemeData(
      useMaterial3: true,
      colorScheme: scheme,
      scaffoldBackgroundColor: scheme.surface,
      inputDecorationTheme: const InputDecorationTheme(
        border: OutlineInputBorder(),
      ),
    );
  }

  @override
  Widget build(BuildContext context) => AnimatedBuilder(
    animation: widget.controller,
    builder: (context, _) => MaterialApp(
      title: 'Lịch Nhắc',
      debugShowCheckedModeBanner: false,
      locale: const Locale('vi'),
      supportedLocales: const [Locale('vi')],
      localizationsDelegates: GlobalMaterialLocalizations.delegates,
      theme: _theme(Brightness.light),
      darkTheme: _theme(Brightness.dark),
      themeMode: widget.controller.themeMode,
      home: HomeScreen(controller: widget.controller, weather: widget.weather),
    ),
  );
}
