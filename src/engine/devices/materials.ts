// Materials for the device mockups, tuned for the film's steel / charcoal world: graphite
// anodised aluminium, a bright polished edge, near-black keycaps and glass. All of them are
// physically based and read the scene environment (see DeviceStudio), so the devices pick up the
// same soft studio highlights as the pin wall.
// Reflection strength: with a scene environment and no material.envMap, three r186 uses
// scene.environmentIntensity for every material and ignores material.envMapIntensity. To vary it
// per material, assign material.envMap explicitly (the screen glass scales its own, in its shader).
// Bloom: PostFX blooms by luminance times the alpha it finds in the scene buffer, and the film's
// rule is that only lit things glow (lit pins write their glow into alpha, steel writes 0). Device
// shells follow it: their specular glints never bloom.
import * as THREE from 'three';

/** Make an opaque material write 0 into the bloom mask (alpha) of PostFX's scene buffer. */
export function noBloom<M extends THREE.Material>(material: M): M {
  if (material.transparent) return material; // blending needs its alpha
  material.onBeforeCompile = (shader) => {
    shader.fragmentShader = shader.fragmentShader.replace('#include <opaque_fragment>', '#include <opaque_fragment>\ngl_FragColor.a = 0.0;');
  };
  material.customProgramCacheKey = () => 'device-no-bloom-v1';
  return material;
}

export type DeviceFinish = 'graphite' | 'silver' | 'steel';

export interface DeviceMaterials {
  /** the anodised shell */
  body: THREE.MeshPhysicalMaterial;
  /** polished (diamond-cut) edges and bands */
  edge: THREE.MeshPhysicalMaterial;
  /** a slightly smoother panel in the shell (trackpad, stand plate) */
  panel: THREE.MeshPhysicalMaterial;
  keycap: THREE.MeshPhysicalMaterial;
  /** dark gaps, ports, grille holes */
  void: THREE.MeshStandardMaterial;
  hinge: THREE.MeshPhysicalMaterial;
  rubber: THREE.MeshStandardMaterial;
  /** phone: matte back glass */
  backGlass: THREE.MeshPhysicalMaterial;
  /** camera lenses */
  lens: THREE.MeshPhysicalMaterial;
  dispose: () => void;
}

const finishes: Record<DeviceFinish, {body: string; edge: string; bodyRough: number; edgeRough: number}> = {
  // graphite: dark, slightly cool, like the wall's steel in shadow
  graphite: {body: '#4a5053', edge: '#a9b1b3', bodyRough: 0.42, edgeRough: 0.24},
  silver: {body: '#b8bdbf', edge: '#e3e7e8', bodyRough: 0.38, edgeRough: 0.14},
  // steel: closest to the pins (#DEE0E0 highlights)
  steel: {body: '#7d8487', edge: '#d6dcdd', bodyRough: 0.3, edgeRough: 0.12},
};

export function createDeviceMaterials(finish: DeviceFinish = 'graphite'): DeviceMaterials {
  const f = finishes[finish];
  const body = new THREE.MeshPhysicalMaterial({
    name: 'device-body',
    color: f.body,
    metalness: 1,
    roughness: f.bodyRough,
  });
  const edge = new THREE.MeshPhysicalMaterial({
    name: 'device-edge',
    color: f.edge,
    metalness: 1,
    roughness: f.edgeRough,
  });
  const panel = new THREE.MeshPhysicalMaterial({
    name: 'device-panel',
    color: f.body,
    metalness: 1,
    roughness: Math.max(0.2, f.bodyRough - 0.12),
  });
  const keycap = new THREE.MeshPhysicalMaterial({
    name: 'device-keycap',
    color: '#141617',
    metalness: 0,
    roughness: 0.52,
    specularIntensity: 0.55,
  });
  const voidMat = new THREE.MeshStandardMaterial({name: 'device-void', color: '#040505', metalness: 0, roughness: 0.9});
  const hinge = new THREE.MeshPhysicalMaterial({
    name: 'device-hinge',
    color: '#1b1e1f',
    metalness: 0.6,
    roughness: 0.38,
  });
  const rubber = new THREE.MeshStandardMaterial({name: 'device-rubber', color: '#0b0c0c', metalness: 0, roughness: 0.92});
  const backGlass = new THREE.MeshPhysicalMaterial({
    name: 'device-back-glass',
    color: finish === 'silver' ? '#c9cdcf' : '#2a2f31',
    metalness: 0,
    roughness: 0.34,
    clearcoat: 0.6,
    clearcoatRoughness: 0.32,
  });
  const lens = new THREE.MeshPhysicalMaterial({
    name: 'device-lens',
    color: '#020303',
    metalness: 0,
    roughness: 0.04,
    clearcoat: 1,
    clearcoatRoughness: 0.02,
    iridescence: 0.35,
    iridescenceIOR: 1.6,
  });
  const all = [body, edge, panel, keycap, voidMat, hinge, rubber, backGlass, lens];
  all.forEach((m) => noBloom(m));
  return {
    body,
    edge,
    panel,
    keycap,
    void: voidMat,
    hinge,
    rubber,
    backGlass,
    lens,
    dispose: () => all.forEach((m) => m.dispose()),
  };
}

/**
 * A perforated speaker grille as an alpha mask: a hex grid of round holes. Drawn once on a canvas
 * (no text); mipmaps average the holes to a soft grey at a distance instead of shimmering.
 */
export function grilleTexture(cols = 18, rows = 120): THREE.CanvasTexture {
  const cell = 8;
  const c = document.createElement('canvas');
  c.width = cols * cell;
  c.height = rows * cell;
  const g = c.getContext('2d')!;
  g.fillStyle = '#000';
  g.fillRect(0, 0, c.width, c.height);
  g.fillStyle = '#fff';
  for (let r = 0; r < rows; r++) {
    for (let q = 0; q < cols; q++) {
      const x = (q + 0.5 + (r % 2 ? 0.5 : 0)) * cell;
      if (x > c.width - cell * 0.4) continue;
      g.beginPath();
      g.arc(x, (r + 0.5) * cell, cell * 0.28, 0, Math.PI * 2);
      g.fill();
    }
  }
  const t = new THREE.CanvasTexture(c);
  t.colorSpace = THREE.NoColorSpace;
  t.anisotropy = 8;
  return t;
}
