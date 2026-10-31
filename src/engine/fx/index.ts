// Custom shaders and GPU particles for the film. Everything is a pure function of film time:
// particles are closed-form in time and a seed, passes run per render for the exact camera, and the
// lens model is PostFX's (camera.userData.lens), so sprites, lines and opaque geometry agree.
// Sprites take their projection from the camera that draws them (PostFX's guard band included);
// a rig only publishes the shutter's view matrices (camera.userData.shutterVP).
//
// Layers (FX_LAYER): glass surfaces, screen overlays and god-ray occluders are seen by the main
// camera; `inside` is drawn only in a glass box's view behind its glass.

// colour discipline
export {FX_PALETTE, REEL_GRADE, sceneColor, toneMap, invertToneMap, hexToLinear, type Look, type ToneMapName} from './color';

// scene plumbing
export {FX_LAYER, usePrePass, useFxLayers, useFxTime, updateLens, makeLensUniforms, type PrePass, type LensOptions, type LensOverride, type FxLensState, type ShutterVP} from './scene';
export {fxBus, type FxBus, type FxLight} from './bus';

// particles
export {Dust, type DustProps} from './particles/Dust';
export {Sparks, type SparksProps, type SparkSource} from './particles/Sparks';
export {Streams, type StreamsProps, type StreamCurve, type StreamLine} from './particles/Streams';
export {buildAtlas, sampleCurve, curvePoint, pointAtArc, type CurveSpec, type SampledCurve} from './particles/curves';
export {makeSpriteMaterial, makeLineMaterial, bindLens} from './particles/material';

// camera
export {FlightRig, type FlightRigProps} from './camera/FlightRig';
export {compileFlight, flightPoseAt, flightStateAt, flightLensAt, applyFlight, stateToPose, type FlightKey, type FlightTrack} from './camera/flight';

// the repo constellation
export {REPOS, type Repo, type RepoTier} from './constellation/repos';
export {REPO_LINKS, CHAPTERS, type RepoLink, type LinkKind} from './constellation/links';
export {constellationLayout, hashString, TIER_WEIGHT, type ConstellationLayout, type LayoutNode, type LayoutLink, type LayoutLane, type LayoutOptions} from './constellation/layout';
export {Constellation, nodeRevealAt, ignition, type ConstellationProps, type ConstellationReveal} from './constellation/Constellation';
export {ConstellationLabels, defaultMeta, type ConstellationLabelsProps} from './constellation/Labels';

// looks
export {Mist, type MistProps} from './looks/Mist';
export {GodRays, useOccluder, occlusionBlending, type GodRaysProps, type GodRaysLight} from './looks/GodRays';
export {GlassBox, type GlassBoxProps} from './looks/GlassBox';
export {glassCells, cellSizeFor, type ClaritySweep, type GlassCell} from './looks/glassCells';
export {PinCluster, pinLathe, hexLattice, type PinClusterProps, type ClusterPin} from './looks/PinCluster';
export {FxStudio, type FxStudioProps} from './looks/Studio';
