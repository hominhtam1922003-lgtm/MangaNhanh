import 'dart:math' as math;
import 'package:flutter/material.dart';
import '../models/weather.dart';

IconData weatherIcon(int? code, {bool? isDay}) => switch (code) {
  0 || 1 => isDay == false ? Icons.nightlight_round : Icons.wb_sunny_rounded,
  2 || 3 => Icons.cloud_rounded,
  45 || 48 => Icons.foggy,
  51 ||
  53 ||
  55 ||
  56 ||
  57 ||
  61 ||
  63 ||
  65 ||
  66 ||
  67 ||
  80 ||
  81 ||
  82 => Icons.water_drop_rounded,
  71 || 73 || 75 || 77 || 85 || 86 => Icons.ac_unit_rounded,
  95 || 96 || 99 => Icons.thunderstorm_rounded,
  _ => Icons.cloud_off_outlined,
};

class ForecastChart extends StatelessWidget {
  const ForecastChart({super.key, required this.hours, required this.data});
  final List<WeatherHour> hours;
  final WeatherData data;
  @override
  Widget build(BuildContext context) {
    final temperatures = hours
        .map((h) => h.temperature)
        .whereType<double>()
        .toList();
    if (hours.length < 2 || temperatures.isEmpty) {
      return const Text('Chưa đủ số liệu cho biểu đồ nhiệt độ.');
    }
    final lo = temperatures.reduce(math.min),
        hi = temperatures.reduce(math.max);
    final color = Theme.of(context).colorScheme.primary;
    String time(WeatherHour h) =>
        '${data.placeTime(h.at).hour.toString().padLeft(2, '0')}h';
    return Semantics(
      label:
          'Biểu đồ ${hours.length} giờ, nhiệt độ từ ${lo.toStringAsFixed(1)} đến ${hi.toStringAsFixed(1)} độ C',
      child: Column(
        crossAxisAlignment: CrossAxisAlignment.stretch,
        children: [
          Wrap(
            spacing: 24,
            runSpacing: 8,
            children: [
              Text('Cao ${hi.toStringAsFixed(1)}°'),
              Text('Thấp ${lo.toStringAsFixed(1)}°'),
            ],
          ),
          const SizedBox(height: 8),
          SizedBox(
            height: 110,
            child: CustomPaint(painter: _TemperatureLine(hours, color, lo, hi)),
          ),
          Row(
            mainAxisAlignment: MainAxisAlignment.spaceBetween,
            children: [
              Text(time(hours.first)),
              Text(time(hours[hours.length ~/ 2])),
              Text(time(hours.last)),
            ],
          ),
        ],
      ),
    );
  }
}

class _TemperatureLine extends CustomPainter {
  _TemperatureLine(this.hours, this.color, this.lo, this.hi);
  final List<WeatherHour> hours;
  final Color color;
  final double lo, hi;
  @override
  void paint(Canvas canvas, Size size) {
    final line = Paint()
      ..color = color
      ..strokeWidth = 2.5
      ..style = PaintingStyle.stroke
      ..strokeCap = StrokeCap.round;
    final grid = Paint()
      ..color = color.withValues(alpha: .12)
      ..strokeWidth = 1;
    for (var i = 1; i <= 3; i++) {
      final y = size.height * i / 4;
      canvas.drawLine(Offset(0, y), Offset(size.width, y), grid);
    }
    final path = Path();
    var connected = false;
    for (var i = 0; i < hours.length; i++) {
      final t = hours[i].temperature;
      if (t == null) {
        connected = false;
        continue;
      }
      final x = size.width * i / (hours.length - 1),
          y = 12 + (size.height - 24) * (1 - (t - lo) / math.max(1, hi - lo));
      if (!connected) {
        path.moveTo(x, y);
        connected = true;
      } else {
        path.lineTo(x, y);
      }
      canvas.drawCircle(Offset(x, y), 2.5, Paint()..color = color);
    }
    canvas.drawPath(path, line);
  }

  @override
  bool shouldRepaint(_TemperatureLine old) =>
      old.hours != hours || old.color != color;
}
