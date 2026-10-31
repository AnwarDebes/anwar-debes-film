// Devices: real recordings of the live apps on procedural 3D hardware.
//
//   <ThreeCanvas shadows="percentage" ...>
//     <DeviceStudio contactShadow={{width: LAPTOP.width, depth: LAPTOP.depth}} />
//     <Laptop screen={recordingSource('trace')} lidAngle={112} />
//     <PostFX width={w} height={h} focusDistance={...} bloom={0} />
//   </ThreeCanvas>
//
// Units are 1 = 10 cm, devices stand on y = 0 and face +z. Screens emit through the inverse of
// PostFX's grade, so recordings keep their own colours: pass the same toneMapping / exposure as
// look={{tone, exposure}} (AgX at 1 by default; REEL_LOOK is ACES at 0.92). See screenMaterial.ts.
export {Laptop, LAPTOP, laptopScreenPose, laptopScreenGeometry, type LaptopProps} from './Laptop';
export {Phone, PHONE, PHONE_STATUS_BAR, phoneScreenPose, phoneScreenGeometry, type PhoneProps} from './Phone';
export {Monitor, MONITOR, monitorScreenPose, monitorScreenGeometry, type MonitorProps} from './Monitor';
export {DeviceScreen, type DeviceScreenProps, type ScreenSource} from './DeviceScreen';
export {
  createScreenMaterial,
  defaultLook,
  SCREEN_TONE,
  SCREEN_WHITE,
  screenRadianceOfGrey,
  type ScreenLook,
  type ScreenTone,
  type ScreenFit,
  type ScreenCrop,
  type ScreenInset,
  type ScreenGeometry,
} from './screenMaterial';
export {DeviceStudio, StudioEnvironment, createStudioScene, FILM_STUDIO, PRODUCT_STUDIO, type DeviceStudioProps, type StudioLevels} from './DeviceStudio';
export {createDeviceMaterials, noBloom, type DeviceFinish, type DeviceMaterials} from './materials';
export {recordings, recordingSource, type Recording, type RecordingName} from './recordings';
export {applyPose, blendPose, easeCamera, easeUi, focusDistance, orbitPosition, type OrbitPose} from './camera';
export {roundedSlab, roundedPlate, roundedFrame, keyboardLayout, SLAB_GROUP, type SlabSpec, type EdgeProfile} from './geometry';
