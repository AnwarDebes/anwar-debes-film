// A device's glass and display. Shows a recording (mp4 in public/, decoded by @remotion/media and
// synchronised to the Remotion frame) or any texture.
//
// Video path: <Video headless onVideoFrame> from @remotion/media, the documented replacement for
// the deprecated useOffthreadVideoTexture (which also throws outside of rendering). Each decoded
// frame (an ImageBitmap while rendering, the player's canvas in preview) becomes the texture's
// source directly, a GPU to GPU upload with no intermediate canvas, and the R3F root is advanced
// synchronously inside the callback, so the upload happens while the bitmap is still open and the
// captured frame always contains the video frame of exactly that composition frame (the <Video>
// holds a delayRender handle until its frame has been delivered).
import React, {useCallback, useLayoutEffect, useMemo, useRef} from 'react';
import {useThree} from '@react-three/fiber';
import {Video} from '@remotion/media';
import {noteSource} from '../ledger/sources';
import {Freeze, useCurrentFrame, useRemotionEnvironment, useVideoConfig} from 'remotion';
import * as THREE from 'three';
import {RectAreaLightUniformsLib} from 'three/examples/jsm/lights/RectAreaLightUniformsLib.js';
import {roundedPlate} from './geometry';
import {createScreenMaterial, defaultLook, SCREEN_WHITE, screenRadianceOfGrey, type ScreenCrop, type ScreenFit, type ScreenGeometry, type ScreenInset, type ScreenLook} from './screenMaterial';

export interface ScreenSource {
  /** an mp4 (e.g. staticFile(recordings.trace.src)); decoded frame-exactly */
  src?: string;
  /** or any texture (canvas, render target...); used when there is no src */
  texture?: THREE.Texture | null;
  /** pixel size of the content; taken from the first decoded frame when omitted */
  size?: [number, number];
  /** Remotion trimBefore, in frames of the composition */
  trimBefore?: number;
  playbackRate?: number;
  loop?: boolean;
  /**
   * Length of the video in its own frames. Past its end the last frame holds (frame-exact in every
   * render tab); without it, frames past the end keep whatever the tab decoded last.
   */
  durationInFrames?: number;
  /**
   * While rendering, skip the scene render ThreeCanvas makes before this frame's video frame has
   * arrived (it is never captured). Default true; only applies when delivery is certain.
   */
  skipStaleRender?: boolean;
  fit?: ScreenFit;
  /** show only part of the content (normalised, from the top left) */
  crop?: ScreenCrop;
  /** black band at the top of the display (a phone's status bar area) */
  inset?: ScreenInset;
}

export interface DeviceScreenProps {
  geometry: ScreenGeometry;
  /** glass outline corner radius (world units) */
  radius: number;
  source?: ScreenSource;
  look?: ScreenLook;
  /** light the display throws on the device and surroundings; 1 = physically matched (0 = none) */
  spill?: number;
  /** order the glass is drawn in its group */
  renderOrder?: number;
}

let rectLightsReady = false;

// sRGB byte -> linear, for averaging the display's colour
const SRGB_TO_LINEAR = new Float32Array(256);
for (let i = 0; i < 256; i++) {
  const c = i / 255;
  SRGB_TO_LINEAR[i] = c <= 0.04045 ? c / 12.92 : Math.pow((c + 0.055) / 1.055, 2.4);
}

// While rendering, the screens of a scene that are still waiting for this frame's video frame.
// ThreeCanvas renders every frame from a passive effect, before any decoded frame can have
// arrived, and that image is never captured (each <Video> holds a delayRender until its frame is
// delivered). While a screen waits, the scene is hidden, so that render costs almost nothing; the
// last screen to receive its frame shows the scene again and renders the frame that is captured.
// Only used when delivery is certain (a looping source, or one whose length is known).
const waiting = new WeakMap<THREE.Object3D, {screens: Set<object>; visible: boolean}>();

const holdScene = (scene: THREE.Object3D, token: object) => {
  let w = waiting.get(scene);
  if (!w) {
    w = {screens: new Set(), visible: scene.visible};
    waiting.set(scene, w);
  }
  if (w.screens.size === 0) {
    w.visible = scene.visible;
    scene.visible = false;
  }
  w.screens.add(token);
};

/** Release a screen's hold; true when no screen of the scene is waiting any more. */
const releaseScene = (scene: THREE.Object3D, token: object): boolean => {
  const w = waiting.get(scene);
  if (!w) return true;
  if (w.screens.delete(token) && w.screens.size === 0) scene.visible = w.visible;
  return w.screens.size === 0;
};

const ScreenFeed: React.FC<{
  source: ScreenSource;
  onFrame: (frame: CanvasImageSource, w: number, h: number) => void;
}> = ({source, onFrame}) => {
  const {isRendering} = useRemotionEnvironment();
  const advance = useThree((s) => s.advance);
  const invalidate = useThree((s) => s.invalidate);
  const scene = useThree((s) => s.scene);
  const token = useMemo(() => ({}), []);
  const frame = useCurrentFrame();
  const {fps: noteFps} = useVideoConfig();
  const onVideoFrame = useCallback(
    (f: CanvasImageSource) => {
      const img = f as unknown as {displayWidth?: number; displayHeight?: number; width: number; height: number};
      onFrame(f, img.displayWidth ?? img.width, img.displayHeight ?? img.height);
      // render now, while the decoded frame is still open: during rendering the frame is captured
      // once every delayRender is released
      if (isRendering) {
        if (releaseScene(scene, token)) advance(performance.now());
      } else invalidate();
    },
    [advance, invalidate, isRendering, onFrame, scene, token],
  );
  const rate = source.playbackRate ?? 1;
  // the last composition frame that still has a video frame of its own
  const last =
    source.durationInFrames !== undefined && !source.loop
      ? Math.max(0, Math.floor((source.durationInFrames - 1 - (source.trimBefore ?? 0)) / rate))
      : Infinity;
  const certain = isRendering && !!source.src && source.skipStaleRender !== false && (!!source.loop || source.durationInFrames !== undefined);
  useLayoutEffect(() => {
    if (!certain) return;
    holdScene(scene, token);
    return () => {
      releaseScene(scene, token);
    };
  }, [certain, frame, scene, token]);
  if (!source.src) return null;
  noteSource(frame / noteFps, {kind: 'capture', src: source.src});
  return (
    <Freeze frame={Number.isFinite(last) ? last : 0} active={frame > last}>
      <Video
        src={source.src}
        headless
        muted
        onVideoFrame={onVideoFrame}
        trimBefore={source.trimBefore}
        playbackRate={rate}
        loop={source.loop ?? false}
      />
    </Freeze>
  );
};

export const DeviceScreen: React.FC<DeviceScreenProps> = ({geometry, radius, source, look, spill = 0, renderOrder}) => {
  const gl = useThree((s) => s.gl);
  const handle = useMemo(() => createScreenMaterial(geometry), [geometry]);
  const plate = useMemo(() => roundedPlate(geometry.width, geometry.height, radius, 14).rotateX(Math.PI / 2), [geometry.width, geometry.height, radius]);

  // the feed: a texture whose source is each decoded frame (created during render, never in an effect)
  const feed = useMemo(() => {
    const texture = new THREE.Texture();
    // decoded frames ignore UNPACK_FLIP_Y: the content transform flips instead (see setContent)
    texture.flipY = false;
    texture.colorSpace = THREE.SRGBColorSpace;
    texture.generateMipmaps = true;
    texture.minFilter = THREE.LinearMipmapLinearFilter;
    texture.magFilter = THREE.LinearFilter;
    texture.anisotropy = gl.capabilities.getMaxAnisotropy();
    // a tiny GPU canvas for the colour of the light the display throws: the frame is reduced on
    // the GPU and only 16 x 10 pixels are read back
    const probe = document.createElement('canvas');
    probe.width = 16;
    probe.height = 10;
    const pctx = probe.getContext('2d', {alpha: false})!;
    const [w, h] = source?.size ?? [1600, 1000];
    return {texture, probe, pctx, ready: false, width: 0, height: 0, nominal: [w, h] as [number, number]};
    // the feed lives as long as the screen
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [gl]);

  const light = useMemo(() => {
    if (!rectLightsReady) {
      RectAreaLightUniformsLib.init();
      rectLightsReady = true;
    }
    const l = new THREE.RectAreaLight('#ffffff', 0, geometry.active.width, geometry.active.height);
    l.position.set(geometry.active.x, geometry.active.y, 0.002);
    // a RectAreaLight emits along its -z; the glass faces +z
    l.rotation.set(0, Math.PI, 0);
    return l;
  }, [geometry]);
  // average colour of the content (display-linear), measured from each decoded frame
  const contentMean = useRef(new THREE.Color(0, 0, 0));

  const fit = source?.fit ?? 'cover';
  const crop = source?.crop;
  const inset = source?.inset;
  const external = source?.texture ?? null;

  // The light the display throws: an area light the size of the display whose radiance is the
  // mean of what the glass emits. Black and white pixels are exact (the grade's inverse maps them
  // to 0 and to the white radiance); greys in between are a close approximation.
  const applySpill = useCallback(
    (l: ScreenLook | undefined, amount: number) => {
      const lk = {...defaultLook, ...l};
      const level = Math.max(0, lk.power) * Math.max(0, lk.brightness);
      const white = level > 0 ? screenRadianceOfGrey(lk.tone, lk.exposure, SCREEN_WHITE * Math.min(1.15, level)) : 0;
      const m = contentMean.current;
      light.color.setRGB(m.r * white, m.g * white, m.b * white, THREE.LinearSRGBColorSpace);
      light.intensity = amount;
    },
    [light],
  );

  // the latest props, for the frame callback (kept stable: <Video> restarts its extraction when
  // its onVideoFrame changes)
  const latest = useRef({fit, crop, inset, look, spill});
  latest.current = {fit, crop, inset, look, spill};

  // look, content mapping and spill: pure functions of this frame's props
  useLayoutEffect(() => {
    handle.setLook(look ?? {});
    if (source?.src) {
      handle.setContent(feed.ready ? feed.texture : null, feed.ready ? feed.width : feed.nominal[0], feed.ready ? feed.height : feed.nominal[1], fit, crop, inset);
    } else if (external) {
      const img = external.image as {width?: number; height?: number} | undefined;
      handle.setContent(external, img?.width ?? 16, img?.height ?? 10, fit, crop, inset);
    } else {
      handle.setContent(null, 16, 10, fit, crop, inset);
    }
    applySpill(look, spill);
  }, [handle, look, source?.src, external, fit, crop, inset, feed, spill, applySpill]);

  const onFrame = useCallback(
    (frame: CanvasImageSource, w: number, h: number) => {
      const p = latest.current;
      if (feed.width !== w || feed.height !== h) {
        // new size: drop the GPU texture so the next upload allocates the right storage
        feed.width = w;
        feed.height = h;
        feed.texture.dispose();
      }
      feed.texture.image = frame;
      feed.texture.needsUpdate = true;
      feed.ready = true;
      handle.setContent(feed.texture, w, h, p.fit, p.crop, p.inset);
      if (p.spill > 0) {
        // mean colour of this frame, in linear light (the GPU reduces it to 16 x 10 pixels)
        feed.pctx.drawImage(frame, 0, 0, feed.probe.width, feed.probe.height);
        const px = feed.pctx.getImageData(0, 0, feed.probe.width, feed.probe.height).data;
        let r = 0, g = 0, b = 0;
        const n = px.length / 4;
        for (let i = 0; i < px.length; i += 4) {
          r += SRGB_TO_LINEAR[px[i]];
          g += SRGB_TO_LINEAR[px[i + 1]];
          b += SRGB_TO_LINEAR[px[i + 2]];
        }
        contentMean.current.setRGB(r / n, g / n, b / n, THREE.LinearSRGBColorSpace);
        applySpill(p.look, p.spill);
      }
    },
    [feed, handle, applySpill],
  );

  useLayoutEffect(
    () => () => {
      handle.material.dispose();
      plate.dispose();
      feed.texture.dispose();
    },
    [handle, plate, feed],
  );

  return (
    <>
      <mesh geometry={plate} material={handle.material} renderOrder={renderOrder} />
      {spill > 0 ? <primitive object={light} /> : null}
      {source?.src ? <ScreenFeed source={source} onFrame={onFrame} /> : null}
    </>
  );
};
