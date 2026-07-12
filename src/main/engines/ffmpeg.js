'use strict';

const { spawn } = require('child_process');
const path = require('path');
const fs = require('fs');
const settings = require('../settings');

/** Run ffprobe and return the parsed JSON. */
function probe(filePath) {
  return new Promise((resolve, reject) => {
    const child = spawn(settings.binaries.ffprobe, [
      '-v', 'error',
      '-print_format', 'json',
      '-show_format', '-show_streams',
      filePath,
    ], { windowsHide: true });
    let out = '', err = '';
    child.stdout.on('data', (b) => { out += b.toString(); });
    child.stderr.on('data', (b) => { err += b.toString(); });
    child.on('error', reject);
    child.on('close', (code) => {
      if (code !== 0) return reject(new Error(err || `ffprobe exited ${code}`));
      try { resolve(JSON.parse(out)); } catch { reject(new Error('ffprobe: invalid JSON')); }
    });
  });
}

/** Get video duration in seconds. */
async function getDuration(filePath) {
  const data = await probe(filePath);
  const fmt = parseFloat(data.format && data.format.duration);
  if (!isNaN(fmt)) return fmt;
  const vs = (data.streams || []).find((s) => s.codec_type === 'video');
  if (vs && !isNaN(parseFloat(vs.duration))) return parseFloat(vs.duration);
  return NaN;
}

/** Get width/height of the first video stream. */
async function getDimensions(filePath) {
  const data = await probe(filePath);
  const vs = (data.streams || []).find((s) => s.codec_type === 'video');
  return vs ? { width: parseInt(vs.width), height: parseInt(vs.height) } : null;
}

/**
 * Build an ffmpeg filter chain for an aspect-ratio transform.
 * @param {'original'|'9:16-crop'|'9:16-pad'|'1:1'} aspect
 * @param {number} srcW
 * @param {number} srcH
 */
function buildAspectFilter(aspect, srcW, srcH) {
  switch (aspect) {
    case '9:16-crop': {
      // Center-crop to 9:16 (vertical)
      const targetW = Math.round((srcH * 9) / 16);
      const safeW = Math.min(targetW, srcW) - (Math.min(targetW, srcW) % 2);
      return `crop=${safeW}:${srcH},scale=1080:1920`;
    }
    case '9:16-pad': {
      // Pad into a 9:16 frame (blurred bg is nicer but keep simple → black)
      return `scale=1080:1920:force_original_aspect_ratio=decrease,pad=1080:1920:(ow-iw)/2:(oh-ih)/2:black`;
    }
    case '1:1': {
      const target = Math.min(srcW, srcH);
      return `crop=${target}:${target},scale=1080:1080`;
    }
    case 'original':
    default:
      return null; // no transform
  }
}

/** Run an ffmpeg command, optionally streaming progress over the whole job. */
function runFfmpeg(args, { onProgress, totalDuration } = {}) {
  return new Promise((resolve, reject) => {
    const child = spawn(settings.binaries.ffmpeg, ['-y', '-hide_banner', '-loglevel', 'error', ...args], { windowsHide: true });
    let err = '';
    child.stderr.on('data', (b) => {
      const text = b.toString();
      err += text;
      if (onProgress && totalDuration) {
        const m = text.match(/time=(\d+):(\d+):(\d+\.\d+)/);
        if (m) {
          const sec = (+m[1]) * 3600 + (+m[2]) * 60 + parseFloat(m[3]);
          onProgress({ percent: Math.min(100, (sec / totalDuration) * 100) });
        }
      }
    });
    child.on('error', reject);
    child.on('close', (code) => {
      if (code !== 0) return reject(new Error(err || `ffmpeg exited ${code}`));
      resolve();
    });
  });
}

/**
 * Cut a clip from a video. Supports aspect-ratio transforms.
 * @param {Object} job
 * @param {string} job.videoPath   source video
 * @param {string} job.outputPath  destination mp4
 * @param {number} job.startSec
 * @param {number} job.durationSec
 * @param {string} [job.aspect]    original | 9:16-crop | 9:16-pad | 1:1
 * @param {Function} [job.onProgress]
 */
async function clipVideo(job) {
  const dims = await getDimensions(job.videoPath).catch(() => null);
  const aspect = buildAspectFilter(job.aspect, dims ? dims.width : 1920, dims ? dims.height : 1080);

  const args = [
    '-ss', String(job.startSec),
    '-i', job.videoPath,
    '-t', String(job.durationSec),
    '-c:v', 'libx264', '-preset', 'medium', '-crf', '20',
    '-c:a', 'aac', '-b:a', '128k',
  ];
  if (aspect) args.push('-vf', aspect);
  args.push(job.outputPath);

  await runFfmpeg(args, { onProgress: job.onProgress });
  return job.outputPath;
}

/**
 * Escape a file path for use inside ffmpeg's subtitles filter.
 *
 * The subtitles filter uses ':' as an option separator, so a Windows drive
 * letter ('C:') and any ':' in the path break parsing unless escaped.
 * Backslashes must become forward slashes, single quotes escaped, and
 * every ':' escaped as '\:'.
 */
function escapeSubsPath(p) {
  return p.replace(/\\/g, '/').replace(/'/g, "\\'").replace(/:/g, '\\:');
}

/**
 * Burn an SRT/ASS subtitle file into a video, applying subtitle style.
 * @param {Object} opts
 * @param {string} opts.videoPath
 * @param {string} opts.subtitlePath  (.srt or .ass)
 * @param {string} opts.outputPath
 * @param {Object} [opts.style]        force_style key/value map (see subtitles.js)
 * @param {number} [opts.totalDuration]
 * @param {Function} [opts.onProgress]
 */
async function burnSubtitles({ videoPath, subtitlePath, outputPath, style, totalDuration, onProgress }) {
  const styleStr = style ? Object.entries(style).map(([k, v]) => `${k}=${v}`).join(',') : '';
  const subArg = escapeSubsPath(subtitlePath);
  const vf = `subtitles='${subArg}'${styleStr ? `:force_style='${styleStr}'` : ''}`;

  const args = [
    '-i', videoPath,
    '-vf', vf,
    '-c:v', 'libx264', '-preset', 'medium', '-crf', '20',
    '-c:a', 'copy',
    outputPath,
  ];
  await runFfmpeg(args, { onProgress, totalDuration });
  return outputPath;
}

module.exports = { probe, getDuration, getDimensions, clipVideo, burnSubtitles, runFfmpeg };
