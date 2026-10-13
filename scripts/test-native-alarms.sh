#!/usr/bin/env bash
set -euo pipefail
adb install -r build/app/outputs/apk/debug/app-debug.apk
adb install -r build/app/outputs/apk/androidTest/debug/app-debug-androidTest.apk
adb shell pm grant vn.lichnhac.app android.permission.POST_NOTIFICATIONS
adb shell appops set vn.lichnhac.app SCHEDULE_EXACT_ALARM allow
adb shell am instrument -w -e class vn.lichnhac.app.AlarmIntegrationTest vn.lichnhac.app.test/androidx.test.runner.AndroidJUnitRunner | tee /tmp/lich-nhac-alarm-integration.log
if grep -Eq 'FAILURES|INSTRUMENTATION_FAILED|Process crashed' /tmp/lich-nhac-alarm-integration.log; then exit 1; fi
grep -Eq 'OK \([0-9]+ tests?\)' /tmp/lich-nhac-alarm-integration.log
