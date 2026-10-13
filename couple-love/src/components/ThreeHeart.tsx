import React, { memo, useMemo, useRef, useState } from "react";
import { View, PanResponder, Text } from "react-native";
import { Canvas, useFrame } from "@react-three/fiber/native";
import * as THREE from "three";
class Boundary extends React.Component<
  { children: React.ReactNode },
  { failed: boolean }
> {
  state = { failed: false };
  static getDerivedStateFromError() {
    return { failed: true };
  }
  render() {
    return this.state.failed ? (
      <View className="h-72 items-center justify-center">
        <Text style={{ fontSize: 120 }}>♥️</Text>
        <Text className="text-love">Hai nhịp tim, một hành trình</Text>
      </View>
    ) : (
      this.props.children
    );
  }
}
function Heart({
  drag,
  reduced,
}: {
  drag: { x: number; y: number };
  reduced: boolean;
}) {
  const group = useRef<THREE.Group>(null),
    particles = useRef<THREE.Points>(null);
  const geometry = useMemo(() => {
    const shape = new THREE.Shape();
    shape.moveTo(0, -1.15);
    shape.bezierCurveTo(-0.15, -0.95, -1.3, -0.2, -1.3, 0.55);
    shape.bezierCurveTo(-1.3, 1.35, -0.35, 1.7, 0, 0.85);
    shape.bezierCurveTo(0.35, 1.7, 1.3, 1.35, 1.3, 0.55);
    shape.bezierCurveTo(1.3, -0.2, 0.15, -0.95, 0, -1.15);
    const geo = new THREE.ExtrudeGeometry(shape, {
      depth: 0.42,
      bevelEnabled: true,
      bevelSize: 0.16,
      bevelThickness: 0.16,
      bevelSegments: 6,
      steps: 1,
      curveSegments: 40,
    });
    geo.center();
    geo.computeVertexNormals();
    return geo;
  }, []);
  const sparkle = useMemo(() => {
    let seed = 4271;
    const rand = () => {
      seed = (seed * 1664525 + 1013904223) >>> 0;
      return seed / 4294967296;
    };
    const positions = new Float32Array(80 * 3);
    for (let i = 0; i < positions.length; i++)
      positions[i] = (rand() - 0.5) * 7;
    const g = new THREE.BufferGeometry();
    g.setAttribute("position", new THREE.BufferAttribute(positions, 3));
    return g;
  }, []);
  useFrame(({ clock }, delta) => {
    if (group.current) {
      const t = clock.elapsedTime;
      group.current.rotation.y =
        drag.x + (reduced ? 0 : Math.sin(t * 0.35) * 0.35);
      group.current.rotation.x = drag.y;
      group.current.position.y = reduced ? 0 : Math.sin(t * 0.8) * 0.11;
      group.current.scale.setScalar(
        reduced ? 1 : 1 + Math.sin(t * 1.5) * 0.025,
      );
    }
    if (particles.current && !reduced)
      particles.current.rotation.y += Math.min(delta, 0.05) * 0.05;
  });
  return (
    <>
      <ambientLight intensity={0.8} />
      <directionalLight position={[3, 4, 5]} intensity={3.3} color="#fff0f4" />
      <pointLight position={[-3, -1, 2]} intensity={5} color="#ff4081" />
      <pointLight position={[0, 3, -3]} intensity={4} color="#ab6cff" />
      <group ref={group}>
        <mesh geometry={geometry}>
          <meshPhysicalMaterial
            color="#ec397b"
            roughness={0.2}
            metalness={0.25}
            clearcoat={1}
            clearcoatRoughness={0.12}
            emissive="#a80743"
            emissiveIntensity={0.18}
          />
        </mesh>
        <mesh geometry={geometry} scale={1.045}>
          <meshBasicMaterial
            color="#ff6eaa"
            transparent
            opacity={0.08}
            depthWrite={false}
            side={THREE.BackSide}
          />
        </mesh>
      </group>
      <points ref={particles} geometry={sparkle}>
        <pointsMaterial
          color="#ffa6cb"
          size={0.055}
          transparent
          opacity={0.75}
          sizeAttenuation
          depthWrite={false}
        />
      </points>
    </>
  );
}
export default memo(function ThreeHeart({
  reduced = false,
}: {
  reduced?: boolean;
}) {
  const [drag, setDrag] = useState({ x: 0, y: 0 });
  const base = useRef({ x: 0, y: 0 });
  const touch = useMemo(
    () =>
      PanResponder.create({
        onStartShouldSetPanResponder: () => true,
        onMoveShouldSetPanResponder: () => true,
        onPanResponderGrant: () => {
          base.current = drag;
        },
        onPanResponderMove: (_, g) =>
          setDrag({
            x: base.current.x + g.dx * 0.008,
            y: Math.max(-0.6, Math.min(0.6, base.current.y + g.dy * 0.006)),
          }),
      }),
    [drag],
  );
  return (
    <Boundary>
      <View
        accessibilityLabel="Trái tim 3D, vuốt để xoay"
        style={{ height: 290 }}
        {...touch.panHandlers}
      >
        <Canvas
          camera={{ position: [0, 0, 5.8], fov: 42 }}
          gl={{ antialias: true, alpha: true }}
        >
          <Heart drag={drag} reduced={reduced} />
        </Canvas>
      </View>
    </Boundary>
  );
});
