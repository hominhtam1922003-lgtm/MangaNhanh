import 'task.dart';
import 'vietnamese_calendar.dart';

class Holiday {
  const Holiday(
    this.id,
    this.title,
    this.date,
    this.description, {
    this.publicHoliday = false,
  });
  final int id;
  final String title, description;
  final DateTime date;
  final bool publicHoliday;
}

final _holidayCache = <int, List<Holiday>>{};
List<Holiday> holidaysForYear(int year) {
  if (year < 1900 || year > 2100) {
    return [];
  }
  return _holidayCache.putIfAbsent(year, () {
    final tet = lunarToSolar(1, 1, year);
    final items = <Holiday>[];
    void add(
      String title,
      DateTime date,
      String note, {
      bool publicHoliday = false,
    }) => items.add(
      Holiday(
        1500000000 + (year - 1900) * 100 + items.length,
        title,
        date,
        note,
        publicHoliday: publicHoliday,
      ),
    );
    add(
      'Tết Dương lịch',
      DateTime(year, 1, 1),
      'Ngày 1 tháng 1',
      publicHoliday: true,
    );
    add(
      'Giao thừa',
      DateTime(tet.year, tet.month, tet.day - 1),
      'Ngày cuối năm âm lịch',
    );
    add('Tết Nguyên đán', tet, 'Mùng 1 tháng Giêng', publicHoliday: true);
    add(
      'Mùng 2 Tết',
      DateTime(tet.year, tet.month, tet.day + 1),
      'Ngày truyền thống; lịch nghỉ thực tế theo công bố hằng năm',
    );
    add(
      'Mùng 3 Tết',
      DateTime(tet.year, tet.month, tet.day + 2),
      'Ngày truyền thống; lịch nghỉ thực tế theo công bố hằng năm',
    );
    add(
      'Quốc tế Phụ nữ',
      DateTime(year, 3, 8),
      'Ngày kỷ niệm, không mặc định là ngày nghỉ',
    );
    add(
      'Giỗ Tổ Hùng Vương',
      lunarToSolar(10, 3, year),
      'Ngày 10 tháng 3 âm lịch',
      publicHoliday: true,
    );
    add(
      'Ngày Giải phóng miền Nam',
      DateTime(year, 4, 30),
      'Ngày 30 tháng 4',
      publicHoliday: true,
    );
    add(
      'Quốc tế Lao động',
      DateTime(year, 5, 1),
      'Ngày 1 tháng 5',
      publicHoliday: true,
    );
    add('Quốc tế Thiếu nhi', DateTime(year, 6, 1), 'Ngày kỷ niệm');
    add('Tết Đoan Ngọ', lunarToSolar(5, 5, year), 'Ngày 5 tháng 5 âm lịch');
    add('Ngày Gia đình Việt Nam', DateTime(year, 6, 28), 'Ngày kỷ niệm');
    add(
      'Quốc khánh',
      DateTime(year, 9, 2),
      'Lịch nghỉ liền kề / nghỉ bù theo công bố hằng năm',
      publicHoliday: true,
    );
    add('Tết Trung thu', lunarToSolar(15, 8, year), 'Ngày 15 tháng 8 âm lịch');
    add('Ngày Phụ nữ Việt Nam', DateTime(year, 10, 20), 'Ngày kỷ niệm');
    add('Ngày Nhà giáo Việt Nam', DateTime(year, 11, 20), 'Ngày kỷ niệm');
    add('Giáng sinh', DateTime(year, 12, 25), 'Ngày lễ truyền thống');
    items.sort((a, b) => a.date.compareTo(b.date));
    return List.unmodifiable(items);
  });
}

List<Holiday> holidaysOn(DateTime date) =>
    holidaysForYear(date.year).where((h) => sameDay(h.date, date)).toList();
