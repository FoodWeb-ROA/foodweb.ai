export interface FeatureDetail {
  headline?: string;
  body: string;
}

export interface Feature {
  id: string;
  tag: string;
  /** Multi-line title — `\n` is preserved via white-space: pre-line */
  title: string;
  body: string;
  /** Long-form copy shown in the Learn more modal */
  detail: FeatureDetail;
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
    detail: {
      body: "The best chefs in the world didn't enter this profession to fill in spreadsheets. They came to cook. ROA takes every administrative task off the pass — communication, planning, data — and runs it silently in the background. Your team stays sharp. Your creativity stays yours.",
    },
    image: '/uploads/1.png',
  },
  {
    id: 'recipes',
    tag: 'RECIPES',
    title: 'Recipes that scale,\ncost, and adapt.',
    body: 'Every recipe in one place. Scale portions instantly, auto-calculate food cost percentages, adapt for dietary restrictions on the fly.',
    detail: {
      headline: 'Every Recipe Scaled, Costed by ROA.',
      body: 'One recipe. Every station. Every shift. ROA is the single source of truth for every dish you serve — scaling portions automatically, calculating costs as ingredients change, and keeping your team consistent from the first cover to the last. No more guesswork on the line.',
    },
    image: '/uploads/2.png',
    image2: '/uploads/3.png',
  },
  {
    id: 'menu',
    tag: 'MENU',
    title: 'Build and manage\nevery menu section.',
    body: 'Organise dishes by section, set prices, activate or archive menus — and see the full cost picture without leaving the app.',
    detail: {
      headline: 'Menus that Move, Priced by ROA.',
      body: 'Your menu is a living document. ROA lets you build, price, and activate it section by section — with live food cost always visible, allergen flags built in, and one-click rotation when the season changes. Full control. Zero blind spots.',
    },
    image: '/uploads/5.png',
  },
  {
    id: 'inventory',
    tag: 'INVENTORY',
    title: 'Never run out\nmid-service again.',
    body: 'Real-time stock tracking with smart reorder alerts. ROA learns your burn rates and flags shortages before they hit service.',
    detail: {
      headline: 'Every Shelf Tracked, Counted by ROA.',
      body: 'ROA learns how fast your kitchen burns through stock, flags shortages before they hit service, and syncs with your suppliers automatically. What used to take a chef an hour every morning now runs itself. Real-time inventory. Smarter reorders. Waste turned into control.',
    },
    emoji: '📦',
  },
  {
    id: 'agent',
    tag: 'AI AGENT',
    title: 'Your kitchen,\none conversation away.',
    body: 'Ask ROA anything — stock levels, prep status, menu costs, allergen checks. Instant, accurate answers. Like a sous chef who never sleeps.',
    detail: {
      headline: 'Ask Anything, ROA Answers.',
      body: "What's the food cost on the tasting menu tonight? How much protein do we have left? Does table 12's dish contain mustard? ROA is your always-on sous chef — connected to your entire operation, ready to answer in seconds. Every question. Any hour. One conversation away.",
    },
    image: '/uploads/4.png',
  },
  {
    id: 'prep',
    tag: 'PREP',
    title: 'Prep lists that\nbuild themselves.',
    body: 'ROA generates daily prep lists from your menus, events, and history. Assign to stations, track completion live from the pass.',
    detail: {
      headline: 'Prep Lists That Build Themselves with ROA.',
      body: 'At the end of every service, ROA already knows what tomorrow needs. It reads your menus, your bookings, your history — and generates the full prep list, assigned by station, tracked live from the pass. Your team knowing exactly what to do. Every single day.',
    },
    emoji: '📋',
  },
  {
    id: 'team',
    tag: 'TEAM',
    title: 'Your whole brigade,\nalways in sync.',
    body: 'Assign roles, coordinate shifts, and track prep progress across every station — in real time, from any device. No more guessing who’s doing what.',
    detail: {
      headline: 'Your Team, Scheduled by ROA.',
      body: "Forty-five hour weeks don't make better chefs — they break them. ROA builds your weekly rota around the 37.5-hour law, your service volume, and your team's actual capacity. Fair schedules, automatic compliance, and a kitchen that runs without burning out the people inside it.",
    },
    emoji: '👥',
  },
  {
    id: 'sustainability',
    tag: 'SUSTAINABILITY',
    title: 'Cook with less\nwaste, every service.',
    body: 'Track food waste, monitor carbon footprint, and hit your sustainability targets — ROA turns good intentions into measurable action.',
    detail: {
      headline: 'Less Waste, More Impact with ROA.',
      body: "Every gram you throw away is a margin you never recover. ROA measures your food waste in real time, tracks your carbon footprint, and turns your sustainability targets into a number you can actually manage. A greener kitchen isn't a cost. With ROA, it's a competitive advantage.",
    },
    emoji: '🌱',
  },
];
