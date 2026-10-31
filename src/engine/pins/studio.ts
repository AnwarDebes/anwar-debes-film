import * as THREE from 'three';

// The site's photo studio for reflections (pins.js studioScene): a gradient sweep, two soft boxes,
// a fill card and a floor bounce, prefiltered once with PMREM.
//
// 'site' is the exact port. 'dark' keeps the same softbox layout in a dark room: domes keep
// the upper-left softbox highlight but their bodies fall to charcoal, which is the reel's wall
// (pool centre about #505252, highlights about #DEE0E0, gaps about #161817).

export type StudioVariant = 'site' | 'dark';

interface StudioLevels {
  top: number;
  mid: number;
  bot: number;
  key: number;
  strip: number;
  fill: number;
  floor: number;
}

const LEVELS: Record<StudioVariant, StudioLevels> = {
  site: {top: 1, mid: 1, bot: 1, key: 6.0, strip: 2.4, fill: 1.6, floor: 1.4},
  dark: {top: 0.024, mid: 0.011, bot: 0.006, key: 0.04, strip: 0.012, fill: 0.016, floor: 0.006},
};

const studioScene = (variant: StudioVariant): {scene: THREE.Scene; dispose: () => void} => {
  const L = LEVELS[variant];
  const scene = new THREE.Scene();
  const disposables: Array<{dispose: () => void}> = [];
  const skyGeo = new THREE.SphereGeometry(50, 32, 16);
  const skyMat = new THREE.ShaderMaterial({
    side: THREE.BackSide,
    depthWrite: false,
    uniforms: {
      top: {value: new THREE.Color(0.95, 0.97, 0.96).multiplyScalar(L.top)},
      mid: {value: new THREE.Color(0.55, 0.58, 0.57).multiplyScalar(L.mid)},
      bot: {value: new THREE.Color(0.3, 0.32, 0.31).multiplyScalar(L.bot)},
    },
    vertexShader:
      'varying vec3 vP; void main(){ vP = normalize(position); gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0); }',
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
  box(14, 9, L.key, [-12, 14, 18]); // key soft box, upper left
  box(5, 18, L.strip, [22, 2, 10]); // strip light, right
  box(34, 22, L.fill, [0, -4, 30]); // big fill card behind the camera
  box(26, 6, L.floor, [0, -18, 14]); // floor bounce
  return {scene, dispose: () => disposables.forEach((d) => d.dispose())};
};

const envCache = new WeakMap<THREE.WebGLRenderer, Map<StudioVariant, THREE.Texture>>();

/** Prefiltered studio environment for this renderer (created once, synchronously). */
export const studioEnvironment = (gl: THREE.WebGLRenderer, variant: StudioVariant = 'dark'): THREE.Texture => {
  let byVariant = envCache.get(gl);
  if (!byVariant) {
    byVariant = new Map();
    envCache.set(gl, byVariant);
  }
  const hit = byVariant.get(variant);
  if (hit) return hit;
  const pmrem = new THREE.PMREMGenerator(gl);
  const {scene, dispose} = studioScene(variant);
  const rt = pmrem.fromScene(scene, 0.02);
  dispose();
  pmrem.dispose();
  byVariant.set(variant, rt.texture);
  return rt.texture;
};
