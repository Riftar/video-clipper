'use strict';

const { ipcMain } = require('electron');
const settings = require('../settings');
const auth = require('../auth');

function register() {
  ipcMain.handle('get-app-settings', () => ({
    appName: settings.appName,
    version: settings.version,
    paths: {
      workspace: settings.paths.workspace,
      videos: settings.paths.videos,
      clips: settings.paths.clips,
      subtitles: settings.paths.subtitles,
      export: settings.paths.export,
    },
  }));

  ipcMain.handle('check-license', () => auth.checkLicense());
}

module.exports = { register };
