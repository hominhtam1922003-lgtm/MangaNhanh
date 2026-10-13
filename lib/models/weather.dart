import 'dart:convert';

class WeatherPlace {
  const WeatherPlace({
    required this.name,
    required this.latitude,
    required this.longitude,
    this.gps = false,
    this.accuracy,
  });
  final String name;
  final double latitude;
  final double longitude;
  final bool gps;
  final double? accuracy;
  Map<String, Object?> toJson() => {
    'name': name,
    'latitude': latitude,
    'longitude': longitude,
    'gps': gps,
    'accuracy': accuracy,
  };
  factory WeatherPlace.fromJson(Map<String, dynamic> json) => WeatherPlace(
    name: json['name'] as String,
    latitude: (json['latitude'] as num).toDouble(),
    longitude: (json['longitude'] as num).toDouble(),
    gps: json['gps'] == true,
    accuracy: (json['accuracy'] as num?)?.toDouble(),
  );
  static const myTho = WeatherPlace(
    name: 'Mỹ Tho (chọn sẵn)',
    latitude: 10.3600,
    longitude: 106.3600,
  );
}

class WeatherSettings {
  const WeatherSettings({
    this.place = WeatherPlace.myTho,
    this.enabled = false,
    this.rain = true,
    this.heat = true,
    this.wind = true,
    this.sun = false,
    this.rainThreshold = 60,
    this.heatThreshold = 35,
    this.windThreshold = 40,
  });
  final WeatherPlace place;
  final bool enabled, rain, heat, wind, sun;
  final int rainThreshold, heatThreshold, windThreshold;
  Map<String, Object?> toJson() => {
    'place': place.toJson(),
    'enabled': enabled,
    'rain': rain,
    'heat': heat,
    'wind': wind,
    'sun': sun,
    'rainThreshold': rainThreshold,
    'heatThreshold': heatThreshold,
    'windThreshold': windThreshold,
  };
  String encode() => jsonEncode(toJson());
  factory WeatherSettings.decode(String value) {
    final json = jsonDecode(value) as Map<String, dynamic>;
    return WeatherSettings(
      place: WeatherPlace.fromJson(json['place'] as Map<String, dynamic>),
      enabled: json['enabled'] == true,
      rain: json['rain'] != false,
      heat: json['heat'] != false,
      wind: json['wind'] != false,
      sun: json['sun'] == true,
      rainThreshold: ((json['rainThreshold'] as num?)?.toInt() ?? 60).clamp(
        10,
        100,
      ),
      heatThreshold: ((json['heatThreshold'] as num?)?.toInt() ?? 35).clamp(
        28,
        45,
      ),
      windThreshold: ((json['windThreshold'] as num?)?.toInt() ?? 40).clamp(
        20,
        100,
      ),
    );
  }
  WeatherSettings copyWith({
    WeatherPlace? place,
    bool? enabled,
    bool? rain,
    bool? heat,
    bool? wind,
    bool? sun,
    int? rainThreshold,
    int? heatThreshold,
    int? windThreshold,
  }) => WeatherSettings(
    place: place ?? this.place,
    enabled: enabled ?? this.enabled,
    rain: rain ?? this.rain,
    heat: heat ?? this.heat,
    wind: wind ?? this.wind,
    sun: sun ?? this.sun,
    rainThreshold: rainThreshold ?? this.rainThreshold,
    heatThreshold: heatThreshold ?? this.heatThreshold,
    windThreshold: windThreshold ?? this.windThreshold,
  );
}

class WeatherHour {
  const WeatherHour({
    required this.at,
    required this.temperature,
    required this.rainProbability,
    required this.precipitation,
    required this.wind,
    required this.gust,
    required this.code,
    required this.uv,
  });
  final DateTime at;
  final double? temperature, rainProbability, precipitation, wind, gust, uv;
  final int? code;
}

class WeatherDay {
  const WeatherDay({
    required this.at,
    required this.min,
    required this.max,
    required this.rain,
    required this.code,
  });
  final DateTime at;
  final double? min, max, rain;
  final int? code;
}

class WeatherData {
  WeatherData._(this.raw, this.fetchedAt, this.place);
  final Map<String, dynamic> raw;
  final DateTime fetchedAt;
  final WeatherPlace place;
  String get timezone => raw['timezone'] as String? ?? 'UTC';
  int get offset => (raw['utc_offset_seconds'] as num?)?.toInt() ?? 0;
  Map<String, dynamic> get current => raw['current'] as Map<String, dynamic>;
  double? get temperature => number(current['temperature_2m']);
  double? get feelsLike => number(current['apparent_temperature']);
  double? get humidity => number(current['relative_humidity_2m']);
  double? get wind => number(current['wind_speed_10m']);
  int? get code => (current['weather_code'] as num?)?.toInt();
  DateTime get observedAt => epoch(current['time']);
  bool stale(DateTime now) =>
      now.toUtc().difference(fetchedAt.toUtc()) > const Duration(hours: 1);
  DateTime placeTime(DateTime utc) =>
      utc.toUtc().add(Duration(seconds: offset));
  static double? number(dynamic value) =>
      value is num && value.isFinite ? value.toDouble() : null;
  static DateTime epoch(dynamic value) => DateTime.fromMillisecondsSinceEpoch(
    (value as num).toInt() * 1000,
    isUtc: true,
  );
  factory WeatherData.fromApi(
    Map<String, dynamic> json,
    WeatherPlace place,
    DateTime fetchedAt,
  ) {
    if (json['current'] is! Map ||
        (json['current'] as Map)['time'] is! num ||
        json['hourly'] is! Map ||
        (json['hourly'] as Map)['time'] is! List) {
      throw const FormatException('Dữ liệu thời tiết không hợp lệ.');
    }
    return WeatherData._(json, fetchedAt.toUtc(), place);
  }
  String encode() => jsonEncode({
    'raw': raw,
    'fetchedAt': fetchedAt.toIso8601String(),
    'place': place.toJson(),
  });
  factory WeatherData.decode(String value) {
    final json = jsonDecode(value) as Map<String, dynamic>;
    return WeatherData.fromApi(
      json['raw'] as Map<String, dynamic>,
      WeatherPlace.fromJson(json['place'] as Map<String, dynamic>),
      DateTime.parse(json['fetchedAt'] as String),
    );
  }
  List<WeatherHour> get hours {
    final h = raw['hourly'] as Map<String, dynamic>;
    final times = h['time'] as List;
    dynamic at(String key, int i) =>
        h[key] is List && i < (h[key] as List).length
        ? (h[key] as List)[i]
        : null;
    return List.generate(
      times.length,
      (i) => WeatherHour(
        at: epoch(times[i]),
        temperature: number(at('temperature_2m', i)),
        rainProbability: number(at('precipitation_probability', i)),
        precipitation: number(at('precipitation', i)),
        wind: number(at('wind_speed_10m', i)),
        gust: number(at('wind_gusts_10m', i)),
        uv: number(at('uv_index', i)),
        code: (at('weather_code', i) as num?)?.toInt(),
      ),
    );
  }

  List<WeatherDay> get days {
    final d = raw['daily'] as Map<String, dynamic>?;
    if (d == null || d['time'] is! List) {
      return [];
    }
    final times = d['time'] as List;
    double? at(String key, int i) =>
        d[key] is List && i < (d[key] as List).length
        ? number((d[key] as List)[i])
        : null;
    return List.generate(
      times.length,
      (i) => WeatherDay(
        at: epoch(times[i]),
        min: at('temperature_2m_min', i),
        max: at('temperature_2m_max', i),
        rain: at('precipitation_probability_max', i),
        code: at('weather_code', i)?.toInt(),
      ),
    );
  }
}

String weatherLabel(int? code) => switch (code) {
  0 => 'Trời quang',
  1 || 2 => 'Ít mây',
  3 => 'Nhiều mây',
  45 || 48 => 'Sương mù',
  51 || 53 || 55 || 56 || 57 => 'Mưa phùn',
  61 || 63 || 65 || 66 || 67 => 'Mưa',
  71 || 73 || 75 || 77 => 'Tuyết',
  80 || 81 || 82 => 'Mưa rào',
  85 || 86 => 'Mưa tuyết',
  95 || 96 || 99 => 'Dông',
  _ => 'Chưa có dữ liệu',
};

class WeatherAlert {
  const WeatherAlert(this.type, this.title, this.message, this.at);
  final String type, title, message;
  final DateTime at;
}

List<WeatherAlert> evaluateWeather(
  WeatherData data,
  WeatherSettings settings,
  DateTime now,
) {
  if (!settings.enabled ||
      data.stale(now) ||
      now.toUtc().difference(data.observedAt) > const Duration(minutes: 90))
    return [];
  final horizon = now.toUtc().add(const Duration(hours: 3));
  final hours = data.hours.where(
    (h) =>
        !h.at.isBefore(now.toUtc().subtract(const Duration(minutes: 30))) &&
        h.at.isBefore(horizon),
  );
  final result = <WeatherAlert>[];
  final seen = <String>{};
  void add(String type, String title, String message, WeatherHour h) {
    if (seen.add(type)) {
      result.add(WeatherAlert(type, title, message, h.at));
    }
  }

  for (final h in hours) {
    if (settings.rain &&
        (h.rainProbability ?? -1) >= settings.rainThreshold &&
        (h.precipitation ?? 0) >= 0.2) {
      add(
        'rain',
        'Có khả năng mưa trong 3 giờ tới',
        'Xác suất ${h.rainProbability!.round()}%, lượng dự báo ${h.precipitation} mm. Mang theo áo mưa.',
        h,
      );
    }
    if (settings.heat &&
        ((h.temperature ?? -99) >= settings.heatThreshold ||
            (h.uv ?? -1) >= 8)) {
      add(
        'heat',
        'Dự báo nắng nóng / UV cao',
        'Nhiệt độ ${h.temperature?.round() ?? '—'}°C, UV ${h.uv ?? '—'}. Uống nước và chống nắng.',
        h,
      );
    }
    if (settings.wind && (h.gust ?? h.wind ?? -1) >= settings.windThreshold) {
      add(
        'wind',
        'Dự báo gió mạnh',
        'Gió giật ${h.gust ?? h.wind} km/h. Thận trọng khi đi đường.',
        h,
      );
    }
    if (settings.sun &&
        (h.code == 0 || h.code == 1) &&
        (h.rainProbability ?? 100) < 20) {
      add(
        'sun',
        'Dự báo trời quang',
        'Trời có khả năng ít mây, nắng. Chuẩn bị chống nắng khi ra ngoài.',
        h,
      );
    }
  }
  return result;
}
