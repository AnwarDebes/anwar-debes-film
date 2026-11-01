"""Build the 57 Shorts on the workspace: picture from the film, sound from the Shorts master
(the same mix with the background 20 LU under the narrator), each Short normalised to -14 LUFS
with its true peak at or under -1.5 dBTP after the AAC encode, in parallel.

  python scripts/shorts/build_parallel.py [slug ...]   (env: FILM_VIDEO, SHORTS_AUDIO, FFMPEG, JOBS)
"""
import json
import os
import re
import subprocess
import sys
from multiprocessing import Pool
from pathlib import Path

import build_shorts as bs

FILM = bs.FILM
AUDIO = Path(os.environ.get("SHORTS_AUDIO", bs.ROOT / "public" / "audio" / "film-shorts" / "master.flac"))
FF = os.environ.get("FFMPEG", "ffmpeg")
TARGET_I, TARGET_TP, AAC_MARGIN = -14.0, -1.5, 0.6
ABITRATE = 192_000


def run(cmd):
    r = subprocess.run(cmd, capture_output=True, text=True)
    if r.returncode != 0:
        raise RuntimeError(r.stderr[-1500:])
    return r


def ebur(inputs, fc, out_label):
    r = subprocess.run([FF, "-hide_banner", "-nostats"] + inputs + ["-filter_complex", fc + f",ebur128=peak=true[{out_label}]",
                        "-map", f"[{out_label}]", "-f", "null", "-"], capture_output=True, text=True)
    tail = r.stderr[r.stderr.rfind("Summary:"):]
    i = re.search(r"I:\s*(-?[\d.]+)", tail)
    p = re.search(r"Peak:\s*(-?[\d.]+|-inf)", tail)
    return (float(i.group(1)) if i else float("nan")), (float(p.group(1)) if p and p.group(1) != "-inf" else -99.0)


def audio_inputs(segs):
    out = []
    for s, e in segs:
        out += ["-ss", f"{s:.3f}", "-t", f"{e - s:.3f}", "-i", str(AUDIO)]
    return out


def audio_filter(n, k0, dur, gain_db=0.0):
    if n > 1:
        pre = "".join(f"[{k0 + k}:a]" for k in range(n)) + f"concat=n={n}:v=0:a=1[ca];"
        a = "[ca]"
    else:
        pre, a = "", f"[{k0}:a]"
    fo = max(0.0, dur - 0.6)
    chain = f"afade=t=in:d=0.25,afade=t=out:st={fo:.3f}:d=0.6,aresample=48000,volume={gain_db:.2f}dB"
    return pre + a + chain


def build(args):
    idx, item = args
    slug, repos, hook, title, tags, segs = item
    out = bs.OUT / f"{idx:02d}-{slug}.mp4"
    ov = bs.overlay(slug, repos, hook)
    dur = sum(e - s for s, e in segs)
    n = len(segs)
    # pass 0: loudness of this Short's sound as it will be cut and faded
    I0, TP0 = ebur(audio_inputs(segs), audio_filter(n, 0, dur), "m")
    gain = min(TARGET_I - I0, (TARGET_TP - AAC_MARGIN) - TP0)
    inputs = []
    for s, e in segs:
        inputs += ["-ss", f"{s:.3f}", "-t", f"{e - s:.3f}", "-i", str(FILM)]
    inputs += audio_inputs(segs)
    if n > 1:
        fc = "".join(f"[{k}:v]" for k in range(n)) + f"concat=n={n}:v=1:a=0[cv];"
        v = "[cv]"
    else:
        fc, v = "", "[0:v]"
    fc += (f"{v}fps=30,scale=1080:608:flags=lanczos,setsar=1[fv];"
           f"[{2 * n}:v]format=rgba[ov];"
           f"color=c=black:s={bs.W}x{bs.H}:r=30:d={dur:.3f}[base];"
           f"[base][fv]overlay=0:{bs.VID_Y}:shortest=1[b1];"
           f"[b1][ov]overlay=0:0:shortest=1,format=yuv420p[vout];"
           + audio_filter(n, n, dur, gain) + "[aout]")
    kbps = int(min(4200, max(500, (bs.MAX_BYTES * 8 * 0.96 / dur - ABITRATE) / 1000)))
    base = [FF, "-hide_banner", "-loglevel", "error", "-y"] + inputs + ["-loop", "1", "-i", str(ov),
            "-filter_complex", fc, "-map", "[vout]", "-map", "[aout]", "-t", f"{dur:.3f}",
            "-c:v", "libx264", "-preset", "medium", "-b:v", f"{kbps}k", "-pix_fmt", "yuv420p", "-profile:v", "high",
            "-g", "60", "-threads", "6", "-c:a", "aac", "-b:a", f"{ABITRATE // 1000}k", "-movflags", "+faststart"]
    logbase = str(bs.OUT / f"x264-{slug}")
    run(base + ["-pass", "1", "-passlogfile", logbase, "-an", "-f", "mp4", "/dev/null"])
    run(base + ["-pass", "2", "-passlogfile", logbase, str(out)])
    size = out.stat().st_size
    if size > bs.MAX_BYTES:
        kbps = int(kbps * bs.MAX_BYTES / size * 0.95)
        base[base.index("-b:v") + 1] = f"{kbps}k"
        run(base + ["-pass", "2", "-passlogfile", logbase, str(out)])
        size = out.stat().st_size
    for f in bs.OUT.glob(f"x264-{slug}*"):
        f.unlink()
    I1, TP1 = ebur(["-i", str(out)], "[0:a]anull", "m")
    main = repos[0]
    links = "\n".join(f"https://github.com/AnwarDebes/{r}" for r in repos) if repos[0] != "anwar-debes-film" \
        else "https://github.com/AnwarDebes/anwar-debes-film"
    desc = (f"{hook}\n\nStar it on GitHub:\n{links}\n\nFull film, Show Its Work (49 min): {bs.FILM_URL}\n"
            f"More: https://anwardebes.github.io\n\n#shorts " + " ".join("#" + t for t in tags + ["AI", "GitHub"]))
    lead = hook if hook.endswith(("?", ".", "!")) else hook + "."
    tiktok = (lead + f" Code: github.com/AnwarDebes{'/' + main if len(repos) == 1 else ''} "
              + " ".join("#" + t for t in tags + ["AI", "coding", "tech"]))
    return {"n": idx, "slug": slug, "file": out.name, "bytes": size, "seconds": round(dur, 2), "kbps": kbps,
            "repos": repos, "hook": hook, "title": title, "description": desc, "tiktok": tiktok,
            "segments": [[round(s, 3), round(e, 3)] for s, e in segs],
            "audio": {"preLufs": round(I0, 2), "preTruePeak": round(TP0, 2), "gainDb": round(gain, 2),
                      "lufs": round(I1, 2), "truePeak": round(TP1, 2), "bitrate": ABITRATE}}


def main():
    want = set(sys.argv[1:])
    items = [(i, it) for i, it in enumerate(bs.S) if not want or it[0] in want]
    with Pool(int(os.environ.get("JOBS", "14"))) as pool:
        done = []
        for m in pool.imap_unordered(build, items):
            done.append(m)
            a = m["audio"]
            print(f"{m['file']:42} {m['seconds']:6.1f}s {m['bytes'] / 1e6:5.2f} MB  {a['lufs']:6.2f} LUFS  TP {a['truePeak']:6.2f}",
                  flush=True)
    done.sort(key=lambda x: x["n"])
    (bs.OUT / "shorts.json").write_text(json.dumps(done, indent=1, ensure_ascii=False), encoding="utf-8")
    print("SHORTS_DONE", len(done), flush=True)


if __name__ == "__main__":
    main()
