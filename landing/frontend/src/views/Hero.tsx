import React from 'react';
import { ArrowRight } from 'lucide-react';
import { HeroScene } from '../components/HeroScene';

export const Hero: React.FC = () => (
  <section className="hero theme-dark" id="top" aria-labelledby="hero-title">
    <HeroScene />

    <div className="container">
      <div className="hero-copy">
        <h1 className="hero-title" id="hero-title">
          <span className="hero-row">Know the <span className="grad">real cost</span></span>{' '}
          <span className="hero-row">of flying in India</span>
        </h1>

        <p className="hero-sub">
          We check airfares on India&apos;s busiest routes every day and show what you really pay,
          with every tax and fee included. Free for everyone.
        </p>

        <div className="hero-ctas">
          <a className="btn btn-primary btn-pill" href="#routes">
            Check a route <ArrowRight size={18} aria-hidden="true" />
          </a>
          <a className="btn btn-ghost btn-pill" href="#how">See how it works</a>
        </div>
      </div>
    </div>
  </section>
);
