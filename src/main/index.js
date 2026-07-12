'use strict';

const { app, BrowserWindow, session } = require('electron');
const path = require('path');
const settings = require('./settings');
const { ensureWorkspace } = require('./workspace');
const { registerAll } = require('./ipc');

let mainWindow = null;

function createWindow() {
  mainWindow = new BrowserWindow({
    width: 1280,
    height: 800,
    minWidth: 960,
    minHeight: 640,
    backgroundColor: '#0f172a',
    title: settings.appName,
    webPreferences: {
      preload: path.join(__dirname, '..', 'preload', 'index.js'),
      contextIsolation: true,
      nodeIntegration: false,
      sandbox: false,
    },
  });

  mainWindow.loadFile(path.join(__dirname, '..', 'renderer', 'index.html'));
  mainWindow.setMenuBarVisibility(false);

  mainWindow.on('closed', () => { mainWindow = null; });
}

// Lock down content loading. We run fully local with file://, so a strict CSP.
function installCsp() {
  session.defaultSession.webRequest.onHeadersReceived((details, callback) => {
    callback({
      responseHeaders: {
        ...details.responseHeaders,
        'Content-Security-Policy': [
          "default-src 'self' 'unsafe-inline' data: blob:; " +
          "script-src 'self' 'unsafe-inline'; " +
          "style-src 'self' 'unsafe-inline' data:; " +
          "img-src 'self' data: blob: https:; " +
          "media-src 'self' blob: file:; " +
          "connect-src 'self' https:; " +
          "font-src 'self' data:",
        ],
      },
    });
  });
}

app.whenReady().then(() => {
  ensureWorkspace();
  installCsp();
  registerAll();
  createWindow();

  app.on('activate', () => {
    if (BrowserWindow.getAllWindows().length === 0) createWindow();
  });
});

app.on('window-all-closed', () => {
  if (process.platform !== 'darwin') app.quit();
});
