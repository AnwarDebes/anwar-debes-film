import type {FilmTimeline} from '../../timeline';
import {ruleLitTimes, type PlateTimes} from './walk';

// When the name plates of the places in chapters 01, 02 and 14 appear (film time, from the
// timeline). Their rule-line pins light at the same moment, in every chapter that draws the line.

export const plateTimes = (tl: FilmTimeline): PlateTimes => {
  const w = (u: string, word: string, lead = 0.1) => tl.word(u, word).start - lead;
  return {
    'AnwarDebes.github.io': tl.utt('u0107').start + 0.2,
    AnwarDebes: tl.scene('01.6').start + 0.5,
    Assignment1Cloud: w('u0121', 'cloud', 0.3),
    'WebOfEverything-': w('u0122', 'practice', 0.3),
    PROG2053: w('u0122', 'web', 0.3),
    HexGTM: w('u0123', 'Tsetlin', 0.3),
    Dynamic_Visualization: tl.scene('01.8').start + 0.4,
    DNN: tl.scene('01.9').start + 0.3,
    'Deep-Neural-Networks-Assignments': w('u0126', 'two', 0.2),
    'glassbox-lm': tl.scene('02.1').start + 0.5,
    'video-editing-skill': tl.scene('14.1').start + 0.5,
    'ai-medical-training-simulator': tl.utt('u1403').start,
    assets: tl.utt('u1404').start,
  };
};

export const ruleTimes = (tl: FilmTimeline): number[] => ruleLitTimes(tl, plateTimes(tl));
