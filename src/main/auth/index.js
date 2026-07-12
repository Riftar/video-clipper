'use strict';

/**
 * License / auth module.
 *
 * ── CURRENT STATE (MVP): a stub that always grants full access. ──
 *
 * ── FUTURE (Supabase): replace this file with a real implementation that:
 *   - reads/writes an encrypted license file bound to machineIdSync()
 *   - calls Supabase RPCs: app_login, app_logout, app_start_trial
 *   - resolves a { status: 'trial' | 'pro' | 'expired', ... } object
 *
 * The IPC layer (src/main/ipc/auth.js) only depends on checkLicense()'s shape,
 * so swapping this file is the only change required to enable online auth.
 */

const settings = require('../settings');

/**
 * @returns {Promise<{ success: boolean, status: string, name: string, type: string }>}
 */
async function checkLicense() {
  // STUB: always grants pro. Once settings.supabase.enabled is true, route
  // through a real verifier instead.
  return {
    success: true,
    status: 'active',
    name: 'Local User',
    type: 'pro',
    note: settings.supabase.enabled
      ? 'Online auth configured but not yet implemented.'
      : 'Offline mode (no license server configured).',
  };
}

module.exports = { checkLicense };
