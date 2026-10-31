// The glass of a device: one physically based glass surface (it reflects the studio like the rest
// of the world) with the display under it, emitted through an inverse of the post pipeline's tone
// mapping so a recording shows its own colours.
//
// Why the inverse: PostFX tone-maps the whole frame (AgX by default, ACES at 0.92 in REEL_LOOK).
// A UI pushed through AgX loses its whites (#FFFFFF -> #C4C4C4), crushes dark grounds
// (#050D0C -> #000302) and shifts hues. The screen instead emits, per pixel, the scene-linear value
// that the grade maps back to the recording's colour, scaled so white lands on the film's display
// white. The inverses are exact: AgX to 8 bits over the whole RGB cube, ACES to float precision
// (closed form), Neutral except for pure primaries it cannot display. Reflections and glare add on
// top physically, so they still wash the display out the way glass does. Pass the same grade the
// PostFX of the scene uses: look={{tone: REEL_LOOK.toneMapping, exposure: REEL_LOOK.exposure}}.
//
// Bloom: like the pins (only lit pins bloom), the glass writes the bloom mask into alpha. The
// display blooms only as much as `look.bloom` asks (default 0), reflections never.
import * as THREE from 'three';

/** PostFX's default tone mapping. */
export const SCREEN_TONE = 'agx' as const;

/** The grade applied after the scene (PostFX's toneMapping), or 'none' when nothing tone-maps it. */
export type ScreenTone = 'agx' | 'aces' | 'neutral' | 'linear' | 'none';

export interface ScreenLook {
  /** 0 = off (black glass), 1 = on */
  power?: number;
  /** display brightness; 1 maps recording white to the film's display white (#EDEDED) */
  brightness?: number;
  /** art-directed strip reflection sliding across the glass as the camera moves, 0..1 */
  glare?: number;
  /** strength of the real studio reflections in the glass, 0..1 */
  reflections?: number;
  /** IPS-like dimming at grazing view angles, 0..1 */
  viewFalloff?: number;
  /** the grade after the scene: PostFX's `toneMapping` (default 'agx'); 'none' without PostFX */
  tone?: ScreenTone;
  /** PostFX's `exposure` (default 1; REEL_LOOK uses 0.92) */
  exposure?: number;
  /** how much the display feeds PostFX's bloom, 0..1 (0: never blooms, like steel) */
  bloom?: number;
}

export const defaultLook: Required<ScreenLook> = {
  power: 1,
  brightness: 1,
  glare: 0.3,
  reflections: 0.35,
  viewFalloff: 0.25,
  tone: SCREEN_TONE,
  exposure: 1,
  bloom: 0,
};

const TONE_MODE: Record<ScreenTone, number> = {none: 0, agx: 1, aces: 2, neutral: 3, linear: 4};

// three r186's tone maps (tonemapping_pars_fragment) on the grey axis, where every one of them is
// a per-channel curve (their matrices keep grey grey). For the light a display throws.
const greyForward = (tone: ScreenTone, e: number, x: number): number => {
  const c = x * e;
  switch (tone) {
    case 'agx': {
      const v = Math.min(1, Math.max(0, (Math.log2(Math.max(c, 1e-10)) + 12.47393) / (4.026069 + 12.47393)));
      const v2 = v * v;
      const v4 = v2 * v2;
      const y = 15.5 * v4 * v2 - 40.14 * v4 * v + 31.96 * v4 - 6.868 * v2 * v + 0.4298 * v2 + 0.1191 * v - 0.00232;
      return Math.min(1, Math.pow(Math.max(0, y), 2.2));
    }
    case 'aces': {
      const v = c / 0.6;
      return Math.min(1, Math.max(0, (v * (v + 0.0245786) - 0.000090537) / (v * (0.983729 * v + 0.432951) + 0.238081)));
    }
    case 'neutral': {
      const p = c - (c < 0.08 ? c - 6.25 * c * c : 0.04);
      return p < 0.76 ? p : 1 - (0.24 * 0.24) / (p + 0.24 - 0.76);
    }
    case 'linear':
      return Math.min(1, c);
    default:
      return x;
  }
};

const greyCache = new Map<string, number>();
/** Scene radiance of a grey display level (display-linear) under a grade: the screen's emission. */
export function screenRadianceOfGrey(tone: ScreenTone, exposure: number, displayLinear: number): number {
  if (tone === 'none') return displayLinear;
  const key = `${tone}|${exposure}|${displayLinear}`;
  const hit = greyCache.get(key);
  if (hit !== undefined) return hit;
  const goal = Math.min(0.995, Math.max(0, displayLinear));
  // monotonic: bisect in log space
  let lo = -20;
  let hi = 12;
  for (let i = 0; i < 60; i++) {
    const m = 0.5 * (lo + hi);
    if (greyForward(tone, exposure, Math.pow(2, m)) < goal) lo = m;
    else hi = m;
  }
  const r = goal <= 0 ? 0 : Math.pow(2, 0.5 * (lo + hi));
  if (greyCache.size > 512) greyCache.clear();
  greyCache.set(key, r);
  return r;
}

// Display-linear white of brightness 1: sRGB 239, the film's display white.
export const SCREEN_WHITE = 0.86;
const WHITE = SCREEN_WHITE;

export interface ScreenGeometry {
  /** glass size in world units (u along x, v along y) */
  width: number;
  height: number;
  /** active (lit) area, centre offset and size in world units, relative to the glass centre */
  active: {x: number; y: number; width: number; height: number; radius: number};
  /** a camera dot (in the bezel) or punch hole (in the display), world units from the glass centre */
  dot?: {x: number; y: number; r: number};
  /** a home-indicator pill drawn over the display (phones): centre y, size, world units */
  pill?: {y: number; width: number; height: number; opacity: number};
}

const glsl = /* glsl */ `
uniform sampler2D uScreen;
uniform float uHasScreen;
uniform vec2 uGlassSize;
uniform vec4 uActive;
uniform float uActiveRadius;
uniform vec4 uContent;
uniform vec4 uDot;
uniform float uPower;
uniform float uWhite;
uniform float uGlare;
uniform float uFalloff;
uniform float uTone;
uniform float uExposure;
uniform vec3 uGlareDir;
uniform vec3 uGlareNormal;
uniform float uDirectSpec;
uniform float uReflections;
uniform vec4 uPill;
uniform float uBloomMask;
varying vec2 vGlassUv;
// the display's share of PostFX's bloom, written into alpha after the lighting
float devBloom;

float devRoundRect(vec2 p, vec2 b, float r) {
  vec2 q = abs(p) - b + r;
  return length(max(q, 0.0)) + min(max(q.x, q.y), 0.0) - r;
}

// AgX polynomial (three.js agxDefaultContrastApprox) and its derivative
vec3 devAgxP(vec3 x) {
  vec3 x2 = x * x; vec3 x4 = x2 * x2;
  return 15.5 * x4 * x2 - 40.14 * x4 * x + 31.96 * x4 - 6.868 * x2 * x + 0.4298 * x2 + 0.1191 * x - 0.00232;
}
vec3 devAgxDP(vec3 x) {
  vec3 x2 = x * x; vec3 x4 = x2 * x2;
  return 93.0 * x4 * x - 200.7 * x4 + 127.84 * x2 * x - 20.604 * x2 + 0.8596 * x + 0.1191;
}

// Exact inverse of three.js AgXToneMapping (r186) for display-linear sRGB input. Signed output:
// saturated UI colours need slightly negative scene values, which the half-float buffer keeps.
vec3 devAgxInverse(vec3 d) {
  const mat3 R2Si = mat3(vec3(0.6274094405, 0.06912483904, 0.01642335803), vec3(0.3292602522, 0.9195486138, 0.08804784762), vec3(0.04327189359, 0.01132076676, 0.8956167137));
  const mat3 OUTi = mat3(vec3(0.8997969559, 0.1114209890, 0.1114209890), vec3(0.08719961920, 0.8755755862, 0.08719961920), vec3(0.01300342489, 0.01300342489, 0.8013793918));
  const mat3 INi = mat3(vec3(1.197441077, -0.1964746263, -0.1465574171), vec3(-0.1442615127, 1.354095131, -0.1082840588), vec3(-0.05317956419, -0.1576205051, 1.254841476));
  const mat3 S2Ri = mat3(vec3(1.660512276, -0.1245634643, -0.01816750386), vec3(-0.5877046787, 1.132949121, -0.1005595868), vec3(-0.07286636742, -0.008272361613, 1.118717035));
  const float MINEV = -12.47393;
  const float MAXEV = 4.026069;
  vec3 s = OUTi * pow(max(R2Si * d, 0.0), vec3(1.0 / 2.2));
  s = clamp(s, vec3(-0.00232), vec3(0.99838));
  // the curve is monotonic on [0, 1]: bisect, then polish with Newton inside the bracket
  vec3 lo = vec3(0.0);
  vec3 hi = vec3(1.0);
  for (int i = 0; i < 10; i++) {
    vec3 m = 0.5 * (lo + hi);
    vec3 below = step(devAgxP(m), s);
    lo = mix(lo, m, below);
    hi = mix(m, hi, below);
  }
  vec3 x = 0.5 * (lo + hi);
  for (int i = 0; i < 2; i++) x = clamp(x - (devAgxP(x) - s) / devAgxDP(x), lo, hi);
  vec3 l = exp2(x * (MAXEV - MINEV) + MINEV);
  return S2Ri * (INi * l);
}

// Exact inverse of three.js ACESFilmicToneMapping (r186) at exposure 1, closed form: undo the
// output matrix, solve the RRT + ODT rational fit (a quadratic per channel), undo the input matrix.
vec3 devAcesInverse(vec3 d) {
  const mat3 OUTi = mat3(vec3(0.6430382486, 0.05926869042, 0.005961901254), vec3(0.3111867518, 0.9314364869, 0.06392901569), vec3(0.04577545735, 0.009294915679, 0.9301183842));
  const mat3 INi = mat3(vec3(1.764740972, -0.1470278520, -0.03633683012), vec3(-0.6757776782, 1.160251512, -0.1624364369), vec3(-0.08896329379, -0.01322365968, 1.198773267));
  vec3 w = min(OUTi * d, vec3(1.0));
  vec3 A = 0.983729 * w - 1.0;
  vec3 B = 0.4329510 * w - 0.0245786;
  vec3 C = 0.238081 * w + 0.000090537;
  vec3 v = (-B - sqrt(max(B * B - 4.0 * A * C, 0.0))) / (2.0 * A);
  return 0.6 * (INi * v);
}

// Inverse of three.js NeutralToneMapping (Khronos PBR Neutral) at exposure 1. The output's peak
// gives the input's peak, which undoes the desaturation and the compression; then the toe offset.
vec3 devNeutralInverse(vec3 o) {
  float np = max(o.r, max(o.g, o.b));
  vec3 c = o;
  if (np >= 0.76) {
    float n = min(np, 0.99999);
    float peak = 0.52 + 0.0576 / (1.0 - n);
    float g = 1.0 - 1.0 / (0.15 * (peak - n) + 1.0);
    c = (o - g * n) / max(1.0 - g, 1e-6) * (peak / n);
  }
  float m = max(min(c.r, min(c.g, c.b)), 0.0);
  return c + (m < 0.04 ? 0.4 * sqrt(m) - m : 0.04);
}

vec3 devToneInverse(vec3 d, float mode, float e) {
  if (mode < 0.5) return d;
  if (mode < 1.5) return devAgxInverse(d) / e;
  if (mode < 2.5) return devAcesInverse(d) / e;
  if (mode < 3.5) return devNeutralInverse(d) / e;
  return d / e;
}
`;

export interface ScreenMaterialHandle {
  material: THREE.MeshPhysicalMaterial;
  uniforms: Record<string, THREE.IUniform>;
  /** apply look changes (pure: call every frame with the frame's values) */
  setLook: (look: ScreenLook) => void;
  /** map content (video) of a given pixel size into the active area */
  setContent: (texture: THREE.Texture | null, contentWidth: number, contentHeight: number, fit: ScreenFit, crop?: ScreenCrop, inset?: ScreenInset) => void;
  // (the texture's flipY says whether its v axis points up, as for canvases, or down, as for decoded frames)
}

export type ScreenFit = 'cover' | 'contain' | 'fill';
/** Leave a black band at the top of the display (a phone's status bar area), as a fraction of its height. */
export type ScreenInset = {top?: number};
/** A region of the content to show, in content pixels-normalised coordinates: x, y from top left. */
export type ScreenCrop = {x: number; y: number; width: number; height: number};

export function createScreenMaterial(geo: ScreenGeometry): ScreenMaterialHandle {
  const a = geo.active;
  const uniforms: Record<string, THREE.IUniform> = {
    uScreen: {value: null},
    uHasScreen: {value: 0},
    uGlassSize: {value: new THREE.Vector2(geo.width, geo.height)},
    uActive: {
      value: new THREE.Vector4(
        0.5 + (a.x - a.width / 2) / geo.width,
        0.5 + (a.y - a.height / 2) / geo.height,
        0.5 + (a.x + a.width / 2) / geo.width,
        0.5 + (a.y + a.height / 2) / geo.height,
      ),
    },
    uActiveRadius: {value: a.radius},
    uContent: {value: new THREE.Vector4(1, 1, 0, 0)},
    uDot: {value: geo.dot ? new THREE.Vector4(0.5 + geo.dot.x / geo.width, 0.5 + geo.dot.y / geo.height, geo.dot.r, 1) : new THREE.Vector4(0, 0, 0, 0)},
    uPower: {value: 1},
    uWhite: {value: WHITE},
    uGlare: {value: defaultLook.glare},
    uFalloff: {value: defaultLook.viewFalloff},
    uTone: {value: TONE_MODE[SCREEN_TONE]},
    uExposure: {value: 1},
    uBloomMask: {value: 0},
    // a long soft strip light in front of the device, above the camera (world space): its
    // reflection crosses a +z-facing screen diagonally for cameras in front of it
    uGlareDir: {value: new THREE.Vector3(0.2595, 0.4832, 0.8352).normalize()},
    uGlareNormal: {value: new THREE.Vector3(0.606, 0.592, -0.531).normalize()},
    // point and spot lights put a tiny, extremely bright dot on near-perfect glass (bloom and depth
    // of field blow it up into a blob); keep only a trace of it
    uDirectSpec: {value: 0.02},
    // strength of the studio's reflections in the glass. Scaled in the shader: under a scene
    // environment three r186 replaces material.envMapIntensity with scene.environmentIntensity.
    uReflections: {value: defaultLook.reflections},
    uPill: {value: geo.pill ? new THREE.Vector4(geo.pill.y, geo.pill.width, geo.pill.height, geo.pill.opacity) : new THREE.Vector4(0, 0, 0, 0)},
  };
  const material = new THREE.MeshPhysicalMaterial({
    name: 'device-screen-glass',
    color: '#000000',
    metalness: 0,
    roughness: 0.06,
    ior: 1.52,
    specularIntensity: 1,
  });
  material.onBeforeCompile = (shader) => {
    Object.assign(shader.uniforms, uniforms);
    shader.vertexShader = shader.vertexShader
      .replace('#include <common>', '#include <common>\nvarying vec2 vGlassUv;')
      .replace('#include <uv_vertex>', '#include <uv_vertex>\nvGlassUv = uv;');
    shader.fragmentShader = shader.fragmentShader.replace('#include <common>', `#include <common>\n${glsl}`).replace(
      '#include <emissivemap_fragment>',
      /* glsl */ `
      {
        vec2 g = vGlassUv;
        vec2 p = (g - 0.5) * uGlassSize;
        vec2 a0 = (uActive.xy - 0.5) * uGlassSize;
        vec2 a1 = (uActive.zw - 0.5) * uGlassSize;
        float d = devRoundRect(p - 0.5 * (a0 + a1), 0.5 * (a1 - a0), uActiveRadius);
        float aa = max(fwidth(d), 1e-6);
        float inside = 1.0 - smoothstep(-aa, aa, d);
        vec2 suv = (g - uActive.xy) / (uActive.zw - uActive.xy);
        vec2 cuv = suv * uContent.xy + uContent.zw;
        vec2 inC = step(vec2(0.0), cuv) * step(cuv, vec2(1.0));
        vec3 src = uHasScreen > 0.5 ? texture2D(uScreen, clamp(cuv, 0.0, 1.0)).rgb * (inC.x * inC.y) : vec3(0.0);
        float dd = length(p - (uDot.xy - 0.5) * uGlassSize) - uDot.z;
        float hole = (1.0 - smoothstep(-aa, aa, dd)) * uDot.w;
        vec3 V = normalize(vViewPosition);
        float ndv = clamp(dot(normal, V), 0.0, 1.0);
        float view = mix(1.0, 0.55 + 0.45 * ndv, uFalloff);
        float pd = devRoundRect(p - vec2(0.0, uPill.x), vec2(0.5 * uPill.y, 0.5 * uPill.z), 0.5 * uPill.z);
        float pill = (1.0 - smoothstep(-aa, aa, pd)) * uPill.w;
        src = mix(src, vec3(1.0), pill);
        vec3 disp = src * (uWhite * uPower * view * inside * (1.0 - hole));
        totalEmissiveRadiance = devToneInverse(disp, uTone, uExposure);
        devBloom = uBloomMask * inside * (1.0 - hole);
        // a soft strip light reflected in the glass: it moves with the camera like a real reflection
        vec3 Rw = normalize((vec4(reflect(-V, normal), 0.0) * viewMatrix).xyz);
        float across = dot(Rw, uGlareNormal);
        float strip = exp(-across * across * 140.0) * smoothstep(-0.35, 0.55, dot(Rw, uGlareDir));
        float fres = 0.04 + 0.96 * pow(1.0 - ndv, 5.0);
        totalEmissiveRadiance += vec3(uGlare * (0.05 + 0.9 * fres) * strip * (1.0 - hole));
      }
      `,
    ).replace(
      '#include <lights_fragment_end>',
      'radiance *= uReflections;\niblIrradiance *= uReflections;\n#include <lights_fragment_end>\nreflectedLight.directSpecular *= uDirectSpec;',
    ).replace('#include <opaque_fragment>', '#include <opaque_fragment>\ngl_FragColor.a = devBloom;');
  };
  // one program for every screen
  material.customProgramCacheKey = () => 'device-screen-v4';

  const setLook = (look: ScreenLook) => {
    const l = {...defaultLook, ...look};
    uniforms.uPower.value = Math.max(0, l.power);
    uniforms.uWhite.value = WHITE * Math.max(0, l.brightness);
    uniforms.uGlare.value = l.glare;
    uniforms.uFalloff.value = l.viewFalloff;
    uniforms.uTone.value = TONE_MODE[l.tone] ?? TONE_MODE[SCREEN_TONE];
    uniforms.uExposure.value = Math.max(1e-4, l.exposure);
    uniforms.uBloomMask.value = Math.min(1, Math.max(0, l.bloom));
    uniforms.uReflections.value = l.reflections;
  };

  const setContent = (texture: THREE.Texture | null, cw: number, ch: number, fit: ScreenFit, crop?: ScreenCrop, inset?: ScreenInset) => {
    uniforms.uScreen.value = texture;
    uniforms.uHasScreen.value = texture ? 1 : 0;
    // region of the content to show, in texture uv (v up; CanvasTexture flips y on upload)
    const c = crop ?? {x: 0, y: 0, width: 1, height: 1};
    const regionAspect = (cw * c.width) / Math.max(1e-6, ch * c.height);
    const top = Math.min(0.5, Math.max(0, inset?.top ?? 0));
    const screenAspect = a.width / (a.height * (1 - top));
    let sx = 1;
    let sy = 1;
    if (fit === 'cover') {
      if (regionAspect > screenAspect) sx = screenAspect / regionAspect;
      else sy = regionAspect / screenAspect;
    } else if (fit === 'contain') {
      if (regionAspect > screenAspect) sy = regionAspect / screenAspect;
      else sx = screenAspect / regionAspect;
    }
    // active uv (0..1) -> region uv centred, then -> texture uv
    const rx = sx * c.width;
    const ry = sy * c.height;
    const ox = c.x + c.width * (0.5 - sx / 2);
    const oyTop = c.y + c.height * (0.5 - sy / 2); // from the top
    // the content area is the active area minus the top band: its uv runs 0..1 below the band
    if (!texture || texture.flipY) uniforms.uContent.value.set(rx, ry / (1 - top), ox, 1 - oyTop - ry);
    else uniforms.uContent.value.set(rx, -ry / (1 - top), ox, oyTop + ry);
  };

  return {material, uniforms, setLook, setContent};
}
