import type {ChapterModule} from '../types';
import {chapter as ch01} from './ch01';
import {chapter as ch02} from './ch02';
import {chapter as ch03} from './ch03';
import {chapter as ch04} from './ch04';
import {chapter as ch05} from './ch05';
import {chapter as ch06} from './ch06';
import {chapter as ch07} from './ch07';
import {chapter as ch08} from './ch08';
import {chapter as ch09} from './ch09';
import {chapter as ch10} from './ch10';
import {chapter as ch11} from './ch11';
import {chapter as ch12} from './ch12';
import {chapter as ch13} from './ch13';
import {chapter as ch14} from './ch14';

// The film's chapters, in order. Each chapter lives in its own module (chNN.tsx + chNN/).
export const CHAPTERS: ChapterModule[] = [ch01, ch02, ch03, ch04, ch05, ch06, ch07, ch08, ch09, ch10, ch11, ch12, ch13, ch14];
