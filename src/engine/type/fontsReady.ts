import {useEffect, useLayoutEffect, useRef, useState} from 'react';
import {useDelayRender} from 'remotion';
import {ensureFonts} from '../fonts';

// Text layout is measured in the DOM. A measurement taken before the film
// fonts are loaded would use a fallback face (and @remotion/layout-utils
// would cache it), so every component that measures waits for this gate.

let ready = false;
let pending: Promise<void> | null = null;

const whenReady = (): Promise<void> => {
  if (!pending) {
    pending = ensureFonts().then(() => {
      ready = true;
    });
  }
  return pending;
};

export const fontsAreReady = (): boolean => ready;

/**
 * True once the film fonts are loaded. Until then the frame is held with
 * delayRender, and it is released only after the measured layout commits.
 */
export const useFontsReady = (): boolean => {
  const {delayRender, continueRender} = useDelayRender();
  const [isReady, setReady] = useState<boolean>(ready);
  const handle = useRef<number | null>(null);

  useLayoutEffect(() => {
    if (isReady) return undefined;
    handle.current = delayRender('engine/type: waiting for film fonts');
    let alive = true;
    whenReady().then(
      () => {
        if (alive) setReady(true);
      },
      () => {
        if (alive) setReady(true);
      },
    );
    return () => {
      alive = false;
      if (handle.current !== null) {
        continueRender(handle.current);
        handle.current = null;
      }
    };
    // Runs once per mount; the state only ever flips from false to true.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  useEffect(() => {
    if (isReady && handle.current !== null) {
      continueRender(handle.current);
      handle.current = null;
    }
  }, [isReady, continueRender]);

  return isReady;
};
