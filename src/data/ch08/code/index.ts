// Code panels of chapter 08: real file lines at the pinned commits (startLine is the real line number).
import type {CodeSnippet} from '../../../engine/code/types';
import lucidAgent from './lucid-agent.json';
import lucidScores from './lucid-scores.json';
import lucidTest from './lucid-test.json';
import rlccaGame from './rlcca-game.json';
import rlccaTeacher from './rlcca-teacher.json';

export const snippets = {
  'lucid-agent': lucidAgent as unknown as CodeSnippet,
  'lucid-scores': lucidScores as unknown as CodeSnippet,
  'lucid-test': lucidTest as unknown as CodeSnippet,
  'rlcca-game': rlccaGame as unknown as CodeSnippet,
  'rlcca-teacher': rlccaTeacher as unknown as CodeSnippet,
} as const;
