import React, {useMemo} from 'react';
import {color, layout, type} from '../tokens';
import {useFontsReady} from './fontsReady';
import {Kicker} from './Kicker';
import {KineticLine} from './KineticLine';
import {layoutBlock} from './layout';
import {parseMarkup, typo} from './markup';
import {capHeightOf} from './metrics';
import {fontOf, tagLook} from './styles';
import {useUnits} from './units';

export interface ChapterCardProps {
  /** chapter number (zero-padded) or a literal index string */
  index: number | string;
  /** the kicker after the index, e.g. "Verifiable AI" (set in caps) */
  kicker: string;
  /** display title, markup: the idea word in *asterisks* becomes mint STIX italic */
  title: string;
  /** optional grey line under the title (markup allowed) */
  sub?: string;
  /** enter time (s) */
  at: number;
  /** exit time (s): everything leaves with a focus pull */
  exitAt?: number;
  t?: number;
  align?: 'left' | 'center';
  /** px: the left edge (left) or the centre (center). Default: the 7% margin / the frame centre. */
  x?: number;
  /** px: the kicker baseline. Default 0.29 H (left) or 0.36 H (center). */
  kickerBaseline?: number;
  kind?: 'displayL' | 'displayM' | 'headline';
  /** px: maximum title width. Default 0.6 W (left), 0.8 W (center). */
  maxWidth?: number;
  /** stagger between title words (s) */
  perWordS?: number;
}

/**
 * Chapter card: a mono index kicker ("03 · VERIFIABLE AI") above a display
 * title whose idea word is mint italic. The kicker focus-pulls in first, then
 * the title word by word, then the sub-line; all leave together.
 * Geometry from the reel's title card: kicker baseline 0.29 H, title cap top
 * 0.044 H below it, sub-line baseline 0.095 H below the title's last baseline.
 */
export const ChapterCard: React.FC<ChapterCardProps> = ({
  index,
  kicker,
  title,
  sub,
  at,
  exitAt,
  t,
  align = 'left',
  x: xProp,
  kickerBaseline: kbProp,
  kind = 'displayM',
  maxWidth: mwProp,
  perWordS = 0.085,
}) => {
  const {W, H, w: fw, h: fh} = useUnits();
  const ready = useFontsReady();
  const x = xProp ?? (align === 'left' ? fw(layout.marginLeftW) : W / 2);
  const kb = Math.round(kbProp ?? fh(align === 'left' ? layout.kickerBaselineH : 0.36));
  const maxWidth = mwProp ?? fw(align === 'left' ? 0.6 : 0.8);
  const capTop = kb + fh(0.044);
  const titleLH = Math.max(type[kind].lineHeight, 0.98);
  const titleAt = at + 0.18;
  const titleWords = parseMarkup(title).length;

  // where the sub-line goes depends on how many lines the title takes
  const subBaseline = useMemo(() => {
    if (!sub || !ready) return 0;
    const base = fontOf(kind, H);
    // same looks as KineticLine uses, so the line count matches
    const items = parseMarkup(title).map((tk) => ({
      text: typo(tk.text),
      tag: tk.tag,
      font: tagLook(tk.tag, base, {keyWeight: Math.min(800, base.weight + 100)}).font,
    }));
    const lay = layoutBlock(items, {maxWidth, maxLines: 3, align, balance: align === 'center' ? 1 : 0.6, boxWidth: maxWidth});
    const lines = Math.max(1, lay.lines.length);
    return Math.round(capTop + capHeightOf(base) + (lines - 1) * titleLH * base.size + fh(0.095));
  }, [sub, ready, kind, H, title, maxWidth, align, capTop, titleLH, fh]);

  return (
    <div style={{position: 'absolute', inset: 0, pointerEvents: 'none'}}>
      <Kicker text={kicker} index={index} t={t} at={at} exitAt={exitAt === undefined ? undefined : exitAt + 0.04} x={x} baseline={kb} align={align} />
      <KineticLine
        text={title}
        at={titleAt}
        perWordS={perWordS}
        t={t}
        kind={kind}
        variant="focus"
        x={x}
        y={capTop}
        yAnchor="capTop"
        align={align}
        maxWidth={maxWidth}
        maxLines={3}
        lineHeight={titleLH}
        color={color.text.display}
        exitAt={exitAt}
      />
      {sub && subBaseline > 0 ? (
        <KineticLine
          text={sub}
          at={titleAt + titleWords * perWordS + 0.1}
          perWordS={0.05}
          t={t}
          kind="tagline"
          variant="focus"
          x={x}
          y={subBaseline}
          yAnchor="firstBaseline"
          align={align}
          maxWidth={maxWidth}
          maxLines={2}
          color={color.text.secondary}
          exitAt={exitAt}
        />
      ) : null}
    </div>
  );
};
