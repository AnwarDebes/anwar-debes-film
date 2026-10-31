import type React from 'react';
import {useLayoutEffect, useMemo} from 'react';
import {useThree} from '@react-three/fiber';
import * as THREE from 'three';

// A small reflection studio for steel inside fx shots (the pins in the glass box): the site's
// softbox layout (identity.md d.3) prefiltered once with PMREM, a key light from the upper left, and
// an optional rim light from behind so pins in front of the god-ray source catch its edge.

export interface FxStudioProps {
  /** Environment strength (scene.environmentIntensity). */
  env?: number;
  /** Key light intensity and direction (upper left, in front). */
  key?: number;
  keyPosition?: [number, number, number];
  /** Rim light from behind (e.g. the god-ray source): position and intensity, or null. */
  rim?: {position: [number, number, number]; intensity: number | ((t: number) => number); target?: [number, number, number]} | null;
  /** Film time for an animated rim. */
  t?: number;
}

const envCache = new WeakMap<THREE.WebGLRenderer, THREE.Texture>();

const studioEnv = (gl: THREE.WebGLRenderer): THREE.Texture => {
  const hit = envCache.get(gl);
  if (hit) return hit;
  const scene = new THREE.Scene();
  const disposables: Array<{dispose: () => void}> = [];
  const skyGeo = new THREE.SphereGeometry(50, 32, 16);
  const skyMat = new THREE.ShaderMaterial({
    side: THREE.BackSide,
    depthWrite: false,
    uniforms: {
      top: {value: new THREE.Color(0.95, 0.97, 0.96).multiplyScalar(0.16)},
      mid: {value: new THREE.Color(0.55, 0.58, 0.57).multiplyScalar(0.06)},
      bot: {value: new THREE.Color(0.3, 0.32, 0.31).multiplyScalar(0.03)},
    },
    vertexShader: 'varying vec3 vP; void main(){ vP = normalize(position); gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0); }',
    fragmentShader:
      'uniform vec3 top; uniform vec3 mid; uniform vec3 bot; varying vec3 vP; void main(){ float y = vP.y; vec3 c = y > 0.0 ? mix(mid, top, pow(y, 0.7)) : mix(mid, bot, pow(-y, 0.6)); gl_FragColor = vec4(c, 1.0); }',
  });
  scene.add(new THREE.Mesh(skyGeo, skyMat));
  disposables.push(skyGeo, skyMat);
  const box = (w: number, h: number, intensity: number, pos: [number, number, number]) => {
    const g = new THREE.PlaneGeometry(w, h);
    const m = new THREE.MeshBasicMaterial({side: THREE.DoubleSide});
    m.color.setScalar(intensity);
    const mesh = new THREE.Mesh(g, m);
    mesh.position.set(...pos);
    mesh.lookAt(0, 0, 0);
    scene.add(mesh);
    disposables.push(g, m);
  };
  box(14, 9, 2.2, [-12, 14, 18]);
  box(5, 18, 0.8, [22, 2, 10]);
  box(34, 22, 0.25, [0, -4, 30]);
  box(26, 6, 0.2, [0, -18, 14]);
  const pmrem = new THREE.PMREMGenerator(gl);
  const rt = pmrem.fromScene(scene, 0.02);
  disposables.forEach((d) => d.dispose());
  pmrem.dispose();
  envCache.set(gl, rt.texture);
  return rt.texture;
};

export const FxStudio: React.FC<FxStudioProps> = ({env = 1, key = 1.2, keyPosition = [-1.6, 2.4, 3.2], rim = null, t = 0}) => {
  const gl = useThree((s) => s.gl);
  const scene = useThree((s) => s.scene);
  const tex = useMemo(() => studioEnv(gl), [gl]);
  const lights = useMemo(() => {
    const keyL = new THREE.DirectionalLight(0xffffff, 1);
    const rimL = new THREE.DirectionalLight(0xffffff, 0);
    return {keyL, rimL};
  }, []);
  lights.keyL.intensity = key;
  lights.keyL.position.set(keyPosition[0], keyPosition[1], keyPosition[2]);
  if (rim) {
    lights.rimL.position.set(rim.position[0], rim.position[1], rim.position[2]);
    lights.rimL.target.position.set(...(rim.target ?? [0, 0, 0]));
    lights.rimL.target.updateMatrixWorld();
    lights.rimL.intensity = typeof rim.intensity === 'function' ? rim.intensity(t) : rim.intensity;
  } else {
    lights.rimL.intensity = 0;
  }
  useLayoutEffect(() => {
    const prevEnv = scene.environment;
    const prevI = scene.environmentIntensity;
    scene.environment = tex;
    scene.environmentIntensity = env;
    scene.add(lights.keyL, lights.keyL.target, lights.rimL, lights.rimL.target);
    return () => {
      scene.remove(lights.keyL, lights.keyL.target, lights.rimL, lights.rimL.target);
      scene.environment = prevEnv;
      scene.environmentIntensity = prevI;
    };
  }, [scene, tex, env, lights]);
  return null;
};
