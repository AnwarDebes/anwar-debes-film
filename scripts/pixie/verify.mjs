// Pixie parity and integrity checks.
//
//   node --experimental-strip-types scripts/pixie/verify.mjs [goldenDir]
//
// goldenDir defaults to research/pixie-golden (golden-rects.json, fsm-trace.json,
// u10/*.png, pins-k3/*.png, all recorded by running the original mascot.js).
// Exit code 0 means zero mismatches everywhere.
import {register} from 'node:module';

register('./ts-resolve.mjs', import.meta.url);
const {run} = await import('./checks.ts');
process.exit(await run(process.argv[2]));
