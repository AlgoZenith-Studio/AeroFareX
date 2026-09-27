import React, { useEffect, useRef, useState } from 'react';
import * as THREE from 'three';
import { loadAirliner, disposeAirliner } from './aircraft3d';

/** Room around the plane for its baked-in drop shadow (CSS px). */
const SHADOW_PAD = 48;

/**
 * Top view of the hero aircraft for the scroll-controlled route.
 *
 * The model never changes pose (the parent rotates the whole element), so it is
 * rendered once per size into an offscreen WebGL canvas and copied, with its
 * drop shadow baked in, onto a plain 2D canvas. The moving layer is then a
 * static bitmap: no WebGL frames and no live CSS filter while scrolling.
 */
export const PlaneModelCanvas: React.FC = () => {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const hostRef = useRef<HTMLDivElement>(null);
  const [ready, setReady] = useState(false);

  useEffect(() => {
    const canvas = canvasRef.current;
    const host = hostRef.current;
    const ctx = canvas?.getContext('2d');
    if (!canvas || !host || !ctx) return;
    let renderer: THREE.WebGLRenderer;
    try {
      renderer = new THREE.WebGLRenderer({ alpha: true, antialias: true, powerPreference: 'low-power' });
    } catch {
      return;
    }
    renderer.outputColorSpace = THREE.SRGBColorSpace;
    renderer.toneMapping = THREE.ACESFilmicToneMapping;
    renderer.toneMappingExposure = 1.7;

    const scene = new THREE.Scene();
    let aircraft: THREE.Group | null = null;
    let active = true;
    scene.add(new THREE.HemisphereLight(0xffffff, 0x6c8797, 2.4));
    const key = new THREE.DirectionalLight(0xffffff, 3);
    key.position.set(-4, 8, -5);
    scene.add(key);
    const camera = new THREE.OrthographicCamera(-4.6, 4.6, 5.5, -5.5, 0.1, 30);
    camera.up.set(0, 0, -1);
    camera.position.set(0, 12, 0);
    camera.lookAt(0, 0, 0);

    // Shadow colour from the design tokens (--shadow-dark), not a literal.
    const shadow = getComputedStyle(host).getPropertyValue('--shadow-dark');
    const shadowColor = shadow.match(/rgba?\([^)]*\)/)?.[0] ?? 'transparent';

    const render = () => {
      const width = host.clientWidth;
      const height = host.clientHeight;
      if (!width || !height || !aircraft) return;
      const dpr = Math.min(window.devicePixelRatio || 1, 2);
      renderer.setPixelRatio(dpr);
      renderer.setSize(width, height, false);
      renderer.render(scene, camera);
      canvas.width = Math.round((width + SHADOW_PAD * 2) * dpr);
      canvas.height = Math.round((height + SHADOW_PAD * 2) * dpr);
      ctx.clearRect(0, 0, canvas.width, canvas.height);
      ctx.shadowColor = shadowColor;
      ctx.shadowBlur = 40 * dpr;
      ctx.shadowOffsetY = 12 * dpr;
      ctx.drawImage(renderer.domElement, SHADOW_PAD * dpr, SHADOW_PAD * dpr, width * dpr, height * dpr);
      setReady(true);
    };
    const resizeObserver = new ResizeObserver(render);
    resizeObserver.observe(host);
    loadAirliner().then((model) => {
      if (!active) { disposeAirliner(model); return; }
      aircraft = model;
      scene.add(model);
      render();
    }).catch(() => { /* The SVG remains visible. */ });
    return () => {
      active = false;
      resizeObserver.disconnect();
      if (aircraft) disposeAirliner(aircraft);
      renderer.dispose();
    };
  }, []);

  return (
    <div ref={hostRef} className={`fly-plane-model${ready ? ' is-ready' : ''}`}>
      <canvas ref={canvasRef} style={{ inset: -SHADOW_PAD, width: `calc(100% + ${SHADOW_PAD * 2}px)`, height: `calc(100% + ${SHADOW_PAD * 2}px)` }} />
      <svg className="fly-plane-svg" viewBox="0 0 100 120" fill="currentColor" aria-hidden="true">
        <path d="M50 3c3.2 0 5 6 5 15v24l40 24v7l-40-10v25l14 10v5l-19-5-19 5v-5l14-10V63L5 73v-7l40-24V18c0-9 1.8-15 5-15z" />
      </svg>
    </div>
  );
};
