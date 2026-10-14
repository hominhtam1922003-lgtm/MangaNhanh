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

function useSparkles() {
  return useMemo(() => {
    let seed = 4271;
    const random = () => {
      seed = (seed * 1664525 + 1013904223) >>> 0;
      return seed / 4294967296;
    };
    const positions = new Float32Array(70 * 3);
    const scales = new Float32Array(70);
    for (let index = 0; index < positions.length; index += 3) {
      positions[index] = (random() - 0.5) * 7.5;
      positions[index + 1] = (random() - 0.5) * 5.5;
      positions[index + 2] = (random() - 0.5) * 3.5;
      scales[index / 3] = 0.4 + random();
    }
    const geometry = new THREE.BufferGeometry();
    geometry.setAttribute("position", new THREE.BufferAttribute(positions, 3));
    geometry.setAttribute("size", new THREE.BufferAttribute(scales, 1));
    return geometry;
  }, []);
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
  const sparkles = useRef<THREE.Points>(null);
  const shell = useRef<THREE.Mesh>(null);
  const orbit = useRef<THREE.Group>(null);
  const { theme } = useTheme();
  const geometry = useHeartGeometry();
  const sparkleGeometry = useSparkles();
  const satellites = useMemo(() => [0, 2.1, 4.2], []);
  useFrame(({ clock }, delta) => {
    const t = clock.elapsedTime;
    const step = Math.min(delta, 0.05);
    if (group.current) {
      group.current.rotation.y =
        drag.x + (reduced ? 0 : Math.sin(t * 0.35) * 0.4);
      group.current.rotation.x = drag.y;
      group.current.rotation.z = reduced ? 0 : Math.sin(t * 0.22) * 0.06;
      group.current.position.y = reduced ? 0 : Math.sin(t * 0.8) * 0.12;
      const beat = reduced ? 1 : 1 + Math.sin(t * 1.6) * 0.03;
      group.current.scale.setScalar(pressed ? beat * 1.09 : beat);
    }
    if (shell.current && !reduced) {
      shell.current.rotation.y -= step * 0.18;
    }
    if (orbit.current && !reduced) {
      // Vòng tim nhỏ quay quanh trái tim lớn.
      orbit.current.rotation.y += step * 0.32;
      orbit.current.rotation.z = Math.sin(t * 0.3) * 0.12;
    }
    if (glow.current) {
      const pulse = reduced ? 1 : 1 + Math.sin(t * 1.6) * 0.05;
      glow.current.scale.setScalar(pulse);
    }
    if (sparkles.current) {
      if (!reduced) sparkles.current.rotation.y += step * 0.06;
      const material = sparkles.current.material as THREE.PointsMaterial;
      material.opacity = reduced
        ? 0.65
        : 0.55 + Math.abs(Math.sin(t * 1.1)) * 0.4;
    }
  });
  return (
    <>
      <ambientLight intensity={0.85} />
      <directionalLight position={[3, 4, 5]} intensity={3.4} color="#fff0f4" />
      <pointLight position={[-3, -1, 2]} intensity={5} color="#ff4081" />
      <pointLight position={[0, 3, -3]} intensity={4} color="#ab6cff" />
      <mesh ref={glow} position={[0, 0, -1.6]}>
        <circleGeometry args={[2.5, 64]} />
        <meshBasicMaterial
          color="#ff86b8"
          transparent
          opacity={0.16}
          blending={THREE.AdditiveBlending}
          depthWrite={false}
        />
      </mesh>
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
            emissiveIntensity={0.22}
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
          <meshBasicMaterial color="#ffb3d1" transparent opacity={0.55} />
        </mesh>
        <group ref={orbit}>
          {satellites.map((offset, index) => (
            <mesh
              key={index}
              geometry={geometry}
              position={[
                Math.cos(offset) * 2.1,
                Math.sin(offset * 1.3) * 1.1,
                Math.sin(offset) * 0.6,
              ]}
              scale={0.16}
              rotation={[0.2, offset, -0.1]}
            >
              <meshStandardMaterial
                color={index % 2 ? "#ffd0e4" : theme.glow}
                roughness={0.28}
              />
            </mesh>
          ))}
        </group>
      </group>
      <points ref={sparkles} geometry={sparkleGeometry}>
        <pointsMaterial
          color="#ffa6cb"
          size={0.06}
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
        accessibilityLabel="Trái tim 3D và cầu tình yêu có cô dâu chú rể chạy vào giữa cầu"
        style={{ height }}
        {...responder.panHandlers}
      >
        <Canvas
          camera={{ position: [0, 0, 5.6], fov: 42 }}
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
