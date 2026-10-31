// Generated from the repositories at the listed commits (same tokenizer as scripts/code/highlight.mjs). Do not edit by hand.
import type {CodeDiff, CodeSnippet} from '../../../engine/code/types';
import ditmTm from './ditm-tm.json';

export const snippets = {
  'ditm-tm': ditmTm as unknown as CodeSnippet,
} as const;

export const diffs = {
} as const;

export type SnippetId = keyof typeof snippets;
export type DiffId = keyof typeof diffs;
