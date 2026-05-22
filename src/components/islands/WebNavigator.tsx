import { Fragment, useMemo, useState } from 'react';
import { WEB_NODES, NODE_EDGES, nodePoints } from '~/lib/web-nodes';

interface Props {
  size?: number;
  /** id of the node that should be highlighted from external (scroll) state */
  scrollNode?: string | null;
  /** invoked when a node is clicked */
  onSelect?: (id: string) => void;
  /** override label font size in pixels (used by the small floating logo) */
  labelSizePx?: number | null;
  /** when false, hover/click are ignored and only scrollNode drives the active state */
  interactive?: boolean;
}

export default function WebNavigator({
  size = 460,
  scrollNode = null,
  onSelect,
  labelSizePx = null,
  interactive = true,
}: Props) {
  const [hovered, setHovered] = useState<string | null>(null);
  const active = interactive ? (hovered || scrollNode) : scrollNode;
  const points = useMemo(() => nodePoints(size), [size]);
  const pointById = useMemo(() => {
    const m = new Map<string, { x: number; y: number }>();
    points.forEach((p) => m.set(p.id, { x: p.x, y: p.y }));
    return m;
  }, [points]);

  const cx = size / 2;
  const cy = size / 2;
  const dotR = size * 0.025;
  const baseStroke = Math.max(1, size * 0.0055);
  const activeStroke = Math.max(1.5, size * 0.0072);
  const labelR = 0.62;
  const hitR = size * 0.05;

  return (
    <div className="webnav" style={{ width: size, height: size }}>
      {/* Wheel: base graph + active-state highlights drawn from the same points */}
      <svg
        className="webnav-svg"
        viewBox={`0 0 ${size} ${size}`}
        width={size}
        height={size}
        aria-hidden
      >
        {/* Base graph — always visible */}
        <g className="webnav-base" strokeLinecap="round">
          {NODE_EDGES.map(([a, b]) => {
            const ptA = pointById.get(a)!;
            const ptB = pointById.get(b)!;
            return (
              <line
                key={`base-${a}-${b}`}
                x1={ptA.x} y1={ptA.y} x2={ptB.x} y2={ptB.y}
                strokeWidth={baseStroke}
              />
            );
          })}
          {points.map((pt) => (
            <circle key={`base-${pt.id}`} cx={pt.x} cy={pt.y} r={dotR} />
          ))}
        </g>

        {/* Active highlights — exact same coordinates as the base */}
        <g className="webnav-active" strokeLinecap="round">
          {NODE_EDGES.map(([a, b]) => {
            const ptA = pointById.get(a)!;
            const ptB = pointById.get(b)!;
            const isHot = !!(active && (a === active || b === active));
            return (
              <line
                key={`hot-${a}-${b}`}
                x1={ptA.x} y1={ptA.y} x2={ptB.x} y2={ptB.y}
                strokeWidth={activeStroke}
                style={{ opacity: isHot ? 1 : 0 }}
              />
            );
          })}
          {active && pointById.has(active) && (
            <circle
              cx={pointById.get(active)!.x}
              cy={pointById.get(active)!.y}
              r={dotR}
            />
          )}
        </g>
      </svg>

      {/* Hit areas + labels */}
      {WEB_NODES.map((n, i) => {
        const rad = (n.angle * Math.PI) / 180;
        const pt = points[i];
        const labelX = cx + ((size * labelR) / 2) * Math.cos(rad);
        const labelY = cy - ((size * labelR) / 2) * Math.sin(rad);
        const isActive = active === n.id;
        const cos = Math.cos(rad), sin = Math.sin(rad);
        // Anchor label by inside edge so every label sits the same radial distance from the wheel
        const txPercent = -50 * (1 - cos);
        const tyPercent = -50 * (1 + sin);

        return (
          <Fragment key={n.id}>
            <button
              type="button"
              aria-label={n.label}
              onMouseEnter={() => setHovered(n.id)}
              onMouseLeave={() => setHovered(null)}
              onClick={() => onSelect?.(n.id)}
              className="webnav-hit"
              style={{
                left: pt.x - hitR,
                top: pt.y - hitR,
                width: hitR * 2,
                height: hitR * 2,
              }}
            />
            <div
              className="webnav-label"
              style={{
                left: labelX, top: labelY,
                transform: `translate(${txPercent}%, ${tyPercent}%) scale(${isActive ? 1.18 : 1})`,
                transformOrigin: `${((1 - cos) / 2) * 100}% ${((1 + sin) / 2) * 100}%`,
                fontSize: labelSizePx != null ? labelSizePx : size * 0.026,
                fontWeight: isActive ? 800 : 500,
                color: isActive ? 'var(--c-text)' : 'var(--c-node-label)',
                textShadow: isActive ? '0 0 18px rgba(74,143,74,0.55)' : 'none',
              }}
            >
              {n.label}
            </div>
          </Fragment>
        );
      })}
    </div>
  );
}
