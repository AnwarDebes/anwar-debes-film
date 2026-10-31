// --import hook: lets Node load the engine's .ts modules, whose relative imports have no extension.
import {register} from 'node:module';

register('./ts-resolve.mjs', import.meta.url);
