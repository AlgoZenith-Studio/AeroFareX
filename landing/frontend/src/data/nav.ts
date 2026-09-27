/**
 * Header links. `href` starting with '#' scrolls within the home page; from any
 * other page it goes to that section of the home page. `to` is an in-app page.
 */
export type NavLink = { label: string; href: string } | { label: string; to: string };

export const NAV_LINKS: NavLink[] = [
  { href: '#features', label: 'Features' },
  { href: '#track', label: 'What we track' },
  { href: '#gap', label: 'Hidden fees' },
  { to: '/fares', label: 'Search fares' },
  { href: '#how', label: 'How it works' },
];
