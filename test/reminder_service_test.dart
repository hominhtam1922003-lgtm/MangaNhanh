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
  late List<Map<String, dynamic>> pending;

  setUp(() {
    debugDefaultTargetPlatformOverride = TargetPlatform.android;
    AndroidFlutterLocalNotificationsPlugin.registerWith();
    calls = [];
    granted = true;
    enabled = true;
    zone = 'Asia/Ho_Chi_Minh';
    service = ReminderService();
    pending = [
      {'id': 1, 'title': 'Nhắc việc', 'body': '', 'payload': 'task:1'},
      {'id': 1500000001, 'title': 'Lễ', 'body': '', 'payload': 'holiday:1'},
    ];
    messenger.setMockMethodCallHandler(timezone, (_) async => zone);
    messenger.setMockMethodCallHandler(channel, (call) async {
      calls.add(call);
      if (call.method == 'cancel') {
        pending.removeWhere((p) => p['id'] == (call.arguments as Map)['id']);
      }
      if (call.method == 'zonedSchedule') {
        final args = call.arguments as Map;
        pending.removeWhere((p) => p['id'] == args['id']);
        pending.add({
          'id': args['id'],
          'title': args['title'],
          'body': args['body'],
          'payload': args['payload'],
        });
      }
      return switch (call.method) {
        'initialize' => true,
        'requestNotificationsPermission' => granted,
        'areNotificationsEnabled' => enabled,
        'getActiveNotifications' => [
          {'id': 100, 'channelId': 'task_reminders', 'payload': 'task:100'},
          {
            'id': 1600000001,
            'channelId': 'weather_alerts',
            'payload': 'weather:rain',
          },
        ],
        'pendingNotificationRequests' => pending,
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

  test(
    'Nhắc việc không hủy nhầm lễ hoặc thời tiết, hủy cả thông báo đã hiện',
    () async {
      await service.reconcile([]);
      final ids = calls
          .where((c) => c.method == 'cancel')
          .map((c) => (c.arguments as Map)['id'])
          .toList();
      expect(ids, containsAll([1, 100]));
      expect(ids, isNot(contains(1500000001)));
      expect(ids, isNot(contains(1600000001)));
    },
  );

  test('Không hủy hoặc lên lịch lại các việc không thay đổi', () async {
    final task = futureTask();
    await service.reconcile([task]);
    calls.clear();
    await service.reconcile([task]);
    expect(calls.where((c) => c.method == 'zonedSchedule'), isEmpty);
    expect(
      calls.where(
        (c) => c.method == 'cancel' && (c.arguments as Map)['id'] == 1,
      ),
      isEmpty,
    );
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
