'use strict';

const { ipcMain, BrowserWindow } = require('electron');
const path = require('path');
const fs = require('fs');
const settings = require('../settings');
const { safeName } = require('../workspace');
const ffmpeg = require('../engines/ffmpeg');

/** Convert seconds → HH:MM:SS for log readability. */
function fmtTime(sec) {
  const s = Math.max(0, Math.floor(sec));
  const h = Math.floor(s / 3600);
  const m = Math.floor((s % 3600) / 60);
  const r = s % 60;
  return [h, m, r].map((n) => String(n).padStart(2, '0')).join(':');
}

function register() {
  /**
   * Clip one or many segments from a video. Accepts a single job or a list.
   * Each job: { videoPath, startSec, durationSec, aspect, title }
   * Progress is reported per-item.
   */
  ipcMain.handle('clip-video', async (event, { jobs }) => {
    const list = Array.isArray(jobs) ? jobs : [jobs];
    const win = BrowserWindow.fromWebContents(event.sender);
    const send = (p) => { if (win && !win.isDestroyed()) win.webContents.send('clip-progress', p); };

    const results = [];
    for (let i = 0; i < list.length; i++) {
      const job = list[i];
      const baseName = safeName(job.title || `clip_${fmtTime(job.startSec)}`) || `clip_${i + 1}`;
      const outName = `${baseName}.mp4`;
      const outputPath = path.join(settings.paths.clips, outName);

      send({ stage: 'clipping', index: i, total: list.length, name: outName });

      try {
        await ffmpeg.clipVideo({
          videoPath: job.videoPath,
          outputPath,
          startSec: job.startSec,
          durationSec: job.durationSec,
          aspect: job.aspect || 'original',
          onProgress: ({ percent }) => send({ stage: 'clipping', index: i, total: list.length, name: outName, percent }),
        });
        results.push({ success: true, outputPath, name: outName });
        send({ stage: 'item-done', index: i, total: list.length, name: outName });
      } catch (err) {
        results.push({ success: false, name: outName, error: err.message });
        send({ stage: 'item-error', index: i, total: list.length, name: outName, error: err.message });
      }
    }

    send({ stage: 'done' });
    return { success: true, results };
  });
}

module.exports = { register };
