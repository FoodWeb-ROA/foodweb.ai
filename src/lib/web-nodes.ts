export interface WebNode {
  id: string;
  label: string;
  angle: number;
}

export const WEB_NODES: WebNode[] = [
  { id: 'chef',           label: 'Chef',           angle:   90 },
  { id: 'recipes',        label: 'Recipes',        angle:   45 },
  { id: 'menu',           label: 'Menu',           angle:    0 },
  { id: 'inventory',      label: 'Inventory',      angle:  -45 },
  { id: 'agent',          label: 'Agent',          angle:  -90 },
  { id: 'prep',           label: 'Prep',           angle: -135 },
  { id: 'sustainability', label: 'Sustainability', angle:  135 },
  { id: 'team',           label: 'Team',           angle:  180 },
];

// FEATURE_NODES is the scroll order, matches FEATURES order
export const FEATURE_NODES = ['chef', 'recipes', 'menu', 'inventory', 'agent', 'prep', 'team', 'sustainability'];

// Matches the original logo artwork: axis nodes (N/S/E/W) connect to every
// corner node and to their perpendicular axis counterparts; corner-to-corner
// and diameter (opposite-axis) edges are omitted. 20 edges total.
export const NODE_EDGES: [string, string][] = (() => {
  const isAxis = (angle: number) => angle % 90 === 0;
  const edges: [string, string][] = [];
  for (let i = 0; i < WEB_NODES.length; i++) {
    for (let j = i + 1; j < WEB_NODES.length; j++) {
      const a = WEB_NODES[i];
      const b = WEB_NODES[j];
      const aAxis = isAxis(a.angle);
      const bAxis = isAxis(b.angle);
      // both corner → skip
      if (!aAxis && !bAxis) continue;
      // axis ↔ axis: only perpendicular pairs (90° apart), not diameter (180°)
      if (aAxis && bAxis) {
        const diff = Math.abs(((a.angle - b.angle + 540) % 360) - 180);
        if (diff !== 90) continue;
      }
      edges.push([a.id, b.id]);
    }
  }
  return edges;
})();

export interface NodePoint { id: string; x: number; y: number; }

export function nodePoints(size: number): NodePoint[] {
  const cx = size / 2;
  const cy = size / 2;
  // Dot center radius from container center = 0.3208 × 0.78 of size (logo PNG renders at 78%)
  const dotR = 0.3208 * 0.78;
  return WEB_NODES.map((n) => {
    const rad = (n.angle * Math.PI) / 180;
    return {
      id: n.id,
      x: cx + size * dotR * Math.cos(rad),
      y: cy - size * dotR * Math.sin(rad),
    };
  });
}
