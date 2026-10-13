import 'dart:convert';
import 'package:http/http.dart' as http;
import '../models/weather.dart';

class UserMessage implements Exception {
  const UserMessage(this.message);
  final String message;
  @override
  String toString() => message;
}

class WeatherApi {
  WeatherApi({http.Client? client}) : _client = client ?? http.Client();
  final http.Client _client;

  Future<WeatherData> fetch(WeatherPlace place) async {
    try {
      final uri = Uri.https('api.open-meteo.com', '/v1/forecast', {
        'latitude': '${place.latitude}',
        'longitude': '${place.longitude}',
        'current':
            'temperature_2m,apparent_temperature,relative_humidity_2m,weather_code,wind_speed_10m,is_day,precipitation,wind_direction_10m,wind_gusts_10m,cloud_cover,surface_pressure',
        'hourly':
            'temperature_2m,precipitation_probability,precipitation,weather_code,wind_speed_10m,wind_gusts_10m,uv_index,is_day',
        'daily':
            'weather_code,temperature_2m_max,temperature_2m_min,precipitation_probability_max,precipitation_sum,wind_speed_10m_max,wind_gusts_10m_max,uv_index_max,sunrise,sunset',
        'timezone': 'auto',
        'timeformat': 'unixtime',
        'forecast_days': '7',
        'wind_speed_unit': 'kmh',
        'temperature_unit': 'celsius',
        'precipitation_unit': 'mm',
      });
      final response = await _client
          .get(uri)
          .timeout(const Duration(seconds: 20));
      if (response.statusCode == 429) {
        throw const UserMessage(
          'Nguồn thời tiết đang giới hạn lượt truy cập. Thử lại sau.',
        );
      }
      if (response.statusCode != 200) {
        throw const UserMessage('Nguồn thời tiết chưa sẵn sàng. Hãy thử lại.');
      }
      return WeatherData.fromApi(
        jsonDecode(utf8.decode(response.bodyBytes)) as Map<String, dynamic>,
        place,
        DateTime.now(),
      );
    } on UserMessage {
      rethrow;
    } catch (_) {
      throw const UserMessage(
        'Không thể cập nhật thời tiết. Kiểm tra kết nối internet; dữ liệu đã tải vẫn được giữ lại.',
      );
    }
  }

  Future<List<WeatherPlace>> search(String text) async {
    if (text.trim().length < 2) {
      throw const UserMessage('Nhập ít nhất 2 ký tự địa điểm.');
    }
    try {
      final response = await _client
          .get(
            Uri.https('geocoding-api.open-meteo.com', '/v1/search', {
              'name': text.trim(),
              'count': '8',
              'language': 'vi',
              'format': 'json',
            }),
          )
          .timeout(const Duration(seconds: 15));
      if (response.statusCode != 200) {
        throw const UserMessage('Chưa thể tìm địa điểm.');
      }
      final json =
          jsonDecode(utf8.decode(response.bodyBytes)) as Map<String, dynamic>;
      return (json['results'] as List? ?? []).map((r) {
        final j = r as Map<String, dynamic>;
        return WeatherPlace(
          name: [
            j['name'],
            j['admin1'],
            j['country'],
          ].whereType<String>().join(', '),
          latitude: (j['latitude'] as num).toDouble(),
          longitude: (j['longitude'] as num).toDouble(),
        );
      }).toList();
    } on UserMessage {
      rethrow;
    } catch (_) {
      throw const UserMessage(
        'Không tìm được địa điểm. Kiểm tra internet hoặc nhập tọa độ thủ công.',
      );
    }
  }
}
