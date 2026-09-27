import React from 'react';
import { ArrowUp } from 'lucide-react';
import { PORTAL_URL } from '../lib/format';
import { HEADLINE } from '../data/mockData';
import { NAV_LINKS } from '../data/nav';

const IconX: React.FC = () => (
  <svg width="18" height="18" viewBox="0 0 24 24" fill="currentColor" aria-hidden="true">
    <path d="M18.244 2.25h3.308l-7.227 8.26 8.502 11.24h-6.66l-5.214-6.817L4.99 21.75H1.68l7.73-8.835L1.254 2.25H8.08l4.713 6.231zm-1.161 17.52h1.833L7.084 4.126H5.117z" />
  </svg>
);
const IconLinkedIn: React.FC = () => (
  <svg width="18" height="18" viewBox="0 0 24 24" fill="currentColor" aria-hidden="true">
    <path d="M20.45 20.45h-3.56v-5.57c0-1.33-.02-3.04-1.85-3.04-1.85 0-2.13 1.45-2.13 2.94v5.67H9.35V9h3.42v1.56h.05c.48-.9 1.64-1.85 3.37-1.85 3.6 0 4.27 2.37 4.27 5.46zM5.34 7.43a2.07 2.07 0 1 1 0-4.14 2.07 2.07 0 0 1 0 4.14zM7.12 20.45H3.56V9h3.56zM22.22 0H1.77C.79 0 0 .77 0 1.72v20.56C0 23.23.79 24 1.77 24h20.45c.98 0 1.78-.77 1.78-1.72V1.72C24 .77 23.2 0 22.22 0z" />
  </svg>
);
const IconGitHub: React.FC = () => (
  <svg width="18" height="18" viewBox="0 0 24 24" fill="currentColor" aria-hidden="true">
    <path d="M12 .5A11.5 11.5 0 0 0 .5 12a11.5 11.5 0 0 0 7.86 10.92c.58.1.79-.25.79-.56v-2c-3.2.7-3.88-1.37-3.88-1.37-.53-1.34-1.3-1.7-1.3-1.7-1.06-.72.08-.71.08-.71 1.17.08 1.79 1.2 1.79 1.2 1.04 1.79 2.73 1.27 3.4.97.1-.76.4-1.27.74-1.56-2.56-.29-5.26-1.28-5.26-5.7 0-1.26.45-2.29 1.19-3.1-.12-.29-.52-1.46.11-3.05 0 0 .97-.31 3.18 1.18a11 11 0 0 1 5.8 0c2.2-1.49 3.17-1.18 3.17-1.18.63 1.59.23 2.76.11 3.05.74.81 1.19 1.84 1.19 3.1 0 4.43-2.7 5.4-5.28 5.69.41.36.78 1.06.78 2.14v3.17c0 .31.21.67.8.56A11.5 11.5 0 0 0 23.5 12 11.5 11.5 0 0 0 12 .5z" />
  </svg>
);

export const SiteFooter: React.FC = () => (
  <footer className="ed band-ink theme-dark foot">
    <div className="ed-inner">
      <div className="foot-top">
        <img className="foot-logo" src="/long_logo.svg" alt="AeroFareX" />
        <p className="foot-tagline">
          India&apos;s daily airfare index. We show what flying really costs, free and open to everyone.
        </p>
      </div>

      <div className="crop-marks" aria-hidden="true">
        <span className="crop crop--left" />
        <span className="crop crop--right" />
      </div>

      <div className="foot-grid">
        <nav className="foot-col" aria-label="Explore">
          <p className="ed-label">Explore</p>
          <ul>
            {NAV_LINKS.map((l) => (
              <li key={l.href}><a href={l.href}>{l.label}</a></li>
            ))}
          </ul>
        </nav>

        <nav className="foot-col" aria-label="For professionals">
          <p className="ed-label">For professionals</p>
          <ul>
            <li><a href={PORTAL_URL} target="_blank" rel="noreferrer">Analyst dashboard</a></li>
            <li><a href="#how">Our method</a></li>
            <li><a href="#who">Who it&apos;s for</a></li>
            <li><a href="#gap">Hidden fees explained</a></li>
          </ul>
        </nav>

        <div className="foot-col">
          <p className="ed-label">The data</p>
          <ul className="foot-facts">
            <li>{HEADLINE.updatedAt}</li>
            <li>{HEADLINE.coverage}</li>
            <li>5 busiest routes</li>
            <li>No ads, nothing to sell</li>
          </ul>
        </div>

        <div className="foot-col">
          <p className="ed-label">Follow us</p>
          <div className="socials-ed">
            <a href="#" aria-label="AeroFareX on X"><IconX /></a>
            <a href="#" aria-label="AeroFareX on LinkedIn"><IconLinkedIn /></a>
            <a href="#" aria-label="AeroFareX on GitHub"><IconGitHub /></a>
          </div>
        </div>
      </div>

      <div className="foot-bottom">
        <span>&copy; 2026 AeroFareX</span>
        <span>Built for MoSPI &middot; Smart India Hackathon 2026</span>
        <a href="#top" className="foot-top-link">
          Back to top <ArrowUp size={14} aria-hidden="true" />
        </a>
      </div>
      <p className="foot-asset-credit">
        Aircraft model: <a href="https://airbornescience.nasa.gov/content/3D_Models_Gallery" target="_blank" rel="noreferrer">NASA Airborne Science Program</a>. NASA does not endorse AeroFareX.
      </p>
    </div>
  </footer>
);
