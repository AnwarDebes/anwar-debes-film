// --import hook: resolve the extensionless relative imports of src/pixie/*.ts in Node.
import {register} from 'node:module';

register('./ts-resolve.mjs', import.meta.url);
