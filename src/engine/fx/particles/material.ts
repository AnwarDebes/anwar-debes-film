import * as THREE from 'three';
import {HASH_GLSL, LENS_GLSL, LINE_FRAG_GLSL, LINE_VERT_GLSL, NOISE_GLSL, SPRITE_FRAG_GLSL, SPRITE_VERT_GLSL} from '../glsl';
import {ADDITIVE_BLOOM, makeLensUniforms, updateLens, type LensOptions, type LensUniforms} from '../scene';

export interface SpriteMaterialSpec {
  /** GLSL declarations and a `void main()` that ends by calling fxSprite(...). */
  vertexMain: string;
  uniforms: Record<string, THREE.IUniform>;
  /** Quad half-size in sprite radii (cover halos and rings). */
  extent?: number;
  haloScale?: number;
  ringRadius?: number;
  ringWidthPx?: number;
  /** Energy exponent through defocus and the minimum radius (1 = physical). */
  energyExp?: number;
  noise?: boolean;
}

export interface SpriteUniforms {
  uExtent: {value: number};
  uHaloScale: {value: number};
  uRingRadius: {value: number};
  uRingWidthPx: {value: number};
  uEnergyExp: {value: number};
}

export interface FxMaterial<U> {
  material: THREE.ShaderMaterial;
  uniforms: U & LensUniforms;
}

/** An additive sprite material wired to the shared lens model. */
export const makeSpriteMaterial = <U extends Record<string, THREE.IUniform>>(spec: SpriteMaterialSpec & {uniforms: U}): FxMaterial<U & SpriteUniforms> => {
  const uniforms = {
    ...makeLensUniforms(),
    uExtent: {value: spec.extent ?? 1.7},
    uHaloScale: {value: spec.haloScale ?? 4},
    uRingRadius: {value: spec.ringRadius ?? 2.6},
    uRingWidthPx: {value: spec.ringWidthPx ?? 1},
    uEnergyExp: {value: spec.energyExp ?? 1},
    ...spec.uniforms,
  } as unknown as U & SpriteUniforms & LensUniforms;
  const material = new THREE.ShaderMaterial({
    vertexShader: `${HASH_GLSL}\n${spec.noise ? NOISE_GLSL : ''}\n${LENS_GLSL}\n${SPRITE_VERT_GLSL}\n${spec.vertexMain}`,
    fragmentShader: `${SPRITE_FRAG_GLSL}
void main() {
  #include <clipping_planes_fragment>
  if (vColor.a + vColor.r + vColor.g + vColor.b <= 0.0) discard;
  float p = fxSpriteProfile();
  vec4 c = vColor * p;
  if (c.r + c.g + c.b + c.a < 1e-6) discard;
  gl_FragColor = c;
}`,
    uniforms: uniforms as unknown as Record<string, THREE.IUniform>,
    clipping: true,
    ...ADDITIVE_BLOOM,
  });
  return {material, uniforms};
};

export interface LineMaterialSpec {
  vertexMain: string;
  uniforms: Record<string, THREE.IUniform>;
}

/** An additive anti-aliased line material wired to the shared lens model. */
export const makeLineMaterial = <U extends Record<string, THREE.IUniform>>(spec: LineMaterialSpec & {uniforms: U}): FxMaterial<U> => {
  const uniforms = {
    ...makeLensUniforms(),
    ...spec.uniforms,
  } as unknown as U & LensUniforms;
  const material = new THREE.ShaderMaterial({
    vertexShader: `${HASH_GLSL}\n${LENS_GLSL}\n${LINE_VERT_GLSL}\n${spec.vertexMain}`,
    fragmentShader: `${LINE_FRAG_GLSL}
void main() {
  #include <clipping_planes_fragment>
  if (vColor.r + vColor.g + vColor.b + vColor.a <= 0.0) discard;
  float c = fxLineCoverage();
  if (c <= 0.0) discard;
  gl_FragColor = vColor * c;
}`,
    uniforms: uniforms as unknown as Record<string, THREE.IUniform>,
    clipping: true,
    ...ADDITIVE_BLOOM,
  });
  return {material, uniforms};
};

/** Keep a mesh's lens uniforms in step with whichever camera and target draw it. */
export const bindLens = (mesh: THREE.Object3D, uniforms: LensUniforms, opts: () => LensOptions) => {
  mesh.onBeforeRender = (renderer, _scene, camera) => updateLens(uniforms, renderer, camera, opts());
};
