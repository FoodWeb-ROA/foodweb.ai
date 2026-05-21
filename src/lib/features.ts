export interface Feature {
  id: string;
  tag: string;
  /** Multi-line title — `\n` is preserved via white-space: pre-line */
  title: string;
  body: string;
  image?: string;
  image2?: string;
  emoji?: string;
}

// Order must match FEATURE_NODES in src/lib/web-nodes.ts
export const FEATURES: Feature[] = [
  {
    id: 'chef',
    tag: 'CHEF',
    title: 'Your kitchen HQ,\nalways in sync.',
    body: 'The home screen connects your team, prep list, and key modules at a glance. Everything starts and ends with the chef.',
    image: '/uploads/1.png',
  },
  {
    id: 'recipes',
    tag: 'RECIPES',
    title: 'Recipes that scale,\ncost, and adapt.',
    body: 'Every recipe in one place. Scale portions instantly, auto-calculate food cost percentages, adapt for dietary restrictions on the fly.',
    image: '/uploads/2.png',
    image2: '/uploads/3.png',
  },
  {
    id: 'menu',
    tag: 'MENU',
    title: 'Build and manage\nevery menu section.',
    body: 'Organise dishes by section, set prices, activate or archive menus — and see the full cost picture without leaving the app.',
    image: '/uploads/5.png',
  },
  {
    id: 'inventory',
    tag: 'INVENTORY',
    title: 'Never run out\nmid-service again.',
    body: 'Real-time stock tracking with smart reorder alerts. ROA learns your burn rates and flags shortages before they hit service.',
    emoji: '📦',
  },
  {
    id: 'agent',
    tag: 'AI AGENT',
    title: 'Your kitchen,\none conversation away.',
    body: 'Ask ROA anything — stock levels, prep status, menu costs, allergen checks. Instant, accurate answers. Like a sous chef who never sleeps.',
    image: '/uploads/4.png',
  },
  {
    id: 'prep',
    tag: 'PREP',
    title: 'Prep lists that\nbuild themselves.',
    body: 'ROA generates daily prep lists from your menus, events, and history. Assign to stations, track completion live from the pass.',
    emoji: '📋',
  },
  {
    id: 'team',
    tag: 'TEAM',
    title: 'Your whole brigade,\nalways in sync.',
    body: 'Assign roles, coordinate shifts, and track prep progress across every station — in real time, from any device. No more guessing who’s doing what.',
    emoji: '👥',
  },
  {
    id: 'sustainability',
    tag: 'SUSTAINABILITY',
    title: 'Cook with less\nwaste, every service.',
    body: 'Track food waste, monitor carbon footprint, and hit your sustainability targets — ROA turns good intentions into measurable action.',
    emoji: '🌱',
  },
];
