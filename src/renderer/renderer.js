'use strict';

/* ════════════════════════════════════════════════════════════════
   Clipper — renderer. Builds each page's UI and wires it to window.api.
   Plain JS, no framework. State is kept in small module objects.
   Wrapped in an IIFE so a re-run (e.g. reload) doesn't trip
   "Identifier 'api' has already been declared" at top level.
   ════════════════════════════════════════════════════════════════ */

(function () {
const api = window.api;
const FONT_OPTIONS = ['Arial', 'Arial Black', 'Impact', 'Tahoma', 'Verdana',
  'Montserrat', 'Poppins', 'Bebas Neue', 'Inter', 'Anton', 'Urbanist', 'Oswald', 'Raleway', 'Nunito'];

/* ─────────────────────────── helpers ─────────────────────────── */
const $  = (sel, root = document) => root.querySelector(sel);
const $$ = (sel, root = document) => [...root.querySelectorAll(sel)];

function el(tag, attrs = {}, ...children) {
  const node = document.createElement(tag);
  for (const [k, v] of Object.entries(attrs)) {
    if (k === 'class') node.className = v;
    else if (k === 'html') node.innerHTML = v;
    else if (k.startsWith('on') && typeof v === 'function') node.addEventListener(k.slice(2), v);
    else node.setAttribute(k, v);
  }
  for (const c of children.flat()) {
    if (c == null || c === false) continue;
    node.append(c.nodeType ? c : document.createTextNode(String(c)));
  }
  return node;
}

function fmtSize(bytes) {
  if (!bytes) return '0 B';
  const u = ['B', 'KB', 'MB', 'GB']; const i = Math.floor(Math.log(bytes) / Math.log(1024));
  return `${(bytes / Math.pow(1024, i)).toFixed(i ? 1 : 0)} ${u[i]}`;
}
function fmtDate(iso) { try { return new Date(iso).toLocaleString(); } catch { return ''; } }
function secsToHHMMSS(sec) {
  if (sec == null || isNaN(sec)) return '00:00:00';
  const s = Math.max(0, Math.floor(sec));
  return [Math.floor(s/3600), Math.floor((s%3600)/60), s%60].map(n => String(n).padStart(2,'0')).join(':');
}
function hhmmssToSecs(str) {
  const m = /^(\d{1,2}):(\d{2}):(\d{2}(\.\d+)?)$/.exec((str||'').trim());
  if (!m) return NaN;
  return (+m[1])*3600 + (+m[2])*60 + parseFloat(m[3]);
}

function toast(msg, type = 'info', ms = 3200) {
  const host = $('#toast-host');
  const t = el('div', { class: `toast ${type}` }, msg);
  host.append(t);
  setTimeout(() => { t.style.opacity = '0'; setTimeout(() => t.remove(), 250); }, ms);
}

/* ─────────────────────────── nav ─────────────────────────────── */
function initNav() {
  $$('.nav-item').forEach(btn => {
    btn.addEventListener('click', () => {
      $$('.nav-item').forEach(b => b.classList.toggle('active', b === btn));
      const target = btn.dataset.target;
      $$('.page').forEach(p => p.classList.toggle('active', p.id === target));
      $('#page-title').textContent = btn.textContent.trim();
      // refresh page data on entry
      const page = target.replace('page-', '');
      if (page === 'downloader') downloader.refresh();
      if (page === 'studio') studio.refresh();
      if (page === 'export') exportPage.refresh();
    });
  });
}

/* ════════════════════════════════ DOWNLOADER ════════════════════════════════ */
const downloader = (() => {
  let lastInfo = null;

  async function analyze() {
    const url = $('#dl-url').value.trim();
    const btn = $('#dl-analyze');
    const status = $('#dl-status');
    if (!url) return toast('Paste a URL first.', 'warn');

    btn.disabled = true;
    status.innerHTML = '<span class="spinner"></span> Analyzing…';
    const res = await api.download.getInfo(url);
    btn.disabled = false;

    if (!res.success) {
      status.innerHTML = `<span class="err">✗ ${res.error}</span>`;
      return;
    }
    lastInfo = res.data;
    status.innerHTML = '';
    renderPreview(res.data);
  }

  function renderPreview(info) {
    const host = $('#dl-preview');
    host.innerHTML = '';
    host.append(
      el('div', { class: 'preview-grid' },
        el('div', { class: 'thumb' }, info.thumbnail
          ? el('img', { src: info.thumbnail })
          : el('div', {}, 'No preview')),
        el('div', {},
          el('div', { class: 'field' },
            el('label', {}, 'Title'),
            el('div', { class: 'input', style: 'font-weight:600' }, info.title)),
          el('div', { class: 'row', style: 'margin-top:10px' },
            el('div', { class: 'field' },
              el('label', {}, 'Duration'),
              el('div', { class: 'input' }, secsToHHMMSS(info.duration))),
            el('div', { class: 'field' },
              el('label', {}, 'Uploader'),
              el('div', { class: 'input' }, info.uploader || '—'))),
        )
      )
    );
    $('#dl-download-btn').disabled = false;
  }

  async function download() {
    const url = $('#dl-url').value.trim();
    const quality = $('#dl-quality').value;
    const btn = $('#dl-download-btn');
    if (!url) return;
    btn.disabled = true;
    $('#dl-progress-wrap').style.display = 'block';
    setProgress(0, 'Starting download…');

    const unsub = api.download.onProgress(p => {
      if (p.stage === 'downloading') setProgress(p.percent, `Downloading… ${p.percent.toFixed(0)}%`);
      if (p.stage === 'done') setProgress(100, 'Done!');
    });

    const res = await api.download.start(url, quality);
    unsub();
    btn.disabled = false;
    if (res.success) {
      toast('Download complete.', 'success');
      setProgress(100, `Saved: ${res.filePath || ''}`);
    } else {
      toast(res.error || 'Download failed.', 'error');
      setProgress(0, `Error: ${res.error}`);
    }
  }

  function setProgress(pct, label) {
    $('#dl-progress-bar').style.width = `${pct}%`;
    $('#dl-progress-label').textContent = label;
    $('#dl-progress-pct').textContent = `${pct.toFixed(0)}%`;
  }

  function build() {
    const root = $('#page-downloader');
    root.innerHTML = '';
    root.append(
      el('div', { class: 'card' },
        el('h3', { class: 'card-title' }, 'Universal Video Downloader'),
        el('div', { class: 'field' },
          el('label', {}, 'Video URL'),
          el('input', { id: 'dl-url', class: 'input', placeholder: 'Paste YouTube / IG / TikTok / FB link…' })),
        el('div', { class: 'row', style: 'margin-top:12px' },
          el('div', { class: 'field' },
            el('label', {}, 'Quality'),
            el('select', { id: 'dl-quality', class: 'select' },
              ...['1080','720','480','360'].map(q => el('option', { value: q }, q + 'p')))),
          el('button', { id: 'dl-analyze', class: 'btn-ghost', onclick: analyze }, 'Analyze'),
          el('button', { id: 'dl-download-btn', class: 'btn accent', onclick: download, disabled: true }, 'Download')),
        el('div', { id: 'dl-progress-wrap', style: 'display:none;margin-top:14px' },
          el('div', { class: 'progress' }, el('div', { id: 'dl-progress-bar', class: 'progress-bar' })),
          el('div', { class: 'progress-meta' },
            el('span', { id: 'dl-progress-label' }, ''),
            el('span', { id: 'dl-progress-pct' }, '0%'))),
        el('div', { id: 'dl-status', class: 'status-line' }),
        el('div', { id: 'dl-preview' })
      ),
      el('div', { class: 'card' },
        el('h3', { class: 'card-title' }, 'Downloaded Videos'),
        el('div', { id: 'dl-videolist' }))
    );
    $('#dl-quality').value = '720';
  }

  async function refresh() {
    const host = $('#dl-videolist'); if (!host) return;
    const videos = await api.library.getVideos();
    if (!videos.length) {
      host.innerHTML = '';
      host.append(el('div', { class: 'empty-state' },
        el('div', { class: 'big' }, '∅'), el('div', {}, 'No videos yet. Download one above.')));
      return;
    }
    host.innerHTML = '';
    const table = el('table', { class: 'table' },
      el('thead', {}, el('tr', {},
        el('th', {}, 'Name'), el('th', {}, 'Size'), el('th', {}, 'Added'))),
      el('tbody', {}, ...videos.map(v => el('tr', {},
        el('td', {}, v.name),
        el('td', {}, fmtSize(v.size)),
        el('td', {}, fmtDate(v.mtime))))));
    host.append(table);
  }

  return { build, refresh };
})();

/* ════════════════════════════════════ STUDIO (clip) ════════════════════════════════════ */
const studio = (() => {
  const queue = []; // { title, startSec, durationSec, aspect }

  function build() {
    const root = $('#page-studio');
    root.innerHTML = '';
    root.append(
      el('div', { class: 'card' },
        el('h3', { class: 'card-title' }, 'Source Video'),
        el('div', { class: 'row' },
          el('div', { class: 'field', style: 'flex:2' },
            el('label', {}, 'Pick a downloaded video'),
            el('select', { id: 'st-video', class: 'select' })),
          el('button', { class: 'btn-ghost', onclick: pickExternal }, 'Browse…')),
        el('div', { id: 'st-player-wrap', style: 'margin-top:14px' })
      ),
      el('div', { class: 'card' },
        el('h3', { class: 'card-title' }, 'Add Clip'),
        el('div', { class: 'grid-3' },
          el('div', { class: 'field' },
            el('label', {}, 'Start (HH:MM:SS)'),
            el('input', { id: 'st-start', class: 'input', value: '00:00:00' }),
            el('button', { class: 'btn-ghost', style: 'margin-top:6px', onclick: () => captureTime('start') }, 'Capture')),
          el('div', { class: 'field' },
            el('label', {}, 'Duration (seconds)'),
            el('input', { id: 'st-duration', class: 'input', type: 'number', value: '15' })),
          el('div', { class: 'field' },
            el('label', {}, 'Aspect ratio'),
            el('select', { id: 'st-aspect', class: 'select' },
              el('option', { value: 'original' }, 'Original'),
              el('option', { value: '9:16-crop' }, '9:16 Portrait (Crop)'),
              el('option', { value: '9:16-pad' }, '9:16 Portrait (Pad)'),
              el('option', { value: '1:1' }, '1:1 Square'))
          )
        ),
        el('div', { class: 'field', style: 'margin-top:12px' },
          el('label', {}, 'Clip title (optional)'),
          el('input', { id: 'st-title', class: 'input', placeholder: 'my-clip' })),
        el('div', { class: 'row', style: 'margin-top:14px' },
          el('button', { class: 'btn', onclick: addToQueue }, 'Add to queue'),
          el('button', { class: 'btn accent', onclick: processBatch, disabled: true, id: 'st-process-btn' }, 'Process Batch')),
        el('div', { id: 'st-status', class: 'status-line' })
      ),
      el('div', { class: 'card' },
        el('h3', { class: 'card-title' }, 'Clip Queue'),
        el('div', { id: 'st-queue' })
      )
    );
  }

  async function pickExternal() {
    const res = await api.library.selectVideoFile();
    if (!res.success) return;
    const sel = $('#st-video');
    // Inject as a temporary option so the rest of the code reads it uniformly
    const opt = el('option', { value: res.path, selected: true }, `[external] ${res.path.split(/[\\/]/).pop()}`);
    sel.append(opt);
    loadPlayer(res.path);
  }

  async function loadVideoList() {
    const sel = $('#st-video'); if (!sel) return;
    const current = sel.value;
    sel.innerHTML = '<option value="">— Select a video —</option>';
    const videos = await api.library.getVideos();
    videos.forEach(v => sel.append(el('option', { value: v.path }, v.name)));
    if (current) sel.value = current;
  }

  function onVideoChange() {
    const sel = $('#st-video');
    const p = sel.value;
    if (p) loadPlayer(p);
  }

  async function loadPlayer(path) {
    const wrap = $('#st-player-wrap'); wrap.innerHTML = '';
    const video = el('video', { controls: true, id: 'st-player' });
    const res = await api.library.localPreview(path);
    if (res.success) video.src = res.url;
    wrap.append(video);
  }

  function captureTime(field) {
    const v = $('#st-player'); if (!v) return toast('Pick a video first.', 'warn');
    const t = secsToHHMMSS(v.currentTime);
    if (field === 'start') $('#st-start').value = t;
  }

  function addToQueue() {
    const startSec = hhmmssToSecs($('#st-start').value);
    const durationSec = parseFloat($('#st-duration').value);
    if (isNaN(startSec)) return toast('Invalid start time. Use HH:MM:SS.', 'warn');
    if (isNaN(durationSec) || durationSec <= 0) return toast('Duration must be > 0.', 'warn');
    queue.push({
      videoPath: $('#st-video').value,
      title: $('#st-title').value.trim() || `clip_${secsToHHMMSS(startSec).replace(/:/g, '-')}`,
      startSec, durationSec,
      aspect: $('#st-aspect').value,
    });
    $('#st-title').value = '';
    renderQueue();
    toast('Added to queue.', 'success');
  }

  function renderQueue() {
    const host = $('#st-queue'); host.innerHTML = '';
    if (!queue.length) {
      host.append(el('div', { class: 'empty-state' }, el('div', { class: 'big' }, '∅'), 'Queue is empty.'));
      $('#st-process-btn').disabled = true;
      return;
    }
    $('#st-process-btn').disabled = false;
    const table = el('table', { class: 'table' },
      el('thead', {}, el('tr', {},
        el('th', {}, '#'), el('th', {}, 'Title'), el('th', {}, 'Start'),
        el('th', {}, 'Dur'), el('th', {}, 'Aspect'), el('th', {}, ''))),
      el('tbody', {}, ...queue.map((q, i) => el('tr', {},
        el('td', {}, String(i + 1)),
        el('td', {}, q.title),
        el('td', {}, secsToHHMMSS(q.startSec)),
        el('td', {}, q.durationSec + 's'),
        el('td', {}, el('span', { class: 'tag' }, q.aspect)),
        el('td', {}, el('button', { class: 'btn-ghost', onclick: () => { queue.splice(i, 1); renderQueue(); } }, 'Remove'))
      )))
    );
    host.append(table);
  }

  async function processBatch() {
    const videoPath = $('#st-video').value;
    if (!videoPath) return toast('Pick a source video first.', 'warn');
    if (!queue.length) return;
    const jobs = queue.map(q => ({ ...q, videoPath }));
    $('#st-process-btn').disabled = true;
    $('#st-status').innerHTML = '<span class="spinner"></span> Processing…';

    const unsub = api.clip.onProgress(p => {
      if (p.stage === 'clipping') {
        $('#st-status').innerHTML = `Clipping ${p.index + 1}/${p.total} — ${p.name}${p.percent ? ` (${p.percent.toFixed(0)}%)` : ''}`;
      } else if (p.stage === 'done') {
        $('#st-status').innerHTML = '<span class="ok">✓ All clips processed.</span>';
      }
    });

    const res = await api.clip.run(jobs);
    unsub();
    $('#st-process-btn').disabled = false;
    if (res.success) {
      const ok = res.results.filter(r => r.success).length;
      toast(`${ok}/${res.results.length} clips created.`, ok === res.results.length ? 'success' : 'warn');
      queue.length = 0;
      renderQueue();
    } else {
      toast('Batch failed.', 'error');
    }
  }

  async function refresh() {
    await loadVideoList();
    const sel = $('#st-video'); if (sel && !sel.onchange) sel.addEventListener('change', onVideoChange);
    renderQueue();
  }

  return { build, refresh };
})();

/* ════════════════════════════════════ EXPORT ════════════════════════════════════ */
const exportPage = (() => {
  let currentStyle = null;

  async function build() {
    const root = $('#page-export');
    root.innerHTML = '';
    const cfg = await api.subtitle.getStyle();
    currentStyle = cfg.style;

    root.append(
      el('div', { class: 'card' },
        el('h3', { class: 'card-title' }, 'Clip'),
        el('div', { class: 'row' },
          el('div', { class: 'field', style: 'flex:2' },
            el('label', {}, 'Pick a clip'),
            el('select', { id: 'ex-clip', class: 'select' })),
          el('button', { class: 'btn-ghost', onclick: loadClip }, 'Load'))
      ),
      el('div', { class: 'preview-grid' },
        el('div', { class: 'card' },
          el('h3', { class: 'card-title' }, 'Subtitle Styling'),
          el('div', { class: 'grid-2' },
            el('div', { class: 'field' },
              el('label', {}, 'Font'),
              el('select', { id: 'ex-font', class: 'select' },
                ...FONT_OPTIONS.map(f => el('option', { value: f, selected: f === currentStyle.font }, f)))),
            el('div', { class: 'field' },
              el('label', {}, 'Size'),
              el('input', { id: 'ex-size', class: 'input', type: 'number', value: currentStyle.size })),
            el('div', { class: 'field' },
              el('label', {}, 'Text color'),
              el('input', { id: 'ex-color', class: 'input', type: 'color', value: currentStyle.baseColor })),
            el('div', { class: 'field' },
              el('label', {}, 'Outline color'),
              el('input', { id: 'ex-outline', class: 'input', type: 'color', value: currentStyle.outlineColor })),
            el('div', { class: 'field' },
              el('label', {}, 'Weight'),
              el('select', { id: 'ex-weight', class: 'select' },
                ...['bold','normal','italic','bold-italic'].map(w => el('option', { value: w, selected: w === currentStyle.weight }, w)))),
            el('div', { class: 'field' },
              el('label', {}, 'Casing'),
              el('select', { id: 'ex-casing', class: 'select' },
                ...['original','upper','lower'].map(c => el('option', { value: c, selected: c === currentStyle.casing }, c)))),
            el('div', { class: 'field' },
              el('label', {}, 'Alignment'),
              el('select', { id: 'ex-align', class: 'select' },
                ...['left','center','right'].map(a => el('option', { value: a, selected: a === currentStyle.alignment }, a)))),
            el('div', { class: 'field' },
              el('label', {}, 'Vertical position (%)'),
              el('input', { id: 'ex-pos', class: 'input', type: 'number', min: '0', max: '100', value: currentStyle.positionPct }))
          ),
          el('div', { class: 'row', style: 'margin-top:14px' },
            el('button', { class: 'btn-ghost', onclick: saveStyle }, 'Save style')),
          el('hr', { class: 'sep' }),
          el('div', { class: 'field' },
            el('label', {}, 'Source language'),
            el('select', { id: 'ex-lang', class: 'select' },
              el('option', { value: 'id' }, 'Indonesian'),
              el('option', { value: 'en' }, 'English'),
              el('option', { value: 'auto' }, 'Auto-detect'))),
          el('div', { class: 'row', style: 'margin-top:12px' },
            el('button', { id: 'ex-transcribe-btn', class: 'btn', onclick: transcribe, disabled: true }, 'AI Transcribe')),
          el('div', { id: 'ex-trans-status', class: 'status-line' })
        ),
        el('div', { class: 'card' },
          el('h3', { class: 'card-title' }, 'Preview & Transcript'),
          el('div', { id: 'ex-player-wrap' }, el('div', { class: 'muted' }, 'Load a clip to preview.')),
          el('hr', { class: 'sep' }),
          el('div', { class: 'field' },
            el('label', {}, 'Transcript (editable SRT)'),
            el('textarea', { id: 'ex-transcript', class: 'textarea', placeholder: 'Transcript will appear here after transcription…' })),
          el('div', { class: 'row', style: 'margin-top:10px' },
            el('button', { class: 'btn-ghost', onclick: reloadTranscript }, 'Reload'),
            el('button', { class: 'btn-ghost', onclick: saveTranscript }, 'Save edits')),
          el('hr', { class: 'sep' }),
          el('div', { class: 'row' },
            el('button', { id: 'ex-export-btn', class: 'btn accent', onclick: doExport, disabled: true }, 'Export Video'),
            el('button', { class: 'btn-ghost', onclick: openExportFolder }, 'Open export folder')),
          el('div', { id: 'ex-export-status', class: 'status-line' }),
          el('div', { id: 'ex-export-prog', style: 'display:none;margin-top:8px' },
            el('div', { class: 'progress' }, el('div', { id: 'ex-export-bar', class: 'progress-bar' })))
        )
      )
    );
  }

  function readStyleFromForm() {
    return {
      font: $('#ex-font').value,
      size: parseInt($('#ex-size').value) || 100,
      baseColor: $('#ex-color').value,
      outlineColor: $('#ex-outline').value,
      outlineWidth: 2,
      weight: $('#ex-weight').value,
      casing: $('#ex-casing').value,
      alignment: $('#ex-align').value,
      positionPct: parseInt($('#ex-pos').value) || 40,
    };
  }

  async function saveStyle() {
    const style = readStyleFromForm();
    const res = await api.subtitle.saveStyle(style);
    currentStyle = style;
    toast(res.success ? 'Style saved.' : 'Failed to save style.', res.success ? 'success' : 'error');
  }

  async function loadClipList() {
    const sel = $('#ex-clip'); if (!sel) return;
    const current = sel.value;
    sel.innerHTML = '<option value="">— Select a clip —</option>';
    const clips = await api.library.getClips();
    clips.forEach(c => sel.append(el('option', { value: c.path }, c.name)));
    if (current) sel.value = current;
  }

  async function loadClip() {
    const path = $('#ex-clip').value;
    if (!path) return;
    $('#ex-transcribe-btn').disabled = false;
    // Player
    const wrap = $('#ex-player-wrap'); wrap.innerHTML = '';
    const v = el('video', { controls: true });
    const res = await api.library.localPreview(path);
    if (res.success) v.src = res.url;
    wrap.append(v);
    // Existing transcript?
    const t = await api.subtitle.getText(path);
    $('#ex-transcript').value = t.success ? t.text : '';
    if (t.success) $('#ex-export-btn').disabled = false;
  }

  async function transcribe() {
    const clipPath = $('#ex-clip').value;
    const lang = $('#ex-lang').value;
    if (!clipPath) return;
    $('#ex-transcribe-btn').disabled = true;
    $('#ex-trans-status').innerHTML = '<span class="spinner"></span> Transcribing… (this can take a while)';

    const unsub = api.subtitle.onTranscriptionProgress(p => {
      if (p.stage === 'transcribing') {
        $('#ex-trans-status').innerHTML = `<span class="spinner"></span> Transcribing… ${p.percent}%`;
      } else if (p.stage === 'done') {
        $('#ex-trans-status').innerHTML = '<span class="ok">✓ Transcription complete.</span>';
      }
    });

    const res = await api.subtitle.transcribe(clipPath, lang);
    unsub();
    $('#ex-transcribe-btn').disabled = false;
    if (res.success) {
      $('#ex-transcript').value = res.text;
      $('#ex-export-btn').disabled = false;
      toast('Transcription complete.', 'success');
    } else {
      $('#ex-trans-status').innerHTML = `<span class="err">✗ ${res.error}</span>`;
      toast(res.error, 'error');
    }
  }

  async function saveTranscript() {
    const clipPath = $('#ex-clip').value;
    const res = await api.subtitle.saveText(clipPath, $('#ex-transcript').value);
    toast(res.success ? 'Transcript saved.' : 'Save failed.', res.success ? 'success' : 'error');
  }

  async function reloadTranscript() {
    const clipPath = $('#ex-clip').value;
    const res = await api.subtitle.getText(clipPath);
    $('#ex-transcript').value = res.success ? res.text : '';
  }

  async function doExport() {
    const clipPath = $('#ex-clip').value;
    if (!clipPath) return;
    await saveTranscript(); // persist edits before burning
    const style = readStyleFromForm();
    $('#ex-export-btn').disabled = true;
    $('#ex-export-prog').style.display = 'block';
    $('#ex-export-status').innerHTML = '<span class="spinner"></span> Exporting…';

    const unsub = api.subtitle.onExportProgress(p => {
      if (p.stage === 'exporting') {
        $('#ex-export-bar').style.width = `${p.percent}%`;
        $('#ex-export-status').innerHTML = `Exporting… ${p.percent.toFixed(0)}%`;
      } else if (p.stage === 'done') {
        $('#ex-export-bar').style.width = '100%';
        $('#ex-export-status').innerHTML = '<span class="ok">✓ Export complete.</span>';
      }
    });

    const res = await api.subtitle.export(clipPath, style);
    unsub();
    $('#ex-export-btn').disabled = false;
    if (res.success) toast('Export complete!', 'success');
    else { toast(res.error || 'Export failed.', 'error'); $('#ex-export-status').innerHTML = `<span class="err">✗ ${res.error}</span>`; }
  }

  async function openExportFolder() { await api.subtitle.openExportFolder(); }
  async function refresh() { await loadClipList(); }

  return { build, refresh };
})();

/* ════════════════════════════════════ LICENSE ════════════════════════════════════ */
const licensePage = (() => {
  function build() {
    const root = $('#page-license');
    root.innerHTML = '';
    root.append(
      el('div', { class: 'card' },
        el('h3', { class: 'card-title' }, 'License Status'),
        el('div', { id: 'lic-info', class: 'status-line' }, 'Checking…')),
      el('div', { class: 'card' },
        el('h3', { class: 'card-title' }, 'About'),
        el('p', { class: 'muted' }, 'Clipper — offline video clipper: download, cut, transcribe, subtitle, export.'),
        el('p', { class: 'muted' }, 'Online auth (Supabase) is prepared but disabled. This build runs in full-access offline mode.'),
        el('p', { class: 'muted' }, 'Version ' + (window.__version || '0.1.0')))
    );
  }
  async function refresh() {
    const host = $('#lic-info'); if (!host) return;
    const res = await api.license.check();
    if (res.success) {
      host.innerHTML = `<span class="ok">✓ Active — ${res.type.toUpperCase()}</span><br><span class="muted">${res.name} · ${res.note || ''}</span>`;
    } else {
      host.innerHTML = '<span class="err">Not licensed.</span>';
    }
  }
  return { build, refresh };
})();

/* ════════════════════════════════════ BOOT ════════════════════════════════════ */
async function boot() {
  initNav();
  downloader.build();
  studio.build();
  await exportPage.build();
  licensePage.build();

  const settings = await api.settings.get();
  $('#brand-version').textContent = 'v' + settings.version;
  window.__version = settings.version;
  $('#workspace-path').textContent = settings.paths.workspace;
  $('#workspace-path').title = settings.paths.workspace;
  $('#user-badge').textContent = 'offline';

  downloader.refresh();
  licensePage.refresh();
}

document.addEventListener('DOMContentLoaded', boot);

})();
