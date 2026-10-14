import React, { useEffect, useMemo, useRef } from "react";
import { Animated, Easing, StyleSheet, Text, View } from "react-native";
import Svg, {
  Circle,
  Defs,
  Ellipse,
  G,
  LinearGradient as SvgGradient,
  Path,
  Rect,
  Stop,
} from "react-native-svg";
import { useTheme } from "../theme/ThemeContext";

const WIDTH = 330;
const HEIGHT = 150;
/** Cầu tình yêu: một vòng cung có lan can, hai bạn chibi chạy từ hai đầu vào giữa. */
const BRIDGE_D = "M22 118 Q165 44 308 118";
const PLANKS = Array.from({ length: 21 }, (_, index) => index / 20);

function pointAt(t: number) {
  // Đường bậc hai: P = (1-t)²·A + 2(1-t)t·B + t²·C
  const a = (1 - t) * (1 - t);
  const b = 2 * (1 - t) * t;
  const c = t * t;
  return {
    x: a * 22 + b * 165 + c * 308,
    y: a * 118 + b * 44 + c * 118,
  };
}

export default function LoveBridge({
  leftEmoji = "👰",
  rightEmoji = "🤵",
  height = HEIGHT,
}: {
  leftEmoji?: string;
  rightEmoji?: string;
  height?: number;
}) {
  const { theme } = useTheme();
  const walk = useRef(new Animated.Value(0)).current;
  const meet = useRef(new Animated.Value(0)).current;
  useEffect(() => {
    const loop = Animated.loop(
      Animated.sequence([
        Animated.timing(walk, {
          toValue: 1,
          duration: 3600,
          easing: Easing.inOut(Easing.quad),
          useNativeDriver: true,
        }),
        Animated.timing(meet, {
          toValue: 1,
          duration: 900,
          easing: Easing.out(Easing.back(2)),
          useNativeDriver: true,
        }),
        Animated.delay(1100),
        Animated.timing(meet, {
          toValue: 0,
          duration: 400,
          useNativeDriver: true,
        }),
        Animated.timing(walk, {
          toValue: 0,
          duration: 500,
          useNativeDriver: true,
        }),
      ]),
    );
    loop.start();
    return () => loop.stop();
  }, [walk, meet]);

  // Hai bạn đi từ hai đầu vào tới giữa cầu, mỗi bên dừng ở 46%/54%.
  const translateX = (side: "left" | "right") =>
    walk.interpolate({
      inputRange: [0, 1],
      outputRange: side === "left" ? [6, WIDTH * 0.42] : [-6, -WIDTH * 0.42],
    });
  const bob = walk.interpolate({
    inputRange: [0, 0.25, 0.5, 0.75, 1],
    outputRange: [0, -5, 0, -5, 0],
  });
  const heartScale = meet.interpolate({
    inputRange: [0, 1],
    outputRange: [0.2, 1],
  });
  const heartOpacity = meet.interpolate({
    inputRange: [0, 1],
    outputRange: [0, 1],
  });
  const planks = useMemo(() => PLANKS.map((t) => ({ t, ...pointAt(t) })), []);

  return (
    <View style={{ height, alignItems: "center", justifyContent: "center" }}>
      <Svg width={WIDTH} height={HEIGHT}>
        <Defs>
          <SvgGradient id="deck" x1="0" y1="0" x2="0" y2="1">
            <Stop offset="0" stopColor={theme.deep[0]} />
            <Stop offset="1" stopColor={theme.deep[1]} />
          </SvgGradient>
          <SvgGradient id="sky" x1="0" y1="0" x2="0" y2="1">
            <Stop offset="0" stopColor={theme.glow} stopOpacity="0.35" />
            <Stop offset="1" stopColor={theme.glow} stopOpacity="0" />
          </SvgGradient>
        </Defs>
        <Ellipse cx={165} cy={128} rx={150} ry={16} fill="url(#sky)" />
        <Circle cx={165} cy={126} r={62} fill="url(#sky)" />
        {/* mặt cầu (nhìn nghiêng cho ra dáng 3D) */}
        <Path
          d={BRIDGE_D}
          stroke={theme.deep[1]}
          strokeWidth={22}
          fill="none"
          strokeLinecap="round"
        />
        <Path
          d={BRIDGE_D}
          stroke="url(#deck)"
          strokeWidth={16}
          fill="none"
          strokeLinecap="round"
        />
        {/* ván cầu */}
        <G>
          {planks.map(({ t, x, y }) => (
            <Rect
              key={t}
              x={x - 3.2}
              y={y - 7.6}
              width={6.4}
              height={15}
              rx={2.4}
              fill={t % 0.2 < 0.1 ? "#ffffff55" : "#ffffff2e"}
            />
          ))}
        </G>
        {/* lan can */}
        <Path
          d={BRIDGE_D}
          stroke={theme.deep[0]}
          strokeWidth={3}
          fill="none"
          transform="translate(0 -26)"
          opacity={0.95}
        />
        {planks
          .filter((_, index) => index % 2 === 0)
          .map(({ t, x, y }) => (
            <Rect
              key={`post-${t}`}
              x={x - 1.4}
              y={y - 27}
              width={2.8}
              height={26}
              rx={1.2}
              fill={theme.deep[0]}
              opacity={0.9}
            />
          ))}
        {/* mố cầu hai đầu */}
        {[22, 308].map((x) => (
          <G key={x}>
            <Rect
              x={x - 12}
              y={100}
              width={24}
              height={30}
              rx={6}
              fill={theme.deep[1]}
            />
            <Rect
              x={x - 14}
              y={94}
              width={28}
              height={9}
              rx={4}
              fill={theme.deep[0]}
            />
          </G>
        ))}
      </Svg>
      <Animated.View
        pointerEvents="none"
        style={[
          styles.actor,
          {
            left: 0,
            transform: [
              { translateX: translateX("left") },
              { translateY: bob },
            ],
          },
        ]}
      >
        <Text style={{ fontSize: 34 }}>{leftEmoji}</Text>
      </Animated.View>
      <Animated.View
        pointerEvents="none"
        style={[
          styles.actor,
          {
            right: 0,
            transform: [
              { translateX: translateX("right") },
              { translateY: bob },
            ],
          },
        ]}
      >
        <Text style={{ fontSize: 34 }}>{rightEmoji}</Text>
      </Animated.View>
      <Animated.Text
        pointerEvents="none"
        style={[
          styles.heart,
          {
            opacity: heartOpacity,
            transform: [{ scale: heartScale }],
          },
        ]}
      >
        💞
      </Animated.Text>
    </View>
  );
}

const styles = StyleSheet.create({
  actor: { position: "absolute", bottom: 34 },
  heart: { position: "absolute", bottom: 72, fontSize: 30 },
});
