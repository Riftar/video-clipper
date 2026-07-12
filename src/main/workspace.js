'use strict';

const fs = require('fs');
const path = require('path');
const settings = require('./settings');

/** Ensure every workspace subfolder exists. Safe to call repeatedly. */
function ensureWorkspace() {
  const dirs = [
    settings.paths.workspace,
    settings.paths.videos,
    settings.paths.clips,
    settings.paths.subtitles,
    settings.paths.export,
    settings.paths.cache,
  ];
  for (const d of dirs) {
    fs.mkdirSync(d, { recursive: true });
  }
}

/** Read/write the user config JSON (subtitle style presets, last-used values...). */
function readConfig() {
  try {
    if (!fs.existsSync(settings.paths.config)) return {};
    const raw = fs.readFileSync(settings.paths.config, 'utf8');
    const parsed = JSON.parse(raw);
    return parsed && typeof parsed === 'object' ? parsed : {};
  } catch {
    return {};
  }
}

function writeConfig(obj) {
  try {
    fs.writeFileSync(settings.paths.config, JSON.stringify(obj || {}, null, 2), 'utf8');
    return true;
  } catch {
    return false;
  }
}

/** Sanitize an arbitrary string into a safe filename. */
function safeName(input) {
  return String(input || '').replace(/[^a-zA-Z0-9-_]+/g, '_').replace(/^_+|_+$/g, '').slice(0, 80);
}

/** List files in a folder filtered by extension, newest first. */
function listFiles(folder, exts) {
  if (!fs.existsSync(folder)) return [];
  const set = new Set(exts.map((e) => e.toLowerCase().replace(/^\./, '')));
  return fs.readdirSync(folder, { withFileTypes: true })
    .filter((d) => d.isFile())
    .filter((d) => set.has(path.extname(d.name).slice(1).toLowerCase()))
    .map((d) => {
      const full = path.join(folder, d.name);
      const stat = fs.statSync(full);
      return { name: d.name, path: full, size: stat.size, mtime: stat.mtime };
    })
    .sort((a, b) => b.mtime - a.mtime);
}

module.exports = { ensureWorkspace, readConfig, writeConfig, safeName, listFiles };
