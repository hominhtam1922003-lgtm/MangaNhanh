import 'package:flutter/material.dart';

class DepthCard extends StatelessWidget {
  const DepthCard({super.key, required this.child, this.hero = false});
  final Widget child;
  final bool hero;
  @override
  Widget build(BuildContext context) {
    final c = Theme.of(context).colorScheme;
    return Container(
      padding: const EdgeInsets.all(22),
      decoration: BoxDecoration(
        borderRadius: BorderRadius.circular(28),
        gradient: LinearGradient(
          begin: Alignment.topLeft,
          end: Alignment.bottomRight,
          colors: hero
              ? [c.primary, const Color(0xFF184973), const Color(0xFF19354E)]
              : [c.surfaceContainerHigh, c.surfaceContainerLow],
        ),
        border: Border.all(
          color: hero
              ? Colors.white.withValues(alpha: 0.18)
              : c.outlineVariant.withValues(alpha: 0.45),
        ),
        boxShadow: [
          BoxShadow(
            color: c.primary.withValues(alpha: 0.12),
            blurRadius: 22,
            offset: const Offset(0, 10),
          ),
        ],
      ),
      child: hero
          ? DefaultTextStyle.merge(
              style: const TextStyle(color: Colors.white),
              child: IconTheme(
                data: const IconThemeData(color: Colors.white),
                child: child,
              ),
            )
          : child,
    );
  }
}

class WeatherOrb extends StatelessWidget {
  const WeatherOrb({super.key, required this.rainy});
  final bool rainy;
  @override
  Widget build(BuildContext context) => Semantics(
    label: rainy ? 'Biểu tượng mưa' : 'Biểu tượng mặt trời',
    child: SizedBox(
      width: 100,
      height: 100,
      child: Stack(
        alignment: Alignment.center,
        children: [
          Container(
            width: 78,
            height: 78,
            decoration: BoxDecoration(
              shape: BoxShape.circle,
              gradient: RadialGradient(
                center: const Alignment(-0.5, -0.6),
                colors: rainy
                    ? [
                        const Color(0xFFE2F8FF),
                        const Color(0xFF51A2C8),
                        const Color(0xFF24517A),
                      ]
                    : [
                        const Color(0xFFFFF9CF),
                        const Color(0xFFFFCF5C),
                        const Color(0xFFE78332),
                      ],
              ),
              boxShadow: const [
                BoxShadow(
                  color: Color(0x66000000),
                  blurRadius: 14,
                  offset: Offset(8, 12),
                ),
              ],
            ),
          ),
          Positioned(
            right: 0,
            bottom: 8,
            child: Icon(
              rainy ? Icons.water_drop_rounded : Icons.cloud_rounded,
              size: 53,
              color: const Color(0xFFDCECF9),
              shadows: const [
                Shadow(
                  color: Color(0x55000000),
                  offset: Offset(3, 5),
                  blurRadius: 8,
                ),
              ],
            ),
          ),
        ],
      ),
    ),
  );
}
