import React, { memo, useMemo, useRef } from "react";
import { Text, View } from "react-native";
import { Canvas, useFrame } from "@react-three/fiber/native";
import * as THREE from "three";

/**
 * Cầu tình yêu 3D — dựng theo đúng bức ảnh bạn gửi (cầu Ô Thước):
 * trăng tròn sáng sau lưng, đàn chim Ô Thước bay thành dòng, cầu vồng lên giữa
 * trời và hai nhân vật chibi (cô dâu áo xanh ngọc – chú rể áo lam) chạy từ hai
 * đầu cầu vào giữa, gặp nhau rồi cùng đứng dưới trăng.
 * Toàn bộ bằng Three.js (đã có sẵn trong app), không cần ảnh ngoài.
 */

class Boundary extends React.Component<
  { children: React.ReactNode; color: string },
  { failed: boolean }
> {
  state = { failed: false };
  static getDerivedStateFromError() {
    return { failed: true };
  }
  render() {
    if (this.state.failed)
      return (
        <View className="items-center justify-center" style={{ height: 190 }}>
          <Text style={{ fontSize: 64 }}>🌉</Text>
          <Text style={{ color: this.props.color }} className="text-xs mt-1">
            Cầu tình yêu 3D cần máy hỗ trợ đồ hoạ
          </Text>
        </View>
      );
    return this.props.children;
  }
}

/** Vị trí trên vòm cầu: t = 0 mép trái, 0.5 giữa cầu, 1 mép phải. */
function archPoint(t: number) {
  const x = (t - 0.5) * 6.4;
  const y = 1.9 * Math.sin(Math.PI * t) - 0.35;
  return { x, y };
}

/** Một chú chim Ô Thước: thân, đầu, đuôi và hai cánh vỗ. */
function Magpie({
  offset,
  radius,
  speed,
  height,
  size = 1,
}: {
  offset: number;
  radius: number;
  speed: number;
  height: number;
  size?: number;
}) {
  const bird = useRef<THREE.Group>(null);
  const leftWing = useRef<THREE.Mesh>(null);
  const rightWing = useRef<THREE.Mesh>(null);
  useFrame(({ clock }) => {
    const t = clock.elapsedTime * speed + offset;
    if (bird.current) {
      bird.current.position.set(
        Math.cos(t) * radius,
        height + Math.sin(t * 2.1 + offset) * 0.35,
        Math.sin(t) * radius * 0.55 - 0.4,
      );
      bird.current.rotation.y = -t + Math.PI / 2;
      bird.current.rotation.z = Math.cos(t * 2.1) * 0.22;
    }
    const flap = Math.sin(clock.elapsedTime * 11 + offset) * 0.75;
    if (leftWing.current) leftWing.current.rotation.z = 0.35 + flap;
    if (rightWing.current) rightWing.current.rotation.z = -0.35 - flap;
  });
  return (
    <group ref={bird} scale={size}>
      <mesh>
        <sphereGeometry args={[0.11, 18, 18]} />
        <meshStandardMaterial color="#2c3350" roughness={0.45} />
      </mesh>
      <mesh position={[0.15, 0.03, 0]}>
        <sphereGeometry args={[0.07, 16, 16]} />
        <meshStandardMaterial color="#1f2540" roughness={0.5} />
      </mesh>
      <mesh position={[-0.2, 0.01, 0]} rotation={[0, 0, -0.35]}>
        <boxGeometry args={[0.2, 0.02, 0.06]} />
        <meshStandardMaterial color="#39406a" roughness={0.5} />
      </mesh>
      <mesh ref={leftWing} position={[0, 0.05, 0.1]} rotation={[0, 0, 0.35]}>
        <boxGeometry args={[0.26, 0.02, 0.14]} />
        <meshStandardMaterial color="#f4f6ff" roughness={0.4} />
      </mesh>
      <mesh ref={rightWing} position={[0, 0.05, -0.1]} rotation={[0, 0, -0.35]}>
        <boxGeometry args={[0.26, 0.02, 0.14]} />
        <meshStandardMaterial color="#f4f6ff" roughness={0.4} />
      </mesh>
    </group>
  );
}

/** Cô dâu: áo dài xanh ngọc, khăn quàng đỏ, tóc búi cao. */
function Bride({ flip = false }: { flip?: boolean }) {
  return (
    <group scale={flip ? [-1, 1, 1] : [1, 1, 1]}>
      {/* váy */}
      <mesh position={[0, 0.22, 0]}>
        <cylinderGeometry args={[0.11, 0.3, 0.62, 20]} />
        <meshPhysicalMaterial
          color="#8fe3d8"
          roughness={0.35}
          sheen={0.6}
          sheenColor="#ffffff"
        />
      </mesh>
      {/* thân trên */}
      <mesh position={[0, 0.62, 0]}>
        <cylinderGeometry args={[0.11, 0.12, 0.3, 16]} />
        <meshPhysicalMaterial color="#f7e0e8" roughness={0.4} />
      </mesh>
      {/* khăn quàng đỏ */}
      <mesh position={[0.02, 0.6, 0]} rotation={[0, 0, 0.25]}>
        <torusGeometry args={[0.13, 0.035, 10, 22]} />
        <meshStandardMaterial color="#e8534f" roughness={0.5} />
      </mesh>
      {/* tay */}
      <mesh position={[0.15, 0.6, 0]} rotation={[0, 0, -0.5]}>
        <capsuleGeometry args={[0.035, 0.28, 6, 12]} />
        <meshPhysicalMaterial color="#ffe2d8" roughness={0.5} />
      </mesh>
      <mesh position={[-0.15, 0.6, 0]} rotation={[0, 0, 0.5]}>
        <capsuleGeometry args={[0.035, 0.28, 6, 12]} />
        <meshPhysicalMaterial color="#ffe2d8" roughness={0.5} />
      </mesh>
      {/* đầu */}
      <mesh position={[0, 0.9, 0]}>
        <sphereGeometry args={[0.15, 24, 24]} />
        <meshPhysicalMaterial color="#ffe8dd" roughness={0.45} />
      </mesh>
      {/* tóc búi */}
      <mesh position={[0, 1.0, -0.02]}>
        <sphereGeometry args={[0.14, 20, 20]} />
        <meshStandardMaterial color="#2b2333" roughness={0.55} />
      </mesh>
      <mesh position={[0, 1.12, -0.05]}>
        <sphereGeometry args={[0.07, 16, 16]} />
        <meshStandardMaterial color="#2b2333" roughness={0.55} />
      </mesh>
      {/* hoa cài */}
      <mesh position={[0.1, 1.0, 0.06]}>
        <sphereGeometry args={[0.035, 12, 12]} />
        <meshStandardMaterial color="#ff9ec4" roughness={0.4} />
      </mesh>
    </group>
  );
}

/** Chú rể: áo lam, tóc búi gọn. */
function Groom() {
  return (
    <group>
      <mesh position={[0, 0.3, 0]}>
        <cylinderGeometry args={[0.14, 0.19, 0.66, 18]} />
        <meshPhysicalMaterial color="#5b7fc7" roughness={0.42} />
      </mesh>
      <mesh position={[0, 0.62, 0]}>
        <torusGeometry args={[0.15, 0.028, 10, 22]} />
        <meshStandardMaterial color="#e9eefc" roughness={0.5} />
      </mesh>
      <mesh position={[0.19, 0.62, 0]} rotation={[0, 0, -0.5]}>
        <capsuleGeometry args={[0.04, 0.3, 6, 12]} />
        <meshPhysicalMaterial color="#ffe2d8" roughness={0.5} />
      </mesh>
      <mesh position={[-0.19, 0.62, 0]} rotation={[0, 0, 0.5]}>
        <capsuleGeometry args={[0.04, 0.3, 6, 12]} />
        <meshPhysicalMaterial color="#ffe2d8" roughness={0.5} />
      </mesh>
      <mesh position={[0, 0.94, 0]}>
        <sphereGeometry args={[0.155, 24, 24]} />
        <meshPhysicalMaterial color="#ffe8dd" roughness={0.45} />
      </mesh>
      <mesh position={[0, 1.04, -0.01]}>
        <sphereGeometry args={[0.15, 20, 20]} />
        <meshStandardMaterial color="#241f2c" roughness={0.55} />
      </mesh>
      <mesh position={[0, 1.16, -0.04]}>
        <sphereGeometry args={[0.06, 14, 14]} />
        <meshStandardMaterial color="#241f2c" roughness={0.55} />
      </mesh>
    </group>
  );
}

function Scene({ reduced }: { reduced: boolean }) {
  const CYCLE = 13;
  const left = useRef<THREE.Group>(null);
  const right = useRef<THREE.Group>(null);
  const hearts = useRef<THREE.Group>(null);
  const moonHalo = useRef<THREE.Mesh>(null);

  // Ván cầu + cột lan can dựng sẵn một lần.
  const planks = useMemo(
    () =>
      Array.from({ length: 26 }, (_, index) => {
        const t = index / 25;
        const point = archPoint(t);
        const next = archPoint(Math.min(1, t + 0.02));
        const angle = Math.atan2(next.y - point.y, next.x - point.x);
        return { t, ...point, angle };
      }),
    [],
  );
  const stars = useMemo(() => {
    let seed = 9137;
    const random = () => {
      seed = (seed * 1664525 + 1013904223) >>> 0;
      return seed / 4294967296;
    };
    const positions = new Float32Array(160 * 3);
    for (let index = 0; index < positions.length; index += 3) {
      positions[index] = (random() - 0.5) * 11;
      positions[index + 1] = 0.6 + random() * 4.2;
      positions[index + 2] = -2.6 - random() * 2.4;
    }
    const geometry = new THREE.BufferGeometry();
    geometry.setAttribute("position", new THREE.BufferAttribute(positions, 3));
    return geometry;
  }, []);
  const birds = useMemo(
    () =>
      Array.from({ length: 16 }, (_, index) => ({
        offset: (index / 16) * Math.PI * 2,
        radius: 1.7 + (index % 4) * 0.45,
        speed: 0.32 + (index % 3) * 0.08,
        height: -0.5 + (index % 5) * 0.22,
        size: 0.85 + (index % 3) * 0.18,
      })),
    [],
  );
  const heartSpots = useMemo(
    () => [
      [0, 0, 0.1],
      [-0.34, 0.16, -0.05],
      [0.36, 0.22, -0.02],
    ],
    [],
  );

  useFrame(({ clock }) => {
    const time = clock.elapsedTime;
    const phase = reduced ? 0.5 : (time % CYCLE) / CYCLE;
    // 0 → 0.42: đi vào giữa cầu · 0.42 → 0.72: gặp nhau ·
    // 0.72 → 1: quay về hai đầu rồi lặp lại.
    const approach =
      phase < 0.42
        ? phase / 0.42
        : phase < 0.72
          ? 1
          : 1 - (phase - 0.72) / 0.28;
    const meet = phase > 0.4 && phase < 0.74 ? 1 : 0;
    const bounce = reduced ? 0 : Math.abs(Math.sin(time * 6.5)) * 0.05;

    for (const [ref, start, end] of [
      [left, 0.03, 0.34],
      [right, 0.97, 0.66],
    ] as [React.RefObject<THREE.Group | null>, number, number][]) {
      const t = start + (end - start) * approach;
      const point = archPoint(t);
      const next = archPoint(
        Math.min(1, Math.max(0, t + (end > start ? 0.02 : -0.02))),
      );
      if (ref.current) {
        ref.current.position.set(point.x, point.y + 0.02 + bounce, 0.05);
        ref.current.rotation.y =
          (end > start ? 1 : -1) *
          Math.atan2(next.y - point.y, next.x - point.x);
      }
    }
    if (hearts.current) {
      hearts.current.visible = meet === 1;
      hearts.current.children.forEach((child, index) => {
        const rise = ((time * 0.9 + index * 0.33) % 1.2) / 1.2;
        child.position.y = 1.5 + rise * 1.1;
        child.scale.setScalar(0.12 + rise * 0.1);
        (child as THREE.Mesh).rotation.y = time + index;
      });
    }
    if (moonHalo.current && !reduced)
      moonHalo.current.scale.setScalar(1 + Math.sin(time * 0.8) * 0.03);
  });

  return (
    <>
      <color attach="background" args={["#241b3d"]} />
      <fog attach="fog" args={["#2a2049", 7, 16]} />
      <ambientLight intensity={0.75} />
      <directionalLight position={[2, 4, 3]} intensity={1.6} color="#fff3fa" />
      <pointLight position={[-3, 2, 2]} intensity={9} color="#ffd9ec" />
      <pointLight position={[3, -1, 2]} intensity={5} color="#8fd3ff" />
      {/* Trăng tròn */}
      <mesh ref={moonHalo} position={[0, 2.5, -4.2]}>
        <circleGeometry args={[2.1, 64]} />
        <meshBasicMaterial
          color="#ffe9f4"
          transparent
          opacity={0.28}
          blending={THREE.AdditiveBlending}
          depthWrite={false}
        />
      </mesh>
      <mesh position={[0, 2.5, -4.4]}>
        <sphereGeometry args={[1.5, 48, 48]} />
        <meshBasicMaterial color="#fdf3e6" />
      </mesh>
      <points geometry={stars}>
        <pointsMaterial
          color="#ffe6f3"
          size={0.07}
          transparent
          opacity={0.85}
          sizeAttenuation
          depthWrite={false}
        />
      </points>
      {/* Đàn Ô Thước */}
      {birds.map((bird, index) => (
        <Magpie key={index} {...bird} />
      ))}
      {/* Cầu */}
      <group>
        {planks.map(({ t, x, y, angle }) => (
          <mesh key={t} position={[x, y, 0]} rotation={[0, 0, angle]}>
            <boxGeometry args={[0.34, 0.07, 0.86]} />
            <meshPhysicalMaterial
              color={Math.round(t * 25) % 2 === 0 ? "#fdf2f6" : "#f6dfe9"}
              roughness={0.35}
              clearcoat={0.6}
            />
          </mesh>
        ))}
        {/* dầm vòm dưới */}
        {planks
          .filter((_, index) => index % 4 === 0)
          .map(({ t, x, y }) => (
            <mesh key={`rib-${t}`} position={[x, y - 0.16, 0]}>
              <boxGeometry args={[0.14, 0.28, 0.7]} />
              <meshPhysicalMaterial color="#e9c9d8" roughness={0.4} />
            </mesh>
          ))}
        {/* lan can hai bên */}
        {[0.42, -0.42].map((z) => (
          <group key={z}>
            {planks.map(({ t, x, y, angle }) => (
              <mesh
                key={`rail-${z}-${t}`}
                position={[x, y + 0.28, z]}
                rotation={[0, 0, angle]}
              >
                <boxGeometry args={[0.36, 0.035, 0.05]} />
                <meshPhysicalMaterial color="#fff4f9" roughness={0.3} />
              </mesh>
            ))}
            {planks
              .filter((_, index) => index % 3 === 0)
              .map(({ t, x, y }) => (
                <mesh key={`post-${z}-${t}`} position={[x, y + 0.16, z]}>
                  <boxGeometry args={[0.04, 0.3, 0.04]} />
                  <meshPhysicalMaterial color="#f3d6e3" roughness={0.35} />
                </mesh>
              ))}
          </group>
        ))}
      </group>
      {/* Hai nhân vật chibi */}
      <group ref={left}>
        <Bride />
      </group>
      <group ref={right}>
        <Groom />
      </group>
      {/* Trái tim khi gặp nhau */}
      <group ref={hearts}>
        {heartSpots.map((position, index) => (
          <mesh key={index} position={position as [number, number, number]}>
            <octahedronGeometry args={[1, 0]} />
            <meshBasicMaterial color="#ff6fa5" transparent opacity={0.95} />
          </mesh>
        ))}
      </group>
    </>
  );
}

export default memo(function LoveBridge({
  height = 210,
  reduced = false,
  overlay = true,
}: {
  height?: number;
  reduced?: boolean;
  /** Đặt trên nền sáng (trang chủ) thì bo góc cho khớp giao diện. */
  overlay?: boolean;
}) {
  return (
    <Boundary color="#7b6a86">
      <View
        accessibilityLabel="Cầu tình yêu 3D: cô dâu và chú rể chibi chạy vào giữa cầu dưới trăng"
        style={{
          height,
          borderRadius: overlay ? 26 : 22,
          overflow: "hidden",
          backgroundColor: "#241b3d",
        }}
      >
        <Canvas
          camera={{ position: [0, 0.9, 6.6], fov: 44 }}
          gl={{ antialias: true, alpha: false }}
        >
          <Scene reduced={reduced} />
        </Canvas>
      </View>
    </Boundary>
  );
});
