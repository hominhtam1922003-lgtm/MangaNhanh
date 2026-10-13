import 'package:flutter/services.dart';
import '../models/task.dart';

class AlarmCapabilities {
  const AlarmCapabilities({
    this.exact = false,
    this.fullScreen = false,
    this.volume = 0,
    this.maxVolume = 0,
  });
  final bool exact, fullScreen;
  final int volume, maxVolume;
}

class AlarmBridge {
  static const channel = MethodChannel('vn.lichnhac.app/alarms');
  Future<AlarmCapabilities> capabilities() async {
    final data =
        await channel.invokeMapMethod<String, dynamic>('capabilities') ?? {};
    return AlarmCapabilities(
      exact: data['exact'] == true,
      fullScreen: data['fullScreen'] == true,
      volume: (data['volume'] as num?)?.toInt() ?? 0,
      maxVolume: (data['maxVolume'] as num?)?.toInt() ?? 0,
    );
  }

  Future<bool> sync(List<Task> tasks) async =>
      await channel.invokeMethod<bool>('sync', {
        'tasks': tasks
            .where(
              (t) => t.alarm && t.reminder && !t.completed && t.dueAt != null,
            )
            .map(
              (t) => {
                'id': t.id,
                'title': t.title,
                'at': t.dueAt!.millisecondsSinceEpoch,
              },
            )
            .toList(),
      }) ??
      false;
  Future<void> clear() => channel.invokeMethod<void>('clear');
  Future<void> openRingingAlarm() =>
      channel.invokeMethod<void>('openRingingAlarm');
  Future<void> openExactSettings() =>
      channel.invokeMethod<void>('openExactSettings');
  Future<void> openFullScreenSettings() =>
      channel.invokeMethod<void>('openFullScreenSettings');
  Future<void> openSoundSettings() =>
      channel.invokeMethod<void>('openSoundSettings');
}
