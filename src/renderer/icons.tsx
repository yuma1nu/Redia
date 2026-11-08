const paths = {
  trash: 'M3 6h18 M9 6V3h6v3 M5 6l1 15h12l1-15 M10 10v7 M14 10v7',
  archive: 'M3 3h18v5H3Z M5 8v13h14V8 M10 12h4',
  columns: 'M3 4h18v16H3Z M10 4v16 M16 4v16',
  home: 'm3 10 9-7 9 7 M5 9v12h5v-7h4v7h5V9',
  search: 'M21 21l-5-5 M18 10a8 8 0 1 1-16 0 8 8 0 0 1 16 0',
  folder: 'M3 7V5h6l2 2h10v13H3Z',
  file: 'M14 2H5v20h14V7Z M14 2v6h5 M8 12h8 M8 16h6',
  plan: 'M4 4v17h17 M8 7h6 M11 12h9 M7 17h7',
  settings: 'M12 8a4 4 0 1 0 0 8 4 4 0 0 0 0-8 M9 3h6l1 3 3 1 2 5-2 5-3 1-1 3H9l-1-3-3-1-2-5 2-5 3-1Z',
  plus: 'M12 5v14 M5 12h14', arrow: 'm14 6-6 6 6 6 M8 12h12', chevron: 'm9 5 7 7-7 7',
  clock: 'M12 8v5l3 2 M22 12a10 10 0 1 1-20 0 10 10 0 0 1 20 0',
  bulb: 'M9 18h6 M9 21h6 M8 15c-6-5-2-13 4-13s10 8 4 13l-1 3H9Z',
  globe: 'M21 12a9 9 0 1 1-18 0 9 9 0 0 1 18 0 M3 12h18 M12 3c-5 5-5 13 0 18 M12 3c5 5 5 13 0 18',
  link: 'M9 8H7a4 4 0 0 0 0 8h2 M15 8h2a4 4 0 0 1 0 8h-2 M8 12h8',
  check: 'm5 12 4 4L19 6', close: 'm6 6 12 12 M6 18 18 6',
  backup: 'M4 7V3 M4 7h4 M4 7a9 9 0 1 1-1 9 M12 7v5l3 2',
  calendar: 'M3 5h18v16H3Z M3 10h18 M8 2v6 M16 2v6',
  inbox: 'M4 4h16l2 11v5H2v-5Z M2 15h6l2 3h4l2-3h6', alert: 'M12 3 2 21h20Z M12 9v5 M12 17v1',
} as const;
export type IconName = keyof typeof paths;
export function Icon({ name, size = 18 }: { name: IconName; size?: number }) {
  return <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.65" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true"><path d={paths[name]} /></svg>;
}
