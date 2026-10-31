// The studio the devices sit in: the film's environment (identity.md d.3: gradient sky plus four
// emissive softboxes, PMREM-filtered once), a soft key spot that makes a pool of light on a
// charcoal floor, a rim light for the silhouette, and a contact shadow. Everything is created
// during render (useMemo) or in layout effects, never in passive effects, so the first frame
// ThreeCanvas captures already has it.
import React, {useLayoutEffect, useMemo} from 'react';
import {useThree} from '@react-three/fiber';
import * as THREE from 'three';
import {color} from '../tokens';

export interface StudioLevels {
  /** sky gradient multiplier: 1 = the pin wall's studio (identity.md d.3), ~0.05 = black product studio */
  sky?: number;
  key?: number;
  strip?: number;
  fill?: number;
  bounce?: number;
  /** a large overhead softbox (not in the wall's studio) */
  top?: number;
  /** a low, wide softbox behind the subject (not in the wall's studio): the sheen on decks and keys */
  back?: number;
}

/** The pin wall's studio levels (identity.md d.3). */
export const FILM_STUDIO: Required<StudioLevels> = {sky: 1, key: 6, strip: 2.4, fill: 1.6, bounce: 1.4, top: 0, back: 0};
/**
 * The same softbox layout in a black room: devices keep the wall's highlight shapes, but glass and
 * graphite reflect darkness everywhere else (the classic product look; a bright sky washes a dark
 * UI out to grey).
 */
export const PRODUCT_STUDIO: Required<StudioLevels> = {sky: 0.05, key: 6, strip: 2.4, fill: 0.2, bounce: 0.1, top: 1.1, back: 1.3};

/** The film's studio, as a scene for PMREMGenerator.fromScene. */
export function createStudioScene(levels: StudioLevels = FILM_STUDIO): THREE.Scene {
  const lv = {...FILM_STUDIO, ...levels};
  const scene = new THREE.Scene();
  const sky = new THREE.Mesh(
    new THREE.SphereGeometry(50, 48, 24),
    new THREE.ShaderMaterial({
      side: THREE.BackSide,
      depthWrite: false,
      vertexShader: 'varying vec3 vDir; void main() { vDir = normalize(position); gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0); }',
      uniforms: {uSky: {value: lv.sky}},
      fragmentShader: `varying vec3 vDir;
        uniform float uSky;
        void main() {
          vec3 top = vec3(0.95, 0.97, 0.96), mid = vec3(0.55, 0.58, 0.57), bot = vec3(0.30, 0.32, 0.31);
          float y = vDir.y;
          vec3 c = y > 0.0 ? mix(mid, top, pow(y, 0.7)) : mix(mid, bot, pow(-y, 0.6));
          gl_FragColor = vec4(c * uSky, 1.0);
        }`,
    }),
  );
  scene.add(sky);
  const panel = (w: number, h: number, intensity: number, x: number, y: number, z: number) => {
    const m = new THREE.Mesh(new THREE.PlaneGeometry(w, h), new THREE.MeshBasicMaterial({color: new THREE.Color(intensity, intensity, intensity), side: THREE.DoubleSide}));
    m.position.set(x, y, z);
    m.lookAt(0, 0, 0);
    scene.add(m);
  };
  panel(14, 9, lv.key, -12, 14, 18); // key softbox
  panel(5, 18, lv.strip, 22, 2, 10); // strip
  panel(34, 22, lv.fill, 0, -4, 30); // fill card
  panel(26, 6, lv.bounce, 0, -18, 14); // floor bounce
  if (lv.top > 0) panel(18, 12, lv.top, 0, 20, -5); // overhead
  if (lv.back > 0) panel(30, 9, lv.back, 0, 7, -26); // low behind
  return scene;
}

/** Installs the studio environment on the scene (reflections only; the lights do the lighting). */
export const StudioEnvironment: React.FC<{intensity?: number; background?: THREE.ColorRepresentation | null; levels?: StudioLevels}> = ({
  intensity = 1,
  background = color.wall.deep,
  levels = PRODUCT_STUDIO,
}) => {
  const gl = useThree((s) => s.gl);
  const scene = useThree((s) => s.scene);
  const {sky, key, strip, fill, bounce, top, back} = {...PRODUCT_STUDIO, ...levels};
  const env = useMemo(() => {
    const pmrem = new THREE.PMREMGenerator(gl);
    const studio = createStudioScene({sky, key, strip, fill, bounce, top, back});
    const tex = pmrem.fromScene(studio, 0.02).texture;
    pmrem.dispose();
    studio.traverse((o) => {
      const m = o as THREE.Mesh;
      if (m.isMesh) {
        m.geometry.dispose();
        (m.material as THREE.Material).dispose();
      }
    });
    return tex;
  }, [gl, sky, key, strip, fill, bounce, top, back]);
  const bg = useMemo(() => (background === null ? null : new THREE.Color(background)), [background]);
  useLayoutEffect(() => {
    scene.environment = env;
    scene.environmentIntensity = intensity;
    scene.background = bg;
  }, [scene, env, intensity, bg]);
  useLayoutEffect(() => () => env.dispose(), [env]);
  return null;
};

/**
 * Ambient occlusion right under a footprint (width x depth, world units): darkest just inside the
 * footprint, gone `spread` beyond its edge. Drawn once on a canvas covering footprint + 2 * margin.
 */
function contactShadowTexture(width: number, depth: number, margin: number, spread: number): THREE.CanvasTexture {
  const pxPerUnit = 96;
  const w = Math.round((width + 2 * margin) * pxPerUnit);
  const h = Math.round((depth + 2 * margin) * pxPerUnit);
  const c = document.createElement('canvas');
  c.width = w;
  c.height = h;
  const g = c.getContext('2d')!;
  const img = g.createImageData(w, h);
  const inset = 0.06;
  const hw = (width / 2 - inset) * pxPerUnit;
  const hd = (depth / 2 - inset) * pxPerUnit;
  const r = Math.min(hw, hd) * 0.08;
  const s = spread * pxPerUnit;
  for (let y = 0; y < h; y++) {
    for (let x = 0; x < w; x++) {
      const px = Math.abs(x + 0.5 - w / 2) - (hw - r);
      const py = Math.abs(y + 0.5 - h / 2) - (hd - r);
      const d = Math.hypot(Math.max(px, 0), Math.max(py, 0)) + Math.min(Math.max(px, py), 0) - r;
      const t = Math.max(0, d) / s;
      const a = d <= 0 ? 1 : Math.exp(-t * t * 3.0);
      const i = (y * w + x) * 4;
      img.data[i] = img.data[i + 1] = img.data[i + 2] = 255;
      img.data[i + 3] = Math.round(255 * a);
    }
  }
  g.putImageData(img, 0, 0);
  const t = new THREE.CanvasTexture(c);
  t.colorSpace = THREE.NoColorSpace;
  return t;
}

export interface DeviceStudioProps {
  /** environment reflection strength */
  envIntensity?: number;
  /** softbox / sky levels of the environment (default: PRODUCT_STUDIO) */
  levels?: StudioLevels;
  hemiIntensity?: number;
  /** key spot: intensity, position and where it points */
  keyIntensity?: number;
  keyPosition?: [number, number, number];
  keyTarget?: [number, number, number];
  rimIntensity?: number;
  rimPosition?: [number, number, number];
  /** charcoal floor at y = 0 (null for no floor) */
  floor?: {color?: THREE.ColorRepresentation; fadeNear?: number; fadeFar?: number} | null;
  /** ambient occlusion under a footprint (width x depth at the origin, world units) */
  contactShadow?: {width: number; depth: number; opacity?: number; spread?: number} | null;
  background?: THREE.ColorRepresentation | null;
  shadowMapSize?: number;
}

export const DeviceStudio: React.FC<DeviceStudioProps> = ({
  envIntensity = 1,
  levels = PRODUCT_STUDIO,
  hemiIntensity = 0.2,
  keyIntensity = 4,
  keyPosition = [0.8, 11, 2.6],
  keyTarget = [0, 0, -0.25],
  rimIntensity = 2.2,
  rimPosition = [5, 4.5, -7],
  floor = {},
  contactShadow = null,
  background = color.wall.deep,
  shadowMapSize = 2048,
}) => {
  const key = useMemo(() => {
    // an overhead soft key: a pool of light on the floor and a soft shadow right under the device;
    // its reflection can never reach a camera looking at a screen from the front
    const l = new THREE.SpotLight('#ffffff', 1, 0, 0.44, 1, 0);
    l.castShadow = true;
    l.shadow.mapSize.set(shadowMapSize, shadowMapSize);
    l.shadow.camera.near = 5;
    l.shadow.camera.far = 20;
    l.shadow.bias = -0.0005;
    l.shadow.normalBias = 0.02;
    // VSM (shadows="variance" on the canvas): radius and samples set the penumbra
    l.shadow.radius = 14;
    l.shadow.blurSamples = 20;
    return l;
  }, [shadowMapSize]);
  const rim = useMemo(() => new THREE.DirectionalLight('#eef3f1', 1), []);
  const hemi = useMemo(() => new THREE.HemisphereLight('#F3F6F5', '#2A302E', 1), []);

  const floorMat = useMemo(() => {
    if (!floor) return null;
    const base = new THREE.Color(floor.color ?? '#171a1a');
    const bgc = new THREE.Color(background ?? color.wall.deep);
    const m = new THREE.MeshStandardMaterial({color: base, roughness: 0.78, metalness: 0});
    const near = floor.fadeNear ?? 6;
    const far = floor.fadeFar ?? 16;
    // fade the floor into the background with distance from the origin, so there is no horizon
    m.onBeforeCompile = (shader) => {
      shader.uniforms.uFadeBg = {value: bgc};
      shader.uniforms.uFadeNear = {value: near};
      shader.uniforms.uFadeFar = {value: far};
      shader.vertexShader = shader.vertexShader
        .replace('#include <common>', '#include <common>\nvarying vec3 vFloorWorld;')
        .replace('#include <worldpos_vertex>', '#include <worldpos_vertex>\nvFloorWorld = (modelMatrix * vec4(transformed, 1.0)).xyz;');
      shader.fragmentShader = shader.fragmentShader
        .replace('#include <common>', '#include <common>\nvarying vec3 vFloorWorld;\nuniform vec3 uFadeBg;\nuniform float uFadeNear;\nuniform float uFadeFar;')
        .replace(
          '#include <opaque_fragment>',
          // alpha 0: the floor never feeds PostFX's bloom
          '#include <opaque_fragment>\nfloat fadeK = smoothstep(uFadeNear, uFadeFar, length(vFloorWorld.xz));\ngl_FragColor.rgb = mix(gl_FragColor.rgb, uFadeBg, fadeK);\ngl_FragColor.a = 0.0;',
        );
    };
    m.customProgramCacheKey = () => 'device-floor-v2';
    return m;
  }, [floor, background]);
  const floorGeo = useMemo(() => new THREE.PlaneGeometry(80, 80).rotateX(-Math.PI / 2), []);

  const shadow = useMemo(() => {
    if (!contactShadow) return null;
    const spread = contactShadow.spread ?? 0.2;
    const margin = spread * 1.6;
    const tex = contactShadowTexture(contactShadow.width, contactShadow.depth, margin, spread);
    const mat = new THREE.MeshBasicMaterial({color: '#000000', alphaMap: tex, transparent: true, opacity: contactShadow.opacity ?? 0.62, depthWrite: false});
    const geo = new THREE.PlaneGeometry(contactShadow.width + 2 * margin, contactShadow.depth + 2 * margin).rotateX(-Math.PI / 2);
    return {mat, geo, tex};
  }, [contactShadow]);

  useLayoutEffect(() => {
    key.intensity = keyIntensity;
    key.position.set(...keyPosition);
    key.target.position.set(...keyTarget);
    key.target.updateMatrixWorld();
    rim.intensity = rimIntensity;
    rim.position.set(...rimPosition);
    hemi.intensity = hemiIntensity;
  }, [key, rim, hemi, keyIntensity, keyPosition, keyTarget, rimIntensity, rimPosition, hemiIntensity]);

  useLayoutEffect(
    () => () => {
      floorMat?.dispose();
      floorGeo.dispose();
      shadow?.mat.dispose();
      shadow?.geo.dispose();
      shadow?.tex.dispose();
    },
    [floorMat, floorGeo, shadow],
  );

  return (
    <>
      <StudioEnvironment intensity={envIntensity} background={background} levels={levels} />
      <primitive object={key} />
      <primitive object={key.target} />
      <primitive object={rim} />
      <primitive object={hemi} />
      {floorMat ? <mesh geometry={floorGeo} material={floorMat} receiveShadow /> : null}
      {shadow ? <mesh geometry={shadow.geo} material={shadow.mat} position={[0, 0.002, 0]} renderOrder={1} /> : null}
    </>
  );
};
