'use strict';

/**
 * Subtitle styling helpers.
 *
 * The renderer exposes a high-level style config (font, size, color, position,
 * karaoke preset...). We translate that into:
 *   - a libass `force_style` map consumed by ffmpeg's subtitles filter, and
 *   - (iteration 2) a full .ass rewrite for karaoke presets.
 */

/**
 * Map a user-facing style config to libass force_style keys.
 * @param {Object} s
 *   { font, size, baseColor, highlightColor, positionPct, alignment, casing }
 */
function buildForceStyle(s) {
  if (!s) return null;
  const out = {};

  if (s.font) out.FontName = s.font;
  if (s.size) out.FontSize = String(s.size);
  if (s.baseColor) out.PrimaryColour = rgbToAssColor(s.baseColor);
  if (s.outlineColor) out.OutlineColour = rgbToAssColor(s.outlineColor || '#000000');

  // Alignment in libass uses numpad layout: 1..3 bottom, 4..6 middle, 7..9 top.
  // For bottom row, horizontal alignment maps to: left=1, center=2, right=3.
  let align = s.alignment || 'center';
  if (s.positionPct != null && s.positionPct > 55) align = 'middle';
  if (s.positionPct != null && s.positionPct < 25) align = 'top';
  out.Alignment = { left: '1', center: '2', right: '3', middle: '5', top: '8' }[align] || '2';

  out.Bold = s.weight && (s.weight === 'bold' || s.weight === 'bold-italic') ? '1' : '0';
  out.Italic = s.weight && (s.weight === 'italic' || s.weight === 'bold-italic') ? '1' : '0';

  // Outline + shadow for readability
  out.Outline = s.outlineWidth != null ? String(s.outlineWidth) : '2';
  out.Shadow = '1';
  out.MarginV = s.positionPct != null
    ? String(Math.round(s.positionPct)) // approx: distance from bottom
    : '40';

  return out;
}

/** #RRGGBB → libass &HAABBGGRR. ASS uses BGR byte order; only alpha is inverted (00=opaque). */
function rgbToAssColor(hex) {
  const m = /^#?([0-9a-f]{6})$/i.exec(String(hex || ''));
  if (!m) return '&H00FFFFFF';
  const r = m[1].slice(0, 2);
  const g = m[1].slice(2, 4);
  const b = m[1].slice(4, 6);
  return `&H00${b}${g}${r}`.toUpperCase();
}

/**
 * Apply text casing to subtitle text content.
 * @param {string} text  raw subtitle text (may include SRT markup)
 * @param {string} casing  'original' | 'upper' | 'lower'
 */
function applyCasing(text, casing) {
  if (!text || casing === 'original') return text;
  // SRT body is the lines after the timestamp line — keep numeric/timestamp lines intact
  return text.split('\n').map((line) => {
    if (/^\s*\d+\s*$/.test(line)) return line; // cue number
    if (/^\s*[\d:,]+ --> [\d:,]+\s*$/.test(line)) return line; // timestamp line
    return casing === 'upper' ? line.toUpperCase() : line.toLowerCase();
  }).join('\n');
}

module.exports = { buildForceStyle, rgbToAssColor, applyCasing };
