import 'package:flutter/material.dart';
import 'package:flutter/services.dart';

/// Không chỉnh text/selection trong lúc IME ghép dấu; chỉ phát tìm kiếm khi
/// composing kết thúc. Controller luôn thuộc màn hình, không thuộc lần build.
class VietnameseInput extends StatefulWidget {
  const VietnameseInput({
    super.key,
    required this.controller,
    required this.label,
    this.hint,
    this.validator,
    this.maxLength,
    this.minLines = 1,
    this.maxLines = 1,
    this.onCommitted,
    this.focusNode,
    this.obscureText = false,
    this.prefix,
    this.suffix,
    this.keyboardType,
    this.textInputAction,
    this.onSubmitted,
  });
  final TextEditingController controller;
  final String label;
  final String? hint;
  final String? Function(String?)? validator;
  final int? maxLength;
  final int minLines, maxLines;
  final ValueChanged<String>? onCommitted, onSubmitted;
  final FocusNode? focusNode;
  final bool obscureText;
  final Widget? prefix, suffix;
  final TextInputType? keyboardType;
  final TextInputAction? textInputAction;
  @override
  State<VietnameseInput> createState() => _VietnameseInputState();
}

class _VietnameseInputState extends State<VietnameseInput> {
  late String _committed;
  @override
  void initState() {
    super.initState();
    _committed = widget.controller.text;
    widget.controller.addListener(_listen);
  }

  @override
  void didUpdateWidget(VietnameseInput oldWidget) {
    super.didUpdateWidget(oldWidget);
    if (oldWidget.controller != widget.controller) {
      oldWidget.controller.removeListener(_listen);
      _committed = widget.controller.text;
      widget.controller.addListener(_listen);
    }
  }

  void _listen() {
    final value = widget.controller.value;
    if (value.composing.isValid && !value.composing.isCollapsed) return;
    if (value.text != _committed) {
      _committed = value.text;
      widget.onCommitted?.call(value.text);
    }
  }

  @override
  void dispose() {
    widget.controller.removeListener(_listen);
    super.dispose();
  }

  @override
  Widget build(BuildContext context) => TextFormField(
    controller: widget.controller,
    focusNode: widget.focusNode,
    validator: widget.validator,
    maxLength: widget.maxLength,
    maxLengthEnforcement: MaxLengthEnforcement.none,
    minLines: widget.minLines,
    maxLines: widget.maxLines,
    obscureText: widget.obscureText,
    autocorrect: !widget.obscureText,
    enableSuggestions: !widget.obscureText,
    enableIMEPersonalizedLearning: !widget.obscureText,
    hintLocales: widget.obscureText ? null : const [Locale('vi', 'VN')],
    textCapitalization: widget.obscureText ? TextCapitalization.none : TextCapitalization.sentences,
    smartDashesType: SmartDashesType.disabled,
    smartQuotesType: SmartQuotesType.disabled,
    keyboardType: widget.keyboardType,
    textInputAction: widget.textInputAction,
    onFieldSubmitted: widget.onSubmitted,
    decoration: InputDecoration(
      labelText: widget.label,
      hintText: widget.hint,
      prefixIcon: widget.prefix,
      suffixIcon: widget.suffix,
      alignLabelWithHint: widget.maxLines > 1,
    ),
  );
}
