import React, { useEffect, useRef, useState } from 'react';
import * as THREE from 'three';
import { useReducedMotion } from '../hooks/useReducedMotion';
import { loadAirliner, disposeAirliner } from './aircraft3d';

const clamp01 = (value: number) => Math.min(1, Math.max(0, value));
const ease = (value: number) => value * value * (3 - 2 * value);
const easeOut = (value: number) => 1 - (1 - value) ** 2.2;
const INTRO_DURATION = 5600;
const CRUISE_DISTANCE = 0.34;
// Depth the aircraft appears at, far behind the headline.
const START_DEPTH = 70;
// Share of the approach flown straight before the turn begins.
const STRAIGHT_SHARE = 0.45;
// Final pose (YXZ order): nose up, slight right yaw, slight left bank.
const FINAL_PITCH = 0.38;
const FINAL_YAW = 0.12;
const FINAL_ROLL = 0.15;
const APPROACH_PITCH = 0.12;
const TURN_BANK = 0.42;
const worldAtScreen = (camera: THREE.PerspectiveCamera, x: number, y: number, z: number) => {
  const point = new THREE.Vector3(x * 2 - 1, 1 - y * 2, 0.5).unproject(camera);
  const distance = (z - camera.position.z) / (point.z - camera.position.z);
  return point.sub(camera.position).multiplyScalar(distance).add(camera.position);
};
/** Heading of a nose that points at -z when yaw is 0. */
const headingYaw = (direction: THREE.Vector3) => Math.atan2(-direction.x, -direction.z);

type Approach = { path: THREE.CurvePath<THREE.Vector3>; straightEnd: number; turnSign: number };

/**
 * Head-on straight leg from behind the headline, then one banked turn that
 * rolls out on the final heading exactly at the resting position.
 */
const buildApproach = (camera: THREE.PerspectiveCamera, target: THREE.Vector3, mobile: boolean): Approach => {
  const start = worldAtScreen(camera, mobile ? 0.25 : 0.27, mobile ? 0.42 : 0.4, START_DEPTH);
  const finalHeading = new THREE.Vector3(-Math.sin(FINAL_YAW), 0, -Math.cos(FINAL_YAW));
  const turnEntry = target.clone().addScaledVector(finalHeading, -(mobile ? 6 : 9));
  const bend = start.clone().lerp(turnEntry, STRAIGHT_SHARE);
  const path = new THREE.CurvePath<THREE.Vector3>();
  path.add(new THREE.LineCurve3(start, bend));
  path.add(new THREE.CubicBezierCurve3(bend, bend.clone().lerp(turnEntry, 0.6), turnEntry, target.clone()));
  const lengths = path.getCurveLengths();
  const approachYaw = headingYaw(turnEntry.clone().sub(start));
  return { path, straightEnd: lengths[0] / lengths[1], turnSign: Math.sign(FINAL_YAW - approachYaw) || 1 };
};

/** Live aircraft and cloud scene over the hero sky image. */
export const HeroScene: React.FC = () => {
  const hostRef = useRef<HTMLDivElement>(null);
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const reduced = useReducedMotion();
  const [failed, setFailed] = useState(false);

  useEffect(() => {
    if (failed) return;
    const host = hostRef.current;
    const canvas = canvasRef.current;
    if (!host || !canvas) return;
    const hero = host.closest<HTMLElement>('.hero');

    let renderer: THREE.WebGLRenderer;
    try {
      renderer = new THREE.WebGLRenderer({ canvas, alpha: true, antialias: true, powerPreference: 'high-performance' });
    } catch {
      return;
    }
    renderer.outputColorSpace = THREE.SRGBColorSpace;
    renderer.toneMapping = THREE.ACESFilmicToneMapping;
    renderer.toneMappingExposure = 1.65;

    const scene = new THREE.Scene();
    const camera = new THREE.PerspectiveCamera(38, 1, 0.1, 140);
    const ambient = new THREE.HemisphereLight(0xe7f5ff, 0x8c5066, 2.5);
    scene.add(ambient);
    const sun = new THREE.DirectionalLight(0xffd6a9, 3.2);
    sun.position.set(-5, 7, -7);
    scene.add(sun);
    const rim = new THREE.DirectionalLight(0x90d9f4, 1.5);
    rim.position.set(5, 3, 6);
    scene.add(rim);
    const undersideFill = new THREE.DirectionalLight(0xe5f3ff, 2.6);
    undersideFill.position.set(1, -4, -5);
    scene.add(undersideFill);

    let aircraft: THREE.Group | null = null;
    let cloudTexture: THREE.Texture | null = null;
    const clouds: THREE.Sprite[] = [];
    let active = true;
    loadAirliner().then((model) => {
      if (!active) { disposeAirliner(model); return; }
      aircraft = model;
      scene.add(model);
    }).catch(() => { if (active) setFailed(true); });
    new THREE.TextureLoader().load('/hero-cloud-bank.webp', (texture) => {
      if (!active) { texture.dispose(); return; }
      cloudTexture = texture;
      texture.colorSpace = THREE.SRGBColorSpace;
      const positions: Array<[number, number, number, number, number]> = [
        [-6.9, -2.0, 3.2, 7.4, 0.68], [-1.8, -2.9, 1.4, 6.8, 0.55],
        [4.2, -2.3, 4.2, 8.7, 0.62], [7.6, 0.5, 5.6, 7.1, 0.38],
        [-7.1, 2.8, 7.2, 6.2, 0.28], [0.4, 3.5, 8.2, 7.8, 0.23],
      ];
      positions.forEach(([x, y, z, cloudWidth, opacity], index) => {
        const material = new THREE.SpriteMaterial({ map: texture, transparent: true, opacity, depthWrite: false });
        const cloud = new THREE.Sprite(material);
        cloud.position.set(x, y, z);
        cloud.scale.set(cloudWidth, cloudWidth * 0.37, 1);
        cloud.userData = { x, y, speed: 0.75 - index * 0.09 };
        scene.add(cloud);
        clouds.push(cloud);
      });
    });

    let width = 1;
    let height = 1;
    let visible = true;
    let frame = 0;
    let sceneStart: number | null = null;
    let introStart: number | null = null;
    let approach: Approach | null = null;
    let approachMobile = false;
    const resize = () => {
      width = host.clientWidth;
      height = host.clientHeight;
      if (!width || !height) return;
      renderer.setPixelRatio(Math.min(window.devicePixelRatio || 1, width < 760 ? 1.4 : 1.8));
      renderer.setSize(width, height, false);
      ambient.groundColor.set(width < 760 ? 0xe1edf4 : 0x8c5066);
      ambient.intensity = width < 760 ? 4 : 2.5;
      undersideFill.intensity = width < 760 ? 2.6 : 0.7;
      camera.aspect = width / height;
      camera.updateProjectionMatrix();
      approach = null;
    };
    const resizeObserver = new ResizeObserver(resize);
    resizeObserver.observe(host);
    resize();

    const onContextLost = (event: Event) => { event.preventDefault(); setFailed(true); };
    canvas.addEventListener('webglcontextlost', onContextLost);

    const draw = (time: number) => {
      if (!visible) return;
      if (sceneStart === null) sceneStart = time;
      const elapsed = (time - sceneStart) / 1000;
      const mobile = width < 760;
      camera.position.set(0, 1.3, -12.3);
      camera.lookAt(0, -0.25, 0);
      camera.updateMatrixWorld();

      if (aircraft) {
        if (introStart === null) introStart = time;
        const intro = reduced ? 1 : clamp01((time - introStart) / INTRO_DURATION);
        const travel = easeOut(intro);
        const cruise = Math.max(0, (time - introStart - INTRO_DURATION) / 1000);
        const forward = reduced ? 0 : 1 - Math.exp(-cruise / 5);
        const rest = new THREE.Vector3(mobile ? -0.85 : -3.45, mobile ? -2.8 : -0.3, 0);
        if (!approach || approachMobile !== mobile) {
          approach = buildApproach(camera, rest, mobile);
          approachMobile = mobile;
        }
        const { path, straightEnd, turnSign } = approach;
        const tangent = path.getTangentAt(travel);
        aircraft.position.copy(path.getPointAt(travel));
        aircraft.position.add(new THREE.Vector3(-forward * CRUISE_DISTANCE, forward * 0.09, -forward * 0.2));

        // Fly nose-first along the path; the turn banks in and rolls out into the resting pose.
        const turn = clamp01((travel - straightEnd) / (1 - straightEnd));
        const settle = ease(turn);
        const pitch = THREE.MathUtils.lerp(APPROACH_PITCH, FINAL_PITCH, settle) + Math.asin(tangent.y);
        const bank = FINAL_ROLL * settle - turnSign * TURN_BANK * Math.sin(Math.PI * turn);
        aircraft.rotation.set(pitch, headingYaw(tangent), bank, 'YXZ');
        const textWake = reduced ? 0
          : ease(clamp01((intro - 0.18) / 0.16)) * (1 - ease(clamp01((intro - 0.56) / 0.17)));
        hero?.style.setProperty('--hero-text-wake', textWake.toFixed(3));
        aircraft.scale.setScalar((mobile ? 0.45 : 0.95) * (1 + forward * 0.025));
      }
      clouds.forEach((cloud) => {
        const { x, y, speed } = cloud.userData;
        const start = x + 16;
        const phase = (start + (reduced ? 0 : elapsed * speed)) % 32;
        const distance = phase - start;
        cloud.position.x = phase - 16;
        cloud.position.y = y - distance * 0.28;
      });
      renderer.render(scene, camera);
      if (reduced && aircraft) { frame = 0; return; }
      frame = requestAnimationFrame(draw);
    };
    const observer = new IntersectionObserver(([entry]) => {
      visible = entry.isIntersecting;
      if (visible && !frame) frame = requestAnimationFrame(draw);
      if (!visible && frame) { cancelAnimationFrame(frame); frame = 0; }
    }, { rootMargin: '100px 0px' });
    observer.observe(host);
    frame = requestAnimationFrame(draw);

    return () => {
      active = false;
      if (frame) cancelAnimationFrame(frame);
      observer.disconnect();
      resizeObserver.disconnect();
      canvas.removeEventListener('webglcontextlost', onContextLost);
      hero?.style.removeProperty('--hero-text-wake');
      if (aircraft) disposeAirliner(aircraft);
      clouds.forEach((cloud) => (cloud.material as THREE.SpriteMaterial).dispose());
      cloudTexture?.dispose();
      renderer.dispose();
    };
  }, [reduced, failed]);

  return (
    <div ref={hostRef} className="hero-media hero-media--3d" aria-hidden="true">
      {!failed && <canvas ref={canvasRef} className="hero-scene-canvas" />}
      <div className="hero-scrim" />
      <div className="hero-handoff" />
    </div>
  );
};
