'use strict';

const path = require('path');
const os = require('os');
const fs = require('fs');

const APP_NAME = 'Clipper';
const APP_VERSION = '0.1.0';

/**
 * Resolve the path to a bundled binary.
 *
 * In development the binaries live in <project>/bin. When packaged with
 * electron-builder they move under resources/bin (extraResources). This helper
 * picks the right base for the current run mode.
 */
function binRoot() {
  if (process.env.CLIPPER_BIN) return process.env.CLIPPER_BIN;
  // When packaged, electron-builder copies bin/ -> resources/bin
  if (process.resourcesPath && fs.existsSync(path.join(process.resourcesPath, 'bin'))) {
    return path.join(process.resourcesPath, 'bin');
  }
  // Dev mode: <project root>/bin  (package.json main is src/main/index.js → up two)
  return path.join(__dirname, '..', '..', 'bin');
}

// Workspace: per-user documents folder. Override with CLIPPER_WORKSPACE.
const WORKSPACE = process.env.CLIPPER_WORKSPACE
  || path.join(os.homedir(), 'Documents', APP_NAME);

const settings = Object.freeze({
  appName: APP_NAME,
  version: APP_VERSION,
  paths: {
    workspace: WORKSPACE,
    videos: path.join(WORKSPACE, 'videos'),
    clips: path.join(WORKSPACE, 'clips'),
    subtitles: path.join(WORKSPACE, 'subtitles'),
    export: path.join(WORKSPACE, 'export'),
    cache: path.join(WORKSPACE, 'cache'),
    config: path.join(WORKSPACE, 'config.json'),
  },
  binaries: {
    root: binRoot(),
    ytdlp: path.join(binRoot(), process.platform === 'win32' ? 'yt-dlp.exe' : 'yt-dlp'),
    ffmpeg: path.join(binRoot(), process.platform === 'win32' ? 'ffmpeg.exe' : 'ffmpeg'),
    ffprobe: path.join(binRoot(), process.platform === 'win32' ? 'ffprobe.exe' : 'ffprobe'),
    whisper: path.join(binRoot(), 'whisper', process.platform === 'win32' ? 'whisper-cli.exe' : 'whisper-cli'),
    whisperModel: path.join(binRoot(), 'whisper', 'models', 'ggml-small.bin'),
  },
  /**
   * Supabase placeholder — NOT used yet. When auth is enabled, fill these in
   * and replace src/main/auth/index.js with a real implementation.
   */
  supabase: {
    url: '',
    anonKey: '',
    enabled: false,
  },
});

module.exports = settings;
