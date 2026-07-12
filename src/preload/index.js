'use strict';

const { contextBridge, ipcRenderer } = require('electron');

/**
 * window.api — the only bridge between the renderer and the main process.
 * Each method is a thin wrapper around ipcRenderer.invoke(channel, payload).
 */
const api = {
  // ── Settings / license ──────────────────────────────────────────
  settings: {
    get: () => ipcRenderer.invoke('get-app-settings'),
  },
  license: {
    check: () => ipcRenderer.invoke('check-license'),
  },

  // ── Download ────────────────────────────────────────────────────
  download: {
    getInfo: (url) => ipcRenderer.invoke('get-video-info', { url }),
    checkPlaylist: (url) => ipcRenderer.invoke('check-playlist', { url }),
    start: (url, quality) => ipcRenderer.invoke('download-video', { url, quality }),
    onProgress: (cb) => {
      const handler = (_e, payload) => cb(payload);
      ipcRenderer.on('download-progress', handler);
      return () => ipcRenderer.removeListener('download-progress', handler);
    },
  },

  // ── Library ─────────────────────────────────────────────────────
  library: {
    getVideos: () => ipcRenderer.invoke('get-videos'),
    getClips: () => ipcRenderer.invoke('get-clips'),
    selectVideoFile: () => ipcRenderer.invoke('select-video-file'),
    getVideoPath: (name) => ipcRenderer.invoke('get-video-path', name),
    getDuration: (videoPath) => ipcRenderer.invoke('get-video-duration', { videoPath }),
    openFolder: (targetPath) => ipcRenderer.invoke('open-folder', targetPath),
    localPreview: (filePath) => ipcRenderer.invoke('get-local-preview', { path: filePath }),
  },

  // ── Clip ────────────────────────────────────────────────────────
  clip: {
    run: (jobs) => ipcRenderer.invoke('clip-video', { jobs }),
    onProgress: (cb) => {
      const handler = (_e, payload) => cb(payload);
      ipcRenderer.on('clip-progress', handler);
      return () => ipcRenderer.removeListener('clip-progress', handler);
    },
  },

  // ── Subtitle / transcription / export ───────────────────────────
  subtitle: {
    transcribe: (clipPath, language = 'id') =>
      ipcRenderer.invoke('generate-subtitle', { clipPath, language }),
    getText: (clipPath) => ipcRenderer.invoke('get-subtitle-text', { clipPath }),
    saveText: (clipPath, text) => ipcRenderer.invoke('save-subtitle-text', { clipPath, text }),
    getStyle: () => ipcRenderer.invoke('get-subtitle-style-config'),
    saveStyle: (style) => ipcRenderer.invoke('save-subtitle-style-config', { style }),
    export: (clipPath, style, overwrite) => ipcRenderer.invoke('export-video', { clipPath, style, overwrite }),
    openExportFolder: () => ipcRenderer.invoke('open-export-folder'),
    onTranscriptionProgress: (cb) => {
      const handler = (_e, payload) => cb(payload);
      ipcRenderer.on('transcription-progress', handler);
      return () => ipcRenderer.removeListener('transcription-progress', handler);
    },
    onExportProgress: (cb) => {
      const handler = (_e, payload) => cb(payload);
      ipcRenderer.on('export-progress', handler);
      return () => ipcRenderer.removeListener('export-progress', handler);
    },
  },
};

contextBridge.exposeInMainWorld('api', api);
