import 'package:flutter/foundation.dart';
import 'package:geolocator/geolocator.dart';

import '../data/notification_hub.dart';
import '../data/task_repository.dart';
import '../data/weather_api.dart';
import '../data/weather_background.dart';
import '../models/weather.dart';

class WeatherController extends ChangeNotifier {
  WeatherController(this.repository, this.api, this.background);
  final TaskRepository repository;
  final WeatherApi api;
  final WeatherBackground background;
  WeatherSettings settings = const WeatherSettings();
  WeatherData? data;
  String? error;
  String? backgroundAt;
  bool busy = false;

  Future<void> initialize() async {
    try {
      final value = await repository.setting('weather.settings');
      if (value != null) {
        settings = WeatherSettings.decode(value);
      }
      await loadCache();
      await background.configure(settings.enabled);
      if (value != null && (data == null || data!.stale(DateTime.now()))) {
        await refresh();
      }
    } catch (_) {
      error = 'Chưa thể khởi tạo thời tiết. Hãy thử cập nhật lại.';
    }
    notifyListeners();
  }

  Future<void> loadCache() async {
    final cached = await repository.setting('weather.cache');
    data = cached == null ? null : WeatherData.decode(cached);
    if (data != null &&
        (data!.place.latitude != settings.place.latitude ||
            data!.place.longitude != settings.place.longitude)) {
      data = null;
    }
    backgroundAt = await repository.setting('weather.background');
    notifyListeners();
  }

  Future<void> refresh() async {
    if (busy) {
      return;
    }
    busy = true;
    error = null;
    notifyListeners();
    try {
      final result = await api.fetch(settings.place);
      // Tránh hiển thị forecast mới nếu cấu hình địa điểm đã đổi trong lúc tải.
      data = result;
      await repository.setSetting('weather.cache', result.encode());
      await sendWeatherAlerts(repository, settings, result);
    } catch (e) {
      error = e is UserMessage
          ? e.message
          : 'Chưa cập nhật được thời tiết. Dữ liệu cũ vẫn được giữ.';
    } finally {
      busy = false;
      notifyListeners();
    }
  }

  Future<void> saveSettings(
    WeatherSettings value, {
    bool askPermission = false,
  }) async {
    var message = '';
    if (askPermission &&
        value.enabled &&
        !await NotificationHub.requestPermission()) {
      message =
          'Đã lưu lựa chọn, nhưng quyền thông báo bị từ chối. Bật lại trong cài đặt Android.';
    }
    await repository.setSetting('weather.settings', value.encode());
    settings = value;
    await background.configure(value.enabled);
    if (!value.enabled) {
      for (var i = 1; i <= 4; i++) {
        await NotificationHub.plugin.cancel(id: 1600000000 + i);
      }
    }
    if (message.isNotEmpty) {
      error = message;
    }
    notifyListeners();
  }

  Future<void> choosePlace(WeatherPlace place) async {
    await saveSettings(settings.copyWith(place: place));
    // Không gắn dữ liệu cache của địa điểm cũ vào địa điểm mới.
    data = null;
    notifyListeners();
    await refresh();
  }

  Future<void> useGps() async {
    if (busy) {
      return;
    }
    busy = true;
    error = null;
    notifyListeners();
    WeatherPlace? place;
    try {
      if (!await Geolocator.isLocationServiceEnabled()) {
        throw const UserMessage(
          'GPS đang tắt. Bật vị trí trong cài đặt điện thoại hoặc chọn địa điểm thủ công.',
        );
      }
      var permission = await Geolocator.checkPermission();
      if (permission == LocationPermission.denied) {
        permission = await Geolocator.requestPermission();
      }
      if (permission == LocationPermission.denied ||
          permission == LocationPermission.deniedForever) {
        throw const UserMessage(
          'Chưa được cấp quyền vị trí. Bạn vẫn có thể chọn địa điểm hoặc nhập tọa độ.',
        );
      }
      final position = await Geolocator.getCurrentPosition(
        locationSettings: const LocationSettings(
          accuracy: LocationAccuracy.high,
          timeLimit: Duration(seconds: 20),
        ),
      );
      place = WeatherPlace(
        name: 'Vị trí GPS đã chọn',
        latitude: position.latitude,
        longitude: position.longitude,
        gps: true,
        accuracy: position.accuracy,
      );
    } catch (e) {
      error = e is UserMessage
          ? e.message
          : 'Chưa lấy được vị trí GPS. Thử ngoài trời hoặc chọn thủ công.';
    } finally {
      busy = false;
      notifyListeners();
    }
    if (place != null) {
      await choosePlace(place);
    }
  }

  Future<void> reset() async {
    await background.configure(false);
    settings = const WeatherSettings();
    data = null;
    error = null;
    backgroundAt = null;
    notifyListeners();
  }
}
