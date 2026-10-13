import 'package:flutter/material.dart';
import 'package:flutter_test/flutter_test.dart';
import 'package:lich_nhac/widgets/vietnamese_input.dart';
import 'package:lich_nhac/models/task.dart';
import 'package:lich_nhac/models/task_query.dart';

void main() {
  testWidgets('Ghép dấu giữ nguyên text, caret, composing qua rebuild', (
    tester,
  ) async {
    final controller = TextEditingController();
    final focus = FocusNode();
    final committed = <String>[];
    addTearDown(controller.dispose);
    addTearDown(focus.dispose);
    Widget host() => MaterialApp(
      home: Scaffold(
        body: VietnameseInput(
          controller: controller,
          focusNode: focus,
          label: 'Tiếng Việt',
          onCommitted: committed.add,
        ),
      ),
    );
    await tester.pumpWidget(host());
    await tester.tap(find.byType(TextFormField));
    const composing = TextEditingValue(
      text: 'đi học tiếng Việt',
      selection: TextSelection.collapsed(offset: 10),
      composing: TextRange(start: 7, end: 12),
    );
    tester.testTextInput.updateEditingValue(composing);
    await tester.pump();
    expect(controller.value, composing);
    expect(committed, isEmpty);
    await tester.pumpWidget(host());
    expect(controller.value, composing);
    expect(focus.hasFocus, isTrue);
    tester.testTextInput.updateEditingValue(
      composing.copyWith(composing: TextRange.empty),
    );
    await tester.pump();
    expect(committed, ['đi học tiếng Việt']);
    expect(controller.selection.baseOffset, 10);
  });
  testWidgets('Giới hạn tiêu đề không cắt lúc IME đang ghép', (tester) async {
    final c = TextEditingController();
    addTearDown(c.dispose);
    await tester.pumpWidget(
      MaterialApp(
        home: Scaffold(
          body: VietnameseInput(controller: c, label: 'Tiêu đề', maxLength: 4),
        ),
      ),
    );
    await tester.tap(find.byType(TextFormField));
    tester.testTextInput.updateEditingValue(
      const TextEditingValue(
        text: 'Tiếng',
        selection: TextSelection.collapsed(offset: 5),
        composing: TextRange(start: 0, end: 5),
      ),
    );
    await tester.pump();
    expect(c.text, 'Tiếng');
    expect(c.value.composing, const TextRange(start: 0, end: 5));
  });
  test('Tìm không dấu / Unicode tổ hợp không sửa nội dung gốc', () {
    final task = Task(title: 'Đặt lịch ôn tiếng Việt', dueDate: DateTime(2026));
    expect(
      queryTasks([task], now: DateTime(2026), search: 'dat lich on tieng viet'),
      [task],
    );
    expect(searchText('Vie\u0323\u0302t'), 'viet');
    expect(task.title, 'Đặt lịch ôn tiếng Việt');
  });
}
