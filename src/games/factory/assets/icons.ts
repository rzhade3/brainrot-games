import type { BuildingKind } from '../game/domain';

const ICONS: Record<BuildingKind | 'inspect' | 'remove', string> = {
  inspect: '<path d="m5 3 13 10-6 1-3 6z"/>',
  belt: '<path d="m3 8 9-5 9 5v8l-9 5-9-5zM3 8l9 5 9-5M12 13v8"/><path d="m8 8 4 2 4-2"/>',
  splitter: '<path d="m3 8 9-5 9 5v8l-9 5-9-5zM3 8l9 5 9-5M12 13v8"/><path d="m7 10 5 3 5-3M12 13V7m-2 2 2-2 2 2"/>',
  miner: '<path d="m4 9 8-5 8 5-8 5zM4 9v9l8 4 8-4V9M12 14v8M12 4V1"/><path d="m8 17 4 2"/>',
  furnace: '<path d="m4 10 8-4 8 4v9l-8 4-8-4zM4 10l8 4 8-4M12 14v9M14 7V2h4v7"/><path d="m7 14 2 1v4l-2-1z"/>',
  storage: '<path d="m3 8 9-5 9 5v10l-9 5-9-5zM3 8l9 5 9-5M12 13v10M7 10l9-5"/>',
  assembler: '<path d="m3 9 9-5 9 5v10l-9 5-9-5zM3 9l9 5 9-5M12 14v10M6 2v7M18 2v7M6 2h12"/><path d="m9 17 3 2 3-2"/>',
  remove: '<path d="M5 6h14M9 6V3h6v3M7 6l1 15h8l1-15M10 10v7M14 10v7"/>',
  home: '<path d="m3 11 9-8 9 8M6 9v12h12V9M10 21v-7h4v7"/>',
  'food-plot': '<path d="m3 13 9-5 9 5-9 5zM3 17l9 5 9-5M12 13V3M12 7C7 7 6 3 6 3s6-1 6 4m0 3c5 0 6-4 6-4s-6-1-6 4"/>',
  kitchen: '<path d="m3 11 9-8 9 8M6 9v12h12V9M9 15h6v4H9zM16 6V2h3v7"/>',
  'woodcutting-site': '<path d="M6 21V10m0-7L2 10h8zM14 21V5m0 0 7 3-3 6-4-2M10 17l9 4 3-3-9-4z"/>',
};

export function icon(tool: BuildingKind | 'inspect' | 'remove'): string {
  return `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">${ICONS[tool]}</svg>`;
}

export function residentIcon(): string {
  return '<svg viewBox="0 0 40 40" fill="none" aria-hidden="true"><rect width="40" height="40" rx="12" fill="#e1ead9"/><path d="M9 35v-5c0-6 5-9 11-9s11 3 11 9v5" fill="#356d64"/><circle cx="20" cy="15" r="7" fill="#d7b48b"/><path d="M13 15v-3a7 7 0 0 1 14 0v3l-4-5-10 3" fill="#655347"/></svg>';
}
