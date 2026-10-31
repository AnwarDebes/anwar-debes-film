import type {ChapterSpec} from '../../../types';

// A chapter is built scene by scene; each scene returns a partial spec and they are concatenated.

export type PartSpec = Partial<ChapterSpec>;

export const mergeParts = (...parts: PartSpec[]): ChapterSpec => {
  const out: ChapterSpec = {beats: [], camera: [], focus: [], light: [], ripples: [], magnets: [], presses: [], live: [], world: [], overlays: [], captionSkip: [], pixie: []};
  for (const p of parts) {
    out.beats.push(...(p.beats ?? []));
    out.camera.push(...(p.camera ?? []));
    out.focus!.push(...(p.focus ?? []));
    out.light!.push(...(p.light ?? []));
    out.ripples!.push(...(p.ripples ?? []));
    out.magnets!.push(...(p.magnets ?? []));
    out.presses!.push(...(p.presses ?? []));
    out.live!.push(...(p.live ?? []));
    out.world!.push(...(p.world ?? []));
    out.overlays!.push(...(p.overlays ?? []));
    out.captionSkip!.push(...(p.captionSkip ?? []));
    out.pixie!.push(...(p.pixie ?? []));
  }
  out.beats.sort((a, b) => a.at - b.at);
  out.camera.sort((a, b) => a.at - b.at);
  return out;
};
