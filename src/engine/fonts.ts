import {loadFont} from '@remotion/fonts';
import {continueRender, delayRender, staticFile} from 'remotion';

// Fonts load once, before the first frame of any composition.
const faces: Array<{family: string; file: string; weight: string; style: 'normal' | 'italic'}> = [
  {family: 'Schibsted Grotesk', file: 'fonts/SchibstedGrotesk-VF.ttf', weight: '400 900', style: 'normal'},
  {family: 'Schibsted Grotesk', file: 'fonts/SchibstedGrotesk-Italic-VF.ttf', weight: '400 900', style: 'italic'},
  {family: 'STIX Two Text', file: 'fonts/STIXTwoText-VF.ttf', weight: '400 700', style: 'normal'},
  {family: 'STIX Two Text', file: 'fonts/STIXTwoText-Italic-VF.ttf', weight: '400 700', style: 'italic'},
  {family: 'JetBrains Mono', file: 'fonts/JetBrainsMono-VF.ttf', weight: '100 800', style: 'normal'},
];

let loaded: Promise<void> | null = null;

export const ensureFonts = (): Promise<void> => {
  if (!loaded) {
    const handle = delayRender('Loading film fonts');
    loaded = Promise.all(
      faces.map((f) =>
        loadFont({family: f.family, url: staticFile(f.file), weight: f.weight, style: f.style, format: 'truetype'}),
      ),
    )
      .then(() => continueRender(handle))
      .catch((err) => {
        continueRender(handle);
        throw err;
      });
  }
  return loaded;
};

ensureFonts();
