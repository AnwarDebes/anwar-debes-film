"""Build one vertical Short per repository from the film.

Each Short: the repository's stretch of the film (narration, captions and sources as in
the film), on the film's pin wall, with a hook on top and a GitHub call to action below.
Every hook restates the film's own narration for that stretch, so no claim goes beyond it.
Output: out/shorts/NN-<slug>.mp4 (1080x1920, 30 fps, under 9.5 MB) and shorts.json.
Usage: python scripts/shorts/build_shorts.py [slug ...]   (no args: all; picture and sound from the film)
       python scripts/shorts/build_parallel.py             (sound from the Shorts mix, -14 LUFS, in parallel)
Env:   FILM_VIDEO (default out/anwar-debes-film-1080p.mp4), SHORTS_OUT (default out/shorts)
"""
import json
import math
import os
import subprocess
import sys
from pathlib import Path

from PIL import Image, ImageDraw, ImageEnhance, ImageFont

HERE = Path(__file__).resolve().parent
ROOT = HERE.parent.parent
FILM = Path(os.environ.get('FILM_VIDEO', ROOT / 'out' / 'anwar-debes-film-1080p.mp4'))
WALL = HERE / 'wall.jpg'  # the film's pin wall with nothing on it
FONTS = ROOT / 'public' / 'fonts'
OUT = Path(os.environ.get('SHORTS_OUT', ROOT / 'out' / 'shorts'))
OUT.mkdir(parents=True, exist_ok=True)
FILM_URL = 'https://youtu.be/pefnyZ-oCcM'
MAX_BYTES = 9_400_000
W, H = 1080, 1920
VID_Y = 560  # top of the 1080x608 film window

GREEN = (102, 195, 167)
WHITE = (242, 242, 236)
GREY = (170, 176, 170)
GOLD = (245, 197, 66)

plan = {p['repo']: p for p in json.loads((HERE / 'plan.json').read_text(encoding='utf-8'))}


def cut(repo):
    p = plan[repo]
    return [(p['start'], p['end'])]


# slug, repos, hook (shown on screen), title (platform), tags (extra hashtags), segments
S = [
    ('show-its-work', ['anwar-debes-film'], 'This film checks its own sources',
     'A 49-minute film that checks its own sources', ['ExplainableAI', 'Portfolio'], [(0.0, 31.4)]),
    ('website', ['AnwarDebes.github.io'], 'My website: a face made of 12,420 true/false pins',
     'My website shows how a Tsetlin Machine sees a face', ['TsetlinMachine', 'WebDev'], cut('AnwarDebes.github.io')),
    ('profile', ['AnwarDebes'], 'A GitHub profile that lists the misses too',
     'My GitHub profile lists the misses too', ['GitHub', 'Portfolio'], cut('AnwarDebes')),
    ('coursework', ['Assignment1Cloud', 'WebOfEverything-', 'PROG2053', 'HexGTM', 'Dynamic_Visualization', 'DNN', 'Deep-Neural-Networks-Assignments'],
     'Where it started: the coursework', 'From coursework to Tsetlin Machines: my oldest repositories', ['ComputerScience', 'Student'], [(140.65, 189.72)]),
    ('glassbox-lm', ['glassbox-lm'], 'Can a Tsetlin Machine be a language model?',
     'Can a Tsetlin Machine be the core of a language model?', ['TsetlinMachine', 'LLM'], cut('glassbox-lm')),
    ('trace', ['trace'], 'Guarding an AI agent with rules you can read',
     'TRACE: guard an AI agent with rules you can read', ['AISafety', 'AIAgents'], cut('trace')),
    ('veritas', ['veritas'], 'A solver checks a guardrail on every input at once',
     'VERITAS: prove an AI guardrail with a solver, not just tests', ['AISafety', 'FormalMethods'], cut('veritas')),
    ('candor', ['candor'], 'How much of a decision do the concepts not explain?',
     'CANDOR measures what an explanation leaves out', ['ExplainableAI', 'DeepLearning'], cut('candor')),
    ('reins', ['reins'], 'The cheapest fix that keeps an AI agent safe',
     'REINS: repair an agent\'s action instead of blocking it', ['AISafety', 'AIAgents'], cut('reins')),
    ('thgtm', ['THGTM'], 'Giving a Tsetlin automaton a memory',
     'THGTM: a Tsetlin automaton with a fading memory', ['TsetlinMachine', 'MachineLearning'], cut('THGTM')),
    ('clausegate', ['clausegate'], 'Zero attacks got through. 30% of honest calls did.',
     'clausegate: zero attacks through, and the honest cost', ['AISafety', 'TsetlinMachine'], cut('clausegate')),
    ('clause-driven-llm', ['Clause-Driven-LLM'], 'Hand it to a person before the LLM answers',
     'Clause-Driven-LLM: escalate uncertain questions to a person', ['LLM', 'TsetlinMachine'], cut('Clause-Driven-LLM')),
    ('clause86', ['clause86'], 'The rules that actually fired in a hiring decision',
     'clause86: readable rules behind a hiring decision', ['ExplainableAI', 'TsetlinMachine'], cut('clause86')),
    ('clauseguard', ['clauseguard'], 'A fact-check prototype that says what is not done',
     'clauseguard: a fact-check prototype, honest about its targets', ['FactChecking', 'TsetlinMachine'], cut('clauseguard')),
    ('pixie', ['Claude-Code-In-Motion'], 'Meet Pixie: a coding agent you can watch',
     'Pixie acts out every step of a coding agent', ['AIAgents', 'OpenSource'], cut('Claude-Code-In-Motion')),
    ('vsclaude', ['vsclaude'], 'Watch the agent work, not its log',
     'vsclaude: a desktop editor where you watch the agent work', ['AIAgents', 'DevTools'], cut('vsclaude')),
    ('lucid', ['lucid'], 'Playing unseen games on a plain CPU',
     'LUCID: no language model, no graphics card, just a CPU', ['ARCAGI', 'AIResearch'], cut('lucid')),
    ('rl-cca', ['RL-CCA'], 'A game agent with a copy of the referee inside',
     'NEXUS: a tournament agent that copies the referee line for line', ['ReinforcementLearning', 'GameAI'], cut('RL-CCA')),
    ('tsetlin-zoo', ['tsetlin-zoo'], 'Every number with its source file',
     'tsetlin-zoo: Tsetlin Machine designs, every number sourced', ['TsetlinMachine', 'NLP'], cut('tsetlin-zoo')),
    ('subword-dep-graphtm', ['subword-dep-graphtm'], 'A document as a graph of word pieces',
     'subword-dep-graphtm: text as a graph of word pieces', ['TsetlinMachine', 'NLP'], cut('subword-dep-graphtm')),
    ('attention-distilled-graphtm', ['attention-distilled-graphtm'], 'BERT teaches a Boolean student',
     'Distilling BERT\'s attention into a Boolean model', ['TsetlinMachine', 'NLP'], cut('attention-distilled-graphtm')),
    ('decoder-attention-distill-graphtm', ['decoder-attention-distill-graphtm'], 'Three teachers, one tie',
     'Attention from a decoder: three teachers tie', ['TsetlinMachine', 'NLP'], cut('decoder-attention-distill-graphtm')),
    ('tm-llm-robustness-benchmark', ['tm-llm-robustness-benchmark'], 'Tsetlin Machine lost 27 points. BERT lost 2.',
     'When the result contradicts the hypothesis: Tsetlin Machine vs BERT', ['TsetlinMachine', 'NLP'], cut('tm-llm-robustness-benchmark')),
    ('hgtm', ['HGTM'], 'Why the lower layer learned nothing',
     'HGTM: stacking Graph Tsetlin Machines, and what went wrong', ['TsetlinMachine', 'GraphML'], cut('HGTM')),
    ('rgtm', ['RGTM'], 'One bank of automata for every hop',
     'RGTM: reusing one bank of automata for message passing', ['TsetlinMachine', 'GraphML'], cut('RGTM')),
    ('multi-hgtm', ['Multi-HGTM'], 'Adding votes: 0.73. A clause head: 0.97.',
     'Multi-HGTM: one Tsetlin Machine per view, and one on top', ['TsetlinMachine', 'GraphML'], cut('Multi-HGTM')),
    ('graphtm-cbr', ['graphtm-cbr'], 'Which smallest edit flips the verdict?',
     'graphtm-cbr: readable rules and minimal edits for molecules', ['TsetlinMachine', 'Chemistry'], cut('graphtm-cbr')),
    ('pocketos', ['PocketOS'], 'A desktop in your phone\'s browser',
     'PocketOS: a desktop simulated in a phone browser', ['WebDev', 'OpenSource'], cut('PocketOS')),
    ('mneme', ['Mneme-Education-Ecosystem'], 'Textbook in. Anki deck out.',
     'Mneme: a textbook in, an Anki deck out, with a local model', ['EdTech', 'LLM'], cut('Mneme-Education-Ecosystem')),
    ('idm', ['IDM'], 'Same question, three databases',
     'IDM: one question on three databases at once', ['Databases', 'DataEngineering'], cut('IDM')),
    ('drone-id', ['drone-id'], 'Which drone is that?',
     'drone-id: identify a drone model from a description', ['Drones', 'Python'], cut('drone-id')),
    ('skillbridgenorway', ['SkillBridgeNorway'], 'A Rust developer, matched to a nurse job',
     'SkillBridgeNorway: CV-to-job matching, tested honestly', ['Jobs', 'NLP'], cut('SkillBridgeNorway')),
    ('cyfs', ['CYFS'], 'Clone Your Favourite Song',
     'CYFS: turn a song\'s tempo, key and energy into a prompt', ['AIMusic', 'Music'], cut('CYFS')),
    ('kaleido', ['Kaleido'], 'A self-hosted studio on one graphics card',
     'Kaleido: posts, images and short videos on one GPU', ['SelfHosted', 'GenerativeAI'], cut('Kaleido')),
    ('cookie-galaxy', ['cookie-galaxy'], 'One scroll, about 5,200 particles',
     'cookie-galaxy: a scroll through 5,200 particles', ['ThreeJS', 'WebDev'], cut('cookie-galaxy')),
    ('ditm', ['DiTM'], 'A Tsetlin Machine that generates',
     'DiTM turns a Tsetlin Machine into a generator', ['TsetlinMachine', 'GenerativeAI'], cut('DiTM')),
    ('conftm', ['ConfTM'], 'Nine times in ten, even after the data shifts',
     'ConfTM: label sets that keep their coverage under drift', ['TsetlinMachine', 'Statistics'], cut('ConfTM')),
    ('robtm', ['RobTM'], 'Nearly every answer falls to one bit flip',
     'RobTM: how many bits must an attacker flip?', ['TsetlinMachine', 'AISecurity'], cut('RobTM')),
    ('cctm', ['CCTM'], 'Fairness learned from twin applicants',
     'CCTM: fair loans from counterfactual twins, with a catch', ['TsetlinMachine', 'AIFairness'], cut('CCTM')),
    ('fedtm', ['FedTM'], 'Five hospitals, one model, shared literals',
     'FedTM: five simulated hospitals train one Tsetlin Machine', ['TsetlinMachine', 'Privacy'], cut('FedTM')),
    ('lifelong-tm', ['lifelong-tm'], 'Half the forgetting, ten times the memory',
     'lifelong-tm: less forgetting, at ten times the memory', ['TsetlinMachine', 'MachineLearning'], cut('lifelong-tm')),
    ('sleeparchitect', ['SleepArchitect'], 'Every predicted minute of sleep has a cause',
     'SleepArchitect: simulate tonight\'s sleep from your day', ['Sleep', 'Simulation'], cut('SleepArchitect')),
    ('caffeinesense', ['CaffeineSense'], 'When should your last coffee be?',
     'CaffeineSense: a personal caffeine half-life', ['Coffee', 'Simulation'], cut('CaffeineSense')),
    ('hotcarwatch', ['HotCarWatch'], 'Cracking the windows buys zero minutes',
     'HotCarWatch: how fast a parked car heats up', ['Safety', 'Simulation'], cut('HotCarWatch')),
    ('smokeshield', ['SmokeShield'], 'Same wildfire smoke, five kinds of home',
     'SmokeShield: wildfire smoke indoors, five homes', ['Wildfire', 'Simulation'], cut('SmokeShield')),
    ('pipeguard', ['PipeGuard'], 'Will your pipe burst in a freeze?',
     'PipeGuard: frozen pipes, modelled hour by hour', ['Winter', 'Simulation'], cut('PipeGuard')),
    ('homejoule', ['HomeJoule'], 'Which home upgrade pays back most?',
     'HomeJoule: home upgrades ranked over 25 years', ['Energy', 'Simulation'], cut('HomeJoule')),
    ('pyropredict', ['PyroPredict'], 'Routing people around a wildfire forecast',
     'PyroPredict: evacuation routes on a synthetic grid', ['Wildfire', 'Simulation'], cut('PyroPredict')),
    ('thermoguard', ['ThermoGuard'], 'A heatwave, modelled home by home',
     'ThermoGuard: heatwave risk for homes without cooling', ['Heatwave', 'Simulation'], cut('ThermoGuard')),
    ('knotten-web', ['knotten-web'], 'No number without a source',
     'knotten-web: every number has a source button', ['WebDev', 'Architecture'], cut('knotten-web')),
    ('knotten-test', ['knotten-test'], 'Built from 27 written specifications',
     'knotten-test: a site built from 27 written specs', ['WebDev', 'Architecture'], cut('knotten-test')),
    ('knotten-test-2', ['knotten-test-2'], 'A laser-measured twin of 30 future homes',
     'knotten-test-2: a digital twin with 360 sight lines', ['DigitalTwin', 'Architecture'], cut('knotten-test-2')),
    ('small-business-sites', ['grimstad-kiosk-grill', 'Trondheim-Cookies'], 'Two small business websites',
     'A grill menu and a cookie shop: two small business sites', ['WebDev', 'SmallBusiness'],
     [(2696.6, 2702.96), (plan['Trondheim-Cookies']['start'], plan['Trondheim-Cookies']['end'])]),
    ('ballast', ['ballast'], 'The language model proposes. Risk decides.',
     'ballast: an LLM may propose trades, never place them', ['AlgoTrading', 'LLM'], cut('ballast')),
    ('hugin', ['hugin'], '90 days on paper before going live',
     'hugin: a strategy has to earn live trading', ['AlgoTrading', 'Python'], cut('hugin')),
    ('goblin', ['Goblin'], 'A trading system honest about its edge',
     'Goblin: a trading system that admits it has no edge', ['AlgoTrading', 'Python'], cut('Goblin')),
    ('video-editing-skill', ['video-editing-skill'], 'Video editing with a definition of done',
     'A video editing playbook with a definition of done', ['VideoEditing', 'Workflow'], cut('video-editing-skill')),
]


def font(name, size, var=None):
    f = ImageFont.truetype(str(FONTS / name), size)
    if var:
        f.set_variation_by_name(var)
    return f


F_HOOK = font('SchibstedGrotesk-VF.ttf', 78, 'Bold')
F_LABEL = font('JetBrainsMono-VF.ttf', 34, 'Medium')
F_CTA = font('SchibstedGrotesk-VF.ttf', 50, 'SemiBold')
F_URL = font('JetBrainsMono-VF.ttf', 34, 'Regular')
F_SMALL = font('SchibstedGrotesk-VF.ttf', 34, 'Regular')


def wrap(draw, text, f, width):
    words, lines, cur = text.split(), [], ''
    for w in words:
        t = (cur + ' ' + w).strip()
        if draw.textlength(t, font=f) <= width or not cur:
            cur = t
        else:
            lines.append(cur); cur = w
    if cur:
        lines.append(cur)
    return lines


def star(draw, cx, cy, r, fill):
    pts = []
    for i in range(10):
        a = -math.pi / 2 + i * math.pi / 5
        rr = r if i % 2 == 0 else r * 0.42
        pts.append((cx + rr * math.cos(a), cy + rr * math.sin(a)))
    draw.polygon(pts, fill=fill)


_bg = None


def background():
    global _bg
    if _bg is None:
        wall = Image.open(WALL).convert('RGB')
        sc = H / wall.size[1]
        wall = wall.resize((round(wall.size[0] * sc), H), Image.LANCZOS)
        x0 = (wall.size[0] - W) // 2
        _bg = ImageEnhance.Brightness(wall.crop((x0, 0, x0 + W, H))).enhance(0.55)
    return _bg.copy()


def overlay(slug, repos, hook):
    """Full 1080x1920 background with text; the film window is cut out as transparent."""
    img = background().convert('RGBA')
    d = ImageDraw.Draw(img)
    margin = 72
    label = repos[0] if len(repos) == 1 else f'{len(repos)} repositories'
    if repos[0] == 'anwar-debes-film':
        label = 'Show Its Work'
    d.text((margin, 150), label, font=F_LABEL, fill=GREEN)
    lines = wrap(d, hook, F_HOOK, W - 2 * margin)[:3]
    y = 204
    for ln in lines:
        d.text((margin, y), ln, font=F_HOOK, fill=WHITE)
        y += 92
    # film window
    d.rectangle((0, VID_Y, W, VID_Y + 608), fill=(0, 0, 0, 0))
    # call to action, kept clear of the platforms' bottom and right-hand buttons
    cy = VID_Y + 608 + 56
    star(d, margin + 26, cy + 30, 26, GOLD)
    d.text((margin + 66, cy), 'Star it on GitHub', font=F_CTA, fill=WHITE)
    cy += 78
    if repos[0] == 'anwar-debes-film':
        url_lines = ['github.com/AnwarDebes/', 'anwar-debes-film']
    elif len(repos) == 1:
        url_lines = ['github.com/AnwarDebes/', repos[0]]
    else:
        url_lines = ['github.com/AnwarDebes', '']
    for ul in url_lines:
        if ul:
            d.text((margin, cy), ul, font=F_URL, fill=GREEN)
            cy += 46
    cy += 18
    d.text((margin, cy), 'Full film: Show Its Work, on my channel', font=F_SMALL, fill=GREY)
    path = OUT / f'{slug}-overlay.png'
    img.save(path)
    return path


def run(cmd):
    r = subprocess.run(cmd, capture_output=True, text=True)
    if r.returncode != 0:
        raise RuntimeError(r.stderr[-1500:])
    return r


def build(idx, item):
    slug, repos, hook, title, tags, segs = item
    out = OUT / f'{idx:02d}-{slug}.mp4'
    ov = overlay(slug, repos, hook)
    dur = sum(e - s for s, e in segs)
    inputs, parts = [], []
    for k, (s, e) in enumerate(segs):
        inputs += ['-ss', f'{s:.3f}', '-t', f'{e - s:.3f}', '-i', str(FILM)]
        parts.append(f'[{k}:v][{k}:a]')
    n = len(segs)
    fc = ''
    if n > 1:
        fc += ''.join(parts) + f'concat=n={n}:v=1:a=1[cv][ca];'
        v, a = '[cv]', '[ca]'
    else:
        v, a = '[0:v]', '[0:a]'
    fade_out = max(0.0, dur - 0.6)
    fc += (f'{v}fps=30,scale=1080:608:flags=lanczos,setsar=1[fv];'
           f'[{n}:v]format=rgba[ov];'
           f'color=c=black:s={W}x{H}:r=30:d={dur:.3f}[base];'
           f'[base][fv]overlay=0:{VID_Y}:shortest=1[b1];'
           f'[b1][ov]overlay=0:0:shortest=1,format=yuv420p[vout];'
           f'{a}afade=t=in:d=0.25,afade=t=out:st={fade_out:.3f}:d=0.6,aresample=48000[aout]')
    kbps = int(min(4200, max(500, (MAX_BYTES * 8 * 0.96 / dur - 128_000) / 1000)))
    base = ['ffmpeg', '-hide_banner', '-loglevel', 'error', '-y'] + inputs + ['-loop', '1', '-i', str(ov),
            '-filter_complex', fc, '-map', '[vout]', '-map', '[aout]', '-t', f'{dur:.3f}',
            '-c:v', 'libx264', '-preset', 'medium', '-b:v', f'{kbps}k', '-pix_fmt', 'yuv420p', '-profile:v', 'high',
            '-g', '60', '-c:a', 'aac', '-b:a', '128k', '-movflags', '+faststart']
    logbase = str(OUT / f'x264-{slug}')
    run(base + ['-pass', '1', '-passlogfile', logbase, '-an', '-f', 'mp4', 'NUL'])
    run(base + ['-pass', '2', '-passlogfile', logbase, str(out)])
    size = out.stat().st_size
    if size > MAX_BYTES:
        kbps = int(kbps * MAX_BYTES / size * 0.95)
        base[base.index('-b:v') + 1] = f'{kbps}k'
        run(base + ['-pass', '2', '-passlogfile', logbase, str(out)])
        size = out.stat().st_size
    for f in OUT.glob(f'x264-{slug}*'):
        f.unlink()
    main = repos[0]
    links = '\n'.join(f'github.com/AnwarDebes/{r}' for r in repos) if repos[0] != 'anwar-debes-film' else 'github.com/AnwarDebes/anwar-debes-film'
    desc = (f'{hook}\n\nStar it on GitHub:\n{links}\n\nFull film, Show Its Work (49 min): {FILM_URL}\n'
            f'More: https://anwardebes.github.io\n\n#shorts ' + ' '.join('#' + t for t in tags + ['AI', 'GitHub']))
    return {'n': idx, 'slug': slug, 'file': out.name, 'bytes': size, 'seconds': round(dur, 2), 'kbps': kbps,
            'repos': repos, 'hook': hook, 'title': title, 'description': desc,
            'tiktok': (hook if hook.endswith(('?', '.', '!')) else hook + '.')
                      + f' Code: github.com/AnwarDebes{"/" + main if len(repos) == 1 else ""} '
                      + ' '.join('#' + t for t in tags + ['AI', 'coding', 'tech'])}


def main():
    want = set(sys.argv[1:])
    manifest_path = OUT / 'shorts.json'
    done = {m['slug']: m for m in json.loads(manifest_path.read_text(encoding='utf-8'))} if manifest_path.exists() else {}
    for i, item in enumerate(S):
        if want and item[0] not in want:
            continue
        if not want and item[0] in done and (OUT / done[item[0]]['file']).exists():
            continue
        m = build(i, item)
        done[m['slug']] = m
        print(f"{m['file']:42} {m['seconds']:6.1f}s {m['bytes'] / 1e6:5.2f} MB {m['kbps']}k", flush=True)
        manifest_path.write_text(json.dumps(sorted(done.values(), key=lambda x: x['n']), indent=1, ensure_ascii=False), encoding='utf-8')
    print('SHORTS_DONE', len(done), flush=True)


if __name__ == '__main__':
    main()
