// Chapter 10's live captures (scripts/record/shots/ch10.json; each mp4 has a .json sidecar with the
// shot, the virtual-clock start and a per-frame log). Frame-stepped at 60 fps, BT.709, CRF 17-18.
export interface Rec {
  src: string;
  size: [number, number];
  frames: number;
  url: string;
}

export const REC10 = {
  phone: {src: 'recordings/ch10-pocketos-phone.mp4', size: [780, 1688], frames: 1680, url: 'https://anwardebes.github.io/PocketOS/'},
  desktop: {src: 'recordings/ch10-pocketos-desktop.mp4', size: [2160, 1350], frames: 720, url: 'https://anwardebes.github.io/PocketOS/'},
  skill: {src: 'recordings/ch10-skillbridge.mp4', size: [2160, 1350], frames: 420, url: 'https://skill-bridge-norway.vercel.app/'},
  cyfs: {src: 'recordings/ch10-cyfs.mp4', size: [2160, 1350], frames: 780, url: 'https://cyfs.vercel.app/'},
  cookie: {src: 'recordings/ch10-cookie-galaxy.mp4', size: [2160, 1350], frames: 660, url: 'https://cookie-galaxy-two.vercel.app/'},
} satisfies Record<string, Rec>;
