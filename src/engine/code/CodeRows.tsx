import React, {useId} from 'react';
import {codeTheme, chrome, mixHex, removedTint} from './theme';
import {MONO_TEXT} from './CodeWindow';
import {sliceTokens, type Doc} from './doc';
import {gutterLayout, type ChromeMetrics} from './metrics';
import type {ViewState} from './cues';

// One page of code: line numbers, diff signs, highlight washes and bars, the
// tokens themselves and the typing caret. Rows outside the viewport are not
// rendered. Text is laid out on the monospace grid from computed metrics.

const alphaOf = (rgba: string, k: number) => rgba.replace(/[\d.]+\)$/, (a) => `${(parseFloat(a) * k).toFixed(4)})`);

export const CodeRows: React.FC<{
  doc: Doc;
  view: ViewState;
  c: ChromeMetrics;
  width: number;
  opacity?: number;
  /** vertical drift of the whole page in px (page transitions) */
  drift?: number;
  /** composition frame rate (sets the motion-blur shutter) */
  fps?: number;
}> = ({doc, view, c, width, opacity = 1, drift = 0, fps = 60}) => {
  const {m, offsets, scroll, viewportH, rows} = view;
  const g = gutterLayout(m, doc.digits, doc.isDiff);
  const blurId = `code-mb-${useId().replace(/[^a-zA-Z0-9_-]/g, '')}`;
  // vertical motion blur while scrolling fast: a 180 degree shutter smears a
  // line over half a frame of travel (sigma ~0.29 of that length)
  const motionSigma = Math.min(0.3 * m.lh, view.scrollSpeed * (0.5 / fps) * 0.29);
  // The clip spans the paddings too: rows scrolled half out of view fade
  // inside the padding, rows fully in view are never touched by the fade.
  const top = c.padTop;
  const total = c.padTop + viewportH + c.padBottom;

  // At rest the viewport edge is exact; while scrolling, lines glide through
  // the padding with a soft fade instead of being cut.
  const maxScroll = Math.max(0, view.contentH - viewportH);
  const mu = view.edgeSoft;
  // at rest an exact rectangular clip does the same job far more cheaply
  const restClip = maxScroll > 0.5 && mu < 0.005 ? `inset(${top}px 0px ${c.padBottom}px 0px)` : undefined;
  const vMask =
    maxScroll > 0.5 && !restClip
      ? `linear-gradient(180deg, rgba(0,0,0,0) 0px, rgba(0,0,0,${mu.toFixed(3)}) ${top - 0.5}px, #000 ${top}px, ` +
        `#000 ${top + viewportH}px, rgba(0,0,0,${mu.toFixed(3)}) ${top + viewportH + 0.5}px, rgba(0,0,0,0) ${total}px)`
      : null;
  // a soft right edge, only when a visible line runs past the window
  let widest = 0;
  for (let i = 0; i < doc.rows.length; i++) {
    const y = offsets[i] - scroll;
    if (y > viewportH || y + m.lh < 0 || rows[i].alpha * rows[i].height < 0.02) continue;
    widest = Math.max(widest, doc.rows[i].text.length);
  }
  const overflow = g.codeX + widest * m.cw > width - 0.6 * m.cw;
  const hMask = overflow ? `linear-gradient(90deg, #000 ${width - 3.2 * m.cw}px, transparent ${width - 0.4 * m.cw}px)` : null;
  const mask = vMask && hMask ? `${vMask}, ${hMask}` : (vMask ?? hMask ?? undefined);
  const maskComposite = vMask && hMask ? {WebkitMaskComposite: 'source-in', maskComposite: 'intersect'} : {};

  const mono: React.CSSProperties = {...MONO_TEXT, fontSize: m.fs, lineHeight: `${m.lh}px`, height: m.lh};
  const items: React.ReactNode[] = [];

  for (let i = 0; i < doc.rows.length; i++) {
    const row = doc.rows[i];
    const r = rows[i];
    const y = top + offsets[i] - scroll;
    if (y > total || y + m.lh < 0) continue;
    const h = r.height * m.lh;
    if (h < 0.5 && r.alpha < 0.01) continue;
    const vis = r.alpha * r.focus;
    const blur = r.blur + r.focusBlur;
    const filter = blur > 0.05 ? `blur(${blur.toFixed(2)}px)` : undefined;

    // washes
    let wash: string | undefined;
    if (row.kind === '-' && r.del > 0) wash = alphaOf(chrome.delWash, r.del * (1 - r.settle));
    if (row.kind === '+' && r.add > 0) wash = alphaOf(chrome.addWash, r.add * (1 - r.settle));
    const hlWash = r.hl > 0 ? alphaOf(chrome.mintWash, r.hl) : undefined;

    // numbers
    const numColor = mixHex(chrome.gutter, chrome.gutterActive, r.hl);
    const numbers: Array<[string, number]> = [];
    if (!doc.isDiff) numbers.push([String(row.line), 1]);
    else {
      const a = row.a !== undefined ? String(row.a) : '';
      const b = row.b !== undefined ? String(row.b) : '';
      if (row.kind === '-') numbers.push([a, 1]);
      else if (row.kind === '+') numbers.push([b, view.numberMix]);
      else if (a === b) numbers.push([a, 1]);
      else numbers.push([a, 1 - view.numberMix], [b, view.numberMix]);
    }

    const tokens = sliceTokens(row.tokens, r.chars);
    const textW = row.text.length * m.cw;
    let codeMask: string | undefined;
    if (r.wipe < 1) {
      const soft = 4 * m.cw;
      const edge = (textW + soft) * r.wipe;
      codeMask = `linear-gradient(90deg, #000 ${edge - soft}px, transparent ${edge}px)`;
    }

    items.push(
      <div key={row.key} style={{position: 'absolute', left: 0, top: y, width, height: Math.max(0, h)}}>
        {wash ? <div style={{position: 'absolute', inset: 0, background: wash}} /> : null}
        {hlWash ? <div style={{position: 'absolute', inset: 0, background: hlWash}} /> : null}
        {r.emphAlpha > 0.01
          ? r.emph.map(([c0, c1], k) => (
              <div
                key={k}
                style={{
                  position: 'absolute',
                  left: g.codeX + c0 * m.cw - 0.12 * m.cw,
                  top: m.capTop - 0.24 * m.fs + r.dy,
                  width: (c1 - c0 + 0.24) * m.cw,
                  height: 1.22 * m.fs,
                  borderRadius: 0.16 * m.fs,
                  background: alphaOf(row.kind === '-' ? chrome.delWashStrong : chrome.addWashStrong, r.emphAlpha),
                  opacity: vis,
                }}
              />
            ))
          : null}
        {numbers.map(([num, a], k) =>
          num && a > 0.005 ? (
            <div
              key={`n${k}`}
              style={{
                ...mono,
                position: 'absolute',
                right: width - g.numRight,
                top: r.dy,
                color: numColor,
                fontWeight: 450,
                opacity: vis * a,
                filter,
              }}
            >
              {num}
            </div>
          ) : null,
        )}
        {doc.isDiff && row.kind !== ' ' ? (
          <div
            style={{
              ...mono,
              position: 'absolute',
              left: g.signX,
              top: r.dy,
              color: row.kind === '-' ? chrome.delSign : chrome.addSign,
              fontWeight: 600,
              opacity: vis * (row.kind === '-' ? r.del : r.add) * (1 - r.settle),
            }}
          >
            {row.kind === '-' ? '−' : '+'}
          </div>
        ) : null}
        {tokens.length ? (
          <div
            style={{
              ...mono,
              position: 'absolute',
              left: g.codeX,
              top: r.dy,
              opacity: vis,
              filter,
              WebkitMaskImage: codeMask,
              maskImage: codeMask,
            }}
          >
            {tokens.map(([text, cls], k) => {
              const st = codeTheme[cls];
              const col = row.kind === '-' && r.del > 0 ? mixHex(st.color, removedTint(st.color), r.del) : st.color;
              return (
                <span key={k} style={{color: col, fontWeight: st.weight}}>
                  {text}
                </span>
              );
            })}
          </div>
        ) : null}
      </div>,
    );
  }

  // highlight bars, drawn in the gutter beside the rows they mark
  const barW = 0.0032 * c.H;
  for (const [k, b] of view.bars.entries()) {
    const y0 = top + offsets[b.i0] - scroll;
    const y1 = top + offsets[b.i1 + 1] - scroll;
    const full = y1 - y0 - 0.16 * m.lh;
    const hh = full * b.grow;
    items.push(
      <div
        key={`bar${k}`}
        style={{
          position: 'absolute',
          left: g.barX - barW / 2,
          top: y0 + 0.08 * m.lh + (full - hh) / 2,
          width: barW,
          height: Math.max(0, hh),
          borderRadius: barW / 2,
          background: chrome.mint,
          opacity: b.alpha,
          boxShadow: `0 0 ${0.012 * c.H}px ${chrome.mintGlow}`,
        }}
      />,
    );
  }

  if (view.caret) {
    const {row, col, alpha} = view.caret;
    const y = top + offsets[row] - scroll + rows[row].dy;
    items.push(
      <div
        key="caret"
        style={{
          position: 'absolute',
          left: g.codeX + col * m.cw + 0.04 * m.cw,
          top: y + m.baseline - 0.86 * m.fs,
          width: 0.56 * m.cw,
          height: 1.1 * m.fs,
          background: chrome.caret,
          opacity: 0.92 * alpha * rows[row].focus,
          boxShadow: `0 0 ${0.008 * c.H}px ${chrome.mintGlow}`,
        }}
      />,
    );
  }

  const body = (
    <div
      style={{
        position: 'absolute',
        left: 0,
        top: drift,
        width,
        height: total,
        overflow: 'hidden',
        opacity,
        clipPath: restClip,
        WebkitMaskImage: mask,
        maskImage: mask,
        ...(maskComposite as React.CSSProperties),
        filter: motionSigma > 0.4 ? `url(#${blurId})` : undefined,
      }}
    >
      {items}
    </div>
  );
  if (motionSigma <= 0.4) return body;
  return (
    <>
      <svg width={0} height={0} style={{position: 'absolute'}}>
        <filter id={blurId} x="0" y="-5%" width="100%" height="110%" colorInterpolationFilters="sRGB">
          <feGaussianBlur stdDeviation={`0 ${motionSigma.toFixed(2)}`} />
        </filter>
      </svg>
      {body}
    </>
  );
};
