/**
 * Inline SVG icons (stroke = currentColor, 24×24). Hand-drawn for Lombard,
 * no third-party icon set. Always paired with text: colour/icon is never the
 * only signal (GDD § Accessibility).
 */
const svg = (body: string, extra = '') =>
  `<svg class="icon" viewBox="0 0 24 24" width="24" height="24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true" ${extra}>${body}</svg>`

export const icons = {
  loupe: svg('<circle cx="10" cy="10" r="6"/><path d="M14.5 14.5 20 20"/><path d="M7.5 8.2a3 3 0 0 1 2.6-1.6"/>'),
  scale: svg('<path d="M4 18h16"/><path d="M6 18l1.5-7h9L18 18"/><rect x="9" y="5" width="6" height="4" rx="1"/><path d="M12 9v2"/>'),
  magnet: svg('<path d="M6 4v8a6 6 0 0 0 12 0V4"/><path d="M6 4h3v8a3 3 0 0 0 6 0V4h3"/><path d="M6 7.5h3M15 7.5h3"/>'),
  gear: svg('<circle cx="12" cy="12" r="3"/><path d="M12 2.5v2.2M12 19.3v2.2M4.6 4.6l1.6 1.6M17.8 17.8l1.6 1.6M2.5 12h2.2M19.3 12h2.2M4.6 19.4l1.6-1.6M17.8 6.2l1.6-1.6"/><circle cx="12" cy="12" r="6.5"/>'),
  person: svg('<circle cx="12" cy="8" r="3.5"/><path d="M5 20c.8-3.6 3.6-5.5 7-5.5s6.2 1.9 7 5.5"/>'),
  clock: svg('<circle cx="12" cy="12" r="8.5"/><path d="M12 7.5V12l3 2"/>'),
  check: svg('<path d="M5 12.5l4.2 4.2L19 7"/>'),
  plus: svg('<circle cx="12" cy="12" r="8.5"/><path d="M12 8v8M8 12h8"/>'),
  alert: svg('<path d="M12 3.5 21 19.5H3z"/><path d="M12 10v4.2"/><circle cx="12" cy="16.9" r=".6" fill="currentColor"/>'),
  dot: svg('<circle cx="12" cy="12" r="3" fill="currentColor"/>'),
  back: svg('<path d="M14.5 6 8.5 12l6 6"/>'),
  close: svg('<path d="M6 6l12 12M18 6 6 18"/>'),
  backspace: svg('<path d="M9 5h11v14H9l-6-7z"/><path d="M12.5 9.5l5 5M17.5 9.5l-5 5"/>'),
  copy: svg('<rect x="8.5" y="8.5" width="11" height="11" rx="1.5"/><path d="M15.5 5.5V5a1.5 1.5 0 0 0-1.5-1.5H5A1.5 1.5 0 0 0 3.5 5v9A1.5 1.5 0 0 0 5 15.5h.5"/>'),
  door: svg('<path d="M6 20V4h10v16"/><path d="M4 20h14"/><circle cx="13.2" cy="12.5" r=".8" fill="currentColor"/>'),
  coins: svg('<ellipse cx="9" cy="7" rx="5.5" ry="2.5"/><path d="M3.5 7v4c0 1.4 2.5 2.5 5.5 2.5s5.5-1.1 5.5-2.5V7"/><path d="M9.5 15.4c.9 1 2.9 1.6 5 1.6 3 0 5.5-1.1 5.5-2.5v-4c0-1.2-1.8-2.2-4.3-2.4"/>'),
  hand: svg('<path d="M7 12V6.5a1.5 1.5 0 0 1 3 0V11"/><path d="M10 11V5a1.5 1.5 0 0 1 3 0v6"/><path d="M13 11V6a1.5 1.5 0 0 1 3 0v6.5"/><path d="M16 9.5a1.5 1.5 0 0 1 3 0V14c0 3.6-2.6 6.5-6.2 6.5-2.4 0-4-1-5.3-3L4.8 13.4a1.5 1.5 0 0 1 2.3-1.8L8.5 13"/>'),
  heart: svg('<path d="M12 19.5s-7.5-4.4-7.5-10A4.3 4.3 0 0 1 12 7a4.3 4.3 0 0 1 7.5 2.5c0 5.6-7.5 10-7.5 10z"/>'),
  receipt: svg('<path d="M6 3.5h12v17l-2-1.3-2 1.3-2-1.3-2 1.3-2-1.3-2 1.3z"/><path d="M9 8h6M9 11.5h6M9 15h3.5"/>'),
  walk: svg('<circle cx="13" cy="4.8" r="1.8"/><path d="M10.5 21l2-6.5 3 3V21"/><path d="M8 11.5l2.5-3.5h3l2.5 3 2.5 1"/><path d="M12.5 14.5 13.5 8"/>'),
  doc: svg('<path d="M7 3.5h7l4 4v13H7z"/><path d="M14 3.5v4h4"/><path d="M9.5 12h6M9.5 15.5h6"/>'),
} as const

export type IconName = keyof typeof icons
