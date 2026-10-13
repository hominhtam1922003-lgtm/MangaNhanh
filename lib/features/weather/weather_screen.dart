import 'package:flutter/material.dart';
import '../../app/weather_controller.dart';
import '../../data/weather_api.dart';
import '../../models/task.dart';
import '../../models/weather.dart';
import '../../widgets/depth_card.dart';
import '../../widgets/task_list.dart';
import '../../widgets/page_frame.dart';
import '../../widgets/vietnamese_input.dart';
import '../../widgets/forecast_chart.dart';

class WeatherScreen extends StatefulWidget {
  const WeatherScreen({super.key, required this.controller});
  final WeatherController controller;
  @override
  State<WeatherScreen> createState() => _WeatherScreenState();
}

class _WeatherScreenState extends State<WeatherScreen> {
  Future<void> _run(Future<void> Function() action) async {
    try {
      await action();
    } catch (e) {
      if (mounted)
        ScaffoldMessenger.of(context).showSnackBar(
          SnackBar(
            content: Text(
              e is UserMessage
                  ? e.message
                  : 'Chưa lưu được lựa chọn. Vui lòng thử lại.',
            ),
          ),
        );
    }
  }

  Future<void> _places() async {
    final place = await Navigator.of(context).push<WeatherPlace>(
      MaterialPageRoute(
        builder: (_) => PlacePicker(api: widget.controller.api),
      ),
    );
    if (place != null) await _run(() => widget.controller.choosePlace(place));
  }

  String _value(double? v, String unit, {int decimals = 0}) =>
      v == null ? '—' : '${v.toStringAsFixed(decimals)}$unit';
  String _time(DateTime? utc, WeatherData d) => utc == null
      ? '—'
      : displayTime(d.placeTime(utc).hour * 60 + d.placeTime(utc).minute);
  String _direction(double? degrees) {
    if (degrees == null) return '—';
    const compass = [
      'Bắc',
      'Đông Bắc',
      'Đông',
      'Đông Nam',
      'Nam',
      'Tây Nam',
      'Tây',
      'Tây Bắc',
    ];
    return '${compass[((degrees + 22.5) / 45).floor() % 8]} · ${degrees.round()}°';
  }

  @override
  Widget build(BuildContext context) => AnimatedBuilder(
    animation: widget.controller,
    builder: (context, _) {
      final c = widget.controller,
          d = c.data,
          s = c.settings,
          now = DateTime.now();
      final hours =
          d?.hours
              .where(
                (h) =>
                    !h.at.isBefore(
                      now.toUtc().subtract(const Duration(minutes: 30)),
                    ) &&
                    h.at.isBefore(now.toUtc().add(const Duration(hours: 24))),
              )
              .toList() ??
          <WeatherHour>[];
      final wet = hours
          .where(
            (h) =>
                (h.rainProbability ?? 0) >= s.rainThreshold &&
                (h.precipitation ?? 0) >= .2,
          )
          .firstOrNull;
      final day = d?.days
          .where((day) => sameDay(d.placeTime(day.at), d.placeTime(now)))
          .firstOrNull;
      return RefreshIndicator(
        onRefresh: c.refresh,
        child: ListView(
          physics: const AlwaysScrollableScrollPhysics(),
          padding: const EdgeInsets.fromLTRB(16, 16, 16, 40),
          children: [
            DepthCard(
              hero: true,
              child: Column(
                crossAxisAlignment: CrossAxisAlignment.start,
                children: [
                  Row(
                    children: [
                      const Icon(Icons.location_on_outlined, size: 20),
                      const SizedBox(width: 8),
                      Expanded(
                        child: Text(
                          s.place.name,
                          style: const TextStyle(
                            fontSize: 20,
                            fontWeight: FontWeight.w600,
                          ),
                        ),
                      ),
                      IconButton(
                        tooltip: 'Cập nhật thời tiết',
                        onPressed: c.busy ? null : c.refresh,
                        icon: const Icon(Icons.refresh, color: Colors.white),
                      ),
                    ],
                  ),
                  const SizedBox(height: 18),
                  Row(
                    children: [
                      Expanded(
                        child: Column(
                          crossAxisAlignment: CrossAxisAlignment.start,
                          children: [
                            Text(
                              _value(d?.temperature, '°'),
                              style: const TextStyle(
                                fontSize: 68,
                                fontWeight: FontWeight.w300,
                                height: 1.1,
                              ),
                            ),
                            Text(
                              d == null
                                  ? 'Chưa tải thời tiết'
                                  : weatherLabel(d.code),
                              style: const TextStyle(fontSize: 20),
                            ),
                            const SizedBox(height: 8),
                            Text('Cảm giác ${_value(d?.feelsLike, '°C')}'),
                            if (day != null)
                              Text(
                                'Thấp ${_value(day.min, '°')} · Cao ${_value(day.max, '°')}',
                              ),
                          ],
                        ),
                      ),
                      Container(
                        width: 100,
                        height: 100,
                        decoration: const BoxDecoration(
                          shape: BoxShape.circle,
                          gradient: RadialGradient(
                            colors: [Color(0x55FFD88F), Color(0x006BDACD)],
                          ),
                        ),
                        child: Icon(
                          weatherIcon(d?.code, isDay: d?.isDay),
                          color: const Color(0xFFFFDA94),
                          size: 66,
                        ),
                      ),
                    ],
                  ),
                  const SizedBox(height: 20),
                  Text(
                    d == null
                        ? 'Chọn vị trí để bắt đầu'
                        : d.stale(now)
                        ? 'Dữ liệu đã cũ · Không dùng để kết luận thời tiết sắp tới'
                        : 'Số liệu lúc ${_time(d.observedAt, d)} · ${d.timezone}',
                    style: const TextStyle(
                      fontSize: 12,
                      color: Color(0xFFD8E4FA),
                    ),
                  ),
                ],
              ),
            ),
            const SizedBox(height: 16),
            Wrap(
              spacing: 8,
              runSpacing: 8,
              children: [
                FilledButton.icon(
                  onPressed: c.busy ? null : () => _run(c.useGps),
                  icon: const Icon(Icons.my_location),
                  label: const Text('Dùng GPS'),
                ),
                OutlinedButton.icon(
                  onPressed: c.busy ? null : _places,
                  icon: const Icon(Icons.place_outlined),
                  label: const Text('Đổi địa điểm'),
                ),
              ],
            ),
            if (c.busy)
              const Padding(
                padding: EdgeInsets.symmetric(vertical: 12),
                child: LinearProgressIndicator(),
              ),
            if (c.error != null)
              Padding(
                padding: const EdgeInsets.symmetric(vertical: 12),
                child: Text(
                  c.error!,
                  style: TextStyle(color: Theme.of(context).colorScheme.error),
                ),
              ),
            if (d == null && !c.busy)
              const EmptyState(
                title: 'Chọn vị trí, xem dự báo thật',
                message:
                    'Bấm Dùng GPS hoặc Cập nhật. Không có số liệu mẫu hay dự báo do AI tự tạo.',
              ),
            if (d != null) ...[
              const SectionTitle(
                'Hiện tại',
                subtitle: 'Số liệu mô hình tại vùng lưới gần vị trí đã chọn',
              ),
              LayoutBuilder(
                builder: (context, box) {
                  final columns = box.maxWidth >= 700
                      ? 4
                      : box.maxWidth >= 390
                      ? 3
                      : 2;
                  return Wrap(
                    spacing: 10,
                    runSpacing: 10,
                    children:
                        [
                              _metric(
                                'Độ ẩm',
                                _value(d.humidity, '%'),
                                Icons.water_drop_outlined,
                              ),
                              _metric(
                                'Gió',
                                _value(d.wind, ' km/h'),
                                Icons.air,
                              ),
                              _metric(
                                'Gió giật',
                                _value(d.gust, ' km/h'),
                                Icons.wind_power_outlined,
                              ),
                              _metric(
                                'Lượng mưa',
                                _value(d.precipitation, ' mm', decimals: 1),
                                Icons.umbrella_outlined,
                              ),
                              _metric(
                                'Hướng gió',
                                _direction(d.direction),
                                Icons.navigation_outlined,
                              ),
                              _metric(
                                'Mây che phủ',
                                _value(d.cloud, '%'),
                                Icons.cloud_outlined,
                              ),
                              _metric(
                                'Áp suất bề mặt',
                                _value(d.pressure, ' hPa'),
                                Icons.speed,
                              ),
                              _metric(
                                'UV tối đa hôm nay',
                                _value(day?.uv, '', decimals: 1),
                                Icons.wb_sunny_outlined,
                              ),
                            ]
                            .map(
                              (w) => SizedBox(
                                width:
                                    (box.maxWidth - (columns - 1) * 10) /
                                    columns,
                                child: w,
                              ),
                            )
                            .toList(),
                  );
                },
              ),
              const SizedBox(height: 16),
              Panel(
                color: Theme.of(
                  context,
                ).colorScheme.secondaryContainer.withValues(alpha: .6),
                child: Row(
                  crossAxisAlignment: CrossAxisAlignment.start,
                  children: [
                    const Icon(Icons.umbrella_outlined),
                    const SizedBox(width: 12),
                    Expanded(
                      child: Column(
                        crossAxisAlignment: CrossAxisAlignment.start,
                        children: [
                          const Text(
                            'Khả năng mưa · 24 giờ tới',
                            style: TextStyle(fontWeight: FontWeight.w700),
                          ),
                          const SizedBox(height: 6),
                          Text(
                            d.stale(now)
                                ? 'Dữ liệu cũ, hãy cập nhật trước khi xem nhận định.'
                                : hours.isEmpty
                                ? 'Chưa có dự báo trong khoảng thời gian này.'
                                : wet == null
                                ? 'Chưa thấy giờ nào đạt ngưỡng ${s.rainThreshold}% và 0,2 mm. Không có nghĩa chắc chắn không mưa.'
                                : 'Có thể mưa từ ${_time(wet.at, d)} ngày ${displayDate(d.placeTime(wet.at))}: ${_value(wet.rainProbability, '%')}, ${_value(wet.precipitation, ' mm', decimals: 1)}/giờ. Không phải giờ bắt đầu mưa chính xác.',
                          ),
                        ],
                      ),
                    ),
                  ],
                ),
              ),
              const SectionTitle(
                'Nhịp thời tiết 24 giờ',
                subtitle: 'Nhiệt độ dự báo theo giờ · Vuốt thẻ để xem thêm',
              ),
              Panel(
                child: ForecastChart(hours: hours, data: d),
              ),
              const SizedBox(height: 14),
              SizedBox(
                height: MediaQuery.textScalerOf(context).scale(240),
                child: ListView.separated(
                  scrollDirection: Axis.horizontal,
                  itemCount: hours.length,
                  separatorBuilder: (_, _) => const SizedBox(width: 10),
                  itemBuilder: (context, i) {
                    final h = hours[i], time = d.placeTime(h.at);
                    return SizedBox(
                      width: 138,
                      child: Panel(
                        padding: const EdgeInsets.all(14),
                        child: Column(
                          mainAxisAlignment: MainAxisAlignment.spaceEvenly,
                          children: [
                            Text(
                              displayTime(time.hour * 60 + time.minute),
                              style: const TextStyle(
                                fontWeight: FontWeight.w600,
                              ),
                            ),
                            Text(
                              '${time.day}/${time.month}',
                              style: Theme.of(context).textTheme.bodySmall,
                            ),
                            Icon(
                              weatherIcon(h.code, isDay: h.isDay),
                              size: 26,
                              color: Theme.of(context).colorScheme.primary,
                            ),
                            Text(
                              _value(h.temperature, '°C'),
                              style: const TextStyle(
                                fontSize: 21,
                                fontWeight: FontWeight.w700,
                              ),
                            ),
                            Text('Mưa ${_value(h.rainProbability, '%')}'),
                            Text(_value(h.precipitation, ' mm', decimals: 1)),
                            Text(
                              'Gió ${_value(h.wind, ' km/h')}',
                              style: const TextStyle(fontSize: 12),
                            ),
                            Text(
                              'Giật ${_value(h.gust, ' km/h')} · UV ${_value(h.uv, '', decimals: 1)}',
                              style: const TextStyle(fontSize: 10),
                            ),
                          ],
                        ),
                      ),
                    );
                  },
                ),
              ),
              const SectionTitle(
                '7 ngày tới',
                subtitle:
                    'Dự báo xa bất định hơn. Chạm từng ngày để xem chi tiết.',
              ),
              ...d.days.map(
                (day) => Card(
                  child: ExpansionTile(
                    leading: Icon(
                      weatherIcon(day.code),
                      color: Theme.of(context).colorScheme.primary,
                    ),
                    title: Text(displayDate(d.placeTime(day.at))),
                    subtitle: Text(
                      '${weatherLabel(day.code)} · Mưa ${_value(day.rain, '%')}',
                    ),
                    childrenPadding: const EdgeInsets.all(16),
                    children: [
                      Wrap(
                        spacing: 24,
                        runSpacing: 12,
                        children: [
                          Text(
                            'Thấp ${_value(day.min, '°C')} / Cao ${_value(day.max, '°C')}',
                          ),
                          Text(
                            'Tổng mưa ${_value(day.precipitation, ' mm', decimals: 1)}',
                          ),
                          Text('Gió tối đa ${_value(day.wind, ' km/h')}'),
                          Text('Giật tối đa ${_value(day.gust, ' km/h')}'),
                          Text('UV tối đa ${_value(day.uv, '', decimals: 1)}'),
                          Text(
                            'Mặt trời mọc ${_time(day.sunrise, d)} · lặn ${_time(day.sunset, d)}',
                          ),
                        ],
                      ),
                    ],
                  ),
                ),
              ),
              const SectionTitle('Nguồn & độ tin cậy'),
              Panel(
                child: Column(
                  crossAxisAlignment: CrossAxisAlignment.start,
                  children: [
                    Text(
                      'Open-Meteo · ${d.timezone} · ${d.stale(now) ? 'Bản lưu cũ' : 'Bản tải gần đây'}',
                    ),
                    Text(
                      'Tải: ${displayDate(d.fetchedAt.toLocal())} ${displayTime(d.fetchedAt.toLocal().hour * 60 + d.fetchedAt.toLocal().minute)}',
                    ),
                    Text(
                      'Vị trí chọn: ${s.place.latitude.toStringAsFixed(4)}, ${s.place.longitude.toStringAsFixed(4)}',
                    ),
                    if (s.place.gps)
                      Text(
                        'GPS ước tính ±${s.place.accuracy?.round() ?? '—'} m; không phải độ chính xác dự báo.',
                      ),
                    if (WeatherData.number(d.raw['latitude']) != null &&
                        WeatherData.number(d.raw['longitude']) != null)
                      Text(
                        'Tâm vùng lưới trả về: ${WeatherData.number(d.raw['latitude'])!.toStringAsFixed(4)}, ${WeatherData.number(d.raw['longitude'])!.toStringAsFixed(4)}',
                      ),
                    const SizedBox(height: 10),
                    const Text(
                      '“Hiện tại” là số liệu mô hình, không phải trạm đo tại nhà bạn. Xác suất mưa không phải tỷ lệ thời gian mưa. '
                      'Thời tiết cục bộ có thể khác dự báo; số liệu không có hiển thị —. Dùng nguồn khí tượng chính thức cho quyết định an toàn.',
                    ),
                  ],
                ),
              ),
            ],
            const SizedBox(height: 20),
            Text('Cảnh báo nền', style: Theme.of(context).textTheme.titleLarge),
            SwitchListTile(
              contentPadding: EdgeInsets.zero,
              title: const Text('Kiểm tra thời tiết định kỳ'),
              subtitle: const Text(
                'Mục tiêu mỗi 15 phút; Android có thể trì hoãn. Không phải cảnh báo khẩn cấp.',
              ),
              value: s.enabled,
              onChanged: c.busy
                  ? null
                  : (v) => _run(
                      () => c.saveSettings(
                        s.copyWith(enabled: v),
                        askPermission: v,
                      ),
                    ),
            ),
            SwitchListTile(
              contentPadding: EdgeInsets.zero,
              title: const Text('Có khả năng mưa'),
              value: s.rain,
              onChanged: c.busy
                  ? null
                  : (v) => _run(() => c.saveSettings(s.copyWith(rain: v))),
            ),
            _threshold(
              'Ngưỡng xác suất mưa',
              s.rainThreshold,
              [40, 60, 80],
              '%',
              c.busy
                  ? null
                  : (v) => _run(
                      () => c.saveSettings(s.copyWith(rainThreshold: v)),
                    ),
            ),
            SwitchListTile(
              contentPadding: EdgeInsets.zero,
              title: const Text('Nắng nóng hoặc UV cao'),
              value: s.heat,
              onChanged: c.busy
                  ? null
                  : (v) => _run(() => c.saveSettings(s.copyWith(heat: v))),
            ),
            _threshold(
              'Ngưỡng nhiệt độ (hoặc UV ≥ 8)',
              s.heatThreshold,
              [32, 35, 38],
              '°C',
              c.busy
                  ? null
                  : (v) => _run(
                      () => c.saveSettings(s.copyWith(heatThreshold: v)),
                    ),
            ),
            SwitchListTile(
              contentPadding: EdgeInsets.zero,
              title: const Text('Gió mạnh'),
              value: s.wind,
              onChanged: c.busy
                  ? null
                  : (v) => _run(() => c.saveSettings(s.copyWith(wind: v))),
            ),
            _threshold(
              'Ngưỡng gió giật',
              s.windThreshold,
              [30, 40, 60],
              ' km/h',
              c.busy
                  ? null
                  : (v) => _run(
                      () => c.saveSettings(s.copyWith(windThreshold: v)),
                    ),
            ),
            SwitchListTile(
              contentPadding: EdgeInsets.zero,
              title: const Text('Trời quang, có nắng'),
              value: s.sun,
              subtitle: const Text('Tùy chọn; có thể tăng số thông báo'),
              onChanged: c.busy
                  ? null
                  : (v) => _run(() => c.saveSettings(s.copyWith(sun: v))),
            ),
            const SizedBox(height: 16),
            const Text(
              'Cảnh báo xét 3 giờ tới; mỗi loại tối đa một lần trong 4 giờ. '
              'Vị trí nền là tọa độ bạn đã chọn, không theo dõi GPS liên tục. '
              'Dự báo phụ thuộc mô hình và vùng lưới, không thể bảo đảm chính xác 100%.',
            ),
            if (c.backgroundAt != null)
              Text(
                'Lần kiểm tra nền gần nhất: ${DateTime.tryParse(c.backgroundAt!)?.toLocal() ?? '—'}',
              ),
            const SizedBox(height: 12),
            const Text(
              'Dữ liệu: Open-Meteo (open-meteo.com), CC BY 4.0. API miễn phí dùng phi thương mại theo điều khoản nhà cung cấp.',
            ),
          ],
        ),
      );
    },
  );
  Widget _metric(String label, String value, IconData icon) => Panel(
    padding: const EdgeInsets.all(14),
    child: Column(
      crossAxisAlignment: CrossAxisAlignment.start,
      children: [
        Icon(icon, size: 21, color: Theme.of(context).colorScheme.primary),
        const SizedBox(height: 12),
        Text(
          value,
          style: const TextStyle(fontSize: 16, fontWeight: FontWeight.w700),
        ),
        const SizedBox(height: 4),
        Text(label, style: Theme.of(context).textTheme.bodySmall),
      ],
    ),
  );
  Widget _threshold(
    String label,
    int value,
    List<int> values,
    String unit,
    ValueChanged<int>? change,
  ) => Padding(
    padding: const EdgeInsets.only(bottom: 12),
    child: DropdownButtonFormField<int>(
      key: ValueKey('$label:$value'),
      initialValue: values.contains(value) ? value : values[1],
      isExpanded: true,
      decoration: InputDecoration(labelText: label),
      items: values
          .map((v) => DropdownMenuItem(value: v, child: Text('$v$unit')))
          .toList(),
      onChanged: change == null ? null : (v) => change(v!),
    ),
  );
}

class PlacePicker extends StatefulWidget {
  const PlacePicker({super.key, required this.api});
  final WeatherApi api;
  @override
  State<PlacePicker> createState() => _PlacePickerState();
}

class _PlacePickerState extends State<PlacePicker> {
  final _query = TextEditingController(),
      _lat = TextEditingController(),
      _lon = TextEditingController();
  final _form = GlobalKey<FormState>();
  List<WeatherPlace> _results = [];
  bool _busy = false;
  String? _error;
  @override
  void dispose() {
    _query.dispose();
    _lat.dispose();
    _lon.dispose();
    super.dispose();
  }

  Future<void> _search() async {
    setState(() {
      _busy = true;
      _error = null;
    });
    try {
      final result = await widget.api.search(_query.text);
      if (mounted) {
        setState(() {
          _results = result;
          if (result.isEmpty) {
            _error = 'Không thấy địa điểm. Thử tên không dấu hoặc nhập tọa độ.';
          }
        });
      }
    } catch (e) {
      if (mounted) {
        setState(() => _error = e.toString());
      }
    } finally {
      if (mounted) {
        setState(() => _busy = false);
      }
    }
  }

  String? _coordinate(String? value, double limit) {
    final v = double.tryParse((value ?? '').replaceAll(',', '.'));
    return v == null || !v.isFinite || v.abs() > limit
        ? 'Nhập số trong khoảng -$limit đến $limit.'
        : null;
  }

  @override
  Widget build(BuildContext context) => Scaffold(
    appBar: AppBar(title: const Text('Chọn địa điểm')),
    body: PageFrame(
      maxWidth: 760,
      child: SingleChildScrollView(
        padding: const EdgeInsets.all(16),
        child: Column(
          crossAxisAlignment: CrossAxisAlignment.stretch,
          children: [
            VietnameseInput(
              controller: _query,
              label: 'Tên thành phố / địa phương',
              onSubmitted: (_) {
                if (!_busy) _search();
              },
            ),
            const SizedBox(height: 12),
            FilledButton(
              onPressed: _busy ? null : _search,
              child: const Text('Tìm địa điểm'),
            ),
            if (_busy) const LinearProgressIndicator(),
            if (_error != null) Text(_error!),
            ListTile(
              leading: const Icon(Icons.home_outlined),
              title: const Text('Mỹ Tho'),
              subtitle: const Text(
                '10.3600, 106.3600 · tâm địa phương, không phải vị trí GPS',
              ),
              onTap: () => Navigator.pop(context, WeatherPlace.myTho),
            ),
            ..._results.map(
              (p) => ListTile(
                title: Text(p.name),
                subtitle: Text('${p.latitude}, ${p.longitude}'),
                onTap: () => Navigator.pop(context, p),
              ),
            ),
            const Divider(height: 32),
            Text(
              'Nhập tọa độ chính xác của địa điểm',
              style: Theme.of(context).textTheme.titleMedium,
            ),
            const SizedBox(height: 12),
            Form(
              key: _form,
              child: Column(
                children: [
                  TextFormField(
                    controller: _lat,
                    keyboardType: const TextInputType.numberWithOptions(
                      decimal: true,
                      signed: true,
                    ),
                    decoration: const InputDecoration(labelText: 'Vĩ độ'),
                    validator: (v) => _coordinate(v, 90),
                  ),
                  const SizedBox(height: 12),
                  TextFormField(
                    controller: _lon,
                    keyboardType: const TextInputType.numberWithOptions(
                      decimal: true,
                      signed: true,
                    ),
                    decoration: const InputDecoration(labelText: 'Kinh độ'),
                    validator: (v) => _coordinate(v, 180),
                  ),
                ],
              ),
            ),
            const SizedBox(height: 12),
            OutlinedButton(
              onPressed: () {
                if (!_form.currentState!.validate()) {
                  return;
                }
                Navigator.pop(
                  context,
                  WeatherPlace(
                    name: 'Tọa độ đã chọn',
                    latitude: double.parse(_lat.text.replaceAll(',', '.')),
                    longitude: double.parse(_lon.text.replaceAll(',', '.')),
                  ),
                );
              },
              child: const Text('Dùng tọa độ này'),
            ),
          ],
        ),
      ),
    ),
  );
}
