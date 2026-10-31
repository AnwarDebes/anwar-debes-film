import type * as THREE from 'three';

/**
 * Remembers the inputs of the last pass so identical work can be skipped (sub-frames of a still
 * camera, nested renders). It only compares numbers; it never changes what a pass draws.
 */
export class InputKey {
  private readonly last: Float64Array;
  private readonly next: Float64Array;
  private n = 0;
  private valid = false;
  constructor(capacity = 96) {
    this.last = new Float64Array(capacity);
    this.next = new Float64Array(capacity);
  }
  begin(): this {
    this.n = 0;
    return this;
  }
  num(x: number): this {
    if (this.n < this.next.length) this.next[this.n] = x;
    this.n++;
    return this;
  }
  mat(m: THREE.Matrix4): this {
    const e = m.elements;
    for (let i = 0; i < 16; i++) this.num(e[i]);
    return this;
  }
  /** True when the inputs differ from the last committed set (and commits them). */
  changed(): boolean {
    const n = Math.min(this.n, this.next.length);
    let diff = !this.valid || this.n > this.next.length;
    if (!diff) {
      for (let i = 0; i < n; i++) {
        if (this.last[i] !== this.next[i]) {
          diff = true;
          break;
        }
      }
    }
    if (diff) {
      this.last.set(this.next.subarray(0, n));
      this.valid = this.n <= this.next.length;
    }
    return diff;
  }
  invalidate() {
    this.valid = false;
  }
}
