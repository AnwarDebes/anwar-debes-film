import React, {useEffect, useLayoutEffect, useMemo, useRef} from 'react';
import {AbsoluteFill, useCurrentFrame, useVideoConfig} from 'remotion';
import {ThreeCanvas} from '@remotion/three';
import {useThree} from '@react-three/fiber';
import {PostFX} from '../engine/PostFX';
import * as THREE from 'three';
import {mergeGeometries} from 'three/examples/jsm/utils/BufferGeometryUtils.js';
import {RoomEnvironment} from 'three/examples/jsm/environments/RoomEnvironment.js';

type Props = {cols: number; rows: number; post: boolean; lod?: number; matcap?: boolean};

const SPACING = 0.1;

const pinGeometry = (lod: number) => {
  const radial = lod === 0 ? 10 : 6;
  const shaft = new THREE.CylinderGeometry(0.034, 0.034, 1, radial, 1, true);
  shaft.rotateX(Math.PI / 2);
  shaft.translate(0, 0, -0.5);
  // lod 1: only the visible upper hemisphere of the head
  const head =
    lod === 0
      ? new THREE.SphereGeometry(0.043, 14, 10)
      : new THREE.SphereGeometry(0.043, 8, 3, 0, Math.PI * 2, 0, Math.PI / 2);
  if (lod !== 0) head.rotateX(Math.PI / 2);
  head.scale(1, 1, 0.7);
  return mergeGeometries([shaft.toNonIndexed(), head.toNonIndexed()]);
};

// A procedural steel matcap: dark body, soft key from the top left, mint rim.
const makeMatcap = () => {
  const c = document.createElement('canvas');
  c.width = c.height = 256;
  const g = c.getContext('2d')!;
  const base = g.createRadialGradient(100, 90, 10, 128, 128, 128);
  base.addColorStop(0, '#f4f7f6');
  base.addColorStop(0.18, '#aeb6b3');
  base.addColorStop(0.55, '#3c4442');
  base.addColorStop(1, '#0d1110');
  g.fillStyle = base;
  g.fillRect(0, 0, 256, 256);
  const rim = g.createRadialGradient(170, 190, 60, 150, 170, 128);
  rim.addColorStop(0, 'rgba(116,201,174,0)');
  rim.addColorStop(0.85, 'rgba(116,201,174,0.18)');
  rim.addColorStop(1, 'rgba(116,201,174,0)');
  g.fillStyle = rim;
  g.fillRect(0, 0, 256, 256);
  const t = new THREE.CanvasTexture(c);
  t.colorSpace = THREE.SRGBColorSpace;
  return t;
};

// Scene state must exist before ThreeCanvas calls advance() (a passive effect),
// so it is created during render / layout effects, never in useEffect.
const Environment: React.FC = () => {
  const gl = useThree((s) => s.gl);
  const scene = useThree((s) => s.scene);
  const env = useMemo(() => {
    const pmrem = new THREE.PMREMGenerator(gl);
    const tex = pmrem.fromScene(new RoomEnvironment(), 0.04).texture;
    // dark studio: the env carries reflections, not fill light
    pmrem.dispose();
    return tex;
  }, [gl]);
  useLayoutEffect(() => {
    scene.environment = env;
    scene.background = new THREE.Color('#121816');
    return () => env.dispose();
  }, [env, scene]);
  useEffect(() => {
    const ctx = gl.getContext();
    const ext = ctx.getExtension('WEBGL_debug_renderer_info');
    // eslint-disable-next-line no-console
    console.log('[bench] GPU renderer:', ext ? ctx.getParameter(ext.UNMASKED_RENDERER_WEBGL) : 'unknown');
  }, [gl]);
  return null;
};

const CameraRig: React.FC = () => {
  const frame = useCurrentFrame();
  const camera = useThree((s) => s.camera);
  useLayoutEffect(() => {
    camera.position.set(Math.sin(frame / 180) * 0.8, -4.6, 4.9 - frame * 0.004);
    camera.lookAt(0, 0.2, 0);
    camera.updateProjectionMatrix();
  }, [frame, camera]);
  return null;
};

const Pins: React.FC<{cols: number; rows: number; lod: number; matcap: boolean}> = ({cols, rows, lod, matcap}) => {
  const frame = useCurrentFrame();
  const {fps} = useVideoConfig();
  const ref = useRef<THREE.InstancedMesh>(null);
  const geometry = useMemo(() => pinGeometry(lod), [lod]);
  const material = useMemo(
    () =>
      matcap
        ? new THREE.MeshMatcapMaterial({matcap: makeMatcap()})
        : new THREE.MeshStandardMaterial({color: '#b9c2bf', metalness: 1, roughness: 0.34, envMapIntensity: 0.32}),
    [matcap],
  );
  const dummy = useMemo(() => new THREE.Object3D(), []);
  const count = cols * rows;

  useLayoutEffect(() => {
    const mesh = ref.current;
    if (!mesh) return;
    const t = frame / fps;
    let i = 0;
    for (let y = 0; y < rows; y++) {
      for (let x = 0; x < cols; x++) {
        const px = (x - cols / 2) * SPACING + (y % 2) * SPACING * 0.5;
        const py = (y - rows / 2) * SPACING * 0.866;
        const r = Math.hypot(px, py);
        const h = 0.18 + 0.16 * Math.sin(r * 2.4 - t * 2.2) + 0.1 * Math.sin(px * 1.3 + t * 0.7) * Math.cos(py * 1.7);
        dummy.position.set(px, py, h);
        dummy.updateMatrix();
        mesh.setMatrixAt(i++, dummy.matrix);
      }
    }
    mesh.instanceMatrix.needsUpdate = true;
  }, [frame, fps, cols, rows, dummy]);

  return <instancedMesh ref={ref} args={[geometry, material, count]} frustumCulled={false} />;
};

export const PinBench: React.FC<Props> = ({cols, rows, post, lod = 0, matcap = false}) => {
  const {width, height} = useVideoConfig();
  const frame = useCurrentFrame();
  return (
    <AbsoluteFill style={{backgroundColor: '#121816'}}>
      <ThreeCanvas
        width={width}
        height={height}
        gl={{antialias: false, powerPreference: 'high-performance', stencil: false}}
        camera={{fov: 30, position: [0, -4.6, 4.9], near: 0.1, far: 50}}
      >
        <Environment />
        <CameraRig />
        <directionalLight position={[-3, 4, 6]} intensity={2.2} />
        <directionalLight position={[4, -2, 3]} intensity={0.6} color="#74C9AE" />
        <Pins cols={cols} rows={rows} lod={lod} matcap={matcap} />
        {post ? <PostFX width={width} height={height} focusDistance={5.2} focusRange={1.4} bokehScale={4} bloom={0.4} vignette={0.75} grain={0.05} /> : null}
      </ThreeCanvas>
      <AbsoluteFill style={{justifyContent: 'flex-end', padding: '0 0 7% 7%'}}>
        <div style={{color: '#E4EAE7', fontFamily: 'sans-serif', fontSize: height * 0.045, fontWeight: 700}}>
          Bench frame {frame}
        </div>
      </AbsoluteFill>
    </AbsoluteFill>
  );
};
