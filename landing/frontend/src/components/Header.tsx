import React, { useEffect, useState } from 'react';
import { Link, useLocation } from 'react-router';
import { ArrowRight, Menu, UserRound, X } from 'lucide-react';
import { NAV_LINKS } from '../data/nav';
import { useUserAuth } from '../lib/userAuth';
import { ANALYST_SIGNUP_URL, NavAnchor } from './NavAnchor';

/** Traveller account: "Sign in" when signed out, avatar when signed in. Both open /account. */
const AccountButton: React.FC<{ onClick?: () => void; full?: boolean }> = ({ onClick, full }) => {
  const { user } = useUserAuth();
  const initials = user?.name.split(/\s+/).map((w) => w[0]).slice(0, 2).join('').toUpperCase();
  return (
    <Link to="/account" onClick={onClick} className={full ? 'btn btn-ghost' : 'account-btn'} aria-label={user ? `Your account (${user.name})` : 'Sign in'}>
      {user ? (
        user.photoURL ? <img src={user.photoURL} alt="" className="account-avatar" /> : <span className="account-avatar">{initials}</span>
      ) : (
        <UserRound size={18} aria-hidden="true" />
      )}
      {(full || !user) && <span>{user ? 'Your account' : 'Sign in'}</span>}
    </Link>
  );
};

export const Header: React.FC = () => {
  const [open, setOpen] = useState(false);
  const { pathname } = useLocation();

  useEffect(() => {
    if (!open) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') setOpen(false);
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [open]);

  return (
    <header className="header theme-dark">
      <div className="container header-shell">
        <div className="header-bar">
          <Link className="brand" to="/" aria-label="AeroFareX home" onClick={() => pathname === '/' && window.scrollTo({ top: 0 })}>
            <img className="brand-logo" src="/logo_long_v2.svg" alt="AeroFareX" />
          </Link>

          <nav className="nav" aria-label="Main">
            {NAV_LINKS.map((l) => <NavAnchor key={l.label} link={l} />)}
          </nav>

          <div className="header-actions">
            <AccountButton />
            <a className="btn btn-primary btn-sm" href={ANALYST_SIGNUP_URL} target="_blank" rel="noreferrer">
              Analyst access <ArrowRight size={16} aria-hidden="true" />
            </a>
            <button
              className="menu-btn"
              aria-label={open ? 'Close menu' : 'Open menu'}
              aria-expanded={open}
              aria-controls="mobile-menu"
              onClick={() => setOpen((v) => !v)}
            >
              {open ? <X size={22} /> : <Menu size={22} />}
            </button>
          </div>
        </div>

        {open && (
          <nav id="mobile-menu" className="mobile-menu" aria-label="Mobile">
            {NAV_LINKS.map((l) => <NavAnchor key={l.label} link={l} onClick={() => setOpen(false)} />)}
            <AccountButton full onClick={() => setOpen(false)} />
            <a className="btn btn-primary" href={ANALYST_SIGNUP_URL} target="_blank" rel="noreferrer">
              Analyst access <ArrowRight size={16} aria-hidden="true" />
            </a>
          </nav>
        )}
      </div>
    </header>
  );
};
