import 'dart:math' as math;

// Quy đổi âm lịch Việt Nam (UTC+7), công thức thiên văn Jean Meeus;
// thuật toán tháng nhuận theo lịch Việt Nam của Hồ Ngọc Đức.
// Không phải dữ liệu lịch nghỉ bù do Chính phủ công bố.
class LunarDate {
  const LunarDate(this.day, this.month, this.year, this.leap);
  final int day, month, year;
  final bool leap;
  String get label => '$day/$month${leap ? ' nhuận' : ''} âm lịch';
}

int _jd(int day, int month, int year) {
  final a = (14 - month) ~/ 12;
  final y = year + 4800 - a;
  final m = month + 12 * a - 3;
  var result =
      day + (153 * m + 2) ~/ 5 + 365 * y + y ~/ 4 - y ~/ 100 + y ~/ 400 - 32045;
  if (result < 2299161)
    result = day + (153 * m + 2) ~/ 5 + 365 * y + y ~/ 4 - 32083;
  return result;
}

DateTime _fromJd(int jd) {
  int a, b, c;
  if (jd > 2299160) {
    a = jd + 32044;
    b = (4 * a + 3) ~/ 146097;
    c = a - (b * 146097) ~/ 4;
  } else {
    b = 0;
    c = jd + 32082;
  }
  final d = (4 * c + 3) ~/ 1461;
  final e = c - (1461 * d) ~/ 4;
  final m = (5 * e + 2) ~/ 153;
  return DateTime(
    b * 100 + d - 4800 + m ~/ 10,
    m + 3 - 12 * (m ~/ 10),
    e - (153 * m + 2) ~/ 5 + 1,
  );
}

int _newMoon(int k) {
  final t = k / 1236.85, t2 = (k / 1236.85) * (k / 1236.85);
  final t3 = t2 * t, dr = math.pi / 180;
  var jd = 2415020.75933 + 29.53058868 * k + 0.0001178 * t2 - 0.000000155 * t3;
  jd += 0.00033 * math.sin((166.56 + 132.87 * t - 0.009173 * t2) * dr);
  final m = 359.2242 + 29.10535608 * k - 0.0000333 * t2 - 0.00000347 * t3;
  final mp = 306.0253 + 385.81691806 * k + 0.0107306 * t2 + 0.00001236 * t3;
  final f = 21.2964 + 390.67050646 * k - 0.0016528 * t2 - 0.00000239 * t3;
  final correction =
      (0.1734 - 0.000393 * t) * math.sin(m * dr) +
      0.0021 * math.sin(2 * m * dr) -
      0.4068 * math.sin(mp * dr) +
      0.0161 * math.sin(2 * mp * dr) -
      0.0004 * math.sin(3 * mp * dr) +
      0.0104 * math.sin(2 * f * dr) -
      0.0051 * math.sin((m + mp) * dr) -
      0.0074 * math.sin((m - mp) * dr) +
      0.0004 * math.sin((2 * f + m) * dr) -
      0.0004 * math.sin((2 * f - m) * dr) -
      0.0006 * math.sin((2 * f + mp) * dr) +
      0.0010 * math.sin((2 * f - mp) * dr) +
      0.0005 * math.sin((2 * mp + m) * dr);
  final delta = t < -11
      ? 0.001 +
            0.000839 * t +
            0.0002261 * t2 -
            0.00000845 * t3 -
            0.000000081 * t * t3
      : -0.000278 + 0.000265 * t + 0.000262 * t2;
  return (jd + correction - delta + 0.5 + 7 / 24).floor();
}

int _sunSector(int jd) {
  final t = (jd - 2451545.5 - 7 / 24) / 36525, dr = math.pi / 180;
  final m =
      357.52910 + 35999.05030 * t - 0.0001559 * t * t - 0.00000048 * t * t * t;
  final l0 = 280.46645 + 36000.76983 * t + 0.0003032 * t * t;
  final dl =
      (1.914600 - 0.004817 * t - 0.000014 * t * t) * math.sin(dr * m) +
      (0.019993 - 0.000101 * t) * math.sin(dr * 2 * m) +
      0.000290 * math.sin(dr * 3 * m);
  var l = (l0 + dl) * dr;
  l -= math.pi * 2 * (l / (math.pi * 2)).floor();
  return (l / math.pi * 6).floor();
}

int _month11(int year) {
  final k = ((_jd(31, 12, year) - 2415021.076998) / 29.530588853).floor();
  var nm = _newMoon(k);
  if (_sunSector(nm) >= 9) {
    nm = _newMoon(k - 1);
  }
  return nm;
}

int _leapOffset(int a11) {
  final k = ((a11 - 2415021.076998) / 29.530588853 + 0.5).floor();
  var last = 0, i = 1, arc = _sunSector(_newMoon(k + 1));
  do {
    last = arc;
    i++;
    arc = _sunSector(_newMoon(k + i));
  } while (arc != last && i < 14);
  return i - 1;
}

LunarDate solarToLunar(DateTime date) {
  final dayNumber = _jd(date.day, date.month, date.year);
  final k = ((dayNumber - 2415021.076998) / 29.530588853).floor();
  var monthStart = _newMoon(k + 1);
  if (monthStart > dayNumber) {
    monthStart = _newMoon(k);
  }
  var a11 = _month11(date.year), b11 = a11, year = date.year;
  if (a11 >= monthStart) {
    a11 = _month11(date.year - 1);
  } else {
    year++;
    b11 = _month11(date.year + 1);
  }
  final day = dayNumber - monthStart + 1,
      diff = ((monthStart - a11) / 29).floor();
  var month = diff + 11, leap = false;
  if (b11 - a11 > 365) {
    final offset = _leapOffset(a11);
    if (diff >= offset) {
      month = diff + 10;
      leap = diff == offset;
    }
  }
  if (month > 12) {
    month -= 12;
  }
  if (month >= 11 && diff < 4) {
    year--;
  }
  return LunarDate(day, month, year, leap);
}

DateTime lunarToSolar(int day, int month, int year) {
  final a11 = _month11(month < 11 ? year - 1 : year);
  final b11 = _month11(month < 11 ? year : year + 1);
  final k = ((a11 - 2415021.076998) / 29.530588853 + 0.5).floor();
  var off = month - 11;
  if (off < 0) {
    off += 12;
  }
  if (b11 - a11 > 365 && off >= _leapOffset(a11)) {
    off++;
  }
  return _fromJd(_newMoon(k + off) + day - 1);
}
