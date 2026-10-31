// Shared GLSL for the fx module. Everything here is a pure function of its inputs: integer hashes
// (no float-precision drift between tabs), analytic noise, and the sprite / line projection used by
// every particle, node and link, so they all share one lens model with PostFX:
//   circle of confusion (px) = aperture * H * |1/focus - 1/z| / (4 tan(fov / 2))
// which is exactly PostFX's FRAG_COC in physical-lens mode.

/** pcg integer hashes, interleaved gradient noise and small helpers. */
export const HASH_GLSL = /* glsl */ `
uint fxPcg(uint v) {
  uint state = v * 747796405u + 2891336453u;
  uint word = ((state >> ((state >> 28u) + 4u)) ^ state) * 277803737u;
  return (word >> 22u) ^ word;
}
uvec3 fxPcg3(uvec3 v) {
  v = v * 1664525u + 1013904223u;
  v.x += v.y * v.z; v.y += v.z * v.x; v.z += v.x * v.y;
  v ^= v >> 16u;
  v.x += v.y * v.z; v.y += v.z * v.x; v.z += v.x * v.y;
  return v;
}
uvec4 fxPcg4(uvec4 v) {
  v = v * 1664525u + 1013904223u;
  v.x += v.y * v.w; v.y += v.z * v.x; v.z += v.x * v.y; v.w += v.y * v.z;
  v ^= v >> 16u;
  v.x += v.y * v.w; v.y += v.z * v.x; v.z += v.x * v.y; v.w += v.y * v.z;
  return v;
}
const float FX_INV_U32 = 1.0 / 4294967296.0;
vec3 fxHash3(uint a, uint b, uint c) { return vec3(fxPcg3(uvec3(a, b, c))) * FX_INV_U32; }
vec4 fxHash4(uint a, uint b, uint c, uint d) { return vec4(fxPcg4(uvec4(a, b, c, d))) * FX_INV_U32; }
float fxHash1(uint a, uint b) { return float(fxPcg(a ^ fxPcg(b + 0x9E3779B9u))) * FX_INV_U32; }
float fxIGN(vec2 p) { return fract(52.9829189 * fract(dot(p, vec2(0.06711056, 0.00583715)))); }
float fxSat(float x) { return clamp(x, 0.0, 1.0); }
float fxRamp(float t, float a, float dur) { return dur <= 0.0 ? step(a, t) : clamp((t - a) / dur, 0.0, 1.0); }
float fxSmooth01(float x) { x = clamp(x, 0.0, 1.0); return x * x * (3.0 - 2.0 * x); }
`;

/** 3D simplex noise (Gustavson / McEwan, MIT) and a rotated fbm. */
export const NOISE_GLSL = /* glsl */ `
vec4 fxPermute(vec4 x) { return mod(((x * 34.0) + 10.0) * x, 289.0); }
vec4 fxTaylorInvSqrt(vec4 r) { return 1.79284291400159 - 0.85373472095314 * r; }
float fxSnoise(vec3 v) {
  const vec2 C = vec2(1.0 / 6.0, 1.0 / 3.0);
  const vec4 D = vec4(0.0, 0.5, 1.0, 2.0);
  vec3 i = floor(v + dot(v, C.yyy));
  vec3 x0 = v - i + dot(i, C.xxx);
  vec3 g = step(x0.yzx, x0.xyz);
  vec3 l = 1.0 - g;
  vec3 i1 = min(g.xyz, l.zxy);
  vec3 i2 = max(g.xyz, l.zxy);
  vec3 x1 = x0 - i1 + C.xxx;
  vec3 x2 = x0 - i2 + C.yyy;
  vec3 x3 = x0 - D.yyy;
  i = mod(i, 289.0);
  vec4 p = fxPermute(fxPermute(fxPermute(i.z + vec4(0.0, i1.z, i2.z, 1.0)) + i.y + vec4(0.0, i1.y, i2.y, 1.0)) + i.x + vec4(0.0, i1.x, i2.x, 1.0));
  float n_ = 0.142857142857;
  vec3 ns = n_ * D.wyz - D.xzx;
  vec4 j = p - 49.0 * floor(p * ns.z * ns.z);
  vec4 x_ = floor(j * ns.z);
  vec4 y_ = floor(j - 7.0 * x_);
  vec4 x = x_ * ns.x + ns.yyyy;
  vec4 y = y_ * ns.x + ns.yyyy;
  vec4 h = 1.0 - abs(x) - abs(y);
  vec4 b0 = vec4(x.xy, y.xy);
  vec4 b1 = vec4(x.zw, y.zw);
  vec4 s0 = floor(b0) * 2.0 + 1.0;
  vec4 s1 = floor(b1) * 2.0 + 1.0;
  vec4 sh = -step(h, vec4(0.0));
  vec4 a0 = b0.xzyw + s0.xzyw * sh.xxyy;
  vec4 a1 = b1.xzyw + s1.xzyw * sh.zzww;
  vec3 p0 = vec3(a0.xy, h.x);
  vec3 p1 = vec3(a0.zw, h.y);
  vec3 p2 = vec3(a1.xy, h.z);
  vec3 p3 = vec3(a1.zw, h.w);
  vec4 norm = fxTaylorInvSqrt(vec4(dot(p0, p0), dot(p1, p1), dot(p2, p2), dot(p3, p3)));
  p0 *= norm.x; p1 *= norm.y; p2 *= norm.z; p3 *= norm.w;
  vec4 m = max(0.5 - vec4(dot(x0, x0), dot(x1, x1), dot(x2, x2), dot(x3, x3)), 0.0);
  m = m * m;
  return 105.0 * dot(m * m, vec4(dot(p0, x0), dot(p1, x1), dot(p2, x2), dot(p3, x3)));
}
const mat3 FX_ROT = mat3(0.00, 0.80, 0.60, -0.80, 0.36, -0.48, -0.60, -0.48, 0.64);
float fxFbm(vec3 p, int octaves) {
  float a = 0.5;
  float s = 0.0;
  float n = 0.0;
  for (int i = 0; i < 6; i++) {
    if (i >= octaves) break;
    s += a * fxSnoise(p);
    n += a;
    p = FX_ROT * p * 2.03;
    a *= 0.5;
  }
  return s / n;
}
`;

/**
 * The lens, the shutter and the screen, shared by sprites and lines. uCocK is
 * aperture * H / (4 tan(fov / 2)) in px * world units (0 = pinhole); uVP0 / uVP1 are the
 * view-projections at shutter open and close when a rig publishes them (camera motion blur inside
 * the sprite), otherwise the current camera is used for both ends.
 */
export const LENS_GLSL = /* glsl */ `
uniform vec2 uViewport;
uniform float uCocK;
uniform float uFocus;
uniform float uMaxCoc;
uniform float uMinR;
uniform float uNear;
uniform float uUseVP;
uniform mat4 uVP0;
uniform mat4 uVP1;
uniform float uDofOn;
float fxCoc(float z) {
  if (uDofOn < 0.5) return 0.0;
  return min(uMaxCoc, uCocK * abs(1.0 / uFocus - 1.0 / max(z, 1e-4)));
}
vec4 fxClip0(vec3 p) { return uUseVP > 0.5 ? uVP0 * vec4(p, 1.0) : projectionMatrix * (viewMatrix * vec4(p, 1.0)); }
vec4 fxClip1(vec3 p) { return uUseVP > 0.5 ? uVP1 * vec4(p, 1.0) : projectionMatrix * (viewMatrix * vec4(p, 1.0)); }
vec2 fxToPx(vec4 c) { return (c.xy / c.w * 0.5 + 0.5) * uViewport; }
float fxPxPerUnit(float w) { return projectionMatrix[1][1] * 0.5 * uViewport.y / max(w, 1e-4); }
`;

/**
 * Sprite quad: a soft round particle stretched along its screen-space travel during the shutter.
 * Energy is conserved through defocus, streaking and the minimum on-screen radius, so tiny or
 * blurred particles dim instead of shimmering or blowing out.
 */
export const SPRITE_VERT_GLSL = /* glsl */ `
#include <clipping_planes_pars_vertex>
varying vec2 vLocal;
varying float vHalfLen;
varying float vR;
varying float vCocFrac;
varying vec4 vColor;
varying float vHalo;
varying float vRing;
uniform float uExtent;
uniform float uEnergyExp;

// pA, pB: world positions at shutter open / close; size: world radius; col.rgb: radiance;
// col.a: bloom weight; halo: relative halo strength; ring: ring strength.
void fxSprite(vec3 pA, vec3 pB, float size, vec4 col, float halo, float ring) {
  // emitters work in their object's frame; the lens and shutter work in world space
  pA = (modelMatrix * vec4(pA, 1.0)).xyz;
  pB = (modelMatrix * vec4(pB, 1.0)).xyz;
  size *= length(modelMatrix[0].xyz);
  vec4 cA = fxClip0(pA);
  vec4 cB = fxClip1(pB);
  float w = 0.5 * (cA.w + cB.w);
  if (cA.w < uNear || cB.w < uNear || dot(col.rgb, vec3(1.0)) + col.a <= 0.0) {
    gl_Position = vec4(2.0, 2.0, 2.0, 1.0);
    vColor = vec4(0.0);
    return;
  }
  vec4 mvPosition = viewMatrix * vec4(0.5 * (pA + pB), 1.0);
  #include <clipping_planes_vertex>
  vec2 sA = fxToPx(cA);
  vec2 sB = fxToPx(cB);
  float rPx = size * fxPxPerUnit(w);
  float coc = fxCoc(w);
  float r = sqrt(rPx * rPx + coc * coc);
  float rd = max(r, uMinR);
  // 1 = physical (a defocused speck spreads its light); lower keeps out-of-focus motes visible
  float energy = pow((rPx * rPx) / (rd * rd), uEnergyExp);
  vec2 d = sB - sA;
  float L = length(d);
  vec2 ax = L > 1e-3 ? d / L : vec2(1.0, 0.0);
  vec2 ay = vec2(-ax.y, ax.x);
  float streak = 1.0 / (1.0 + 2.0 * L / (3.14159265 * rd));
  float ext = rd * max(1.7, uExtent);
  vec2 mid = 0.5 * (sA + sB);
  vec2 loc = vec2(position.x * (0.5 * L + ext), position.y * ext);
  vec2 px = mid + ax * loc.x + ay * loc.y;
  float zn = 0.5 * (cA.z / cA.w + cB.z / cB.w);
  gl_Position = vec4((px / uViewport * 2.0 - 1.0) * w, zn * w, w);
  vLocal = loc;
  vHalfLen = 0.5 * L;
  vR = rd;
  vCocFrac = clamp((coc * coc) / max(rd * rd, 1e-6), 0.0, 1.0);
  float nearFade = smoothstep(uNear, uNear * 3.0, w);
  vColor = col * energy * streak * nearFade;
  // halos and rings scale with the in-focus size, so they keep their look when the core is clamped
  vHalo = halo;
  vRing = ring;
}
`;

export const SPRITE_FRAG_GLSL = /* glsl */ `
#include <clipping_planes_pars_fragment>
varying vec2 vLocal;
varying float vHalfLen;
varying float vR;
varying float vCocFrac;
varying vec4 vColor;
varying float vHalo;
varying float vRing;
uniform float uHaloScale;
uniform float uRingRadius;
uniform float uRingWidthPx;

float fxSpriteProfile() {
  float dx = max(abs(vLocal.x) - vHalfLen, 0.0);
  float dpx = length(vec2(dx, vLocal.y));
  float dd = dpx / vR;
  // in focus: gaussian (sigma = r / 2); defocused: a disc with a soft edge and a faint rim
  float g = exp(-2.0 * dd * dd);
  float edge = clamp(1.25 / vR, 0.04, 0.5);
  float disc = 1.0 - smoothstep(1.0 - edge, 1.0, dd);
  disc *= 0.5 * (0.86 + 0.28 * smoothstep(0.45, 0.97, dd));
  float p = mix(g, disc, vCocFrac);
  if (vHalo > 0.0) {
    float hs = uHaloScale;
    p += vHalo * exp(-2.0 * dd * dd / (hs * hs)) / (hs * hs);
  }
  if (vRing > 0.0) {
    float rr = uRingRadius * vR;
    float wpx = max(uRingWidthPx, 0.75) + vCocFrac * vR * 0.6;
    float ring = exp(-0.5 * pow((dpx - rr) / wpx, 2.0));
    p += vRing * ring * (uRingWidthPx / wpx);
  }
  return p;
}
`;

/** Screen-space anti-aliased line segments with defocus, draw-on and dashes. */
export const LINE_VERT_GLSL = /* glsl */ `
#include <clipping_planes_pars_vertex>
varying vec2 vLocal;
varying float vHalfW;
varying float vLen;
varying vec4 vColor;
varying float vArcA;
varying float vArcB;
varying float vCut;
varying vec2 vDash;

// a, b: world endpoints; widthPx: in-focus width; col: radiance + bloom; cut: 0..1 fraction of
// the segment that is drawn (draw-on front), arcA / arcB: arc length at the ends; dash: (period in
// world units, duty), period 0 = solid.
void fxLine(vec3 a, vec3 b, float widthPx, vec4 col, float cut, float arcA, float arcB, vec2 dash) {
  vDash = dash;
  a = (modelMatrix * vec4(a, 1.0)).xyz;
  b = (modelMatrix * vec4(b, 1.0)).xyz;
  vec4 cA = projectionMatrix * (viewMatrix * vec4(a, 1.0));
  vec4 cB = projectionMatrix * (viewMatrix * vec4(b, 1.0));
  if (cA.w < uNear || cB.w < uNear || cut <= 0.0 || dot(col, vec4(1.0)) <= 0.0) {
    gl_Position = vec4(2.0, 2.0, 2.0, 1.0);
    vColor = vec4(0.0);
    return;
  }
  vec4 mvPosition = viewMatrix * vec4(0.5 * (a + b), 1.0);
  #include <clipping_planes_vertex>
  vec2 sA = fxToPx(cA);
  vec2 sB = fxToPx(cB);
  float w = 0.5 * (cA.w + cB.w);
  float coc = fxCoc(w);
  float wf = sqrt(widthPx * widthPx + 4.0 * coc * coc);
  float wd = max(wf, 1.0);
  float energy = widthPx / wd;
  vec2 d = sB - sA;
  float L = length(d);
  vec2 ax = L > 1e-4 ? d / L : vec2(1.0, 0.0);
  vec2 ay = vec2(-ax.y, ax.x);
  float hw = 0.5 * wd + 1.0;
  vec2 px = mix(sA, sB, position.x * 0.5 + 0.5) + ay * position.y * hw;
  float zA = cA.z / cA.w;
  float zB = cB.z / cB.w;
  float wv = mix(cA.w, cB.w, position.x * 0.5 + 0.5);
  float zn = mix(zA, zB, position.x * 0.5 + 0.5);
  gl_Position = vec4((px / uViewport * 2.0 - 1.0) * wv, zn * wv, wv);
  vLocal = vec2((position.x * 0.5 + 0.5), position.y * hw);
  vHalfW = 0.5 * wd;
  vLen = L;
  vColor = col * energy * smoothstep(uNear, uNear * 3.0, w);
  vArcA = arcA;
  vArcB = arcB;
  vCut = cut;
}
`;

export const LINE_FRAG_GLSL = /* glsl */ `
#include <clipping_planes_pars_fragment>
varying vec2 vLocal;
varying float vHalfW;
varying float vLen;
varying vec4 vColor;
varying float vArcA;
varying float vArcB;
varying float vCut;
varying vec2 vDash;

float fxLineCoverage() {
  float across = clamp(vHalfW + 0.5 - abs(vLocal.y), 0.0, 1.0);
  // the draw-on front, anti-aliased over one pixel along the segment
  float along = clamp((vCut - vLocal.x) * max(vLen, 1.0) + 0.5, 0.0, 1.0);
  float c = across * along;
  if (vDash.x > 0.0) {
    float arc = mix(vArcA, vArcB, vLocal.x);
    float f = fract(arc / vDash.x);
    float pxPerArc = max(vLen, 1e-3) / max(abs(vArcB - vArcA), 1e-6);
    float aa = min(0.25, 0.75 / max(pxPerArc * vDash.x, 1e-3));
    c *= (1.0 - smoothstep(vDash.y - aa, vDash.y + aa, f)) * smoothstep(0.0, 2.0 * aa, f);
  }
  return c;
}
`;

/** Common head for every fx vertex shader (three adds the matrices, cameraPosition, etc.). */
export const fxVertexHead = (extra = ''): string => `${HASH_GLSL}\n${LENS_GLSL}\n${extra}`;
