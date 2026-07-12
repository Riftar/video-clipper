'use strict';

const auth = require('./auth');
const library = require('./library');
const download = require('./download');
const clip = require('./clip');
const subtitle = require('./subtitle');

/** Register every IPC handler module. Safe to call once at app ready. */
function registerAll() {
  auth.register();
  library.register();
  download.register();
  clip.register();
  subtitle.register();
}

module.exports = { registerAll };
