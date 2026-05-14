import { useState } from 'react';
import { fmtShort } from '../../lib/format';

const LABEL_THRESHOLD = 20; // BAR width (px): below this → tooltip, above → inline

function BarTooltip({ cx, barTop, label, maxX }) {
  const W = Math.ceil(label.length * 7.5 + 14);
  const H = 22;
  const tx = Math.min(Math.max(cx - W / 2, 0), Math.max(maxX - W, 0));
  const ty = Math.max(barTop - H - 6, 2);
  return (
    <g transform={`translate(${tx},${ty})`} pointerEvents="none">
      <rect width={W} height={H} rx={4}
        fill="rgba(15,23,42,0.92)" stroke="rgba(255,255,255,0.12)" strokeWidth={0.5} />
      <text x={W / 2} y={H / 2}
        textAnchor="middle" dominantBaseline="middle"
        fontSize="11" fill="rgba(255,255,255,0.92)">
        {label}
      </text>
    </g>
  );
}

function StackedTooltip({ cx, barTop, segments, maxX }) {
  const lineH = 19;
  const PAD   = 11;
  const W     = 178;
  const H     = segments.length * lineH + PAD * 2 - 4;
  const tx    = Math.min(Math.max(cx - W / 2, 0), Math.max(maxX - W, 0));
  const ty    = Math.max(barTop - H - 6, 2);
  return (
    <g transform={`translate(${tx},${ty})`} pointerEvents="none">
      <rect width={W} height={H} rx={4}
        fill="rgba(15,23,42,0.95)" stroke="rgba(255,255,255,0.12)" strokeWidth={0.5} />
      {segments.map((seg, i) => (
        <g key={seg.name} transform={`translate(0,${PAD + i * lineH - 4})`}>
          <rect x={PAD} y={3} width={8} height={8} rx={2} fill={seg.color} />
          <text x={PAD + 13} y={11}
            dominantBaseline="auto" fontSize="11" fill="rgba(255,255,255,0.85)">
            {seg.name} — {fmtShort(seg.seconds)}
          </text>
        </g>
      ))}
    </g>
  );
}

export function HourlyChart({ bars, width, height }) {
  const [hoveredBar, setHoveredBar] = useState(null);
  const maxSecs    = Math.max(...bars.map(b => b.seconds), 60);
  const count      = 24;
  const GAP        = 4;
  const BAR        = Math.max(6, Math.floor((width - GAP * (count - 1)) / count));
  const CHART_H    = Math.max(height - 28, 60);
  const svgW       = count * (BAR + GAP) - GAP;
  const showInline = BAR >= LABEL_THRESHOLD;
  const inlineSize = Math.max(7, Math.min(13, Math.round(BAR * 0.48)));
  const axisSize   = Math.max(8, Math.min(11, Math.round(BAR * 0.42)));

  const hovered     = hoveredBar !== null ? bars[hoveredBar] : null;
  const hoveredBarH = hovered?.seconds > 0
    ? Math.max((hovered.seconds / maxSecs) * CHART_H, 4) : 0;
  const showTooltip = hovered?.seconds > 0 && (!showInline || hoveredBarH < 26);

  return (
    <div className="chart-scroll">
      <svg width={svgW} height={CHART_H + 22} className="chart-svg"
        onMouseLeave={() => setHoveredBar(null)}>
        <defs>
          <linearGradient id="h-grad" x1="0" y1="0" x2="0" y2="1">
            <stop offset="0%" stopColor="#c084fc" />
            <stop offset="100%" stopColor="#22d3ee" stopOpacity="0.6" />
          </linearGradient>
        </defs>

        {bars.map((b, i) => {
          const barH = b.seconds > 0 ? Math.max((b.seconds / maxSecs) * CHART_H, 4) : 0;
          const x    = i * (BAR + GAP);
          const cx   = x + BAR / 2;
          const cy   = CHART_H - barH / 2;
          return (
            <g key={i} onMouseEnter={() => setHoveredBar(i)}>
              <rect x={x} y={0} width={BAR} height={CHART_H} fill="transparent" />
              {barH > 0 ? (
                <rect x={x} y={CHART_H - barH} width={BAR} height={barH}
                  fill="url(#h-grad)" rx={4} ry={4} />
              ) : (
                <rect x={x} y={CHART_H - 2} width={BAR} height={2}
                  fill="rgba(255,255,255,0.06)" rx={1} />
              )}
              {showInline && barH >= 26 && (
                <text
                  x={cx} y={cy}
                  textAnchor="middle" dominantBaseline="middle"
                  fontSize={inlineSize} fill="rgba(255,255,255,0.80)"
                  transform={`rotate(-90,${cx},${cy})`}
                  pointerEvents="none"
                >
                  {fmtShort(b.seconds)}
                </text>
              )}
              {i % 6 === 0 && (
                <text x={cx} y={CHART_H + 16}
                  textAnchor="middle" fontSize={axisSize} fill="rgba(255,255,255,0.3)"
                  pointerEvents="none">
                  {i}h
                </text>
              )}
            </g>
          );
        })}

        {showTooltip && (
          <BarTooltip
            cx={hoveredBar * (BAR + GAP) + BAR / 2}
            barTop={CHART_H - hoveredBarH}
            label={fmtShort(hovered.seconds)}
            maxX={svgW}
          />
        )}
      </svg>
    </div>
  );
}

export function DailyChart({ bars, width, height, stacked, onBarClick }) {
  const [hoveredBar, setHoveredBar] = useState(null);
  const maxSecs    = Math.max(...bars.map(b => b.seconds), 60);
  const count      = bars.length;
  const GAP        = count <= 7 ? 12 : count <= 12 ? 10 : 5;
  const BAR        = Math.max(8, Math.floor((width - GAP * (count - 1)) / count));
  const CHART_H    = Math.max(height - 28, 60);
  const svgW       = count * (BAR + GAP) - GAP;
  const r          = Math.min(BAR / 2, 6);
  const showInline = BAR >= LABEL_THRESHOLD;
  const inlineSize = Math.max(7, Math.min(13, Math.round(BAR * 0.48)));
  const axisSize   = Math.max(8, Math.min(11, Math.round(BAR * 0.42)));

  const hovered     = hoveredBar !== null ? bars[hoveredBar] : null;
  const hoveredBarH = hovered?.seconds > 0
    ? Math.max((hovered.seconds / maxSecs) * CHART_H, 4) : 0;
  const showTooltip = hovered?.seconds > 0 && (stacked || !showInline || hoveredBarH < 22);

  return (
    <div className="chart-scroll">
      <svg width={svgW} height={CHART_H + 22} className="chart-svg"
        onMouseLeave={() => setHoveredBar(null)}>
        <defs>
          <linearGradient id="d-grad" x1="0" y1="0" x2="0" y2="1">
            <stop offset="0%" stopColor="#c084fc" />
            <stop offset="100%" stopColor="#22d3ee" stopOpacity="0.6" />
          </linearGradient>
          {stacked && bars.map((b, i) => {
            const barH = b.seconds > 0 ? Math.max((b.seconds / maxSecs) * CHART_H, 4) : 0;
            if (barH === 0) return null;
            const x = i * (BAR + GAP);
            return (
              <clipPath key={i} id={`clip-d-${i}`}>
                <rect x={x} y={CHART_H - barH} width={BAR} height={barH} rx={r} ry={r} />
              </clipPath>
            );
          })}
        </defs>

        {bars.map((b, i) => {
          const barH      = b.seconds > 0 ? Math.max((b.seconds / maxSecs) * CHART_H, 4) : 0;
          const x         = i * (BAR + GAP);
          const cx        = x + BAR / 2;
          const cy        = CHART_H - barH / 2;
          const clickable = onBarClick && b.date;
          return (
            <g key={i}
              onMouseEnter={() => setHoveredBar(i)}
              onClick={clickable ? () => onBarClick(b.date) : undefined}
              style={clickable ? { cursor: 'pointer' } : undefined}
            >
              <rect x={x} y={0} width={BAR} height={CHART_H} fill="transparent" />
              {barH > 0 ? (
                stacked && b.segments?.length > 0 ? (
                  <g clipPath={`url(#clip-d-${i})`}>
                    {(() => {
                      let stackY = CHART_H;
                      return b.segments.map(seg => {
                        const segH = Math.max((seg.seconds / b.seconds) * barH, 1);
                        stackY -= segH;
                        return (
                          <rect key={seg.name} x={x} y={stackY} width={BAR} height={segH}
                            fill={seg.color} fillOpacity={0.85} />
                        );
                      });
                    })()}
                  </g>
                ) : (
                  <rect x={x} y={CHART_H - barH} width={BAR} height={barH}
                    fill="url(#d-grad)" rx={r} ry={r} />
                )
              ) : (
                <rect x={x} y={CHART_H - 2} width={BAR} height={2}
                  fill="rgba(255,255,255,0.06)" rx={1} />
              )}
              {!stacked && showInline && barH >= 22 && (
                <text
                  x={cx} y={cy}
                  textAnchor="middle" dominantBaseline="middle"
                  fontSize={inlineSize} fill="rgba(255,255,255,0.80)"
                  transform={`rotate(-90,${cx},${cy})`}
                  pointerEvents="none"
                >
                  {fmtShort(b.seconds)}
                </text>
              )}
              <text x={cx} y={CHART_H + 16}
                textAnchor="middle" fontSize={axisSize} fill="rgba(255,255,255,0.3)"
                pointerEvents="none">
                {b.label}
              </text>
            </g>
          );
        })}

        {showTooltip && (
          stacked && hovered?.segments?.length > 0 ? (
            <StackedTooltip
              cx={hoveredBar * (BAR + GAP) + BAR / 2}
              barTop={CHART_H - hoveredBarH}
              segments={hovered.segments}
              maxX={svgW}
            />
          ) : (
            <BarTooltip
              cx={hoveredBar * (BAR + GAP) + BAR / 2}
              barTop={CHART_H - hoveredBarH}
              label={fmtShort(hovered.seconds)}
              maxX={svgW}
            />
          )
        )}
      </svg>
    </div>
  );
}
