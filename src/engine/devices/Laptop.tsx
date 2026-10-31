// A procedural laptop: graphite aluminium deck with a polished edge, a generic blank keyboard,
// trackpad and grilles, a hinge barrel, and a thin lid whose glass carries the display.
// Units: 1 = 10 cm. The laptop stands on y = 0 (its feet), centred on x, z; the screen faces +z.
import React, {useLayoutEffect, useMemo} from 'react';
import type {ThreeElements} from '@react-three/fiber';
import * as THREE from 'three';
import {DeviceScreen, type ScreenSource} from './DeviceScreen';
import {keyboardLayout, mergeParts, place, roundedPlate, roundedSlab} from './geometry';
import {createDeviceMaterials, grilleTexture, type DeviceFinish} from './materials';
import type {ScreenGeometry, ScreenLook} from './screenMaterial';

export const LAPTOP = {
  width: 3.04,
  depth: 2.15,
  baseHeight: 0.15,
  feet: 0.012,
  radius: 0.11,
  lidDepth: 2.1,
  lidThickness: 0.052,
  hingeInset: 0.058,
  hingeDrop: 0.012,
  /** the glass, relative to the lid face */
  glassInset: 0.008,
  /** active area (16:10) and its bezels */
  activeWidth: 2.872,
  topBezel: 0.084,
  activeRadius: 0.014,
  keyUnit: 0.18,
} as const;

const L = LAPTOP;
const glassW = L.width - 2 * L.glassInset;
const glassH = L.lidDepth - 2 * L.glassInset;
const activeH = L.activeWidth / 1.6;
const activeY = glassH / 2 - L.topBezel - activeH / 2;
// lid slab, in hinge space (origin on the hinge axis)
const lidGap = 0.007 + L.hingeDrop; // closed lid rests just above the keys
const lidZ0 = -0.03;

export const laptopScreenGeometry: ScreenGeometry = {
  width: glassW,
  height: glassH,
  active: {x: 0, y: activeY, width: L.activeWidth, height: activeH, radius: L.activeRadius},
};

/** hinge axis position in laptop space */
const hingeY = L.feet + L.baseHeight - L.hingeDrop;
const hingeZ = -L.depth / 2 + L.hingeInset;

/**
 * Pose of the display (active area) in laptop space for a lid angle: centre, unit right / up /
 * normal vectors and size. Use it to aim cameras and focus at exact points of the screen:
 * point(u, v) = centre + right * (u - 0.5) * width + up * (v - 0.5) * height.
 */
export function laptopScreenPose(lidAngleDeg = 112) {
  const m = new THREE.Matrix4()
    .makeTranslation(0, hingeY, hingeZ)
    .multiply(new THREE.Matrix4().makeRotationX(-THREE.MathUtils.degToRad(lidAngleDeg)))
    .multiply(new THREE.Matrix4().makeTranslation(0, lidGap - 0.0004, lidZ0 + L.lidDepth / 2))
    .multiply(new THREE.Matrix4().makeRotationX(Math.PI / 2));
  const centre = new THREE.Vector3(0, activeY, 0).applyMatrix4(m);
  const basis = new THREE.Matrix3().setFromMatrix4(m);
  const right = new THREE.Vector3(1, 0, 0).applyMatrix3(basis).normalize();
  const up = new THREE.Vector3(0, 1, 0).applyMatrix3(basis).normalize();
  const normal = new THREE.Vector3(0, 0, 1).applyMatrix3(basis).normalize();
  const point = (u: number, v: number, target = new THREE.Vector3()) =>
    target
      .copy(centre)
      .addScaledVector(right, (u - 0.5) * L.activeWidth)
      .addScaledVector(up, (v - 0.5) * activeH);
  return {centre, right, up, normal, width: L.activeWidth, height: activeH, point};
}

export type LaptopProps = Omit<ThreeElements['group'], 'children'> & {
  /** lid opening in degrees: 0 closed, about 112 for a typical working angle */
  lidAngle?: number;
  finish?: DeviceFinish;
  /** what the display shows */
  screen?: ScreenSource;
  look?: ScreenLook;
  /** light thrown by the display onto the deck and surroundings */
  spill?: number;
  castShadow?: boolean;
};

export const Laptop: React.FC<LaptopProps> = ({lidAngle = 112, finish = 'graphite', screen, look, spill = 0.6, castShadow = true, ...group}) => {
  const mats = useMemo(() => createDeviceMaterials(finish), [finish]);
  const grille = useMemo(() => {
    const tex = grilleTexture(14, 110);
    const m = new THREE.MeshStandardMaterial({color: '#050606', roughness: 0.9, metalness: 0, alphaMap: tex, transparent: true, depthWrite: false});
    return {tex, m};
  }, []);

  const parts = useMemo(() => {
    const base = roundedSlab({
      width: L.width,
      depth: L.depth,
      height: L.baseHeight,
      radius: L.radius,
      top: {kind: 'round', r: 0.011},
      bottom: {kind: 'round', r: 0.05},
      cornerSegments: 16,
      profileSegments: 8,
    });
    const lid = roundedSlab({
      width: L.width,
      depth: L.lidDepth,
      height: L.lidThickness,
      radius: L.radius,
      top: {kind: 'round', r: 0.014},
      bottom: {kind: 'round', r: 0.006},
      cornerSegments: 16,
      profileSegments: 8,
    });
    // keyboard
    const kb = keyboardLayout();
    const u = L.keyUnit;
    const kbBack = -L.depth / 2 + 0.135;
    const kx0 = -(kb.width * u) / 2;
    const caps: THREE.BufferGeometry[] = [];
    const wells: THREE.BufferGeometry[] = [];
    const gap = 0.03;
    for (const k of kb.keys) {
      const w = k.w * u - gap;
      const d = k.d * u - gap;
      const x = kx0 + k.x * u;
      const z = kbBack + k.z * u;
      caps.push(place(roundedSlab({width: w, depth: d, height: 0.01, radius: 0.017, top: {kind: 'round', r: 0.0035}, cornerSegments: 5, profileSegments: 3}), x, L.baseHeight - 0.004, z));
      wells.push(place(roundedPlate(w + 0.014, d + 0.014, 0.022, 5), x, L.baseHeight + 0.0004, z));
    }
    const keys = mergeParts(caps);
    const keyWells = mergeParts(wells);
    const kbFront = kbBack + kb.depth * u;
    // trackpad
    const tpW = 1.42;
    const tpD = 0.82;
    const tpZ = L.depth / 2 - 0.085 - tpD / 2;
    const trackpad = place(roundedPlate(tpW, tpD, 0.04, 10), 0, L.baseHeight + 0.0007, tpZ);
    const trackpadGap = place(roundedPlate(tpW + 0.012, tpD + 0.012, 0.046, 10), 0, L.baseHeight + 0.0003, tpZ);
    // grilles either side of the keyboard
    const gx = (kb.width * u) / 2 + (L.width / 2 - (kb.width * u) / 2) / 2;
    const gD = kbFront - kbBack - 0.02;
    const grilles = mergeParts([
      place(roundedPlate(0.105, gD, 0.02, 6), -gx, L.baseHeight + 0.0004, (kbBack + kbFront) / 2),
      place(roundedPlate(0.105, gD, 0.02, 6), gx, L.baseHeight + 0.0004, (kbBack + kbFront) / 2),
    ]);
    // ports (dark inlays on the sides)
    const port = (x: number, z: number, side: number) => place(roundedPlate(0.03, 0.088, 0.015, 6), x, 0, z, 0, 0, (side * Math.PI) / 2);
    const portY = L.baseHeight * 0.48;
    const ports = mergeParts([
      place(port(0, 0, 1), -L.width / 2 - 0.0006, portY, -0.62),
      place(port(0, 0, 1), -L.width / 2 - 0.0006, portY, -0.42),
      place(port(0, 0, -1), L.width / 2 + 0.0006, portY, -0.52),
    ]);
    const jack = place(roundedPlate(0.034, 0.034, 0.017, 8), 0, 0, 0, 0, 0, Math.PI / 2);
    place(jack, -L.width / 2 - 0.0006, portY, 0.55);
    const portsAll = mergeParts([ports, jack]);
    // feet
    const foot = (x: number, z: number) => place(roundedSlab({width: 0.13, depth: 0.13, height: L.feet + 0.004, radius: 0.064, bottom: {kind: 'round', r: 0.005}, cornerSegments: 6, profileSegments: 3}), x, 0, z);
    const fx = L.width / 2 - 0.26;
    const fz = L.depth / 2 - 0.22;
    const feet = mergeParts([foot(-fx, -fz), foot(fx, -fz), foot(-fx, fz), foot(fx, fz)]);
    // hinge barrel
    const hinge = new THREE.CylinderGeometry(0.05, 0.05, L.width * 0.86, 40, 1).rotateZ(Math.PI / 2);
    // camera lens in the top bezel
    const lens = new THREE.CircleGeometry(0.011, 32);
    const lensRing = new THREE.RingGeometry(0.011, 0.0145, 40);
    return {base, lid, keys, keyWells, trackpad, trackpadGap, grilles, ports: portsAll, feet, hinge, lens, lensRing};
  }, []);

  // slab groups: top cap, top edge, side, bottom edge, bottom cap
  const baseMats = useMemo(() => [mats.body, mats.edge, mats.body, mats.body, mats.body], [mats]);
  const lidMats = useMemo(() => [mats.body, mats.edge, mats.body, mats.body, mats.body], [mats]);

  useLayoutEffect(
    () => () => {
      Object.values(parts).forEach((g) => g.dispose());
      mats.dispose();
      grille.tex.dispose();
      grille.m.dispose();
    },
    [parts, mats, grille],
  );

  const lidRot = -THREE.MathUtils.degToRad(lidAngle);

  return (
    <group {...group}>
      <mesh geometry={parts.feet} material={mats.rubber} />
      <group position={[0, L.feet, 0]}>
        <mesh geometry={parts.base} material={baseMats} castShadow={castShadow} receiveShadow />
        <mesh geometry={parts.keyWells} material={mats.void} receiveShadow />
        <mesh geometry={parts.keys} material={mats.keycap} receiveShadow />
        <mesh geometry={parts.trackpadGap} material={mats.void} />
        <mesh geometry={parts.trackpad} material={mats.panel} receiveShadow />
        <mesh geometry={parts.grilles} material={grille.m} renderOrder={2} />
        <mesh geometry={parts.ports} material={mats.void} />
      </group>
      <group position={[0, hingeY, hingeZ]}>
        <mesh geometry={parts.hinge} material={mats.hinge} castShadow={castShadow} receiveShadow />
        <group rotation={[lidRot, 0, 0]}>
          <mesh geometry={parts.lid} material={lidMats} position={[0, lidGap, lidZ0 + L.lidDepth / 2]} castShadow={castShadow} receiveShadow />
          {/* the glass faces the lid's inner side; screen up is the lid's far edge */}
          <group position={[0, lidGap - 0.0004, lidZ0 + L.lidDepth / 2]} rotation={[Math.PI / 2, 0, 0]}>
            <DeviceScreen geometry={laptopScreenGeometry} radius={L.radius - L.glassInset} source={screen} look={look} spill={spill} />
            <group position={[0, glassH / 2 - L.topBezel / 2, 0.0003]}>
              <mesh geometry={parts.lens} material={mats.lens} />
              <mesh geometry={parts.lensRing} material={mats.hinge} />
            </group>
          </group>
        </group>
      </group>
    </group>
  );
};
