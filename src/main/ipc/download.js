'use strict';

const { ipcMain, BrowserWindow } = require('electron');
const settings = require('../settings');
const ytdlp = require('../engines/ytdlp');

function register() {
  // Probe metadata for a URL (title, thumbnail, duration).
  ipcMain.handle('get-video-info', async (_e, { url }) => {
    try {
      const info = await ytdlp.getVideoInfo(url);
      return { success: true, data: info };
    } catch (err) {
      return { success: false, error: err.message };
    }
  });

  // Detect playlist.
  ipcMain.handle('check-playlist', async (_e, { url }) => {
    try {
      const result = await ytdlp.checkPlaylist(url);
      return { success: true, data: result };
    } catch (err) {
      return { success: false, error: err.message };
    }
  });

  // Download with progress events streamed to all windows.
  ipcMain.handle('download-video', async (event, { url, quality }) => {
    try {
      const win = BrowserWindow.fromWebContents(event.sender);
      const send = (payload) => {
        if (win && !win.isDestroyed()) win.webContents.send('download-progress', payload);
      };

      const { filePath, title } = await ytdlp.downloadVideo({
        url,
        quality,
        onProgress: ({ percent }) => send({ stage: 'downloading', percent }),
      });

      send({ stage: 'done', percent: 100, filePath });
      return { success: true, filePath, title };
    } catch (err) {
      return { success: false, error: err.message };
    }
  });
}

module.exports = { register };
