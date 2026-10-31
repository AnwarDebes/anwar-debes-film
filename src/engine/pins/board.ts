// The hex pin board (identity.md d.1). Board width is 1 world unit; pins point at +Z.
// Pure and cached: the same spec always returns the same Board object.

const SQ3 = Math.sqrt(3);

export interface BoardSpec {
  /** Pins in an even row. Odd rows hold cols - 1 pins, offset by half a pitch. */
  cols: number;
  /** Number of rows. Takes precedence over aspect. */
  rows?: number;
  /** Board height / width, used when rows is not given (site formula). Default 1. */
  aspect?: number;
}

export interface Board {
  readonly key: string;
  readonly cols: number;
  readonly rows: number;
  /** Pin count. */
  readonly N: number;
  /** Nearest-neighbour pitch in world units (board width = 1). */
  readonly p: number;
  readonly rowH: number;
  /** Board height in world units (row span plus one pitch). */
  readonly extH: number;
  /** Pin centres, board-local world units: x in (-0.5, 0.5), y in (-extH/2, extH/2). */
  readonly x: Float32Array;
  readonly y: Float32Array;
  /** uv in 0..1 (v up). */
  readonly u: Float32Array;
  readonly v: Float32Array;
  readonly row: Uint16Array;
  readonly col: Uint16Array;
  /** Index of the first pin of row r; rowStart[rows] = N. */
  readonly rowStart: Int32Array;
  /** Six neighbour indices per pin, -1 where the board ends. */
  readonly nb: Int32Array;
  readonly nbCount: Uint8Array;
}

const cache = new Map<string, Board>();

export const makeBoard = (spec: BoardSpec): Board => {
  const cols = Math.max(2, Math.round(spec.cols));
  const p = 1 / cols;
  const rowH = (p * SQ3) / 2;
  const rows =
    spec.rows !== undefined
      ? Math.max(2, Math.round(spec.rows))
      : Math.max(2, Math.round(((spec.aspect ?? 1) - p) / rowH) + 1);
  const key = `${cols}x${rows}`;
  const hit = cache.get(key);
  if (hit) return hit;

  const extH = (rows - 1) * rowH + p;
  const span = (rows - 1) * rowH;
  const rowStart = new Int32Array(rows + 1);
  let N = 0;
  for (let r = 0; r < rows; r++) {
    rowStart[r] = N;
    N += r % 2 === 1 ? cols - 1 : cols;
  }
  rowStart[rows] = N;

  const x = new Float32Array(N);
  const y = new Float32Array(N);
  const u = new Float32Array(N);
  const v = new Float32Array(N);
  const row = new Uint16Array(N);
  const col = new Uint16Array(N);
  for (let r = 0; r < rows; r++) {
    const odd = r % 2 === 1;
    const n = rowStart[r + 1] - rowStart[r];
    const yy = -span / 2 + r * rowH;
    for (let c = 0; c < n; c++) {
      const i = rowStart[r] + c;
      const xx = -0.5 + p / 2 + c * p + (odd ? p / 2 : 0);
      x[i] = xx;
      y[i] = yy;
      u[i] = xx + 0.5;
      v[i] = (yy + extH / 2) / extH;
      row[i] = r;
      col[i] = c;
    }
  }

  // same row c +- 1; rows r +- 1 at columns (odd ? [c, c+1] : [c-1, c])
  const nb = new Int32Array(N * 6).fill(-1);
  const nbCount = new Uint8Array(N);
  for (let r = 0; r < rows; r++) {
    const odd = r % 2 === 1;
    const n = rowStart[r + 1] - rowStart[r];
    for (let c = 0; c < n; c++) {
      const i = rowStart[r] + c;
      let k = 0;
      const add = (rr: number, cc: number) => {
        if (rr < 0 || rr >= rows) return;
        const nn = rowStart[rr + 1] - rowStart[rr];
        if (cc < 0 || cc >= nn) return;
        nb[i * 6 + k++] = rowStart[rr] + cc;
      };
      add(r, c - 1);
      add(r, c + 1);
      const d0 = odd ? 0 : -1;
      add(r - 1, c + d0);
      add(r - 1, c + d0 + 1);
      add(r + 1, c + d0);
      add(r + 1, c + d0 + 1);
      nbCount[i] = k;
    }
  }

  const board: Board = {key, cols, rows, N, p, rowH, extH, x, y, u, v, row, col, rowStart, nb, nbCount};
  cache.set(key, board);
  return board;
};

/** Board-local world position of a uv point. */
export const uvToWorld = (b: Board, u: number, v: number): [number, number] => [u - 0.5, v * b.extH - b.extH / 2];

/** uv of a board-local world point. */
export const worldToUv = (b: Board, x: number, y: number): [number, number] => [x + 0.5, (y + b.extH / 2) / b.extH];

/** Distance between two uv points in board widths (v is scaled by the board height). */
export const uvDistance = (b: Board, u0: number, v0: number, u1: number, v1: number): number =>
  Math.hypot(u1 - u0, (v1 - v0) * b.extH);

/** Index of the pin nearest to a uv point. */
export const pinAt = (b: Board, u: number, v: number): number => {
  const yy = v * b.extH - b.extH / 2;
  const span = (b.rows - 1) * b.rowH;
  const rf = (yy + span / 2) / b.rowH;
  let best = 0;
  let bestD = Infinity;
  const r0 = Math.max(0, Math.min(b.rows - 1, Math.floor(rf)));
  for (let r = Math.max(0, r0 - 1); r <= Math.min(b.rows - 1, r0 + 2); r++) {
    const odd = r % 2 === 1;
    const n = b.rowStart[r + 1] - b.rowStart[r];
    const xx = u - 0.5;
    const cf = (xx + 0.5 - b.p / 2 - (odd ? b.p / 2 : 0)) / b.p;
    const c0 = Math.max(0, Math.min(n - 1, Math.round(cf)));
    for (let c = Math.max(0, c0 - 1); c <= Math.min(n - 1, c0 + 1); c++) {
      const i = b.rowStart[r] + c;
      const d = (b.x[i] - xx) ** 2 + (b.y[i] - yy) ** 2;
      if (d < bestD) {
        bestD = d;
        best = i;
      }
    }
  }
  return best;
};

/** Row range [r0, r1] whose pins can lie inside the v interval [v0, v1], written into `out`. */
export const rowsInVInto = (b: Board, v0: number, v1: number, out: Int32Array): Int32Array => {
  const span = (b.rows - 1) * b.rowH;
  const lo = v0 < v1 ? v0 : v1;
  const hi = v0 < v1 ? v1 : v0;
  out[0] = Math.max(0, Math.floor((lo * b.extH - b.extH / 2 + span / 2) / b.rowH));
  out[1] = Math.min(b.rows - 1, Math.ceil((hi * b.extH - b.extH / 2 + span / 2) / b.rowH));
  return out;
};

/** Column range [c0, c1] of row r whose pins can lie inside the u interval [u0, u1], into `out`. */
export const colsInUInto = (b: Board, r: number, u0: number, u1: number, out: Int32Array): Int32Array => {
  const n = b.rowStart[r + 1] - b.rowStart[r];
  const off = b.p / 2 + (r % 2 === 1 ? b.p / 2 : 0);
  const lo = u0 < u1 ? u0 : u1;
  const hi = u0 < u1 ? u1 : u0;
  out[0] = Math.max(0, Math.floor((lo - off) / b.p));
  out[1] = Math.min(n - 1, Math.ceil((hi - off) / b.p));
  return out;
};

const _range = new Int32Array(2);

/** Row range [r0, r1] whose pins can lie inside the v interval [v0, v1]. */
export const rowsInV = (b: Board, v0: number, v1: number): [number, number] => {
  rowsInVInto(b, v0, v1, _range);
  return [_range[0], _range[1]];
};

/** Column range [c0, c1] of row r whose pins can lie inside the u interval [u0, u1]. */
export const colsInU = (b: Board, r: number, u0: number, u1: number): [number, number] => {
  colsInUInto(b, r, u0, u1, _range);
  return [_range[0], _range[1]];
};

/** Indices of all pins inside a uv box, row-major. */
export const pinsInBox = (b: Board, u0: number, v0: number, u1: number, v1: number): Int32Array => {
  const out: number[] = [];
  const [r0, r1] = rowsInV(b, v0, v1);
  const ua = Math.min(u0, u1);
  const ub = Math.max(u0, u1);
  const va = Math.min(v0, v1);
  const vb = Math.max(v0, v1);
  for (let r = r0; r <= r1; r++) {
    const [c0, c1] = colsInU(b, r, ua, ub);
    for (let c = c0; c <= c1; c++) {
      const i = b.rowStart[r] + c;
      if (b.u[i] >= ua && b.u[i] <= ub && b.v[i] >= va && b.v[i] <= vb) out.push(i);
    }
  }
  return Int32Array.from(out);
};

/** The film wall: about 22k pins, 20% overscan around a 145-pin-wide frame at the base framing. */
export const FILM_WALL: BoardSpec = {cols: 176, rows: 126};
