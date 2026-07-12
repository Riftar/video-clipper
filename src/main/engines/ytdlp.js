'use strict';

const { spawn } = require('child_process');
const settings = require('../settings');

/** Run yt-dlp with JSON output and return the parsed object. */
function runJson(args) {
  return new Promise((resolve, reject) => {
    const child = spawn(settings.binaries.ytdlp, args, { windowsHide: true });
    let out = '';
    let err = '';
    child.stdout.on('data', (b) => { out += b.toString(); });
    child.stderr.on('data', (b) => { err += b.toString(); });
    child.on('error', reject);
    child.on('close', (code) => {
      if (code !== 0) return reject(new Error(err || `yt-dlp exited ${code}`));
      try { resolve(JSON.parse(out)); } catch (e) { reject(new Error('yt-dlp: invalid JSON output')); }
    });
  });
}

/** Fetch metadata for a single video URL (title, thumbnail, duration, formats...). */
async function getVideoInfo(url) {
  const data = await runJson([
    '--dump-json',
    '--no-playlist',
    '--no-warnings',
    url,
  ]);
  return {
    title: data.title || data.fulltitle || 'Untitled',
    thumbnail: data.thumbnail || null,
    duration: data.duration || null,
    uploader: data.uploader || data.channel || null,
    url,
    isPlaylist: false,
    raw: data,
  };
}

/** Detect whether the given URL points to a playlist. */
async function checkPlaylist(url) {
  return new Promise((resolve) => {
    const child = spawn(settings.binaries.ytdlp, [
      '--flat-playlist', '--dump-json', '--no-warnings', url,
    ], { windowsHide: true });
    let count = 0;
    let err = '';
    child.stdout.on('data', () => { count++; });
    child.stderr.on('data', (b) => { err += b.toString(); });
    child.on('error', () => resolve({ isPlaylist: false }));
    child.on('close', () => resolve({ isPlaylist: count > 1, count }));
  });
}

/**
 * Download a video to the videos folder, streaming download progress.
 * @param {Object} opts  { url, quality, onProgress }
 * @returns {Promise<{ filePath: string, title: string }>}
 */
function downloadVideo({ url, quality = '720', onProgress }) {
  return new Promise((resolve, reject) => {
    const heightMap = { '1080': '1080', '720': '720', '480': '480', '360': '360' };
    const h = heightMap[String(quality)] || '720';

    const outTemplate = `${settings.paths.videos}${require('path').sep}%(title).80s.%(height)s.%(ext)s`;
    const args = [
      '-f', `bestvideo[height<=${h}]+bestaudio/best[height<=${h}]/best`,
      '--merge-output-format', 'mp4',
      '-o', outTemplate,
      '--newline',
      '--no-playlist',
      '--no-warnings',
      url,
    ];

    const child = spawn(settings.binaries.ytdlp, args, { windowsHide: true });
    let errBuf = '';
    let lastTitle = null;
    let resolvedPath = null;

    const progressRe = /\[download\]\s+([\d.]+)%\s+of\s+~?\s*([\d.]+)?(KiB|MiB|GiB)/i;

    child.stdout.on('data', (b) => {
      const line = b.toString();
      const m = line.match(progressRe);
      if (m && onProgress) {
        onProgress({ percent: parseFloat(m[1]) });
      }
      // yt-dlp prints "[download] Destination: ..." and the final merged path
      if (line.includes('Destination:')) lastTitle = line.split('Destination:')[1].trim();
      if (line.includes('Merging formats into')) {
        const m2 = line.match(/"([^"]+)"/);
        if (m2) resolvedPath = m2[1];
      }
      if (line.includes('has already been downloaded')) {
        const m2 = line.match(/\[download\]\s+(.+)\s+has already/);
        if (m2) resolvedPath = m2[1].trim();
      }
    });
    child.stderr.on('data', (b) => { errBuf += b.toString(); });

    child.on('error', reject);
    child.on('close', (code) => {
      if (code !== 0) return reject(new Error(errBuf || `yt-dlp exited ${code}`));
      resolve({ filePath: resolvedPath, title: lastTitle });
    });
  });
}

/** Run yt-dlp's self-update. Returns the stdout/stderr text. */
function updateSelf() {
  return new Promise((resolve, reject) => {
    const child = spawn(settings.binaries.ytdlp, ['-U'], { windowsHide: true });
    let out = '';
    child.stdout.on('data', (b) => { out += b.toString(); });
    child.stderr.on('data', (b) => { out += b.toString(); });
    child.on('error', reject);
    child.on('close', (code) => resolve({ output: out, code }));
  });
}

module.exports = { getVideoInfo, checkPlaylist, downloadVideo, updateSelf };
