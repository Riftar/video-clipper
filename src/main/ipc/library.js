'use strict';

const { ipcMain, dialog, shell } = require('electron');
const path = require('path');
const fs = require('fs');
const settings = require('../settings');
const { listFiles } = require('../workspace');
const ffmpeg = require('../engines/ffmpeg');

function register() {
  // List downloaded source videos, newest first.
  ipcMain.handle('get-videos', () =>
    listFiles(settings.paths.videos, ['.mp4', '.mkv', '.webm', '.mov'])
      .map((f) => ({ name: f.name, path: f.path, size: f.size, mtime: f.mtime.toISOString() }))
  );

  // List produced clips, newest first.
  ipcMain.handle('get-clips', () =>
    listFiles(settings.paths.clips, ['.mp4'])
      .map((f) => ({ name: f.name, path: f.path, size: f.size, mtime: f.mtime.toISOString() }))
  );

  // Open the OS file picker for a video, return its path.
  ipcMain.handle('select-video-file', async () => {
    const result = await dialog.showOpenDialog({
      title: 'Select a video',
      properties: ['openFile'],
      filters: [{ name: 'Videos', extensions: ['mp4', 'mkv', 'webm', 'mov'] }],
    });
    if (result.canceled || result.filePaths.length === 0) return { success: false };
    return { success: true, path: result.filePaths[0] };
  });

  // Resolve the absolute path for a video by name in the workspace.
  ipcMain.handle('get-video-path', (_e, name) =>
    path.join(settings.paths.videos, name)
  );

  // Get duration of a video file (seconds).
  ipcMain.handle('get-video-duration', async (_e, { videoPath }) => {
    const d = await ffmpeg.getDuration(videoPath);
    return isNaN(d) ? null : d;
  });

  // Reveal a folder (or a file's parent) in the OS file manager.
  ipcMain.handle('open-folder', async (_e, targetPath) => {
    const p = targetPath || settings.paths.workspace;
    const stat = fs.existsSync(p) ? fs.statSync(p) : null;
    if (stat && stat.isFile()) {
      shell.showItemInFolder(p);
    } else {
      shell.openPath(p);
    }
    return { success: true };
  });
}

module.exports = { register };
