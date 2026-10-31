// Code panels of chapter 06: real file lines at the pinned commits (startLine is the real line number).
import type {CodeSnippet} from '../../../engine/code/types';
import reinsShield from './reins-shield.json';
import thgtmEtta from './thgtm-etta.json';

export const snippets = {
  'reins-shield': reinsShield as unknown as CodeSnippet,
  'thgtm-etta': thgtmEtta as unknown as CodeSnippet,
} as const;
