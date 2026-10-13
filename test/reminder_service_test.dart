import 'package:flutter/foundation.dart';
import 'package:flutter/services.dart';
import 'package:flutter_local_notifications/flutter_local_notifications.dart';
import 'package:flutter_test/flutter_test.dart';
import 'package:lich_nhac/data/reminder_service.dart';
import 'package:lich_nhac/models/task.dart';

void main() {
  TestWidgetsFlutterBinding.ensureInitialized();
  const channel = MethodChannel('dexterous.com/flutter/local_notifications');
  const timezone = MethodChannel('vn.lichnhac.app/timezone');
  final messenger =
      TestDefaultBinaryMessengerBinding.instance.defaultBinaryMessenger;
  late List<MethodCall> calls;
  late bool granted;
  late bool enabled;
  late String zone;
  late ReminderService service;

  setUp(() {
    debugDefaultTargetPlatformOverride = TargetPlatform.android;
    AndroidFlutterLocalNotificationsPlugin.registerWith();
    calls = [];
    granted = true;
    enabled = true;
    zone = 'Asia/Ho_Chi_Minh';
    service = ReminderService();
    messenger.setMockMethodCallHandler(timezone, (_) async => zone);
    messenger.setMockMethodCallHandler(channel, (call) async {
      calls.add(call);
      return switch (call.method) {
        'initialize' => true,
        'requestNotificationsPermission' => granted,
        'areNotificationsEnabled' => enabled,
        'pendingNotificationRequests' => [
          {'id': 1, 'title': 'Nhắc việc', 'body': '', 'payload': 'task:1'},
          {'id': 1500000001, 'title': 'Lễ', 'body': '', 'payload': 'holiday:1'},
        ],
        _ => null,
      };
    });
  });
  tearDown(() {
    messenger.setMockMethodCallHandler(channel, null);
    messenger.setMockMethodCallHandler(timezone, null);
    debugDefaultTargetPlatformOverride = null;
  });

  Task futureTask({
    bool reminder = true,
    bool completed = false,
    int? minutes = 540,
  }) => Task(
    id: 1,
    title: 'Nhắc việc',
    dueDate: DateTime.now().add(const Duration(days: 3)),
    dueMinutes: minutes,
    reminder: reminder,
    completed: completed,
  );

  test('Lên lịch giờ địa phương bằng inexactAllowWhileIdle', () async {
    expect(
      await service.reconcile([futureTask()], requestPermission: true),
      isNull,
    );
    final args =
        calls.singleWhere((c) => c.method == 'zonedSchedule').arguments as Map;
    expect(args['id'], 1);
    expect(args['timeZoneName'], 'Asia/Ho_Chi_Minh');
    final specifics = args['platformSpecifics'] as Map;
    expect(
      specifics['scheduleMode'],
      AndroidScheduleMode.inexactAllowWhileIdle.name,
    );
    expect(
      calls.any((c) => c.method == 'requestExactAlarmsPermission'),
      isFalse,
    );
  });

  test(
    'Không lên lịch khi tắt nhắc, không giờ, đã xong hoặc hạn đã qua',
    () async {
      final tasks = [
        futureTask(reminder: false),
        futureTask(minutes: null),
        futureTask(completed: true),
        Task(
          id: 4,
          title: 'Hạn cũ',
          dueDate: DateTime(2000),
          dueMinutes: 600,
          reminder: true,
        ),
      ];
      expect(await service.reconcile(tasks), isNull);
      expect(calls.any((c) => c.method == 'zonedSchedule'), isFalse);
      expect(
        calls.any((c) => c.method == 'requestNotificationsPermission'),
        isFalse,
      );
    },
  );

  test(
    'Từ chối quyền không throw; hủy lịch và trả thông báo tiếng Việt',
    () async {
      granted = false;
      expect(
        await service.reconcile([futureTask()], requestPermission: true),
        contains('chưa được cấp'),
      );
      expect(calls.any((c) => c.method == 'cancel'), isTrue);
      expect(calls.any((c) => c.method == 'zonedSchedule'), isFalse);
    },
  );

  test('Quyền bị tắt trong hệ thống không tạo lịch mới', () async {
    enabled = false;
    expect(await service.reconcile([futureTask()]), contains('đang bị tắt'));
    expect(calls.any((c) => c.method == 'zonedSchedule'), isFalse);
  });

  test('Xóa hoặc hoàn thành hủy lịch thông báo cũ', () async {
    await service.reconcile([futureTask()]);
    calls.clear();
    await service.reconcile([futureTask(completed: true)]);
    expect(calls.any((c) => c.method == 'cancel'), isTrue);
    expect(calls.any((c) => c.method == 'zonedSchedule'), isFalse);
    calls.clear();
    await service.reconcile([]);
    expect(calls.any((c) => c.method == 'cancel'), isTrue);
  });

  test('Đổi múi giờ và múi giờ GMT cố định', () async {
    await service.reconcile([futureTask()]);
    calls.clear();
    zone = 'GMT+07:00';
    expect(await service.reconcile([futureTask()]), isNull);
    final args =
        calls.singleWhere((c) => c.method == 'zonedSchedule').arguments as Map;
    expect(args['timeZoneName'], 'GMT+07:00');
  });

  test('Lỗi plugin trả cảnh báo, không crash', () async {
    messenger.setMockMethodCallHandler(
      channel,
      (_) async => throw PlatformException(code: 'test'),
    );
    expect(await service.reconcile([futureTask()]), contains('Dữ liệu đã lưu'));
  });
}
