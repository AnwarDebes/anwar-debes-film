// The pin spring (k = 140, zeta = 0.72, measured from the reel) in closed form.
// A linear spring driven by target steps is a sum of step responses (identity.md d.6),
// so the height at any time is a pure function of that time.

export const SPRING_K = 140;
export const SPRING_ZETA = 0.72;
export const W0 = Math.sqrt(SPRING_K);
/** decay rate zeta * w0 */
export const SA = SPRING_ZETA * W0;
/** damped frequency */
export const WD = W0 * Math.sqrt(1 - SPRING_ZETA * SPRING_ZETA);
const SB = SPRING_ZETA / Math.sqrt(1 - SPRING_ZETA * SPRING_ZETA);

/** After this long a step response is within 2e-6 of its target. */
export const SETTLE_S = 1.6;

/** Exact unit step response. */
export const stepExact = (tau: number): number =>
  tau <= 0 ? 0 : 1 - Math.exp(-SA * tau) * (Math.cos(WD * tau) + SB * Math.sin(WD * tau));

/** Exact derivative of the step response (= impulse response), per second. */
export const stepVelocity = (tau: number): number =>
  tau <= 0 ? 0 : ((W0 * W0) / WD) * Math.exp(-SA * tau) * Math.sin(WD * tau);

// Lookup tables: linear interpolation at 0.4 ms steps is accurate to ~3e-6.
const LUT_N = 4096;
const LUT_SCALE = LUT_N / SETTLE_S;
const STEP = new Float32Array(LUT_N + 2);
for (let j = 0; j <= LUT_N + 1; j++) STEP[j] = stepExact(Math.min(j, LUT_N) / LUT_SCALE);

/** Step response via the lookup table. */
export const step = (tau: number): number => {
  if (tau <= 0) return 0;
  if (tau >= SETTLE_S) return 1;
  const f = tau * LUT_SCALE;
  const j = f | 0;
  const a = STEP[j];
  return a + (STEP[j + 1] - a) * (f - j);
};

// exp(-x) for x in [0, 12]; beyond that the easing is complete.
const EXP_MAX = 12;
const EXP_N = 4096;
const EXP_SCALE = EXP_N / EXP_MAX;
const EXPT = new Float32Array(EXP_N + 2);
for (let j = 0; j <= EXP_N + 1; j++) EXPT[j] = Math.exp(-Math.min(j, EXP_N) / EXP_SCALE);

/** 1 - exp(-tau / timeConstant), the first-order easing used for tint and glow. */
export const ease1 = (tau: number, timeConstant: number): number => {
  if (tau <= 0) return 0;
  const x = tau / timeConstant;
  if (x >= EXP_MAX) return 1;
  const f = x * EXP_SCALE;
  const j = f | 0;
  const a = EXPT[j];
  return 1 - (a + (EXPT[j + 1] - a) * (f - j));
};

/** How long a first-order easing needs before it is complete (within 6e-6). */
export const easeSettle = (timeConstant: number): number => EXP_MAX * timeConstant;

/**
 * Spring response to a target that jumps to 1 at tau = 0 and then decays as exp(-lambda tau)
 * (a press that heals). y = a [e^{-l t} - e^{-A t}(cos wd t + ((A - l)/wd) sin wd t)].
 */
export const decayResponse = (tau: number, lambda: number): number => {
  if (tau <= 0) return 0;
  const a = (W0 * W0) / (lambda * lambda - 2 * SA * lambda + W0 * W0);
  const e = Math.exp(-SA * tau);
  return a * (Math.exp(-lambda * tau) - e * (Math.cos(WD * tau) + ((SA - lambda) / WD) * Math.sin(WD * tau)));
};

/**
 * Quadrature of the spring's impulse response: h(t) = sum_j w_j x(t - tau_j) filters any input
 * x(t) through the pin spring. Weights sum to 1 (unit DC gain).
 */
export const springKernel = (n: number, spanS = 0.7): {tau: Float64Array; w: Float64Array} => {
  const tau = new Float64Array(n);
  const w = new Float64Array(n);
  // Uniform nodes integrate exactly the step response over each interval.
  const dt = spanS / n;
  let sum = 0;
  for (let j = 0; j < n; j++) {
    const a = j * dt;
    const b = (j + 1) * dt;
    tau[j] = (a + b) / 2;
    w[j] = stepExact(b) - stepExact(a);
    sum += w[j];
  }
  for (let j = 0; j < n; j++) w[j] /= sum;
  return {tau, w};
};
