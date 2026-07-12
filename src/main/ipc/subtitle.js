'use strict';

const { ipcMain, BrowserWindow } = require('electron');
const path = require('path');
const fs = require('fs');
const settings = require('../settings');
const { readConfig, writeConfig, safeName } = require('../workspace');
const whisper = require('../engines/whisper');
const ffmpeg = require('../engines/ffmpeg');
const subtitles = require('../engines/subtitles');

/** Where the SRT for a given clip lives. */
function srtPathFor(clipPath) {
  const base = path.basename(clipPath, path.extname(clipPath));
  return path.join(settings.paths.subtitles, `${base}.srt`);
}

function register() {
  // ── Transcription ────────────────────────────────────────────────
  ipcMain.handle('generate-subtitle', async (event, { clipPath, language = 'id' }) => {
    const win = BrowserWindow.fromWebContents(event.sender);
    const send = (p) => { if (win && !win.isDestroyed()) win.webContents.send('transcription-progress', p); };

    try {
      send({ stage: 'starting' });
      const { srtPath, text } = await whisper.transcribe({
        inputPath: clipPath,
        language,
        onProgress: ({ percent }) => send({ stage: 'transcribing', percent }),
      });

      // Copy SRT next to subtitle store under the clip's name
      const dest = srtPathFor(clipPath);
      fs.copyFileSync(srtPath, dest);

      send({ stage: 'done' });
      return { success: true, srtPath: dest, text };
    } catch (err) {
      return { success: false, error: err.message };
    }
  });

  // ── Subtitle text read/save (after user edits) ───────────────────
  ipcMain.handle('get-subtitle-text', async (_e, { clipPath }) => {
    const p = srtPathFor(clipPath);
    if (!fs.existsSync(p)) return { success: false, error: 'No subtitle file for this clip yet.' };
    return { success: true, text: fs.readFileSync(p, 'utf8') };
  });

  ipcMain.handle('save-subtitle-text', async (_e, { clipPath, text }) => {
    try {
      const p = srtPathFor(clipPath);
      fs.writeFileSync(p, text || '', 'utf8');
      return { success: true };
    } catch (err) {
      return { success: false, error: err.message };
    }
  });

  // ── Style config (persisted across sessions) ─────────────────────
  ipcMain.handle('get-subtitle-style-config', async () => {
    const cfg = readConfig();
    return { success: true, style: cfg.subtitleStyle || defaultStyle() };
  });

  ipcMain.handle('save-subtitle-style-config', async (_e, { style }) => {
    const cfg = readConfig();
    cfg.subtitleStyle = style;
    const ok = writeConfig(cfg);
    return { success: ok };
  });

  // ── Export (burn subtitles) ──────────────────────────────────────
  ipcMain.handle('export-video', async (event, { clipPath, style, overwrite }) => {
    const win = BrowserWindow.fromWebContents(event.sender);
    const send = (p) => { if (win && !win.isDestroyed()) win.webContents.send('export-progress', p); };

    try {
      const srtPath = srtPathFor(clipPath);
      if (!fs.existsSync(srtPath)) {
        return { success: false, error: 'No subtitle file found. Run transcription first.' };
      }

      const baseName = safeName(path.basename(clipPath, path.extname(clipPath)));
      let outputPath;
      if (overwrite) {
        outputPath = path.join(settings.paths.export, baseName + '_sub.mp4');
      } else {
        let i = 1;
        do {
          const suffix = i === 1 ? '_sub' : '_sub_' + i;
          outputPath = path.join(settings.paths.export, baseName + suffix + '.mp4');
          i++;
        } while (fs.existsSync(outputPath));
      }
      const outputName = path.basename(outputPath);

      // Apply casing if requested
      const appliedStyle = subtitles.buildForceStyle(style || defaultStyle());
      if (style && style.casing && style.casing !== 'original') {
        const raw = fs.readFileSync(srtPath, 'utf8');
        fs.writeFileSync(srtPath, subtitles.applyCasing(raw, style.casing), 'utf8');
      }

      const totalDuration = await ffmpeg.getDuration(clipPath).catch(() => null);

      send({ stage: 'exporting', percent: 0 });
      await ffmpeg.burnSubtitles({
        videoPath: clipPath,
        subtitlePath: srtPath,
        outputPath,
        style: appliedStyle,
        totalDuration,
        onProgress: ({ percent }) => send({ stage: 'exporting', percent }),
      });

      send({ stage: 'done', outputPath });
      return { success: true, outputPath, outputName };
    } catch (err) {
      return { success: false, error: err.message };
    }
  });

  ipcMain.handle('open-export-folder', async () => {
    const { shell } = require('electron');
    shell.openPath(settings.paths.export);
    return { success: true };
  });

  // ── Local file preview path (for <video src>) ────────────────────
  ipcMain.handle('get-local-preview', async (_e, { path: p }) => {
    if (!p || !fs.existsSync(p)) return { success: false };
    return { success: true, url: 'file:///' + p.replace(/\\/g, '/') };
  });
}

function defaultStyle() {
  return {
    font: 'Arial',
    size: 100,
    baseColor: '#ffffff',
    outlineColor: '#000000',
    outlineWidth: 2,
    weight: 'bold',
    casing: 'original',
    alignment: 'center',
    positionPct: 40,
  };
}

module.exports = { register };
