import {useLayoutEffect, useMemo} from 'react';
import {useThree} from '@react-three/fiber';
import {useCurrentFrame, useVideoConfig} from 'remotion';
import * as THREE from 'three';

// Scene plumbing for the fx: layers, pre-passes and the shared lens uniforms.
//
// Pre-passes (the mist, the god-ray occlusion and blur, the glass box's view of what is behind it)
// run from scene.onBeforeRender, i.e. at the start of every render of the scene: after three has
// updated the world matrices and before it builds the render lists. PostFX renders the scene once
// per motion-blur sub-frame, so every sub-frame gets passes for its own camera pose, and nothing is
// carried from one frame to the next. Results are cached on (time, camera, target) only to skip
// identical work; the cache never changes what is drawn.

/** Layers the fx reserve. Main cameras see glass, overlay and occluder (enabled by useFxLayers). */
export const FX_LAYER = {
  /** Seen only through glass: drawn in the glass box's view of the scene, never by the main camera. */
  inside: 26,
  /** Glass surfaces: left out of the glass box's own view of the scene. */
  glass: 27,
  /** Screen-space overlays (god-ray composite): never refracted, never occluders. */
  overlay: 28,
  /** Objects that block the god-ray light. */
  occluder: 29,
} as const;

export type PrePassFn = (renderer: THREE.WebGLRenderer, scene: THREE.Scene, camera: THREE.Camera, target: THREE.WebGLRenderTarget | null) => void;

export interface PrePass {
  /** Lower runs first. Lens 0, mist 10, god rays 20, glass 30. */
  order: number;
  run: PrePassFn;
}

interface Registry {
  passes: PrePass[];
  running: boolean;
  prev: THREE.Object3D['onBeforeRender'];
  hook: THREE.Object3D['onBeforeRender'];
}

const registries = new WeakMap<THREE.Scene, Registry>();

const install = (scene: THREE.Scene): Registry => {
  let reg = registries.get(scene);
  if (reg) return reg;
  const prev = scene.onBeforeRender;
  const r: Registry = {
    passes: [],
    running: false,
    prev,
    hook: function (this: THREE.Object3D, ...args: Parameters<THREE.Object3D['onBeforeRender']>) {
      r.prev.apply(this, args);
      if (r.running) return;
      const renderer = args[0] as THREE.WebGLRenderer;
      const camera = args[2] as THREE.Camera;
      // three passes the current render target as the fourth argument for scenes
      const target = (args[3] as unknown as THREE.WebGLRenderTarget | null) ?? null;
      r.running = true;
      try {
        for (const p of r.passes) p.run(renderer, scene, camera, target);
      } finally {
        r.running = false;
      }
    } as THREE.Object3D['onBeforeRender'],
  };
  scene.onBeforeRender = r.hook;
  registries.set(scene, r);
  return r;
};

/** Register a pre-pass with the scene while mounted. */
export const usePrePass = (pass: PrePass | null): void => {
  const scene = useThree((s) => s.scene);
  useLayoutEffect(() => {
    if (!pass) return;
    const reg = install(scene);
    reg.passes.push(pass);
    reg.passes.sort((a, b) => a.order - b.order);
    return () => {
      const k = reg.passes.indexOf(pass);
      if (k >= 0) reg.passes.splice(k, 1);
      if (!reg.passes.length && scene.onBeforeRender === reg.hook) {
        scene.onBeforeRender = reg.prev;
        registries.delete(scene);
      }
    };
  }, [scene, pass]);
};

/** True while a pre-pass is rendering the scene (nested renders skip their own pre-passes). */
export const inPrePass = (scene: THREE.Scene): boolean => registries.get(scene)?.running ?? false;

const layerUsers = new WeakMap<THREE.Camera, number>();
const FX_MASK = (1 << FX_LAYER.glass) | (1 << FX_LAYER.overlay) | (1 << FX_LAYER.occluder);

/** Lets the main camera see the fx layers while any fx component that needs them is mounted. */
export const useFxLayers = (): void => {
  const camera = useThree((s) => s.camera);
  // during render, so the very first frame already sees them
  camera.layers.mask |= FX_MASK;
  useLayoutEffect(() => {
    layerUsers.set(camera, (layerUsers.get(camera) ?? 0) + 1);
    camera.layers.mask |= FX_MASK;
    return () => {
      const n = (layerUsers.get(camera) ?? 1) - 1;
      layerUsers.set(camera, n);
      if (n <= 0) camera.layers.mask &= ~FX_MASK;
    };
  }, [camera]);
};

// ---------------------------------------------------------------- render state

const _vp = new THREE.Vector4();
const _clear = new THREE.Color();

export interface SavedState {
  target: THREE.WebGLRenderTarget | null;
  autoClear: boolean;
  clearColor: THREE.Color;
  clearAlpha: number;
  shadowAuto: boolean;
  clipping: THREE.Plane[];
  layers: number;
  background: THREE.Scene['background'];
  override: THREE.Material | null;
  viewport: THREE.Vector4;
}

/** Save the renderer and scene state a pre-pass may touch. */
export const saveState = (renderer: THREE.WebGLRenderer, scene: THREE.Scene, camera: THREE.Camera): SavedState => ({
  target: renderer.getRenderTarget(),
  autoClear: renderer.autoClear,
  clearColor: renderer.getClearColor(_clear).clone(),
  clearAlpha: renderer.getClearAlpha(),
  shadowAuto: renderer.shadowMap.autoUpdate,
  clipping: renderer.clippingPlanes,
  layers: camera.layers.mask,
  background: scene.background,
  override: scene.overrideMaterial,
  viewport: renderer.getViewport(_vp).clone(),
});

export const restoreState = (renderer: THREE.WebGLRenderer, scene: THREE.Scene, camera: THREE.Camera, s: SavedState): void => {
  renderer.setRenderTarget(s.target);
  renderer.autoClear = s.autoClear;
  renderer.setClearColor(s.clearColor, s.clearAlpha);
  renderer.shadowMap.autoUpdate = s.shadowAuto;
  renderer.clippingPlanes = s.clipping;
  camera.layers.mask = s.layers;
  scene.background = s.background;
  scene.overrideMaterial = s.override;
  if (!s.target) renderer.setViewport(s.viewport);
};

/** Pixel size of the target the scene is being drawn into. */
export const targetSize = (renderer: THREE.WebGLRenderer, target: THREE.WebGLRenderTarget | null, out = new THREE.Vector2()): THREE.Vector2 => {
  if (target) return out.set(target.width, target.height);
  return renderer.getDrawingBufferSize(out);
};

// ---------------------------------------------------------------- fullscreen passes

const FS_VERT = /* glsl */ `
varying vec2 vUv;
void main() {
  vUv = position.xy * 0.5 + 0.5;
  gl_Position = vec4(position.xy, 0.0, 1.0);
}`;

/** A full-screen triangle and its own scene, for screen passes inside pre-passes. */
export class ScreenPass {
  readonly scene = new THREE.Scene();
  readonly camera = new THREE.OrthographicCamera(-1, 1, 1, -1, 0, 1);
  readonly mesh: THREE.Mesh;
  constructor() {
    const g = new THREE.BufferGeometry();
    g.setAttribute('position', new THREE.BufferAttribute(new Float32Array([-1, -1, 0, 3, -1, 0, -1, 3, 0]), 3));
    this.mesh = new THREE.Mesh(g);
    this.mesh.frustumCulled = false;
    this.scene.add(this.mesh);
  }
  render(renderer: THREE.WebGLRenderer, material: THREE.Material, target: THREE.WebGLRenderTarget | null) {
    this.mesh.material = material;
    renderer.setRenderTarget(target);
    renderer.render(this.scene, this.camera);
  }
  dispose() {
    this.mesh.geometry.dispose();
  }
}

export const screenMaterial = (fragmentShader: string, uniforms: Record<string, THREE.IUniform>, extra: Partial<THREE.ShaderMaterialParameters> = {}) =>
  new THREE.ShaderMaterial({
    vertexShader: FS_VERT,
    fragmentShader,
    uniforms,
    depthTest: false,
    depthWrite: false,
    toneMapped: false,
    ...extra,
  });

export const halfFloatTarget = (w: number, h: number, opts: THREE.RenderTargetOptions = {}) =>
  new THREE.WebGLRenderTarget(Math.max(1, w), Math.max(1, h), {
    type: THREE.HalfFloatType,
    format: THREE.RGBAFormat,
    minFilter: THREE.LinearFilter,
    magFilter: THREE.LinearFilter,
    depthBuffer: false,
    generateMipmaps: false,
    ...opts,
  });

// ---------------------------------------------------------------- lens

/** Lens published on camera.userData.lens by CameraRig and FlightRig (the PostFX contract). */
export interface FxLensState {
  focusDistance: number;
  aperture: number;
}

/**
 * The camera at shutter open and close, published by FlightRig on camera.userData.shutterVP as
 * world-to-view matrices. The projection is taken from whichever camera draws, at draw time, so a
 * view offset (PostFX's guard band) or a pass with its own target keeps sprites on their lines.
 */
export interface ShutterVP {
  view0: THREE.Matrix4;
  view1: THREE.Matrix4;
}

export interface LensOverride {
  /** World-space focus distance (view depth). */
  focusDistance?: number;
  /** Aperture diameter, world units. 0 = everything sharp. */
  aperture?: number;
}

export interface LensUniforms {
  uViewport: {value: THREE.Vector2};
  uCocK: {value: number};
  uFocus: {value: number};
  uMaxCoc: {value: number};
  uMinR: {value: number};
  uNear: {value: number};
  uUseVP: {value: number};
  uVP0: {value: THREE.Matrix4};
  uVP1: {value: THREE.Matrix4};
  uDofOn: {value: number};
}

export const makeLensUniforms = (): LensUniforms => ({
  uViewport: {value: new THREE.Vector2(1, 1)},
  uCocK: {value: 0},
  uFocus: {value: 1},
  uMaxCoc: {value: 40},
  uMinR: {value: 0.8},
  uNear: {value: 0.01},
  uUseVP: {value: 0},
  uVP0: {value: new THREE.Matrix4()},
  uVP1: {value: new THREE.Matrix4()},
  uDofOn: {value: 0},
});

const _size = new THREE.Vector2();

export interface LensOptions {
  lens?: LensOverride;
  /** Largest sprite defocus radius as a fraction of frame height (sprites can afford more than PostFX). */
  maxBlur?: number;
  /** Smallest drawn radius in px at 1440p (scaled with the frame height). */
  minRadius?: number;
  /** Use the rig's shutter view-projections for camera motion streaks (default true). */
  cameraStreaks?: boolean;
}

/** Fill lens uniforms for the camera and target about to be drawn. */
export const updateLens = (u: LensUniforms, renderer: THREE.WebGLRenderer, camera: THREE.Camera, opts: LensOptions = {}) => {
  const target = renderer.getRenderTarget();
  const size = targetSize(renderer, target, _size);
  u.uViewport.value.copy(size);
  const H = size.y;
  const pc = camera as THREE.PerspectiveCamera;
  const fov = pc.fov ?? 18;
  const tanHalf = Math.tan(THREE.MathUtils.degToRad(fov) / 2);
  const pub = camera.userData.lens as FxLensState | undefined;
  const focus = opts.lens?.focusDistance ?? pub?.focusDistance ?? 1;
  const aperture = opts.lens?.aperture ?? pub?.aperture ?? 0;
  u.uFocus.value = Math.max(1e-4, focus);
  u.uCocK.value = (aperture * H) / (4 * tanHalf);
  u.uDofOn.value = aperture > 0 ? 1 : 0;
  u.uMaxCoc.value = (opts.maxBlur ?? 0.04) * H;
  u.uMinR.value = ((opts.minRadius ?? 0.8) * H) / 1440;
  u.uNear.value = pc.near ?? 0.01;
  const sh = camera.userData.shutterVP as ShutterVP | undefined;
  if (sh && opts.cameraStreaks !== false) {
    u.uUseVP.value = 1;
    u.uVP0.value.multiplyMatrices(pc.projectionMatrix, sh.view0);
    u.uVP1.value.multiplyMatrices(pc.projectionMatrix, sh.view1);
  } else {
    u.uUseVP.value = 0;
  }
};

// ---------------------------------------------------------------- time

/** Film time of this component, seconds: frame / fps + offset. */
export const useFxTime = (timeOffset = 0): number => {
  const frame = useCurrentFrame();
  const {fps} = useVideoConfig();
  return frame / fps + timeOffset;
};

/** A unit quad (-1..1) for instanced sprites and segments: four vertices, two triangles. */
export const useQuadGeometry = (instances: number): THREE.InstancedBufferGeometry => {
  const geo = useMemo(() => {
    const g = new THREE.InstancedBufferGeometry();
    g.setAttribute('position', new THREE.BufferAttribute(new Float32Array([-1, -1, 0, 1, -1, 0, 1, 1, 0, -1, 1, 0]), 3));
    g.setIndex([0, 1, 2, 0, 2, 3]);
    g.boundingSphere = new THREE.Sphere(new THREE.Vector3(), Infinity);
    return g;
  }, []);
  geo.instanceCount = instances;
  useLayoutEffect(() => () => geo.dispose(), [geo]);
  return geo;
};

/** Additive, premultiplied blending that also accumulates the bloom mask in alpha. */
export const ADDITIVE_BLOOM: Partial<THREE.ShaderMaterialParameters> = {
  transparent: true,
  depthWrite: false,
  depthTest: true,
  blending: THREE.CustomBlending,
  blendEquation: THREE.AddEquation,
  blendSrc: THREE.OneFactor,
  blendDst: THREE.OneFactor,
  blendEquationAlpha: THREE.AddEquation,
  blendSrcAlpha: THREE.OneFactor,
  blendDstAlpha: THREE.OneFactor,
  toneMapped: false,
};
