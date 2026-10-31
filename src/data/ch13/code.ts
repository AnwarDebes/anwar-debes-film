// Code excerpts shown in chapter 13, tokenized from the cloned repositories at the commit in each
// file's "ref" (same token classes as scripts/code/highlight.mjs). Line numbers are file lines.
import type {CodeSnippet} from '../../engine/code/types';
import knottenSource from './knotten-source.json';
import ballastTestRisk from './ballast-test-risk.json';

export const snippets13 = {
  'knotten-source': knottenSource as unknown as CodeSnippet,
  'ballast-test-risk': ballastTestRisk as unknown as CodeSnippet,
} as const;
