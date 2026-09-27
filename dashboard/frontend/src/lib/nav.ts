import type { LucideIcon } from 'lucide-react';
import { Activity, BookOpen, CalendarClock, LayoutDashboard, Route as RouteIcon, ShieldCheck, Waypoints } from 'lucide-react';
import type { Role } from '@aerofarex/shared-types';

/**
 * The portal's page map. The dashboard has one role (analyst; admin counts as
 * analyst), so every page needs ANALYST. Public users use the landing site.
 */
export interface NavItem {
  href: string;
  label: string;
  icon: LucideIcon;
  minRole: Role;
  group: 'menu' | 'general';
}

export const NAV: NavItem[] = [
  { href: '/', label: 'Overview', icon: LayoutDashboard, minRole: 'ANALYST', group: 'menu' },
  { href: '/attribution/', label: 'Attribution', icon: Waypoints, minRole: 'ANALYST', group: 'menu' },
  { href: '/routes/', label: 'Routes', icon: RouteIcon, minRole: 'ANALYST', group: 'menu' },
  { href: '/lead-time/', label: 'Lead time', icon: CalendarClock, minRole: 'ANALYST', group: 'menu' },
  { href: '/quality/', label: 'Data quality', icon: ShieldCheck, minRole: 'ANALYST', group: 'menu' },
  { href: '/health/', label: 'Source health', icon: Activity, minRole: 'ANALYST', group: 'general' },
  { href: '/methodology/', label: 'Methodology', icon: BookOpen, minRole: 'ANALYST', group: 'general' },
];

export const navItemFor = (pathname: string) =>
  NAV.find((item) => (item.href === '/' ? pathname === '/' : pathname.startsWith(item.href.replace(/\/$/, ''))));
