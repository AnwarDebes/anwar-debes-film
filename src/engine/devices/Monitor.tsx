// A procedural desktop display: a thin graphite panel with uniform bezels and a polished edge, on
// an angled neck and a weighted foot plate. Units: 1 = 10 cm. Stands on y = 0, screen faces +z.
import React, {useLayoutEffect, useMemo} from 'react';
import type {ThreeElements} from '@react-three/fiber';
import * as THREE from 'three';
import {DeviceScreen, type ScreenSource} from './DeviceScreen';
import {roundedSlab} from './geometry';
import {createDeviceMaterials, type DeviceFinish} from './materials';
import type {ScreenGeometry, ScreenLook} from './screenMaterial';

export const MONITOR = {
  /** active area width; height follows the aspect */
  activeWidth: 6.0,
  aspect: 16 / 10,
  bezel: 0.085,
  thickness: 0.15,
  radius: 0.09,
  /** height of the panel's lower edge above the desk */
  lift: 0.95,
  glassInset: 0.012,
} as const;

const M = MONITOR;

const dims = (aspect: number) => {
  const activeH = M.activeWidth / aspect;
  const panelW = M.activeWidth + 2 * (M.bezel + M.glassInset);
  const panelH = activeH + 2 * (M.bezel + M.glassInset);
  const glassW = panelW - 2 * M.glassInset;
  const glassH = panelH - 2 * M.glassInset;
  const centreY = M.lift + panelH / 2;
  return {activeH, panelW, panelH, glassW, glassH, centreY};
};

export function monitorScreenGeometry(aspect: number = M.aspect): ScreenGeometry {
  const d = dims(aspect);
  return {
    width: d.glassW,
    height: d.glassH,
    active: {x: 0, y: 0, width: M.activeWidth, height: d.activeH, radius: 0.012},
    dot: {x: 0, y: d.glassH / 2 - (M.bezel + M.glassInset) / 2, r: 0.016},
  };
}

/** Pose of the display in monitor space (see laptopScreenPose). */
export function monitorScreenPose(aspect: number = M.aspect, tiltDeg = 4) {
  const d = dims(aspect);
  const m = new THREE.Matrix4()
    .makeTranslation(0, d.centreY, 0)
    .multiply(new THREE.Matrix4().makeRotationX(-THREE.MathUtils.degToRad(tiltDeg)))
    .multiply(new THREE.Matrix4().makeTranslation(0, 0, M.thickness / 2 + 0.0004));
  const centre = new THREE.Vector3().applyMatrix4(m);
  const basis = new THREE.Matrix3().setFromMatrix4(m);
  const right = new THREE.Vector3(1, 0, 0).applyMatrix3(basis).normalize();
  const up = new THREE.Vector3(0, 1, 0).applyMatrix3(basis).normalize();
  const normal = new THREE.Vector3(0, 0, 1).applyMatrix3(basis).normalize();
  const point = (u: number, v: number, target = new THREE.Vector3()) =>
    target.copy(centre).addScaledVector(right, (u - 0.5) * M.activeWidth).addScaledVector(up, (v - 0.5) * d.activeH);
  return {centre, right, up, normal, width: M.activeWidth, height: d.activeH, point};
}

export type MonitorProps = Omit<ThreeElements['group'], 'children'> & {
  finish?: DeviceFinish;
  /** screen aspect (width / height), default 16:10 to match the recordings */
  aspect?: number;
  /** backward tilt of the panel in degrees */
  tilt?: number;
  screen?: ScreenSource;
  look?: ScreenLook;
  spill?: number;
  castShadow?: boolean;
};

export const Monitor: React.FC<MonitorProps> = ({finish = 'graphite', aspect = M.aspect, tilt = 4, screen, look, spill = 0.5, castShadow = true, ...group}) => {
  const mats = useMemo(() => createDeviceMaterials(finish), [finish]);
  const d = useMemo(() => dims(aspect), [aspect]);
  const screenGeo = useMemo(() => monitorScreenGeometry(aspect), [aspect]);

  const parts = useMemo(() => {
    // panel, built flat (front = +y) and stood up: front faces +z, centred on its own origin
    const panel = roundedSlab({
      width: d.panelW,
      depth: d.panelH,
      height: M.thickness,
      radius: M.radius,
      top: {kind: 'round', r: 0.012},
      bottom: {kind: 'round', r: 0.05},
      cornerSegments: 16,
      profileSegments: 8,
    });
    panel.translate(0, -M.thickness / 2, 0).rotateX(Math.PI / 2);
    // neck: a slab leaning back from the foot to the back of the panel
    const neckLen = d.centreY + 0.2;
    const neck = roundedSlab({width: 1.02, depth: neckLen, height: 0.1, radius: 0.1, top: {kind: 'round', r: 0.02}, bottom: {kind: 'round', r: 0.02}, cornerSegments: 10, profileSegments: 5});
    neck.translate(0, -0.05, 0).rotateX(Math.PI / 2);
    // foot plate
    const foot = roundedSlab({width: 2.5, depth: 1.9, height: 0.07, radius: 0.32, top: {kind: 'round', r: 0.02}, bottom: {kind: 'round', r: 0.012}, cornerSegments: 16, profileSegments: 5});
    return {panel, neck, foot, neckLen};
  }, [d]);

  const slabMats = useMemo(() => [mats.void, mats.edge, mats.body, mats.body, mats.body], [mats]);
  const plainMats = useMemo(() => [mats.body, mats.edge, mats.body, mats.body, mats.body], [mats]);

  useLayoutEffect(
    () => () => {
      parts.panel.dispose();
      parts.neck.dispose();
      parts.foot.dispose();
      mats.dispose();
    },
    [parts, mats],
  );

  // the neck rises from the back of the foot and leans forward to meet the back of the panel
  const neckBottomZ = -0.62;
  const neckTopZ = -M.thickness / 2 - 0.06;
  const neckTilt = Math.atan2(neckTopZ - neckBottomZ, parts.neckLen);
  return (
    <group {...group}>
      <mesh geometry={parts.foot} material={plainMats} position={[0, 0, -0.3]} castShadow={castShadow} receiveShadow />
      <mesh
        geometry={parts.neck}
        material={plainMats}
        position={[0, (parts.neckLen / 2) * Math.cos(neckTilt) + 0.03, (neckBottomZ + neckTopZ) / 2]}
        rotation={[neckTilt, 0, 0]}
        castShadow={castShadow}
        receiveShadow
      />
      <group position={[0, d.centreY, 0]} rotation={[-THREE.MathUtils.degToRad(tilt), 0, 0]}>
        <mesh geometry={parts.panel} material={slabMats} castShadow={castShadow} receiveShadow />
        <group position={[0, 0, M.thickness / 2 + 0.0004]}>
          <DeviceScreen geometry={screenGeo} radius={M.radius - M.glassInset} source={screen} look={look} spill={spill} />
        </group>
      </group>
    </group>
  );
};
