import 'package:flutter_test/flutter_test.dart';
import 'package:lich_nhac/models/holiday.dart';
import 'package:lich_nhac/models/vietnamese_calendar.dart';

void main() {
  test('Tết âm lịch Việt Nam theo các mốc đã biết', () {
    expect(lunarToSolar(1, 1, 2024), DateTime(2024, 2, 10));
    expect(lunarToSolar(1, 1, 2025), DateTime(2025, 1, 29));
    expect(lunarToSolar(1, 1, 2026), DateTime(2026, 2, 17));
    expect(lunarToSolar(1, 1, 2027), DateTime(2027, 2, 6));
  });
  test('Tháng nhuận Việt Nam', () {
    final date = solarToLunar(DateTime(2023, 3, 22));
    expect(date.day, 1);
    expect(date.month, 2);
    expect(date.leap, isTrue);
  });
  test('Giỗ Tổ và Trung thu 2026', () {
    expect(lunarToSolar(10, 3, 2026), DateTime(2026, 4, 26));
    expect(lunarToSolar(15, 8, 2026), DateTime(2026, 9, 25));
  });
  test('Ngày dương cố định, ngày lễ và kỷ niệm phân biệt', () {
    expect(holidaysOn(DateTime(2026, 9, 2)).single.publicHoliday, isTrue);
    expect(holidaysOn(DateTime(2026, 11, 20)).single.publicHoliday, isFalse);
    expect(holidaysForYear(1800), isEmpty);
  });
  test('ID ngày lễ không trùng, ngày được sắp tăng dần', () {
    final holidays = [...holidaysForYear(2026), ...holidaysForYear(2027)];
    expect(holidays.map((h) => h.id).toSet().length, holidays.length);
    final dates = holidaysForYear(2026).map((h) => h.date).toList();
    final sorted = [...dates]..sort();
    expect(dates, sorted);
  });
}
