'use strict';

const { spawn } = require('child_process');
const fs = require('fs');
const path = require('path');
const os = require('os');
const settings = require('../settings');
const ffmpeg = require('./ffmpeg');

/**
 * Convert a video/audio file to a 16 kHz mono WAV using ffmpeg.
 * whisper-cli only reads raw WAV, so this step is mandatory for mp4/mkv/etc.
 * @returns {Promise<string>} path to the produced wav
 */
function extractAudio(inputPath) {
  return new Promise((resolve, reject) => {
    const wavPath = path.join(os.tmpdir(), `whisper_audio_${Date.now()}_${Math.random().toString(36).slice(2, 8)}.wav`);
    const child = spawn(settings.binaries.ffmpeg, [
      '-y', '-hide_banner', '-loglevel', 'error',
      '-i', inputPath,
      '-vn',                  // drop the video stream
      '-ac', '1',             // mono
      '-ar', '16000',         // 16 kHz — what whisper expects
      '-f', 'wav',
      wavPath,
    ], { windowsHide: true });
    let err = '';
    child.stderr.on('data', (b) => { err += b.toString(); });
    child.on('error', reject);
    child.on('close', (code) => {
      if (code !== 0) return reject(new Error(`ffmpeg audio extraction failed: ${err}`));
      if (!fs.existsSync(wavPath)) return reject(new Error('ffmpeg produced no wav output'));
      resolve(wavPath);
    });
  });
}

/**
 * Transcribe a video/audio file with whisper-cli, emitting progress events.
 *
 * whisper-cli only reads WAV, so non-wav inputs are first converted with ffmpeg.
 * Output format: SRT (SubRip).
 *
 * @param {Object} opts
 * @param {string} opts.inputPath
 * @param {string} [opts.language]   'id' | 'en' | 'auto'
 * @param {string} [opts.model]      override path to model
 * @param {Function} [opts.onProgress]
 * @returns {Promise<{ srtPath: string, text: string }>}
 */
async function transcribe({ inputPath, language = 'id', model, onProgress }) {
  const modelPath = model || settings.binaries.whisperModel;
  if (!fs.existsSync(modelPath)) {
    throw new Error(`Whisper model not found: ${modelPath}. Place a model in bin/whisper/.`);
  }
  if (!fs.existsSync(settings.binaries.whisper)) {
    throw new Error(`whisper-cli not found: ${settings.binaries.whisper}`);
  }

  // Step 1: ensure whisper can read the input. If it's already wav, skip.
  const isWav = inputPath.toLowerCase().endsWith('.wav');
  const wavPath = isWav ? inputPath : await extractAudio(inputPath);

  try {
    return await runWhisper({ wavPath, modelPath, language, onProgress });
  } finally {
    // Clean up the temp wav if we created it (don't delete caller's original)
    if (!isWav && fs.existsSync(wavPath)) {
      try { fs.unlinkSync(wavPath); } catch {}
    }
  }
}

/** Run whisper-cli on a wav file. Detects failure even when exit code is 0. */
function runWhisper({ wavPath, modelPath, language, onProgress }) {
  return new Promise((resolve, reject) => {
    const outDir = os.tmpdir();
    const baseName = `whisper_${Date.now()}_${Math.random().toString(36).slice(2, 8)}`;
    const outPattern = path.join(outDir, baseName); // whisper writes <base>.srt

    const args = [
      '-m', modelPath,
      '-f', wavPath,
      '-osrt',
      '-of', outPattern,
      '-l', language,
    ];

    const child = spawn(settings.binaries.whisper, args, { windowsHide: true });
    let stderr = '';
    let sawError = false;
    child.stderr.on('data', (b) => {
      const text = b.toString();
      stderr += text;
      if (/failed to read audio/i.test(text)) sawError = true;
      if (onProgress) {
        const m = text.match(/progress\s*=\s*(\d+)/i);
        if (m) onProgress({ percent: parseInt(m[1], 10) });
      }
    });
    child.stdout.on('data', () => {}); // drain

    child.on('error', reject);
    child.on('close', (code) => {
      // whisper-cli can exit 0 even on failure, so check for the error marker too
      if (code !== 0 || sawError) {
        return reject(new Error(stderr || `whisper-cli exited ${code}`));
      }
      const srtPath = `${outPattern}.srt`;
      if (!fs.existsSync(srtPath)) {
        return reject(new Error('whisper-cli produced no SRT output. Check the audio file is valid.'));
      }
      const text = fs.readFileSync(srtPath, 'utf8');
      resolve({ srtPath, text });
    });
  });
}

module.exports = { transcribe, extractAudio };
