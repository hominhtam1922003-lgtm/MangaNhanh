import 'dart:io';
import 'dart:math' as math;
import 'weather_api.dart';

class GroqRateLimit extends UserMessage {
  GroqRateLimit(this.retryAt, {this.daily = false}) : super(daily
    ? 'GroqCloud báo hạn mức ngày đã hết. Không tự gửi lại; kiểm tra hạn mức tài khoản hoặc chờ thời điểm được phép.'
    : 'GroqCloud báo hạn mức lượt gửi/token đã chạm trần. App giữ nguyên câu hỏi, không tự gửi lại và khóa gửi đến khi hết thời gian chờ.');
  final DateTime retryAt;
  final bool daily;
}

Duration? resetDuration(String? text) {
  if (text == null) return null;
  var milliseconds = 0.0;
  final matches = RegExp(r'(\d+(?:\.\d+)?)\s*(ms|s|m|h|d)', caseSensitive: false).allMatches(text.trim());
  if (matches.isEmpty) return null;
  for (final match in matches) {
    final factor = switch (match[2]!.toLowerCase()) { 'ms' => 1, 's' => 1000, 'm' => 60000, 'h' => 3600000, _ => 86400000 };
    milliseconds += double.parse(match[1]!) * factor;
  }
  if (!milliseconds.isFinite || milliseconds <= 0) return null;
  return Duration(milliseconds: math.min(milliseconds.ceil(), 172800000));
}

DateTime retryTime(Map<String,String> headers, DateTime now, {String? message, bool daily = false}) {
  final retry = headers['retry-after'];
  final seconds = double.tryParse(retry ?? '');
  Duration? delay;
  if (seconds != null && seconds.isFinite && seconds > 0) {
    delay = Duration(milliseconds: math.min((seconds * 1000).ceil(), 172800000));
  } else if (retry != null) {
    try { final date = HttpDate.parse(retry); if (date.isAfter(now)) { delay = date.difference(now); } } catch (_) { }
  }
  if (delay == null) {
    final resets = <Duration>[];
    for (final bucket in ['tokens','requests']) {
      final remaining = double.tryParse(headers['x-ratelimit-remaining-$bucket'] ?? '');
      if (remaining != null && remaining <= 0) {
        final value = resetDuration(headers['x-ratelimit-reset-$bucket']);
        if (value != null) resets.add(value);
      }
    }
    if (resets.isNotEmpty) delay = resets.reduce((a,b) => a > b ? a : b);
  }
  if (delay == null && message != null) {
    final value = RegExp(r'try again in\s+([^.,]+(?:\.\d+\s*(?:ms|s|m|h))?)', caseSensitive: false).firstMatch(message)?[1];
    delay = resetDuration(value);
  }
  return now.add(delay == null ? Duration(seconds: daily ? 3600 : 30) : delay < const Duration(seconds: 5) ? const Duration(seconds: 5) : delay);
}
