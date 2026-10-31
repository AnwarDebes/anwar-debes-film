import React from 'react';
import type {NodeKind} from './types';

// Kind marks, drawn in an 11 u box centred on (0, 0). One family of line icons, so the
// kind reads at a glance without a second colour.
export const KindGlyph: React.FC<{kind: NodeKind; size: number; stroke: string; fill: string; sw: number}> = ({kind, size, stroke, fill, sw}) => {
  const h = size / 2;
  const common = {fill: 'none', stroke, strokeWidth: sw, strokeLinecap: 'round' as const, strokeLinejoin: 'round' as const};
  switch (kind) {
    case 'module':
      return <rect x={-h + sw / 2} y={-h + sw / 2} width={size - sw} height={size - sw} rx={size * 0.16} {...common} />;
    case 'service':
      return (
        <g>
          <circle r={h - sw / 2} {...common} />
          <circle r={size * 0.16} fill={fill} />
        </g>
      );
    case 'model': {
      // a 3 x 3 patch of literals: true pins filled, false pins open
      const on = [1, 0, 1, 0, 1, 1, 1, 0, 0];
      const step = size / 3;
      const r = step * 0.27;
      return (
        <g>
          {on.map((v, i) => {
            const cx = -h + step / 2 + (i % 3) * step;
            const cy = -h + step / 2 + Math.floor(i / 3) * step;
            return v ? <circle key={i} cx={cx} cy={cy} r={r} fill={fill} /> : <circle key={i} cx={cx} cy={cy} r={r * 0.82} fill="none" stroke={stroke} strokeWidth={sw * 0.7} />;
          })}
        </g>
      );
    }
    case 'data': {
      const rx = h - sw / 2;
      const ry = size * 0.17;
      const top = -h + ry + sw / 2;
      const bot = h - ry - sw / 2;
      return (
        <g {...common}>
          <ellipse cx={0} cy={top} rx={rx} ry={ry} />
          <path d={`M${-rx} ${top}V${bot}A${rx} ${ry} 0 0 0 ${rx} ${bot}V${top}`} />
          <path d={`M${-rx} ${(top + bot) / 2}A${rx} ${ry} 0 0 0 ${rx} ${(top + bot) / 2}`} />
        </g>
      );
    }
    case 'ui':
      return (
        <g {...common}>
          <rect x={-h + sw / 2} y={-h + sw / 2} width={size - sw} height={size - sw} rx={size * 0.12} />
          <path d={`M${-h + sw / 2} ${-h + size * 0.34}H${h - sw / 2}`} />
        </g>
      );
    case 'step':
      return <path d={`M${-h * 0.62} ${-h + sw}L${h * 0.78} 0L${-h * 0.62} ${h - sw}Z`} {...common} />;
    case 'test':
      return <path d={`M${-h + sw} ${size * 0.02}L${-size * 0.12} ${h - sw * 1.2}L${h - sw} ${-h + sw * 1.4}`} {...common} />;
    default:
      return null;
  }
};
