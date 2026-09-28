import React, { useEffect } from 'react';
import { Header } from './Header';
import { SiteFooter } from '../views/SiteFooter';

/** Layout for pages other than the home page: same header and footer as the landing. */
export const PageShell: React.FC<{ title: string; children: React.ReactNode; showFooter?: boolean }> = ({ title, children, showFooter = true }) => {
  useEffect(() => {
    document.title = `${title} · AeroFareX`;
    window.scrollTo({ top: 0 });
  }, [title]);
  return (
    <>
      <a className="skip-link" href="#main">Skip to content</a>
      <Header />
      <main id="main">{children}</main>
      {showFooter && <SiteFooter />}
    </>
  );
};
