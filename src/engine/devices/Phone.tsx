// A procedural phone: polished steel frame band, matte back glass with a camera island, side
// buttons, and a front glass with a thin bezel and a punch-hole camera drawn by the screen shader.
// Units: 1 = 10 cm. Centred on its own origin, screen facing +z, up is +y.
import React, {useLayoutEffect, useMemo} from 'react';
import type {ThreeElements} from '@react-three/fiber';
import * as THREE from 'three';
import {DeviceScreen, type ScreenSource} from './DeviceScreen';
import {mergeParts, place, roundedSlab} from './geometry';
import {createDeviceMaterials, noBloom, type DeviceFinish} from './materials';
import type {ScreenGeometry, ScreenLook} from './screenMaterial';

export const PHONE = {
  width: 0.716,
  height: 1.47,
  thickness: 0.078,
  radius: 0.108,
  edge: 0.011,
  glassInset: 0.0125,
  bezel: 0.0115,
} as const;

const P = PHONE;
const glassW = P.width - 2 * P.glassInset;
const glassH = P.height - 2 * P.glassInset;
const activeW = glassW - 2 * P.bezel;
const activeH = glassH - 2 * P.bezel;

export const phoneScreenGeometry: ScreenGeometry = {
  width: glassW,
  height: glassH,
  active: {x: 0, y: 0, width: activeW, height: activeH, radius: P.radius - P.glassInset - P.bezel * 0.6},
  dot: {x: 0, y: activeH / 2 - 0.032, r: 0.0132},
  pill: {y: -activeH / 2 + 0.0145, width: 0.236, height: 0.0092, opacity: 0.62},
};

/** Fraction of the display kept black at the top for the status bar (the punch hole sits in it). */
export const PHONE_STATUS_BAR = 0.054;

/** Pose of the display in phone space (see laptopScreenPose). */
export function phoneScreenPose() {
  const centre = new THREE.Vector3(0, 0, P.thickness / 2 + 0.0004);
  const right = new THREE.Vector3(1, 0, 0);
  const up = new THREE.Vector3(0, 1, 0);
  const normal = new THREE.Vector3(0, 0, 1);
  const point = (u: number, v: number, target = new THREE.Vector3()) =>
    target.copy(centre).addScaledVector(right, (u - 0.5) * activeW).addScaledVector(up, (v - 0.5) * activeH);
  return {centre, right, up, normal, width: activeW, height: activeH, point};
}

export type PhoneProps = Omit<ThreeElements['group'], 'children'> & {
  finish?: DeviceFinish;
  screen?: ScreenSource;
  look?: ScreenLook;
  spill?: number;
  castShadow?: boolean;
};

export const Phone: React.FC<PhoneProps> = ({finish = 'graphite', screen, look, spill = 0, castShadow = true, ...group}) => {
  const mats = useMemo(() => createDeviceMaterials(finish), [finish]);
  const frame = useMemo(() => {
    const m = noBloom(mats.edge.clone());
    m.color.set(finish === 'silver' ? '#dfe3e4' : '#9aa2a5');
    m.roughness = 0.2;
    return m;
  }, [mats, finish]);

  const parts = useMemo(() => {
    // the body, built flat (front = +y) and stood up: front faces +z
    const body = roundedSlab({
      width: P.width,
      depth: P.height,
      height: P.thickness,
      radius: P.radius,
      top: {kind: 'round', r: P.edge},
      bottom: {kind: 'round', r: P.edge},
      cornerSegments: 20,
      profileSegments: 8,
    });
    body.translate(0, -P.thickness / 2, 0).rotateX(Math.PI / 2);
    // camera island on the back (top left as seen from behind = top right in phone space x > 0)
    const islandSize = 0.33;
    const islandX = P.width / 2 - 0.032 - islandSize / 2;
    const islandY = P.height / 2 - 0.032 - islandSize / 2;
    const island = roundedSlab({width: islandSize, depth: islandSize, height: 0.013, radius: 0.085, top: {kind: 'round', r: 0.005}, cornerSegments: 12, profileSegments: 4});
    island.rotateX(-Math.PI / 2).translate(islandX, islandY, -P.thickness / 2 + 0.0005);
    const lensAt: Array<[number, number, number]> = [
      [islandX + 0.075, islandY + 0.075, 0.058],
      [islandX + 0.075, islandY - 0.075, 0.058],
      [islandX - 0.08, islandY + 0.0, 0.05],
    ];
    const rings = mergeParts(
      lensAt.map(([x, y, r]) => place(new THREE.CylinderGeometry(r + 0.006, r + 0.008, 0.012, 48, 1).rotateX(Math.PI / 2), x, y, -P.thickness / 2 - 0.013 - 0.004)),
    );
    const glass = mergeParts(lensAt.map(([x, y, r]) => place(new THREE.CircleGeometry(r, 48).rotateY(Math.PI), x, y, -P.thickness / 2 - 0.013 - 0.0102)));
    const flash = place(new THREE.CircleGeometry(0.018, 32).rotateY(Math.PI), islandX - 0.08, islandY - 0.1, -P.thickness / 2 - 0.0137);
    // buttons
    const button = (len: number, x: number, y: number, side: 1 | -1) =>
      place(
        roundedSlab({width: 0.03, depth: len, height: 0.01, radius: 0.014, top: {kind: 'round', r: 0.004}, cornerSegments: 6, profileSegments: 3}),
        x,
        y,
        0,
        Math.PI / 2,
        0,
        side === 1 ? -Math.PI / 2 : Math.PI / 2,
      );
    const buttons = mergeParts([
      button(0.19, P.width / 2 - 0.004, 0.27, 1),
      button(0.12, -P.width / 2 + 0.004, 0.36, -1),
      button(0.12, -P.width / 2 + 0.004, 0.21, -1),
      button(0.06, -P.width / 2 + 0.004, 0.5, -1),
    ]);
    return {body, island, rings, glass, flash, buttons};
  }, []);

  // body groups: front cap (under the glass), front edge, band, back edge, back cap
  const bodyMats = useMemo(() => [mats.void, frame, frame, frame, mats.backGlass], [mats, frame]);
  const islandMats = useMemo(() => [mats.backGlass, frame, frame, frame, mats.backGlass], [mats, frame]);

  useLayoutEffect(
    () => () => {
      Object.values(parts).forEach((g) => g.dispose());
      mats.dispose();
      frame.dispose();
    },
    [parts, mats, frame],
  );

  return (
    <group {...group}>
      <mesh geometry={parts.body} material={bodyMats} castShadow={castShadow} receiveShadow />
      <mesh geometry={parts.island} material={islandMats} castShadow={castShadow} />
      <mesh geometry={parts.rings} material={frame} />
      <mesh geometry={parts.glass} material={mats.lens} />
      <mesh geometry={parts.flash} material={mats.panel} />
      <mesh geometry={parts.buttons} material={frame} castShadow={castShadow} />
      <group position={[0, 0, P.thickness / 2 + 0.0004]}>
        <DeviceScreen geometry={phoneScreenGeometry} radius={P.radius - P.glassInset} source={screen} look={look} spill={spill} />
      </group>
    </group>
  );
};
