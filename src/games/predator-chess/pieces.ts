import type { Kind, Color } from './engine';
// Shared geometry keeps both sides legible and consistent across devices.
const shapes: Record<Kind, string> = {
 p: '<circle cx="24" cy="13" r="6"/><path d="M20 19h8l-1 9 6 9H15l6-9z"/>',
 r: '<path d="M12 8h6v6h4V8h4v6h4V8h6v13l-6 4 2 12H16l2-12-6-4z"/>',
 b: '<path d="M24 6c-5 6-10 10-10 16 0 5 5 8 10 8s10-3 10-8c0-6-5-10-10-16z"/><path d="m25 13-5 9" fill="none"/><path d="m19 29-4 8h18l-4-8z"/>',
 n: '<path d="M14 37h22l-4-9c5-10-2-20-13-21l1 6-9 11 3 5 10-6-2 8z"/><circle cx="23" cy="17" r="1.5" class="eye" stroke="none"/>',
 q: '<path d="m12 16 4 17h16l4-17-8 7-4-12-4 12z"/><circle cx="11" cy="12" r="3"/><circle cx="24" cy="8" r="3"/><circle cx="37" cy="12" r="3"/><path d="M16 33h16v5H16z"/>',
 k: '<path d="M24 5v11m-5-6h10" fill="none" stroke-width="3"/><path d="M15 19c0-6 6-7 9-3 3-4 9-3 9 3 0 4-5 7-5 10l5 8H15l5-8c0-3-5-6-5-10z"/>',
 x: '<circle cx="24" cy="23" r="16"/><path d="m13 23 11-8 11 8-11 8z" class="eye" stroke="none"/><path d="m24 18-3 5 3 5 3-5z" stroke="none"/>',
};
export function pieceSvg(kind: Kind, color: Color): string {
 return `<svg class="piece ${color}" viewBox="0 0 48 48" aria-hidden="true" focusable="false"><g stroke-width="1.7" stroke-linecap="round" stroke-linejoin="round">${shapes[kind]}${kind==='x'?'':'<path d="M13 38h22v4H13z"/>'}</g></svg>`;
}
