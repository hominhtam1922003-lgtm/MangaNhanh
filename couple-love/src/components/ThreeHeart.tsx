import React, { memo, useMemo, useRef, useState } from "react";
import { useTheme } from "../theme/ThemeContext";
import { PanResponder, Text, View } from "react-native";
import { Canvas, useFrame } from "@react-three/fiber/native";
import * as THREE from "three";

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
        <View className="h-80 items-center justify-center">
          <Text style={{ fontSize: 120 }}>♥️</Text>
          <Text style={{ color: this.props.color }}>
            Hai nhịp tim, một hành trình
          </Text>
        </View>
      );
    return this.props.children;
  }
}

function useHeartGeometry() {
  return useMemo(() => {
    const shape = new THREE.Shape();
    shape.moveTo(0, -1.15);
    shape.bezierCurveTo(-0.15, -0.95, -1.3, -0.2, -1.3, 0.55);
    shape.bezierCurveTo(-1.3, 1.35, -0.35, 1.7, 0, 0.85);
    shape.bezierCurveTo(0.35, 1.7, 1.3, 1.35, 1.3, 0.55);
    shape.bezierCurveTo(1.3, -0.2, 0.15, -0.95, 0, -1.15);
    const geometry = new THREE.ExtrudeGeometry(shape, {
      depth: 0.42,
      bevelEnabled: true,
      bevelSize: 0.16,
      bevelThickness: 0.16,
      bevelSegments: 6,
      steps: 1,
      curveSegments: 40,
    });
    geometry.center();
    geometry.computeVertexNormals();
    return geometry;
  }, []);
}

/** Vũ trụ sao: các điểm sáng rải quanh trái tim, rẻ cho máy yếu (một draw call). */
function useStars(count = 130) {
  return useMemo(() => {
    let seed = 4271;
    const random = () => {
      seed = (seed * 1664525 + 1013904223) >>> 0;
      return seed / 4294967296;
    };
    const positions = new Float32Array(count * 3);
    const scales = new Float32Array(count);
    for (let index = 0; index < positions.length; index += 3) {
      const radius = 3.1 + random() * 2.2;
      const theta = random() * Math.PI * 2;
      const phi = (random() - 0.5) * Math.PI;
      positions[index] = Math.cos(theta) * Math.cos(phi) * radius;
      positions[index + 1] = Math.sin(phi) * radius * 0.7;
      positions[index + 2] = Math.sin(theta) * Math.cos(phi) * radius;
      scales[index / 3] = 0.35 + random();
    }
    const geometry = new THREE.BufferGeometry();
    geometry.setAttribute("position", new THREE.BufferAttribute(positions, 3));
    geometry.setAttribute("size", new THREE.BufferAttribute(scales, 1));
    return geometry;
  }, [count]);
}

/**
 * Ba quỹ đạo nghiêng nhau, mỗi quỹ đạo mang vài trái tim nhỏ quay quanh trái
 * tim lớn ở giữa — đúng ý "trái tim chính giữa, vũ trụ trái tim quay quanh".
 */
const ORBITS = [
  {
    radius: 2.15,
    hearts: 5,
    tilt: [0.95, 0, 0.18] as [number, number, number],
    speed: 0.5,
    size: 0.15,
    ring: 0.55,
  },
  {
    radius: 2.75,
    hearts: 7,
    tilt: [-0.65, 0.35, -0.32] as [number, number, number],
    speed: -0.34,
    size: 0.12,
    ring: 0.42,
  },
  {
    radius: 1.7,
    hearts: 4,
    tilt: [1.42, 0, 0.05] as [number, number, number],
    speed: 0.78,
    size: 0.19,
    ring: 0.6,
  },
];

function Orbit({
  config,
  geometry,
  color,
  reduced,
}: {
  config: (typeof ORBITS)[number];
  geometry: THREE.ExtrudeGeometry;
  color: string;
  reduced: boolean;
}) {
  const group = useRef<THREE.Group>(null);
  const hearts = useMemo(
    () =>
      Array.from({ length: config.hearts }, (_, index) => {
        const angle = (index / config.hearts) * Math.PI * 2;
        return {
          angle,
          key: index,
          scale:
            config.size * (index % 3 === 0 ? 1.25 : index % 3 === 1 ? 1 : 0.85),
        };
      }),
    [config.hearts, config.size],
  );
  useFrame((_, delta) => {
    if (!group.current || reduced) return;
    group.current.rotation.y += Math.min(delta, 0.05) * config.speed;
  });
  return (
    <group ref={group} rotation={config.tilt}>
      <mesh rotation={[Math.PI / 2, 0, 0]}>
        <torusGeometry args={[config.radius, 0.008, 6, 96]} />
        <meshBasicMaterial
          color={color}
          transparent
          opacity={config.ring}
          depthWrite={false}
        />
      </mesh>
      {hearts.map((item) => (
        <group
          key={item.key}
          position={[
            Math.cos(item.angle) * config.radius,
            0,
            Math.sin(item.angle) * config.radius,
          ]}
        >
          <mesh
            geometry={geometry}
            scale={item.scale}
            rotation={[0.18, -item.angle + Math.PI / 2, -0.12]}
          >
            <meshStandardMaterial
              color={item.key % 3 === 0 ? "#ffd0e4" : color}
              roughness={0.35}
              metalness={0.1}
              emissive="#8a0f3c"
              emissiveIntensity={0.18}
            />
          </mesh>
          <mesh scale={item.scale * 2.5}>
            <sphereGeometry args={[1, 16, 16]} />
            <meshBasicMaterial
              color={item.key % 2 ? "#ff86b8" : "#b57bff"}
              transparent
              opacity={0.1}
              depthWrite={false}
            />
          </mesh>
        </group>
      ))}
    </group>
  );
}

function Session({
  drag,
  reduced,
  pressed,
}: {
  drag: { x: number; y: number };
  reduced: boolean;
  pressed: boolean;
}) {
  const group = useRef<THREE.Group>(null);
  const glow = useRef<THREE.Mesh>(null);
  const stars = useRef<THREE.Points>(null);
  const shell = useRef<THREE.Mesh>(null);
  const { theme } = useTheme();
  const geometry = useHeartGeometry();
  const starGeometry = useStars();
  useFrame(({ clock }, delta) => {
    const t = clock.elapsedTime;
    const step = Math.min(delta, 0.05);
    if (group.current) {
      group.current.rotation.y =
        drag.x + (reduced ? 0 : Math.sin(t * 0.35) * 0.4);
      group.current.rotation.x = drag.y;
      group.current.rotation.z = reduced ? 0 : Math.sin(t * 0.22) * 0.06;
      group.current.position.y = reduced ? 0 : Math.sin(t * 0.8) * 0.1;
      const beat = reduced ? 1 : 1 + Math.sin(t * 1.6) * 0.03;
      group.current.scale.setScalar(pressed ? beat * 1.09 : beat);
    }
    if (shell.current && !reduced) {
      shell.current.rotation.y -= step * 0.18;
    }
    if (glow.current) {
      const pulse = reduced ? 1 : 1 + Math.sin(t * 1.6) * 0.05;
      glow.current.scale.setScalar(pulse);
    }
    if (stars.current) {
      if (!reduced) stars.current.rotation.y += step * 0.035;
      const material = stars.current.material as THREE.PointsMaterial;
      material.opacity = reduced
        ? 0.6
        : 0.5 + Math.abs(Math.sin(t * 1.1)) * 0.42;
    }
  });
  return (
    <>
      <ambientLight intensity={0.9} />
      <directionalLight position={[3, 4, 5]} intensity={3.4} color="#fff0f4" />
      <pointLight position={[-3, -1, 2]} intensity={5} color="#ff4081" />
      <pointLight position={[0, 3, -3]} intensity={4} color="#ab6cff" />
      {/* Nền vũ trụ: hai quầng sáng chồng lên nhau cho ra dáng tinh vân. */}
      <mesh position={[0, 0, -2.1]}>
        <circleGeometry args={[3.1, 64]} />
        <meshBasicMaterial
          color="#7b2bd6"
          transparent
          opacity={0.14}
          blending={THREE.AdditiveBlending}
          depthWrite={false}
        />
      </mesh>
      <mesh ref={glow} position={[0, 0, -1.9]}>
        <circleGeometry args={[2.5, 64]} />
        <meshBasicMaterial
          color="#ff86b8"
          transparent
          opacity={0.17}
          blending={THREE.AdditiveBlending}
          depthWrite={false}
        />
      </mesh>
      {/* Trái tim lớn ở chính giữa — tâm của vũ trụ trái tim. */}
      <group ref={group}>
        <mesh geometry={geometry}>
          <meshPhysicalMaterial
            color="#f22f74"
            roughness={0.16}
            metalness={0.3}
            clearcoat={1}
            clearcoatRoughness={0.08}
            reflectivity={1}
            sheen={1}
            sheenColor="#ffd0e4"
            emissive="#b4074a"
            emissiveIntensity={0.24}
          />
        </mesh>
        {/* vệt sáng bóng chạy trên mặt tim cho ra dáng 3D */}
        <mesh position={[-0.62, 0.62, 1.02]} rotation={[0.1, -0.2, 0.5]}>
          <sphereGeometry args={[0.36, 32, 32]} />
          <meshBasicMaterial
            color="#ffffff"
            transparent
            opacity={0.22}
            depthWrite={false}
          />
        </mesh>
        <mesh position={[0.5, -0.7, 1.0]} rotation={[0.2, 0.3, -0.4]}>
          <sphereGeometry args={[0.16, 24, 24]} />
          <meshBasicMaterial
            color={theme.glow}
            transparent
            opacity={0.35}
            depthWrite={false}
          />
        </mesh>
        <mesh geometry={geometry} scale={1.05}>
          <meshBasicMaterial
            color="#ff6eaa"
            transparent
            opacity={0.09}
            depthWrite={false}
            side={THREE.BackSide}
          />
        </mesh>
        <mesh ref={shell} rotation={[Math.PI / 2.4, 0, 0]}>
          <torusGeometry args={[1.95, 0.012, 8, 96]} />
          <meshBasicMaterial color="#ffb3d1" transparent opacity={0.5} />
        </mesh>
      </group>
      {/* Vũ trụ trái tim: các trái tim nhỏ quay quanh trái tim lớn. */}
      {ORBITS.map((config, index) => (
        <Orbit
          key={index}
          config={config}
          geometry={geometry}
          color={index % 2 ? theme.glow : "#ff9ec7"}
          reduced={reduced}
        />
      ))}
      <points ref={stars} geometry={starGeometry}>
        <pointsMaterial
          color="#ffd9ec"
          size={0.055}
          transparent
          opacity={0.7}
          sizeAttenuation
          depthWrite={false}
        />
      </points>
    </>
  );
}

export default memo(function ThreeHeart({
  reduced = false,
  height = 320,
}: {
  reduced?: boolean;
  height?: number;
}) {
  const [drag, setDrag] = useState({ x: 0, y: 0 });
  const [pressed, setPressed] = useState(false);
  const { theme } = useTheme();
  const base = useRef({ x: 0, y: 0 });
  const responder = useMemo(
    () =>
      PanResponder.create({
        onStartShouldSetPanResponder: () => true,
        onMoveShouldSetPanResponder: () => true,
        onPanResponderGrant: () => {
          base.current = drag;
          setPressed(true);
        },
        onPanResponderMove: (_, gesture) =>
          setDrag({
            x: base.current.x + gesture.dx * 0.008,
            y: Math.max(
              -0.6,
              Math.min(0.6, base.current.y + gesture.dy * 0.006),
            ),
          }),
        onPanResponderRelease: () => {
          setPressed(false);
          setDrag((current) => ({ x: current.x * 0.94, y: current.y * 0.94 }));
        },
        onPanResponderTerminate: () => setPressed(false),
      }),
    [drag],
  );
  return (
    <Boundary color={theme.text}>
      <View
        accessibilityLabel="Trái tim 3D ở chính giữa và vũ trụ trái tim quay quanh nó"
        style={{ height }}
        {...responder.panHandlers}
      >
        <Canvas
          camera={{ position: [0, 0, 6.1], fov: 42 }}
          // Tắt khử răng cưa và giới hạn độ phân giải: máy ảo/máy yếu không bị đơ.
          gl={{
            antialias: false,
            alpha: true,
            powerPreference: "high-performance",
          }}
        >
          <Session drag={drag} reduced={reduced} pressed={pressed} />
        </Canvas>
      </View>
    </Boundary>
  );
});
