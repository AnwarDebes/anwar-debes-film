// Generated from the repositories at the listed commits (same tokenizer as scripts/code/highlight.mjs). Do not edit by hand.
import type {CodeDiff, CodeSnippet} from '../../../engine/code/types';
import ccimMascot from './ccim-mascot.json';
import ccimSafety from './ccim-safety.json';
import ccimBash from './ccim-bash.json';
import vscStream from './vsc-stream.json';
import vscMotion from './vsc-motion.json';

export const snippets = {
  'ccim-mascot': ccimMascot as unknown as CodeSnippet,
  'ccim-safety': ccimSafety as unknown as CodeSnippet,
  'ccim-bash': ccimBash as unknown as CodeSnippet,
  'vsc-stream': vscStream as unknown as CodeSnippet,
  'vsc-motion': vscMotion as unknown as CodeSnippet,
} as const;

export const diffs = {
} as const;

export type SnippetId = keyof typeof snippets;
export type DiffId = keyof typeof diffs;
