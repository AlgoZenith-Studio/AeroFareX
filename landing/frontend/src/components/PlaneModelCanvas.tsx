import React, { useEffect, useRef, useState } from 'react';
import * as THREE from 'three';
import { loadAirliner, disposeAirliner } from './aircraft3d';

/** Top view of the hero aircraft for the scroll-controlled route. */
export const PlaneModelCanvas: React.FC = () => {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const hostRef = useRef<HTMLDivElement>(null);
  const [ready, setReady] = useState(false);

  useEffect(() => {
    const canvas = canvasRef.current;
    const host = hostRef.current;
    if (!canvas || !host) return;
    let renderer: THREE.WebGLRenderer;
    try {
      renderer = new THREE.WebGLRenderer({ canvas, alpha: true, antialias: true, powerPreference: 'low-power' });
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

    const render = () => {
      const width = host.clientWidth;
      const height = host.clientHeight;
      if (!width || !height) return;
      renderer.setPixelRatio(Math.min(window.devicePixelRatio || 1, 1.7));
      renderer.setSize(width, height, false);
      if (aircraft) {
        renderer.render(scene, camera);
        setReady(true);
      }
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
      <canvas ref={canvasRef} />
      <svg className="fly-plane-svg" viewBox="0 0 100 120" fill="currentColor" aria-hidden="true">
        <path d="M50 3c3.2 0 5 6 5 15v24l40 24v7l-40-10v25l14 10v5l-19-5-19 5v-5l14-10V63L5 73v-7l40-24V18c0-9 1.8-15 5-15z" />
      </svg>
    </div>
  );
};
