import React, { useMemo, useRef } from "react";
import { useFrame } from "@react-three/fiber/native";
import * as THREE from "three";

/**
 * Cầu tình yêu — cảnh 3D dùng CHUNG một canvas với trái tim (không mở canvas
 * thứ hai: hai vùng WebGL cùng lúc làm máy ảo/máy yếu bị đơ, dính màn hình).
 *
 * Dựng theo tranh bạn gửi: trăng tròn sau lưng, cầu vồng nhẹ lên giữa trời,
 * đàn chim Ô Thước bay thành dòng, cô dâu áo xanh ngọc khăn đỏ và chú rể áo lam
 * chạy từ hai đầu cầu vào giữa, gặp nhau rồi cùng quay về.
 * Số lượng lưới được giữ nhỏ (cầu 1 ống cong, ván/cột dùng instanced mesh) để
 * chạy mượt trên máy yếu.
 */

const BRIDGE_CURVE = new THREE.QuadraticBezierCurve3(
  new THREE.Vector3(-3.2, -0.3, 0),
  new THREE.Vector3(0, 1.7, 0),
  new THREE.Vector3(3.2, -0.3, 0),
);

/** Điểm trên vòm cầu: t = 0 mép trái, 0.5 giữa cầu, 1 mép phải. */
export function bridgePoint(t: number) {
  const point = BRIDGE_CURVE.getPoint(Math.min(1, Math.max(0, t)));
  return { x: point.x, y: point.y };
}

/** Đàn chim Ô Thước: thân + hai cánh vỗ, bay vòng quanh cầu. */
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
  const left = useRef<THREE.Mesh>(null);
  const right = useRef<THREE.Mesh>(null);
  useFrame(({ clock }) => {
    const t = clock.elapsedTime * speed + offset;
    if (bird.current) {
      bird.current.position.set(
        Math.cos(t) * radius,
        height + Math.sin(t * 2.1 + offset) * 0.28,
        Math.sin(t) * radius * 0.5 - 0.6,
      );
      bird.current.rotation.y = -t + Math.PI / 2;
      bird.current.rotation.z = Math.cos(t * 2.1) * 0.2;
    }
    const flap = Math.sin(clock.elapsedTime * 10 + offset) * 0.7;
    if (left.current) left.current.rotation.z = 0.3 + flap;
    if (right.current) right.current.rotation.z = -0.3 - flap;
  });
  return (
    <group ref={bird} scale={size}>
      <mesh rotation={[0, 0, Math.PI / 2]}>
        <capsuleGeometry args={[0.055, 0.16, 4, 10]} />
        <meshStandardMaterial color="#2b3352" roughness={0.5} />
      </mesh>
      <mesh position={[0.16, 0.02, 0]}>
        <sphereGeometry args={[0.06, 12, 12]} />
        <meshStandardMaterial color="#1e2440" roughness={0.5} />
      </mesh>
      <mesh position={[-0.22, 0, 0]} rotation={[0, 0, -0.3]}>
        <boxGeometry args={[0.18, 0.015, 0.05]} />
        <meshStandardMaterial color="#39406a" roughness={0.5} />
      </mesh>
      <mesh ref={left} position={[0, 0.03, 0.08]} rotation={[0, 0, 0.3]}>
        <boxGeometry args={[0.24, 0.015, 0.13]} />
        <meshStandardMaterial color="#f6f7ff" roughness={0.4} />
      </mesh>
      <mesh ref={right} position={[0, 0.03, -0.08]} rotation={[0, 0, -0.3]}>
        <boxGeometry args={[0.24, 0.015, 0.13]} />
        <meshStandardMaterial color="#f6f7ff" roughness={0.4} />
      </mesh>
    </group>
  );
}

/** Cô dâu: áo dài xanh ngọc, khăn quàng đỏ, tóc búi có hoa và dải lụa bay. */
function Bride() {
  return (
    <group>
      <mesh position={[0, 0.2, 0]}>
        <cylinderGeometry args={[0.1, 0.3, 0.66, 18]} />
        <meshStandardMaterial color="#93e6dc" roughness={0.35} />
      </mesh>
      <mesh position={[0, 0.6, 0]}>
        <cylinderGeometry args={[0.1, 0.115, 0.3, 14]} />
        <meshStandardMaterial color="#fbe6ee" roughness={0.4} />
      </mesh>
      <mesh position={[0.01, 0.58, 0]} rotation={[0, 0, 0.22]}>
        <torusGeometry args={[0.125, 0.032, 8, 20]} />
        <meshStandardMaterial color="#e8534f" roughness={0.5} />
      </mesh>
      <mesh position={[0.16, 0.6, 0]} rotation={[0, 0, -0.55]}>
        <capsuleGeometry args={[0.032, 0.26, 4, 10]} />
        <meshStandardMaterial color="#ffe6da" roughness={0.5} />
      </mesh>
      <mesh position={[-0.16, 0.6, 0]} rotation={[0, 0, 0.55]}>
        <capsuleGeometry args={[0.032, 0.26, 4, 10]} />
        <meshStandardMaterial color="#ffe6da" roughness={0.5} />
      </mesh>
      <mesh position={[0, 0.9, 0]}>
        <sphereGeometry args={[0.148, 20, 20]} />
        <meshStandardMaterial color="#ffe8dd" roughness={0.45} />
      </mesh>
      <mesh position={[0, 1.0, -0.02]}>
        <sphereGeometry args={[0.14, 18, 18]} />
        <meshStandardMaterial color="#2b2333" roughness={0.55} />
      </mesh>
      <mesh position={[0, 1.12, -0.05]}>
        <sphereGeometry args={[0.065, 14, 14]} />
        <meshStandardMaterial color="#2b2333" roughness={0.55} />
      </mesh>
      <mesh position={[0.1, 1.0, 0.06]}>
        <sphereGeometry args={[0.032, 10, 10]} />
        <meshStandardMaterial color="#ff9ec4" roughness={0.4} />
      </mesh>
      {/* dải lụa dài bay sau lưng */}
      <mesh position={[-0.42, 0.62, -0.1]} rotation={[0.1, 0.3, 0.5]}>
        <torusGeometry args={[0.34, 0.022, 6, 26, Math.PI * 1.3]} />
        <meshStandardMaterial color="#7fd8cf" roughness={0.4} />
      </mesh>
    </group>
  );
}

/** Chú rể: áo lam, đai sáng, tóc búi gọn. */
function Groom() {
  return (
    <group>
      <mesh position={[0, 0.26, 0]}>
        <cylinderGeometry args={[0.13, 0.19, 0.68, 16]} />
        <meshStandardMaterial color="#5b7fc7" roughness={0.42} />
      </mesh>
      <mesh position={[0, 0.58, 0]}>
        <torusGeometry args={[0.14, 0.026, 8, 20]} />
        <meshStandardMaterial color="#eef2ff" roughness={0.5} />
      </mesh>
      <mesh position={[0.19, 0.6, 0]} rotation={[0, 0, -0.55]}>
        <capsuleGeometry args={[0.036, 0.27, 4, 10]} />
        <meshStandardMaterial color="#ffe6da" roughness={0.5} />
      </mesh>
      <mesh position={[-0.19, 0.6, 0]} rotation={[0, 0, 0.55]}>
        <capsuleGeometry args={[0.036, 0.27, 4, 10]} />
        <meshStandardMaterial color="#ffe6da" roughness={0.5} />
      </mesh>
      <mesh position={[0, 0.92, 0]}>
        <sphereGeometry args={[0.152, 20, 20]} />
        <meshStandardMaterial color="#ffe8dd" roughness={0.45} />
      </mesh>
      <mesh position={[0, 1.02, -0.01]}>
        <sphereGeometry args={[0.146, 18, 18]} />
        <meshStandardMaterial color="#241f2c" roughness={0.55} />
      </mesh>
      <mesh position={[0, 1.14, -0.04]}>
        <sphereGeometry args={[0.055, 12, 12]} />
        <meshStandardMaterial color="#241f2c" roughness={0.55} />
      </mesh>
    </group>
  );
}

/** Ván cầu + cột lan can: một instanced mesh cho mỗi loại, rất nhẹ. */
function Planks({ theme }: { theme: { deck: string; post: string } }) {
  const planks = useMemo(() => {
    const matrix = new THREE.Matrix4();
    const rotation = new THREE.Quaternion();
    const positions: THREE.Matrix4[] = [];
    for (let index = 0; index <= 22; index++) {
      const t = index / 22;
      const point = BRIDGE_CURVE.getPoint(t);
      const next = BRIDGE_CURVE.getPoint(Math.min(1, t + 0.02));
      const angle = Math.atan2(next.y - point.y, next.x - point.x);
      rotation.setFromEuler(new THREE.Euler(0, 0, angle));
      positions.push(
        matrix
          .clone()
          .compose(
            new THREE.Vector3(point.x, point.y, 0),
            rotation.clone(),
            new THREE.Vector3(1, 1, 1),
          ),
      );
    }
    return positions;
  }, []);
  const posts = useMemo(() => {
    const matrix = new THREE.Matrix4();
    const list: THREE.Matrix4[] = [];
    for (let index = 0; index <= 22; index += 3) {
      const t = index / 22;
      const point = BRIDGE_CURVE.getPoint(t);
      for (const z of [0.44, -0.44]) {
        list.push(
          matrix
            .clone()
            .compose(
              new THREE.Vector3(point.x, point.y + 0.2, z),
              new THREE.Quaternion(),
              new THREE.Vector3(1, 1, 1),
            ),
        );
      }
    }
    return list;
  }, []);
  const plankRef = useRef<THREE.InstancedMesh>(null);
  const postRef = useRef<THREE.InstancedMesh>(null);
  const plankGeometry = useMemo(
    () => new THREE.BoxGeometry(0.3, 0.05, 0.9),
    [],
  );
  const postGeometry = useMemo(
    () => new THREE.BoxGeometry(0.045, 0.4, 0.045),
    [],
  );
  React.useLayoutEffect(() => {
    planks.forEach((matrix, index) =>
      plankRef.current?.setMatrixAt(index, matrix),
    );
    posts.forEach((matrix, index) =>
      postRef.current?.setMatrixAt(index, matrix),
    );
    if (plankRef.current) plankRef.current.instanceMatrix.needsUpdate = true;
    if (postRef.current) postRef.current.instanceMatrix.needsUpdate = true;
  }, [planks, posts]);
  return (
    <group>
      <instancedMesh
        ref={plankRef}
        args={[plankGeometry, undefined, planks.length]}
      >
        <meshStandardMaterial color={theme.deck} roughness={0.34} />
      </instancedMesh>
      <instancedMesh
        ref={postRef}
        args={[postGeometry, undefined, posts.length]}
      >
        <meshStandardMaterial color={theme.post} roughness={0.4} />
      </instancedMesh>
    </group>
  );
}

/**
 * Cảnh cầu đặt trong canvas sẵn có. `position`/`scale` do nơi gọi quyết định để
 * xếp cầu ở dưới, trái tim ở trên.
 */
export function BridgeGroup({
  reduced = false,
  palette,
}: {
  reduced?: boolean;
  /** Màu lấy từ chủ đề đang dùng để cầu ăn khớp với giao diện. */
  palette: {
    deck: string;
    post: string;
    rail: string;
    moon: string;
    sky: string;
  };
}) {
  const CYCLE = 12;
  const left = useRef<THREE.Group>(null);
  const right = useRef<THREE.Group>(null);
  const hearts = useRef<THREE.Group>(null);
  const moon = useRef<THREE.Mesh>(null);
  const birds = useMemo(
    () =>
      Array.from({ length: 6 }, (_, index) => ({
        offset: (index / 6) * Math.PI * 2,
        radius: 2.1 + (index % 3) * 0.55,
        speed: 0.3 + (index % 2) * 0.1,
        height: -0.9 + (index % 4) * 0.3,
        size: 0.9 + (index % 3) * 0.2,
      })),
    [],
  );
  const heartSpots = useMemo(
    () =>
      [
        [0, 1.9, 0.2],
        [-0.36, 2.05, 0],
        [0.38, 2.1, 0.05],
      ] as [number, number, number][],
    [],
  );
  useFrame(({ clock }) => {
    const time = clock.elapsedTime;
    const phase = reduced ? 0.55 : (time % CYCLE) / CYCLE;
    const approach =
      phase < 0.4 ? phase / 0.4 : phase < 0.72 ? 1 : 1 - (phase - 0.72) / 0.28;
    const meet = phase > 0.38 && phase < 0.74 ? 1 : 0;
    const bounce = reduced ? 0 : Math.abs(Math.sin(time * 6)) * 0.05;
    for (const [ref, start, end] of [
      [left, 0.02, 0.34],
      [right, 0.98, 0.66],
    ] as [React.RefObject<THREE.Group | null>, number, number][]) {
      const t = start + (end - start) * approach;
      const point = BRIDGE_CURVE.getPoint(t);
      const ahead = BRIDGE_CURVE.getPoint(
        Math.min(1, Math.max(0, t + (end > start ? 0.02 : -0.02))),
      );
      if (ref.current) {
        ref.current.position.set(point.x, point.y + 0.02 + bounce, 0.06);
        ref.current.rotation.y =
          (end > start ? 1 : -1) *
          Math.atan2(ahead.y - point.y, ahead.x - point.x);
      }
    }
    if (hearts.current) {
      hearts.current.visible = meet === 1;
      hearts.current.children.forEach((child, index) => {
        const rise = ((time * 0.8 + index * 0.3) % 1.3) / 1.3;
        child.position.y = 1.9 + rise * 1.1;
        child.scale.setScalar(0.08 + rise * 0.07);
        child.rotation.y = time + index;
      });
    }
    if (moon.current && !reduced)
      moon.current.scale.setScalar(1 + Math.sin(time * 0.7) * 0.02);
  });
  return (
    <>
      <ambientLight intensity={0.45} />
      <pointLight position={[-2, 2.4, 2]} intensity={11} color={palette.sky} />
      <pointLight position={[2.4, -0.6, 2]} intensity={5} color="#8fd3ff" />
      {/* Trăng tròn có quầng */}
      <mesh ref={moon} position={[0, 2.5, -3.4]}>
        <circleGeometry args={[1.5, 40]} />
        <meshBasicMaterial
          color={palette.moon}
          transparent
          opacity={0.3}
          blending={THREE.AdditiveBlending}
          depthWrite={false}
        />
      </mesh>
      <mesh position={[0, 2.5, -3.6]}>
        <circleGeometry args={[1.05, 40]} />
        <meshBasicMaterial color={palette.moon} />
      </mesh>
      {/* Mặt cầu: một ống cong uốn theo vòm */}
      <mesh>
        <tubeGeometry args={[BRIDGE_CURVE, 40, 0.19, 8, false]} />
        <meshStandardMaterial color={palette.deck} roughness={0.3} />
      </mesh>
      {/* Lan can hai bên */}
      {[0.44, -0.44].map((z) => (
        <mesh key={z} position={[0, 0.34, z]}>
          <tubeGeometry args={[BRIDGE_CURVE, 40, 0.035, 6, false]} />
          <meshStandardMaterial color={palette.rail} roughness={0.35} />
        </mesh>
      ))}
      <Planks theme={palette} />
      {/* Đàn Ô Thước */}
      {birds.map((bird, index) => (
        <Magpie key={index} {...bird} />
      ))}
      <group ref={left}>
        <Bride />
      </group>
      <group ref={right}>
        <Groom />
      </group>
      <group ref={hearts}>
        {heartSpots.map((position, index) => (
          <mesh key={index} position={position}>
            <octahedronGeometry args={[1, 0]} />
            <meshBasicMaterial color="#ff6fa5" transparent opacity={0.95} />
          </mesh>
        ))}
      </group>
    </>
  );
}
