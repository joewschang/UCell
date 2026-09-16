export type IconName = 'home' | 'organization' | 'shop' | 'bonus' | 'person' | 'chart' | 'order' | 'bell' | 'arrow' | 'check';
const paths: Record<IconName, string> = {
  home: 'M3 10 12 3l9 7M5 9v12h5v-7h4v7h5V9',
  organization: 'M9 3h6v5H9zM3 16h6v5H3zM15 16h6v5h-6zM12 8v4M6 16v-4h12v4',
  shop: 'M5 7h14l2 14H3L5 7ZM9 8V6a3 3 0 0 1 6 0v2',
  bonus: 'M4 6h16v14H4zM4 10h16M15 14h5M7 6V3h10',
  person: 'M16 7a4 4 0 1 1-8 0 4 4 0 0 1 8 0ZM4 21v-2a8 8 0 0 1 16 0v2',
  chart: 'M4 3v17h17M8 15v-4M13 15V7M18 15V4',
  order: 'M6 3h12v18l-3-2-3 2-3-2-3 2V3ZM9 8h6M9 12h6',
  bell: 'M5 17h14l-2-3V9A5 5 0 0 0 7 9v5l-2 3ZM10 21h4M12 2v2',
  arrow: 'M5 12h14M14 7l5 5-5 5',
  check: 'm5 12 4 4L19 6',
};
export default function Icon({ name }: { name: IconName }) {
  return <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true" focusable="false"><path d={paths[name]}/></svg>;
}
