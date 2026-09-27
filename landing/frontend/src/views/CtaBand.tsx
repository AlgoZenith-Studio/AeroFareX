import React from 'react';
import { ArrowRight } from 'lucide-react';
import { Link } from 'react-router';
import { ANALYST_SIGNUP_URL } from '../components/NavAnchor';

export const CtaBand: React.FC = () => (
  <section className="ed band-400 cta-ed" aria-labelledby="cta-title">
    <div className="ed-inner">
      <p className="ed-label cta-ed-label"><span className="ed-idx">[07]</span> Free and open</p>
      <h2 className="cta-ed-title" id="cta-title">
        <span>Every number,</span>
        <span>open to <span className="grad">everyone</span>.</span>
      </h2>

      <div className="crop-marks" aria-hidden="true">
        <span className="crop crop--left" />
        <span className="crop crop--right" />
      </div>

      <div className="cta-ed-row">
        <p className="ed-lead">
          No ads, nothing to sell. Search today&apos;s real prices, or, if you work in government or research,
          request access to the analyst dashboard.
        </p>
        <div className="hero-ctas">
          <Link className="btn btn-dark" to="/fares">
            Search fares <ArrowRight size={18} aria-hidden="true" />
          </Link>
          <a className="btn btn-ghost" href={ANALYST_SIGNUP_URL} target="_blank" rel="noreferrer">
            Analyst access
          </a>
        </div>
      </div>
    </div>
  </section>
);
