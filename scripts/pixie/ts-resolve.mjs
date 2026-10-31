// Node resolve hook: lets the verification load src/pixie/*.ts, whose relative
// imports have no extension (the bundler resolves them in the film build).
import {existsSync} from 'node:fs';
import {fileURLToPath} from 'node:url';

export async function resolve(specifier, context, next) {
  const relative = specifier.startsWith('./') || specifier.startsWith('../');
  if (relative && !/\.[cm]?[jt]sx?$/.test(specifier) && context.parentURL && context.parentURL.endsWith('.ts')) {
    const url = new URL(`${specifier}.ts`, context.parentURL);
    if (existsSync(fileURLToPath(url))) return next(url.href, context);
  }
  return next(specifier, context);
}
