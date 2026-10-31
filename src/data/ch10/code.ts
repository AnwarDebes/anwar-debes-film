// Code excerpts shown in chapter 10, tokenized from the cloned repositories at the commit in each
// file's "ref" (same token classes as scripts/code/highlight.mjs). Line numbers are file lines.
import type {CodeSnippet} from '../../engine/code/types';
import mnemeHeuristic from './mneme-heuristic.json';

export const snippets10 = {
  'mneme-heuristic': mnemeHeuristic as unknown as CodeSnippet,
} as const;
