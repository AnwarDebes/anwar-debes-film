import type {ChapterModule} from '../../types';
import {placeholderChapter} from '../placeholder';
import {chapter as ch10} from '../ch10';
import {chapter as ch13} from '../ch13';

// A chapter list for previewing chapters 10 and 13 on their own: a private preview bundle swaps
// the film's list (chapters/index.ts) for this one, so work in progress elsewhere cannot block
// these renders. The film itself never imports this file.
export const CHAPTERS: ChapterModule[] = ['01', '02', '03', '04', '05', '06', '07', '08', '09', '10', '11', '12', '13', '14'].map((id) =>
  id === '10' ? ch10 : id === '13' ? ch13 : placeholderChapter(id),
);
