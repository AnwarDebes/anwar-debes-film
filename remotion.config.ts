import {Config} from '@remotion/cli/config';

// Headless Chrome ships with the GPU off; ANGLE turns WebGL on the real GPU.
Config.setChromiumOpenGlRenderer('angle');
Config.setVideoImageFormat('jpeg');
Config.setJpegQuality(92);
Config.setOverwriteOutput(true);
Config.setConcurrency(4);
// Long 3D sections are rendered in parts; keep the video cache modest.
Config.setOffthreadVideoCacheSizeInBytes(1024 * 1024 * 1024);
