import 'package:flutter/material.dart';
import '../../app/weather_controller.dart';
import '../../data/weather_api.dart';
import '../../models/task.dart';
import '../../models/weather.dart';
import '../../widgets/depth_card.dart';
import '../../widgets/task_list.dart';

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
      if (mounted) {
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
  }

  Future<void> _places() async {
    final place = await Navigator.of(context).push<WeatherPlace>(
      MaterialPageRoute(
        builder: (_) => PlacePicker(api: widget.controller.api),
      ),
    );
    if (place != null) {
      await _run(() => widget.controller.choosePlace(place));
    }
  }

  String _value(double? v, String unit) =>
      v == null ? '—' : '${v.round()}$unit';
  @override
  Widget build(BuildContext context) => AnimatedBuilder(
    animation: widget.controller,
    builder: (context, _) {
      final c = widget.controller, d = c.data, s = c.settings;
      final now = DateTime.now();
      final hours =
          d?.hours
              .where(
                (h) => h.at.isAfter(
                  now.toUtc().subtract(const Duration(minutes: 30)),
                ),
              )
              .take(12)
              .toList() ??
          <WeatherHour>[];
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
                  Text(
                    s.place.name,
                    style: const TextStyle(
                      fontSize: 21,
                      fontWeight: FontWeight.w600,
                    ),
                  ),
                  const SizedBox(height: 6),
                  Text(
                    '${s.place.latitude.toStringAsFixed(4)}, ${s.place.longitude.toStringAsFixed(4)}',
                  ),
                  if (s.place.gps)
                    Text(
                      'Độ chính xác GPS ước tính: ±${s.place.accuracy?.round() ?? '—'} m',
                    ),
                  const SizedBox(height: 14),
                  Row(
                    children: [
                      Expanded(
                        child: Column(
                          crossAxisAlignment: CrossAxisAlignment.start,
                          children: [
                            Text(
                              _value(d?.temperature, '°'),
                              style: const TextStyle(
                                fontSize: 60,
                                fontWeight: FontWeight.w300,
                              ),
                            ),
                            Text(
                              d == null
                                  ? 'Chưa tải thời tiết'
                                  : weatherLabel(d.code),
                              style: const TextStyle(fontSize: 18),
                            ),
                            if (d != null)
                              Text('Cảm giác ${_value(d.feelsLike, '°C')}'),
                          ],
                        ),
                      ),
                      WeatherOrb(rainy: d?.code != null && d!.code! >= 51),
                    ],
                  ),
                  const SizedBox(height: 16),
                  Wrap(
                    spacing: 12,
                    runSpacing: 8,
                    children: [
                      Text('Độ ẩm ${_value(d?.humidity, '%')}'),
                      Text('Gió ${_value(d?.wind, ' km/h')}'),
                    ],
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
                  label: const Text('Chọn địa điểm'),
                ),
                IconButton(
                  tooltip: 'Cập nhật thời tiết',
                  onPressed: c.busy ? null : c.refresh,
                  icon: const Icon(Icons.refresh),
                ),
              ],
            ),
            if (c.busy) const LinearProgressIndicator(),
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
              Padding(
                padding: const EdgeInsets.symmetric(vertical: 12),
                child: Text(
                  '${d.stale(now) ? '⚠ Dữ liệu cũ — ' : ''}Tải lúc ${displayDate(d.fetchedAt.toLocal())} ${displayTime(d.fetchedAt.toLocal().hour * 60 + d.fetchedAt.toLocal().minute)}\n'
                  'Nguồn: Open-Meteo • Múi giờ ${d.timezone}\n'
                  'Thời điểm số liệu: ${displayDate(d.placeTime(d.observedAt))} ${displayTime(d.placeTime(d.observedAt).hour * 60 + d.placeTime(d.observedAt).minute)}',
                ),
              ),
              Text('12 giờ tới', style: Theme.of(context).textTheme.titleLarge),
              const SizedBox(height: 10),
              SizedBox(
                height: MediaQuery.textScalerOf(context).scale(154),
                child: ListView.separated(
                  scrollDirection: Axis.horizontal,
                  itemCount: hours.length,
                  separatorBuilder: (_, _) => const SizedBox(width: 8),
                  itemBuilder: (context, i) {
                    final h = hours[i], time = d.placeTime(h.at);
                    return SizedBox(
                      width: 98,
                      child: Card(
                        child: Padding(
                          padding: const EdgeInsets.all(10),
                          child: Column(
                            mainAxisAlignment: MainAxisAlignment.spaceEvenly,
                            children: [
                              Text(displayTime(time.hour * 60 + time.minute)),
                              Icon(
                                (h.rainProbability ?? 0) >= 50
                                    ? Icons.umbrella_outlined
                                    : Icons.wb_cloudy_outlined,
                              ),
                              Text(
                                _value(h.temperature, '°C'),
                                style: const TextStyle(
                                  fontWeight: FontWeight.bold,
                                ),
                              ),
                              Text(
                                'Mưa ${_value(h.rainProbability, '%')}',
                                style: const TextStyle(fontSize: 12),
                              ),
                            ],
                          ),
                        ),
                      ),
                    );
                  },
                ),
              ),
              const SizedBox(height: 20),
              Text('7 ngày tới', style: Theme.of(context).textTheme.titleLarge),
              const SizedBox(height: 10),
              ...d.days.map(
                (day) => Card(
                  child: ListTile(
                    title: Text(displayDate(d.placeTime(day.at))),
                    subtitle: Text(
                      '${weatherLabel(day.code)} • Mưa ${_value(day.rain, '%')}',
                    ),
                    trailing: Text(
                      '${_value(day.min, '°')} / ${_value(day.max, '°')}',
                    ),
                  ),
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
    body: SingleChildScrollView(
      padding: const EdgeInsets.all(16),
      child: Column(
        crossAxisAlignment: CrossAxisAlignment.stretch,
        children: [
          TextField(
            controller: _query,
            decoration: const InputDecoration(
              labelText: 'Tên thành phố / địa phương',
            ),
            onSubmitted: (_) => _search(),
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
  );
}
