import 'dart:convert';
import 'package:flutter_test/flutter_test.dart';
import 'package:http/http.dart' as http;
import 'package:http/testing.dart';
import 'package:lich_nhac/data/weather_api.dart';
import 'package:lich_nhac/models/weather.dart';

Map<String, dynamic> fixture(
  DateTime now, {
  double? probability = 80,
  double? rain = 1,
  double? temperature = 36,
  double? gust = 55,
  int? code = 61,
}) {
  final epoch = now.toUtc().millisecondsSinceEpoch ~/ 1000;
  return {
    'timezone': 'Asia/Ho_Chi_Minh',
    'utc_offset_seconds': 25200,
    'current': <String, dynamic>{
      'time': epoch,
      'temperature_2m': 30,
      'weather_code': code,
    },
    'hourly': {
      'time': [epoch + 3600],
      'temperature_2m': [temperature],
      'precipitation_probability': [probability],
      'precipitation': [rain],
      'weather_code': [code],
      'wind_gusts_10m': [gust],
      'wind_speed_10m': [20],
      'uv_index': [4],
      'is_day': [1],
    },
    'daily': <String, dynamic>{
      'time': [epoch],
      'temperature_2m_min': [25],
      'temperature_2m_max': [34],
      'precipitation_probability_max': [probability],
      'weather_code': [code],
    },
  };
}

void main() {
  final now = DateTime.utc(2026, 10, 13, 8);
  WeatherData data({
    double? probability = 80,
    double? rain = 1,
    double? temperature = 36,
    double? gust = 55,
    int? code = 61,
  }) => WeatherData.fromApi(
    fixture(
      now,
      probability: probability,
      rain: rain,
      temperature: temperature,
      gust: gust,
      code: code,
    ),
    WeatherPlace.myTho,
    now,
  );
  test('Chi tiết mới đọc dữ liệu thật, cache cũ trả null', () {
    final raw = fixture(now);
    (raw['current'] as Map<String, dynamic>).addAll({
      'wind_gusts_10m': 31,
      'wind_direction_10m': 170,
      'precipitation': .4,
      'cloud_cover': 60,
      'surface_pressure': 1005,
      'is_day': 0,
    });
    (raw['daily'] as Map<String, dynamic>).addAll({
      'precipitation_sum': [3.2],
      'wind_speed_10m_max': [25],
      'wind_gusts_10m_max': [42],
      'uv_index_max': [8.3],
      'sunrise': [now.millisecondsSinceEpoch ~/ 1000],
      'sunset': [now.millisecondsSinceEpoch ~/ 1000 + 43200],
    });
    final value = WeatherData.fromApi(raw, WeatherPlace.myTho, now);
    expect(value.gust, 31);
    expect(value.direction, 170);
    expect(value.pressure, 1005);
    expect(value.isDay, isFalse);
    expect(value.days.single.precipitation, 3.2);
    expect(value.days.single.uv, 8.3);
    expect(value.days.single.sunrise, now);
    final restored = WeatherData.decode(value.encode());
    expect(restored.days.single.gust, 42);
    expect(data().gust, isNull);
    expect(data().days.single.sunrise, isNull);
  });

  test('Dự báo mưa, nóng, gió xét trong 3 giờ tới', () {
    expect(
      evaluateWeather(
        data(),
        const WeatherSettings(enabled: true),
        now,
      ).map((a) => a.type),
      ['rain', 'heat', 'wind'],
    );
  });
  test('Không cảnh báo khi bị tắt hoặc dữ liệu cũ', () {
    expect(evaluateWeather(data(), const WeatherSettings(), now), isEmpty);
    expect(
      evaluateWeather(
        data(),
        const WeatherSettings(enabled: true),
        now.add(const Duration(hours: 2)),
      ),
      isEmpty,
    );
  });
  test('Không tự thay null bằng số liệu tốt, không cảnh báo giả', () {
    final value = data(
      probability: null,
      rain: null,
      temperature: null,
      gust: null,
      code: null,
    );
    expect(value.hours.single.temperature, isNull);
    expect(
      evaluateWeather(value, const WeatherSettings(enabled: true), now),
      isEmpty,
    );
  });
  test('Xác suất cao nhưng lượng mưa bằng 0 không cảnh báo mưa', () {
    expect(
      evaluateWeather(
        data(rain: 0, temperature: 20, gust: 10),
        const WeatherSettings(enabled: true),
        now,
      ),
      isEmpty,
    );
  });
  test('Ngưỡng và tùy chọn nắng', () {
    final value = data(
      probability: 10,
      rain: 0,
      temperature: 25,
      gust: 10,
      code: 0,
    );
    expect(
      evaluateWeather(value, const WeatherSettings(enabled: true), now),
      isEmpty,
    );
    expect(
      evaluateWeather(
        value,
        const WeatherSettings(enabled: true, sun: true),
        now,
      ).single.type,
      'sun',
    );
  });
  test('Không báo có nắng ban đêm khi mã WMO là trời quang', () {
    final raw = fixture(
      now,
      probability: 10,
      rain: 0,
      temperature: 20,
      gust: 10,
      code: 0,
    );
    (raw['hourly'] as Map)['is_day'] = [0];
    final night = WeatherData.fromApi(raw, WeatherPlace.myTho, now);
    expect(
      evaluateWeather(
        night,
        const WeatherSettings(enabled: true, sun: true),
        now,
      ),
      isEmpty,
    );
  });

  test('Lưu cache giữ nguyên nguồn, địa điểm, epoch và dữ liệu', () {
    final original = data();
    final restored = WeatherData.decode(original.encode());
    expect(restored.place.latitude, WeatherPlace.myTho.latitude);
    expect(restored.observedAt, now);
    expect(restored.placeTime(now).hour, 15);
    expect(restored.hours.single.rainProbability, 80);
    expect(restored.days.single.max, 34);
  });
  test('Settings lưu tọa độ và ngưỡng', () {
    final settings = WeatherSettings.decode(
      const WeatherSettings(enabled: true, rainThreshold: 80).encode(),
    );
    expect(settings.enabled, isTrue);
    expect(settings.rainThreshold, 80);
  });
  test('HTTP dùng tọa độ thật, đơn vị rõ ràng và không API key', () async {
    final api = WeatherApi(
      client: MockClient((request) async {
        expect(request.url.host, 'api.open-meteo.com');
        expect(
          request.url.queryParameters['latitude'],
          '${WeatherPlace.myTho.latitude}',
        );
        expect(request.url.queryParameters['timeformat'], 'unixtime');
        expect(request.url.queryParameters['wind_speed_unit'], 'kmh');
        return http.Response(jsonEncode(fixture(DateTime.now())), 200);
      }),
    );
    expect((await api.fetch(WeatherPlace.myTho)).temperature, 30);
  });
  test(
    'Lỗi HTTP được chuyển thành lỗi dễ hiểu, không làm giả dự báo',
    () async {
      final api = WeatherApi(
        client: MockClient((_) async => http.Response('{}', 429)),
      );
      await expectLater(
        api.fetch(WeatherPlace.myTho),
        throwsA(isA<UserMessage>()),
      );
    },
  );
}
