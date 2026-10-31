import React from 'react';
import {font, type as typeScale} from '../tokens';
import {chrome} from './theme';
import {MONO_TEXT} from './CodeWindow';
import type {Doc} from './doc';
import {gutterLayout, type ChromeMetrics} from './metrics';
import type {NoteView, ViewState} from './cues';

// Inline callouts: a ring around the token, a connector that draws itself
// toward a label, and the label chip. Labels use the caption voice:
// Schibsted Grotesk, with *asterisk* words set as the mint STIX italic idea.

const parseLabel = (s: string): Array<{text: string; em: boolean}> =>
  s
    .split(/(\*[^*]+\*)/g)
    .filter(Boolean)
    .map((p) => (p.startsWith('*') && p.endsWith('*') ? {text: p.slice(1, -1), em: true} : {text: p, em: false}));

/** Approximate label width for layout decisions (Schibsted ~0.5 em average). */
const labelWidth = (s: string, size: number) =>
  parseLabel(s).reduce((w, p) => w + p.text.length * (p.em ? 0.47 * 1.13 : 0.5) * size, 0);

export const LabelText: React.FC<{text: string; size: number; color?: string}> = ({text, size, color = chrome.labelText}) => (
  <>
    {parseLabel(text).map((p, i) =>
      p.em ? (
        <span
          key={i}
          style={{
            fontFamily: font.serif,
            fontStyle: 'italic',
            fontWeight: 400,
            fontSize: size * font.emScale,
            letterSpacing: '-0.01em',
            color: chrome.mint,
            textShadow: `0 0 ${0.4 * size}px rgba(116,201,174,0.28)`,
          }}
        >
          {p.text}
        </span>
      ) : (
        <span key={i} style={{color}}>
          {p.text}
        </span>
      ),
    )}
  </>
);

export const Annotations: React.FC<{
  doc: Doc;
  view: ViewState;
  c: ChromeMetrics;
  width: number;
  opacity?: number;
}> = ({doc, view, c, width, opacity = 1}) => {
  if (!view.notes.length) return null;
  const {m, offsets, scroll} = view;
  const g = gutterLayout(m, doc.digits, doc.isDiff);
  const H = c.H;
  const stroke = Math.max(1, 0.00115 * H);
  const size = typeScale.bodySmall.size * H;
  const kickerSize = 0.0172 * H;
  const padX = 0.015 * H;
  const padY = 0.0085 * H;
  const rowTopOf = (i: number) => c.padTop + offsets[i] - scroll + view.rows[i].dy;

  /**
   * Where an 'end' label fits: right of every line whose glyphs it would
   * overlap, as close to the token's row as possible, inside the window.
   */
  const fitEnd = (row: number, minCol: number, chipW: number, chipH: number): {lx: number; ly: number} | null => {
    const yc = rowTopOf(row) + m.xMid;
    for (const f of [0, 0.5, -0.5, 1, -1, 1.5]) {
      const ly = yc + f * m.lh;
      const top = ly - chipH / 2 - 0.06 * m.lh;
      const bot = ly + chipH / 2 + 0.06 * m.lh;
      let col = minCol;
      for (let i = 0; i < doc.rows.length; i++) {
        if (view.rows[i].alpha * view.rows[i].height < 0.05) continue;
        const rt = rowTopOf(i);
        if (rt + m.baseline + 0.26 * m.fs <= top || rt + m.capTop - 0.05 * m.fs >= bot) continue;
        col = Math.max(col, doc.rows[i].text.length);
      }
      const lx = g.codeX + (col + 2.6) * m.cw;
      const inside = top >= -0.2 * c.padTop && bot <= c.padTop + view.viewportH + 0.8 * c.padBottom;
      if (inside && lx + chipW <= width - 0.014 * H) return {lx, ly};
    }
    return null;
  };

  return (
    <>
      {view.notes.map((n: NoteView) => {
        const row = doc.rows[n.row];
        const r = view.rows[n.row];
        const rowTop = c.padTop + offsets[n.row] - scroll + r.dy;
        const x0 = g.codeX + n.c0 * m.cw - 0.32 * m.cw;
        const x1 = g.codeX + n.c1 * m.cw + 0.32 * m.cw;
        const y0 = rowTop + m.capTop - 0.3 * m.fs;
        const y1 = rowTop + m.baseline + 0.34 * m.fs;
        const yc = (y0 + y1) / 2;
        const [ox, oy] = n.cue.offset ?? [0, 0];
        const lines = n.cue.kicker ? 2 : 1;
        const chipH = padY * 2 + size * 1.22 + (lines === 2 ? kickerSize * 1.5 : 0);
        // above/below flip when the chip would run into the header or out of the body
        let side = n.cue.side ?? 'end';
        const gapAB = 1.15 * m.lh;
        const bodyBottom = c.padTop + view.viewportH + c.padBottom;
        if (side === 'above' && y0 - gapAB - chipH + oy * H < 0.15 * c.padTop) side = 'below';
        else if (side === 'below' && y1 + gapAB + chipH + oy * H > bodyBottom - 0.15 * c.padBottom) side = 'above';
        const chipW = padX * 2 + Math.max(labelWidth(n.cue.label, size), n.cue.kicker ? n.cue.kicker.length * 0.74 * kickerSize : 0);

        // label anchor (left-middle of the chip for horizontal sides)
        let lx: number;
        let ly: number;
        let wire: string;
        // where the connector meets the ring, and the direction pointing into it
        let dot: [number, number] = [x1, yc];
        let into: [number, number] = [-1, 0];
        // under-the-line routing leaves no room for an arrowhead between rows
        let routed = false;
        if (side === 'above' || side === 'below') {
          const cx = (x0 + x1) / 2 + ox * H;
          const gapY = gapAB;
          ly = side === 'above' ? y0 - gapY - chipH / 2 + oy * H : y1 + gapY + chipH / 2 + oy * H;
          lx = cx - chipW / 2;
          const yEdge = side === 'above' ? ly + chipH / 2 : ly - chipH / 2;
          const yTok = side === 'above' ? y0 : y1;
          const mid = (yEdge + yTok) / 2;
          wire = `M ${(x0 + x1) / 2} ${yTok} C ${(x0 + x1) / 2} ${mid}, ${cx} ${mid}, ${cx} ${yEdge}`;
          dot = [(x0 + x1) / 2, yTok];
          into = side === 'above' ? [0, 1] : [0, -1];
        } else if (side === 'left') {
          lx = -0.035 * H - chipW + ox * H;
          ly = yc + oy * H;
          const end = lx + chipW;
          if (row.text.slice(0, n.c0).trim()) {
            // code precedes the token: leave through the gap under the line
            // and out past the gutter, mirroring the route used on the right
            const yGap = rowTop + 1.645 * m.fs;
            const xs = x0 + 0.55 * m.cw;
            const xe = 0.4 * m.cw;
            const rr = Math.min(0.22 * m.lh, yGap - y1);
            const d = Math.max(0.6 * m.cw, (xe - end) * 0.55);
            wire =
              `M ${xs} ${y1} L ${xs} ${yGap - rr} Q ${xs} ${yGap} ${xs - rr} ${yGap} ` +
              `L ${xe} ${yGap} C ${xe - d} ${yGap}, ${end + d} ${ly}, ${end} ${ly}`;
            dot = [xs, y1];
            into = [0, -1];
            routed = true;
          } else {
            const midX = (x0 + end) / 2;
            wire = `M ${x0} ${yc} C ${midX} ${yc}, ${midX} ${ly}, ${end} ${ly}`;
            dot = [x0, yc];
            into = [1, 0];
          }
        } else {
          // trailing , ; : . sit below the x-height line the wire runs on, so
          // they do not need the route under the line
          const after = /[^\s,;:.]/.test(row.text.slice(n.c1));
          const lineEnd = g.codeX + row.text.length * m.cw;
          const fit = side === 'end' ? fitEnd(n.row, row.text.length, chipW, chipH) : null;
          if (fit) {
            lx = fit.lx + ox * H;
            ly = fit.ly + oy * H;
          } else {
            lx = side === 'end' ? lineEnd + 2.6 * m.cw + ox * H : width + 0.035 * H + ox * H;
            ly = yc + oy * H;
          }
          if (after) {
            // code follows the token: run through the gap under the line,
            // past its end, then rise to the label; the wire never crosses code
            const yGap = rowTop + 1.645 * m.fs;
            const xs = x1 - 0.55 * m.cw;
            const xe = side === 'end' ? lineEnd + 0.7 * m.cw : width - 0.6 * m.cw;
            const rr = Math.min(0.22 * m.lh, yGap - y1);
            const d = Math.max(0.6 * m.cw, (lx - xe) * 0.55);
            wire =
              `M ${xs} ${y1} L ${xs} ${yGap - rr} Q ${xs} ${yGap} ${xs + rr} ${yGap} ` +
              `L ${xe} ${yGap} C ${xe + d} ${yGap}, ${lx - d} ${ly}, ${lx} ${ly}`;
            dot = [xs, y1];
            into = [0, -1];
            routed = true;
          } else {
            const midX = (x1 + lx) / 2;
            wire = `M ${x1} ${yc} C ${midX} ${yc}, ${midX} ${ly}, ${lx} ${ly}`;
          }
        }

        const a = n.alpha * opacity * r.focus;
        const rx = 0.2 * m.fs;
        const slide = (1 - n.label) * 0.012 * H * (side === 'left' ? 1 : side === 'right' || side === 'end' ? -1 : 0);
        const slideY = (1 - n.label) * 0.01 * H * (side === 'above' ? 1 : side === 'below' ? -1 : 0);

        return (
          <React.Fragment key={n.key}>
            <svg
              width={1}
              height={1}
              style={{position: 'absolute', left: 0, top: 0, overflow: 'visible', opacity: a}}
            >
              <rect
                x={x0}
                y={y0}
                width={x1 - x0}
                height={y1 - y0}
                rx={rx}
                fill={`rgba(116,201,174,${(0.08 * n.ring).toFixed(3)})`}
                stroke={chrome.mint}
                strokeWidth={stroke}
                pathLength={1}
                strokeDasharray="1 1"
                strokeDashoffset={1 - n.ring}
              />
              <path
                d={wire}
                fill="none"
                stroke={chrome.mint}
                strokeWidth={stroke}
                strokeLinecap="round"
                strokeOpacity={0.9}
                pathLength={1}
                strokeDasharray="1 1"
                strokeDashoffset={1 - n.wire}
              />
              {n.cue.marker === 'dot' || routed ? (
                <circle cx={dot[0]} cy={dot[1]} r={0.0026 * H * n.ring} fill={chrome.mint} />
              ) : (
                (() => {
                  // a slim arrowhead whose tip touches the ring, pointing at the token
                  const len = 0.0078 * H * n.ring;
                  const half = 0.0033 * H * n.ring;
                  const [dx, dy] = into;
                  const tx = dot[0] + dx * stroke * 0.6;
                  const ty = dot[1] + dy * stroke * 0.6;
                  const bx = tx - dx * len;
                  const by = ty - dy * len;
                  return (
                    <path
                      d={`M ${tx} ${ty} L ${bx - dy * half} ${by + dx * half} L ${bx + dx * len * 0.18} ${by + dy * len * 0.18} L ${bx + dy * half} ${by - dx * half} Z`}
                      fill={chrome.mint}
                    />
                  );
                })()
              )}
            </svg>
            <div
              style={{
                position: 'absolute',
                left: lx + slide,
                top: ly - chipH / 2 + slideY,
                height: chipH,
                boxSizing: 'border-box',
                padding: `${padY}px ${padX}px`,
                borderRadius: 0.011 * H,
                background: chrome.chipBg,
                border: `${c.border}px solid ${chrome.chipBorder}`,
                boxShadow: `0 ${0.008 * H}px ${0.024 * H}px rgba(0,0,0,0.45)`,
                opacity: a * n.label,
                whiteSpace: 'nowrap',
                display: 'flex',
                flexDirection: 'column',
                justifyContent: 'center',
              }}
            >
              {n.cue.kicker ? (
                <div
                  style={{
                    ...MONO_TEXT,
                    fontSize: kickerSize,
                    lineHeight: 1.2,
                    letterSpacing: '0.15em',
                    textTransform: 'uppercase',
                    color: chrome.labelDim,
                    marginBottom: 0.3 * kickerSize,
                  }}
                >
                  {n.cue.kicker}
                </div>
              ) : null}
              <div
                style={{
                  fontFamily: font.sans,
                  fontWeight: 500,
                  fontSize: size,
                  lineHeight: 1.22,
                  letterSpacing: '-0.01em',
                }}
              >
                <LabelText text={n.cue.label} size={size} />
              </div>
            </div>
          </React.Fragment>
        );
      })}
    </>
  );
};
