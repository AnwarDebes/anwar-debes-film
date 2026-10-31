// Pitch helpers mirroring scripts/audio/sfx_synth.py, for labels and previews: which note a scale
// degree lands on in the key of the music under it.

const PC: Record<string, number> = {C: 0, D: 2, E: 4, F: 5, G: 7, A: 9, B: 11};
const MAJOR = [0, 2, 4, 5, 7, 9, 11];
// ASCII accidentals by default: none of the film's faces (Schibsted Grotesk, STIX Two Text,
// JetBrains Mono) has U+266F or U+266D, and a fallback glyph would break the type.
const SHARPS = ['C', 'C#', 'D', 'D#', 'E', 'F', 'F#', 'G', 'G#', 'A', 'A#', 'B'];
const FLATS = ['C', 'Db', 'D', 'Eb', 'E', 'F', 'Gb', 'G', 'Ab', 'A', 'Bb', 'B'];
const glyphs = (s: string): string => s.replace(/^([A-G])#/, '$1♯').replace(/^([A-G])b/, '$1♭');

const parseKey = (key: string): {pc: number; minor: boolean} => {
  const k = key.trim();
  const minor = /(minor|min|m)$/.test(k);
  const m = /^([A-Ga-g])([#b♯♭]?)/.exec(k);
  if (!m) throw new Error(`not a key: ${key}`);
  const acc = m[2] === '#' || m[2] === '♯' ? 1 : m[2] === 'b' || m[2] === '♭' ? -1 : 0;
  return {pc: (PC[m[1].toUpperCase()] + acc + 12) % 12, minor};
};

/** Pitch class of the key's major tonic (the relative major for a minor key). */
export const keyTonic = (key: string): number => {
  const {pc, minor} = parseKey(key);
  return minor ? (pc + 3) % 12 : pc;
};

/** Pitch class of the key's own root ('E minor' -> E). */
export const keyRoot = (key: string): number => parseKey(key).pc;

/** MIDI note of a scale degree, with the tonic placed nearest D of `octave` (as the synth does). */
export const degreeMidi = (degree: number, key = 'D', octave = 5): number => {
  const d = Math.max(1, Math.round(degree));
  const dRef = 12 * (octave + 1) + 2;
  const tonic = dRef + ((((keyTonic(key) - 2 + 6) % 12) + 12) % 12) - 6 + 12 * Math.floor((d - 1) / 7);
  return tonic + MAJOR[(d - 1) % 7];
};

const usesFlats = (key: string): boolean => {
  const {pc, minor} = parseKey(key);
  const major = minor ? (pc + 3) % 12 : pc;
  return /[b♭]/.test(key.trim().slice(1, 2)) || [5, 10, 3, 8, 1, 6].includes(major);
};

/** Name of a MIDI note, spelled for the key ('Eb5' in Ab major, 'F#5' in D); unicode = true gives
 * '♯'/'♭' for faces that have them. */
export const noteName = (midi: number, key = 'D', unicode = false): string => {
  const names = usesFlats(key) ? FLATS : SHARPS;
  const n = `${names[((midi % 12) + 12) % 12]}${Math.floor(midi / 12) - 1}`;
  return unicode ? glyphs(n) : n;
};

/** 'Ab major' as written, or 'A♭ major' with unicode = true. */
export const keyLabel = (key: string, unicode = false): string => (unicode ? glyphs(key.trim()) : key.trim());

export const midiHz = (m: number): number => 440 * Math.pow(2, (m - 69) / 12);
