import React, { useEffect, useMemo, useRef } from "react";
import { Animated, Easing, View } from "react-native";
import Svg, {
  Circle,
  Defs,
  Ellipse,
  G,
  LinearGradient as SvgLinear,
  Path,
  RadialGradient,
  Rect,
  Stop,
} from "react-native-svg";
import { useTheme } from "../theme/ThemeContext";

/**
 * Cầu tình yêu — tranh vẽ vector (SVG) dựng theo đúng ảnh bạn gửi:
 * nền trời xanh xám dịu, sóng mây hoa văn hai góc, vầng trăng vàng lớn,
 * mây trắng cuộn dưới chân, đàn chim Ô Thước xếp thành cầu, cô dâu áo hồng dài
 * bay trong gió và chú rể áo lam đứng tựa vào nhau.
 *
 * Vẽ bằng vector nên nét mảnh, thanh thoát (không còn khối mô hình đồ chơi) và
 * rất nhẹ máy: không dùng thêm vùng WebGL nào, chỉ là hình ảnh có hoạt ảnh nhẹ.
 */

const W = 360;
const H = 230;

/** Một con chim Ô Thước nhỏ: thân cong + hai cánh trắng. */
function Bird({
  x,
  y,
  scale = 1,
  flip = false,
}: {
  x: number;
  y: number;
  scale?: number;
  flip?: boolean;
}) {
  return (
    <G
      transform={`translate(${x} ${y}) scale(${flip ? -scale : scale} ${scale})`}
    >
      <Path
        d="M0 0 C 6 -4, 13 -4, 18 0 C 13 2, 6 2, 0 0 Z"
        fill="#2f3446"
        opacity={0.92}
      />
      <Path
        d="M4 -1 C 8 -7, 13 -7, 16 -2 C 12 -4, 8 -4, 4 -1 Z"
        fill="#f7f9fc"
        opacity={0.9}
      />
      <Path
        d="M5 1 C 9 6, 14 6, 17 2 C 13 4, 9 4, 5 1 Z"
        fill="#e8eef6"
        opacity={0.75}
      />
      <Path
        d="M-4 -1 C -7 -3, -9 -2, -10 0 C -8 1, -6 1, -4 -1 Z"
        fill="#2f3446"
        opacity={0.85}
      />
    </G>
  );
}

/** Cụm sóng hoa văn (kiểu sóng Nhật) để viền trời cho có hồn tranh. */
function WaveOrnament({
  x,
  y,
  scale = 1,
  opacity = 0.5,
}: {
  x: number;
  y: number;
  scale?: number;
  opacity?: number;
}) {
  const rings = [0, 1, 2, 3];
  return (
    <G transform={`translate(${x} ${y}) scale(${scale})`} opacity={opacity}>
      {rings.map((ring) => (
        <Path
          key={ring}
          d={`M${-16 - ring * 7} 0 A ${16 + ring * 7} ${16 + ring * 7} 0 0 1 ${16 + ring * 7} 0`}
          stroke="#ffffff"
          strokeWidth={1.6}
          fill="none"
        />
      ))}
      {rings.map((ring) => (
        <Path
          key={`b-${ring}`}
          d={`M${-10 - ring * 7} 6 A ${10 + ring * 7} ${10 + ring * 7} 0 0 1 ${10 + ring * 7} 6`}
          stroke="#ffffff"
          strokeWidth={1.1}
          fill="none"
          opacity={0.7}
        />
      ))}
    </G>
  );
}

/** Đám mây bồng bềnh. */
function Cloud({
  x,
  y,
  scale = 1,
  color = "#ffffff",
  opacity = 0.95,
}: {
  x: number;
  y: number;
  scale?: number;
  color?: string;
  opacity?: number;
}) {
  return (
    <G transform={`translate(${x} ${y}) scale(${scale})`} opacity={opacity}>
      <Path
        d="M-38 8 C -46 -6, -30 -16, -18 -10 C -14 -24, 8 -26, 16 -12 C 32 -18, 46 -6, 38 8 Z"
        fill={color}
      />
    </G>
  );
}

export default function LoveBridgeArt({
  height = 226,
  reduced = false,
}: {
  height?: number;
  reduced?: boolean;
}) {
  const { theme } = useTheme();
  const float = useRef(new Animated.Value(0)).current;

  useEffect(() => {
    if (reduced) return undefined;
    const loop = Animated.loop(
      Animated.sequence([
        Animated.timing(float, {
          toValue: 1,
          duration: 3200,
          easing: Easing.inOut(Easing.sin),
          useNativeDriver: true,
        }),
        Animated.timing(float, {
          toValue: 0,
          duration: 3200,
          easing: Easing.inOut(Easing.sin),
          useNativeDriver: true,
        }),
      ]),
    );
    loop.start();
    return () => loop.stop();
  }, [reduced, float]);

  const translateY = float.interpolate({
    inputRange: [0, 1],
    outputRange: [0, -6],
  });

  // Đàn chim xếp thành cầu: vòm cong, hai bên thấp dần.
  const birds = useMemo(() => {
    const list: { x: number; y: number; scale: number; flip: boolean }[] = [];
    for (let index = 0; index < 19; index++) {
      const t = index / 18;
      const x = 46 + t * (W - 92);
      const arch = Math.sin(Math.PI * t);
      list.push({
        x,
        y: H - 52 - arch * 34,
        scale: 0.75 + arch * 0.5,
        flip: index % 2 === 0,
      });
    }
    return list;
  }, []);

  return (
    <View
      accessibilityLabel="Tranh cầu tình yêu: đôi uyên ương đứng trên cầu chim Ô Thước dưới vầng trăng, mây và sóng hoa văn"
      style={{
        height,
        borderRadius: 26,
        overflow: "hidden",
        borderWidth: 1,
        borderColor: theme.border,
      }}
    >
      <Animated.View
        style={{ flex: 1, transform: [{ translateY }] }}
        pointerEvents="none"
      >
        <Svg width="100%" height="100%" viewBox={`0 0 ${W} ${H}`}>
          <Defs>
            <SvgLinear id="sky" x1="0" y1="0" x2="0" y2="1">
              <Stop offset="0" stopColor="#c9d6e3" />
              <Stop offset="0.55" stopColor="#dfe6ee" />
              <Stop offset="1" stopColor="#eef1f5" />
            </SvgLinear>
            <RadialGradient id="moonGlow" cx="0.5" cy="0.5" r="0.5">
              <Stop offset="0.55" stopColor="#ffe9a8" stopOpacity="0.95" />
              <Stop offset="0.85" stopColor="#ffdf95" stopOpacity="0.35" />
              <Stop offset="1" stopColor="#ffdf95" stopOpacity="0" />
            </RadialGradient>
            <SvgLinear id="dressPink" x1="0" y1="0" x2="0" y2="1">
              <Stop offset="0" stopColor="#f7a8c4" />
              <Stop offset="1" stopColor="#ef7ba6" />
            </SvgLinear>
            <SvgLinear id="robeBlue" x1="0" y1="0" x2="0" y2="1">
              <Stop offset="0" stopColor="#4a5b7c" />
              <Stop offset="1" stopColor="#33415c" />
            </SvgLinear>
            <SvgLinear id="cloudFade" x1="0" y1="0" x2="0" y2="1">
              <Stop offset="0" stopColor="#ffffff" stopOpacity="0.98" />
              <Stop offset="1" stopColor="#e6ecf3" stopOpacity="0.9" />
            </SvgLinear>
          </Defs>

          {/* Trời */}
          <Rect x={0} y={0} width={W} height={H} fill="url(#sky)" />

          {/* Sóng hoa văn hai góc */}
          <WaveOrnament x={46} y={44} scale={1} opacity={0.55} />
          <WaveOrnament x={104} y={30} scale={0.7} opacity={0.4} />
          <WaveOrnament x={W - 40} y={58} scale={0.95} opacity={0.5} />
          <WaveOrnament x={W - 96} y={34} scale={0.65} opacity={0.35} />

          {/* Vầng trăng */}
          <G>
            <Circle cx={W / 2} cy={96} r={62} fill="url(#moonGlow)" />
            <Circle cx={W / 2} cy={96} r={44} fill="#f7dc93" opacity={0.98} />
            <Circle
              cx={W / 2 - 12}
              cy={82}
              r={9}
              fill="#f2d178"
              opacity={0.5}
            />
            <Circle
              cx={W / 2 + 14}
              cy={108}
              r={12}
              fill="#f2d178"
              opacity={0.35}
            />
          </G>

          {/* Mây trắng cuộn dưới chân */}
          <G>
            <Cloud
              x={40}
              y={H - 46}
              scale={1.5}
              color="url(#cloudFade)"
              opacity={0.95}
            />
            <Cloud x={130} y={H - 34} scale={1.15} opacity={0.9} />
            <Cloud
              x={W - 52}
              y={H - 50}
              scale={1.6}
              color="url(#cloudFade)"
              opacity={0.95}
            />
            <Cloud x={W - 132} y={H - 30} scale={1.05} opacity={0.85} />
            <Cloud
              x={W / 2}
              y={H - 18}
              scale={2.2}
              color="url(#cloudFade)"
              opacity={0.98}
            />
            <Cloud x={W / 2 - 96} y={H - 22} scale={1.4} opacity={0.92} />
            <Cloud x={W / 2 + 92} y={H - 24} scale={1.35} opacity={0.92} />
          </G>

          {/* Cầu chim Ô Thước */}
          <G opacity={0.96}>
            {birds.map((bird, index) => (
              <Bird key={index} {...bird} />
            ))}
          </G>

          {/* Đôi uyên ương đứng trên cầu */}
          <G transform={`translate(${W / 2} ${H - 118})`}>
            {/* Chú rể: áo lam dài, tay vòng qua vai cô dâu */}
            <G transform="translate(-16 0)">
              <Path
                d="M-13 44 C -15 20, -12 8, -2 8 C 8 8, 11 20, 9 44 Z"
                fill="url(#robeBlue)"
              />
              <Path
                d="M-11 12 C -14 4, -6 -2, 0 -2 C 7 -2, 12 4, 9 12 Z"
                fill="#38507a"
                opacity={0.9}
              />
              {/* ống tay dài */}
              <Path
                d="M-9 16 C -20 22, -26 30, -30 40 C -26 42, -20 38, -12 30 Z"
                fill="#3d4f70"
              />
              <Path
                d="M8 16 C 16 20, 22 26, 26 32 C 26 34, 22 34, 18 30 C 14 26, 10 22, 6 20 Z"
                fill="#3d4f70"
              />
              {/* đầu + tóc búi */}
              <Circle cx={-1} cy={-12} r={9.4} fill="#f6d7c4" />
              <Path
                d="M-10 -14 C -10 -24, 8 -25, 10 -14 C 6 -18, -6 -18, -10 -14 Z"
                fill="#241f2c"
              />
              <Circle cx={-2} cy={-24} r={4.2} fill="#241f2c" />
              <Path
                d="M1 -12 C 3 -11, 3 -10, 1 -9.5"
                stroke="#b98a72"
                strokeWidth={1}
                fill="none"
              />
              <Path
                d="M-4.5 -15 A 3.4 3.4 0 0 1 -4.5 -9"
                stroke="#241f2c"
                strokeWidth={1.4}
                fill="none"
              />
            </G>
            {/* Cô dâu: tà áo hồng bay dài */}
            <G transform="translate(6 0)">
              <Path
                d="M-4 44 C -14 26, -26 18, -44 20 C -30 26, -22 32, -16 44 Z"
                fill="url(#dressPink)"
                opacity={0.95}
              />
              <Path
                d="M6 44 C 20 30, 34 26, 50 30 C 34 34, 22 38, 14 46 Z"
                fill="url(#dressPink)"
                opacity={0.92}
              />
              <Path
                d="M-8 44 C -12 24, -8 8, 2 8 C 12 8, 15 24, 11 44 Z"
                fill="url(#dressPink)"
              />
              <Path
                d="M-2 10 C -6 2, 0 -4, 3 -4 C 8 -4, 11 3, 8 10 Z"
                fill="#f4b7cd"
              />
              <Path
                d="M12 16 C 22 22, 26 30, 24 38 C 20 34, 16 28, 10 24 Z"
                fill="#f7b6ce"
              />
              {/* đầu, tóc dài, hoa cài */}
              <Circle cx={3} cy={-12} r={9.2} fill="#f8dcc9" />
              <Path
                d="M-7 -12 C -9 -24, 4 -28, 12 -20 C 6 -22, -2 -20, -7 -12 Z"
                fill="#2b2333"
              />
              <Path
                d="M-6 -12 C -10 -2, -8 6, -4 12 C -2 6, -3 -2, -2 -10 Z"
                fill="#2b2333"
              />
              <Circle cx={3} cy={-24} r={4} fill="#2b2333" />
              <Circle cx={9} cy={-21} r={2.4} fill="#ff9ec4" />
              <Path
                d="M7 -12 C 9 -11, 9 -10, 7 -9.5"
                stroke="#c08e74"
                strokeWidth={1}
                fill="none"
              />
              <Path
                d="M9.5 -15 A 3.4 3.4 0 0 1 9.5 -9"
                stroke="#2b2333"
                strokeWidth={1.4}
                fill="none"
              />
            </G>
            {/* khăn quàng đỏ nối hai người */}
            <Path
              d="M-12 8 C -6 12, 2 13, 10 10 C 4 16, -6 16, -13 12 Z"
              fill="#e2524f"
              opacity={0.9}
            />
          </G>

          {/* Vài cánh hoa bay */}
          <G opacity={0.75}>
            <Circle cx={58} cy={128} r={3} fill="#f585ab" />
            <Circle cx={W - 66} cy={140} r={2.4} fill="#f585ab" />
            <Circle cx={W - 108} cy={104} r={2} fill="#f9b3cd" />
            <Circle cx={86} cy={96} r={2.2} fill="#f9b3cd" />
          </G>
        </Svg>
      </Animated.View>
    </View>
  );
}
