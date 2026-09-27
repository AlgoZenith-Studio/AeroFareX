import React from 'react';
import { Link, useLocation } from 'react-router';
import type { NavLink } from '../data/nav';
import { PORTAL_URL } from '../lib/format';

/** Dashboard sign-up / sign-in page for analysts (the dashboard opens "Request access"). */
export const ANALYST_SIGNUP_URL = `${PORTAL_URL.replace(/\/$/, '')}/login/?mode=signup`;

/** A header/footer link: in-app page, or a home-page section from any page. */
export const NavAnchor: React.FC<{ link: NavLink; className?: string; onClick?: () => void }> = ({ link, className, onClick }) => {
  const { pathname } = useLocation();
  if ('to' in link) {
    return (
      <Link to={link.to} className={className} onClick={onClick} aria-current={pathname === link.to ? 'page' : undefined}>
        {link.label}
      </Link>
    );
  }
  // Section anchors scroll on the home page; elsewhere they load the home page at that section.
  const href = pathname === '/' ? link.href : `/${link.href}`;
  return <a href={href} className={className} onClick={onClick}>{link.label}</a>;
};
