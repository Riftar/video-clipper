'use strict';

/* ════════════════════════════════════════════════════════════════
   Clipper — renderer. Builds each page's UI and wires it to window.api.
   Plain JS, no framework. State is kept in small module objects.
   Wrapped in an IIFE so a re-run (e.g. reload) doesn't trip
   "Identifier 'api' has already been declared" at top level.
   All UI strings go through window.i18n.t() for EN/ID support.
   ════════════════════════════════════════════════════════════════ */

(function () {
const api = window.api;
const t = window.i18n.t;
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
  const tn = el('div', { class: `toast ${type}` }, msg);
  host.append(tn);
  setTimeout(() => { tn.style.opacity = '0'; setTimeout(() => tn.remove(), 250); }, ms);
}

/* ─────────────────────────── nav + i18n ──────────────────────── */
let currentPage = 'downloader';

function initNav() {
  $$('.nav-item').forEach(btn => {
    btn.addEventListener('click', () => {
      $$('.nav-item').forEach(b => b.classList.toggle('active', b === btn));
      const target = btn.dataset.target;
      $$('.page').forEach(p => p.classList.toggle('active', p.id === target));
      currentPage = target.replace('page-', '');
      $('#page-title').textContent = btn.textContent.trim();
      if (currentPage === 'downloader') downloader.refresh();
      if (currentPage === 'studio') studio.refresh();
      if (currentPage === 'export') exportPage.refresh();
    });
  });
}

/** Rebuild the entire UI — called on language change and initial boot. */
function rebuildAll() {
  // Update static shell strings
  $$('.nav-item').forEach(item => {
    const page = item.dataset.target.replace('page-', '');
    const key = 'nav_' + page;
    const ico = item.querySelector('.nav-ico');
    item.textContent = '';
    if (ico) item.append(ico);
    item.append(document.createTextNode(' ' + t(key)));
  });
  $('#workspace-path').textContent = t('workspace_label');

  // Rebuild pages
  downloader.build();
  studio.build();
  exportPage.build();
  licensePage.build();

  // Refresh active page data
  if (currentPage === 'downloader') downloader.refresh();
  if (currentPage === 'studio') studio.refresh();
  if (currentPage === 'export') exportPage.refresh();
  licensePage.refresh();
}

function buildLangSelector() {
  const sel = el('select', { id: 'lang-select', class: 'select', style: 'font-size:12px;padding:4px 8px' });
  window.i18n.languages().forEach(l => {
    const opt = el('option', { value: l.code }, l.label);
    if (l.code === window.i18n.getLang()) opt.selected = true;
    sel.append(opt);
  });
  sel.addEventListener('change', () => {
    window.i18n.setLang(sel.value);
    rebuildAll();
  });
  return sel;
}

/* ════════════════════════════════ DOWNLOADER ════════════════════════════════ */
const downloader = (() => {
  let lastInfo = null;

  async function analyze() {
    const url = $('#dl-url').value.trim();
    const btn = $('#dl-analyze');
    const status = $('#dl-status');
    if (!url) return toast(t('dl_paste_first'), 'warn');

    btn.disabled = true;
    status.innerHTML = '<span class="spinner"></span> ' + t('dl_analyzing');
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
          : el('div', {}, t('dl_no_preview'))),
        el('div', {},
          el('div', { class: 'field' },
            el('label', {}, t('dl_col_title')),
            el('div', { class: 'input', style: 'font-weight:600' }, info.title)),
          el('div', { class: 'row', style: 'margin-top:10px' },
            el('div', { class: 'field' },
              el('label', {}, t('dl_col_duration')),
              el('div', { class: 'input' }, secsToHHMMSS(info.duration))),
            el('div', { class: 'field' },
              el('label', {}, t('dl_col_uploader')),
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
    setProgress(0, t('dl_starting'));

    const unsub = api.download.onProgress(p => {
      if (p.stage === 'downloading') setProgress(p.percent, t('dl_downloading') + ' ' + p.percent.toFixed(0) + '%');
      if (p.stage === 'done') setProgress(100, t('dl_done'));
    });

    const res = await api.download.start(url, quality);
    unsub();
    btn.disabled = false;
    if (res.success) {
      toast(t('dl_complete'), 'success');
      setProgress(100, t('dl_done'));
    } else {
      toast(res.error || t('dl_failed'), 'error');
      setProgress(0, t('dl_error') + ': ' + res.error);
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
        el('h3', { class: 'card-title' }, t('dl_title')),
        el('div', { class: 'field' },
          el('label', {}, t('dl_url_label')),
          el('input', { id: 'dl-url', class: 'input', placeholder: t('dl_url_placeholder') })),
        el('div', { class: 'row', style: 'margin-top:12px' },
          el('div', { class: 'field' },
            el('label', {}, t('dl_quality_label')),
            el('select', { id: 'dl-quality', class: 'select' },
              ...['1080','720','480','360'].map(q => el('option', { value: q }, q + 'p')))),
          el('button', { id: 'dl-analyze', class: 'btn-ghost', onclick: analyze }, t('dl_analyze')),
          el('button', { id: 'dl-download-btn', class: 'btn accent', onclick: download, disabled: true }, t('dl_download'))),
        el('div', { id: 'dl-progress-wrap', style: 'display:none;margin-top:14px' },
          el('div', { class: 'progress' }, el('div', { id: 'dl-progress-bar', class: 'progress-bar' })),
          el('div', { class: 'progress-meta' },
            el('span', { id: 'dl-progress-label' }, ''),
            el('span', { id: 'dl-progress-pct' }, '0%'))),
        el('div', { id: 'dl-status', class: 'status-line' }),
        el('div', { id: 'dl-preview' })
      ),
      el('div', { class: 'card' },
        el('h3', { class: 'card-title' }, t('dl_videos_title')),
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
        el('div', { class: 'big' }, '∅'), el('div', {}, t('dl_empty'))));
      return;
    }
    host.innerHTML = '';
    const table = el('table', { class: 'table' },
      el('thead', {}, el('tr', {},
        el('th', {}, t('dl_col_title')), el('th', {}, t('dl_col_size')), el('th', {}, t('dl_col_added')))),
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
  const queue = [];

  const ASPECTS = [
    ['original', 'st_aspects_original'],
    ['9:16-crop', 'st_aspects_crop'],
    ['9:16-pad', 'st_aspects_pad'],
    ['1:1', 'st_aspects_square'],
  ];

  function build() {
    const root = $('#page-studio');
    root.innerHTML = '';
    root.append(
      el('div', { class: 'card' },
        el('h3', { class: 'card-title' }, t('st_source_title')),
        el('div', { class: 'row' },
          el('div', { class: 'field', style: 'flex:2' },
            el('label', {}, t('st_pick_video')),
            el('select', { id: 'st-video', class: 'select' })),
          el('button', { class: 'btn-ghost', onclick: pickExternal }, t('st_browse'))),
        el('div', { id: 'st-player-wrap', style: 'margin-top:14px' })
      ),
      el('div', { class: 'card' },
        el('h3', { class: 'card-title' }, t('st_add_clip_title')),
        el('div', { class: 'grid-3' },
          el('div', { class: 'field' },
            el('label', {}, t('st_start_label')),
            el('input', { id: 'st-start', class: 'input', value: '00:00:00' }),
            el('button', { class: 'btn-ghost', style: 'margin-top:6px', onclick: () => captureTime('start') }, t('st_capture'))),
          el('div', { class: 'field' },
            el('label', {}, t('st_duration_label')),
            el('input', { id: 'st-duration', class: 'input', type: 'number', value: '15' })),
          el('div', { class: 'field' },
            el('label', {}, t('st_aspect_label')),
            el('select', { id: 'st-aspect', class: 'select' },
              ...ASPECTS.map(([v, k]) => el('option', { value: v }, t(k))))
          )
        ),
        el('div', { class: 'field', style: 'margin-top:12px' },
          el('label', {}, t('st_clip_title_label')),
          el('input', { id: 'st-title', class: 'input', placeholder: t('st_clip_title_ph') })),
        el('div', { class: 'row', style: 'margin-top:14px' },
          el('button', { class: 'btn', onclick: addToQueue }, t('st_add_queue')),
          el('button', { class: 'btn accent', onclick: processBatch, disabled: true, id: 'st-process-btn' }, t('st_process_batch'))),
        el('div', { id: 'st-status', class: 'status-line' })
      ),
      el('div', { class: 'card' },
        el('h3', { class: 'card-title' }, t('st_queue_title')),
        el('div', { id: 'st-queue' }))
    );
  }

  async function pickExternal() {
    const res = await api.library.selectVideoFile();
    if (!res.success) return;
    const sel = $('#st-video');
    const opt = el('option', { value: res.path, selected: true }, '[external] ' + res.path.split(/[\\/]/).pop());
    sel.append(opt);
    loadPlayer(res.path);
  }

  async function loadVideoList() {
    const sel = $('#st-video'); if (!sel) return;
    const current = sel.value;
    sel.innerHTML = '<option value="">' + t('st_select_video') + '</option>';
    const videos = await api.library.getVideos();
    videos.forEach(v => sel.append(el('option', { value: v.path }, v.name)));
    if (current) sel.value = current;
  }

  function onVideoChange() {
    const p = $('#st-video').value;
    if (p) loadPlayer(p);
  }

  async function loadPlayer(path) {
    const wrap = $('#st-player-wrap'); wrap.innerHTML = '';
    const video = el('video', { controls: true, id: 'st-player' });
    const res = await api.library.localPreview(path);
    if (res.success) video.src = res.url;

    // ── Player controls: skip 10s buttons + time display ──
    const timeDisplay = el('span', { class: 'time-display' }, '00:00:00');
    const controls = el('div', { class: 'player-controls' },
      el('button', { class: 'btn-ghost', onclick: () => { video.currentTime = Math.max(0, video.currentTime - 10); } }, t('st_rewind')),
      timeDisplay,
      el('button', { class: 'btn-ghost', onclick: () => { video.currentTime = video.currentTime + 10; } }, t('st_forward'))
    );
    video.addEventListener('timeupdate', () => { timeDisplay.textContent = secsToHHMMSS(video.currentTime); });

    // ── Waveform canvas ──
    const canvas = el('canvas', { class: 'waveform', width: 800, height: 60 });

    wrap.append(video, controls, canvas);

    // Click waveform to seek
    canvas.addEventListener('click', (e) => {
      if (!video.duration) return;
      const rect = canvas.getBoundingClientRect();
      const ratio = (e.clientX - rect.left) / rect.width;
      video.currentTime = ratio * video.duration;
    });

    // Draw the waveform asynchronously
    drawWaveform(path, canvas);
  }

  async function drawWaveform(videoPath, canvas) {
    const ctx = canvas.getContext('2d');
    const W = canvas.width, H = canvas.height;
    // Background
    ctx.fillStyle = '#0f172a';
    ctx.fillRect(0, 0, W, H);

    try {
      const AudioContext = window.AudioContext || window.webkitAudioContext;
      const ac = new AudioContext();
      // Fetch the file as array buffer
      const fileUrl = 'file:///' + videoPath.replace(/\\/g, '/').replace(/^\//, '');
      const resp = await fetch(fileUrl);
      const arrBuf = await resp.arrayBuffer();
      const audioBuf = await ac.decodeAudioData(arrBuf);
      ac.close();

      const data = audioBuf.getChannelData(0);
      const buckets = 400;
      const samplesPerBucket = Math.floor(data.length / buckets);
      const peaks = [];
      for (let i = 0; i < buckets; i++) {
        let max = 0;
        const start = i * samplesPerBucket;
        for (let j = 0; j < samplesPerBucket; j++) {
          const v = Math.abs(data[start + j] || 0);
          if (v > max) max = v;
        }
        peaks.push(max);
      }
      const maxPeak = Math.max(...peaks, 0.001);

      // Draw bars
      const barW = W / buckets;
      const mid = H / 2;
      ctx.fillStyle = '#0f172a';
      ctx.fillRect(0, 0, W, H);
      for (let i = 0; i < buckets; i++) {
        const h = (peaks[i] / maxPeak) * (H * 0.9);
        const x = i * barW;
        const grad = ctx.createLinearGradient(0, mid - h/2, 0, mid + h/2);
        grad.addColorStop(0, '#6366f1');
        grad.addColorStop(1, '#10b981');
        ctx.fillStyle = grad;
        ctx.fillRect(x, mid - h/2, Math.max(1, barW - 1), h);
      }
    } catch (e) {
      // If decode fails, show a placeholder line
      ctx.fillStyle = '#334155';
      ctx.fillRect(0, H/2 - 1, W, 2);
    }
  }

  function captureTime(field) {
    const v = $('#st-player'); if (!v) return toast(t('st_pick_video_first'), 'warn');
    const time = secsToHHMMSS(v.currentTime);
    if (field === 'start') $('#st-start').value = time;
  }

  function addToQueue() {
    const startSec = hhmmssToSecs($('#st-start').value);
    const durationSec = parseFloat($('#st-duration').value);
    if (isNaN(startSec)) return toast(t('st_invalid_start'), 'warn');
    if (isNaN(durationSec) || durationSec <= 0) return toast(t('st_invalid_duration'), 'warn');
    queue.push({
      videoPath: $('#st-video').value,
      title: $('#st-title').value.trim() || 'clip_' + secsToHHMMSS(startSec).replace(/:/g, '-'),
      startSec, durationSec,
      aspect: $('#st-aspect').value,
    });
    $('#st-title').value = '';
    renderQueue();
    toast(t('st_added_queue'), 'success');
  }

  function renderQueue() {
    const host = $('#st-queue'); host.innerHTML = '';
    if (!queue.length) {
      host.append(el('div', { class: 'empty-state' }, el('div', { class: 'big' }, '∅'), t('st_queue_empty')));
      $('#st-process-btn').disabled = true;
      return;
    }
    $('#st-process-btn').disabled = false;
    const table = el('table', { class: 'table' },
      el('thead', {}, el('tr', {},
        el('th', {}, '#'), el('th', {}, t('st_col_title')), el('th', {}, t('st_col_start')),
        el('th', {}, t('st_col_dur')), el('th', {}, t('st_col_aspect')), el('th', {}, t('st_col_action')))),
      el('tbody', {}, ...queue.map((q, i) => el('tr', {},
        el('td', {}, String(i + 1)),
        el('td', {}, q.title),
        el('td', {}, secsToHHMMSS(q.startSec)),
        el('td', {}, q.durationSec + 's'),
        el('td', {}, el('span', { class: 'tag' }, q.aspect)),
        el('td', {}, el('button', { class: 'btn-ghost', onclick: () => { queue.splice(i, 1); renderQueue(); } }, t('st_remove')))
      )))
    );
    host.append(table);
  }

  async function processBatch() {
    const videoPath = $('#st-video').value;
    if (!videoPath) return toast(t('st_pick_first'), 'warn');
    if (!queue.length) return;
    const jobs = queue.map(q => ({ ...q, videoPath }));
    $('#st-process-btn').disabled = true;
    $('#st-status').innerHTML = '<span class="spinner"></span> ' + t('st_processing');

    const unsub = api.clip.onProgress(p => {
      if (p.stage === 'clipping') {
        $('#st-status').textContent = t('st_clipping') + ' ' + (p.index + 1) + '/' + p.total + ' — ' + p.name + (p.percent ? ' (' + p.percent.toFixed(0) + '%)' : '');
      } else if (p.stage === 'done') {
        $('#st-status').innerHTML = '<span class="ok">' + t('st_all_done') + '</span>';
      }
    });

    const res = await api.clip.run(jobs);
    unsub();
    $('#st-process-btn').disabled = false;
    if (res.success) {
      const ok = res.results.filter(r => r.success).length;
      toast(ok + '/' + res.results.length + ' ' + t('st_clips_created'), ok === res.results.length ? 'success' : 'warn');
      queue.length = 0;
      renderQueue();
    } else {
      toast(t('st_batch_failed'), 'error');
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

  const WEIGHTS = [['bold','ex_weight_bold'],['normal','ex_weight_normal'],['italic','ex_weight_italic'],['bold-italic','ex_weight_bi']];
  const CASINGS = [['original','ex_casing_original'],['upper','ex_casing_upper'],['lower','ex_casing_lower']];
  const ALIGNS = [['left','ex_align_left'],['center','ex_align_center'],['right','ex_align_right']];

  async function build() {
    const root = $('#page-export');
    root.innerHTML = '';
    const cfg = await api.subtitle.getStyle();
    currentStyle = cfg.style;

    root.append(
      el('div', { class: 'card' },
        el('h3', { class: 'card-title' }, t('ex_clip_title')),
        el('div', { class: 'row' },
          el('div', { class: 'field', style: 'flex:2' },
            el('label', {}, t('ex_pick_clip')),
            el('select', { id: 'ex-clip', class: 'select' })),
          el('button', { class: 'btn-ghost', onclick: loadClip }, t('ex_load')))
      ),
      el('div', { class: 'preview-grid' },
        el('div', { class: 'card' },
          el('h3', { class: 'card-title' }, t('ex_styling_title')),
          el('div', { class: 'grid-2' },
            el('div', { class: 'field' },
              el('label', {}, t('ex_font_label')),
              el('select', { id: 'ex-font', class: 'select', oninput: renderPreviewOverlay },
                ...FONT_OPTIONS.map(f => el('option', { value: f, selected: f === currentStyle.font }, f)))),
            el('div', { class: 'field' },
              el('label', {}, t('ex_size_label')),
              el('input', { id: 'ex-size', class: 'input', type: 'number', value: currentStyle.size, oninput: renderPreviewOverlay })),
            el('div', { class: 'field' },
              el('label', {}, t('ex_color_label')),
              el('input', { id: 'ex-color', class: 'input', type: 'color', value: currentStyle.baseColor, oninput: renderPreviewOverlay })),
            el('div', { class: 'field' },
              el('label', {}, t('ex_outline_color_label')),
              el('input', { id: 'ex-outline', class: 'input', type: 'color', value: currentStyle.outlineColor, oninput: renderPreviewOverlay })),
            el('div', { class: 'field' },
              el('label', {}, t('ex_weight_label')),
              el('select', { id: 'ex-weight', class: 'select', oninput: renderPreviewOverlay },
                ...WEIGHTS.map(([v,k]) => el('option', { value: v, selected: v === currentStyle.weight }, t(k))))),
            el('div', { class: 'field' },
              el('label', {}, t('ex_casing_label')),
              el('select', { id: 'ex-casing', class: 'select', oninput: renderPreviewOverlay },
                ...CASINGS.map(([v,k]) => el('option', { value: v, selected: v === currentStyle.casing }, t(k))))),
            el('div', { class: 'field' },
              el('label', {}, t('ex_align_label')),
              el('select', { id: 'ex-align', class: 'select', oninput: renderPreviewOverlay },
                ...ALIGNS.map(([v,k]) => el('option', { value: v, selected: v === currentStyle.alignment }, t(k))))),
            el('div', { class: 'field' },
              el('label', {}, t('ex_pos_label')),
              el('input', { id: 'ex-pos', class: 'input', type: 'number', min: '0', max: '100', value: currentStyle.positionPct, oninput: renderPreviewOverlay }))
          ),
          el('div', { class: 'row', style: 'margin-top:14px' },
            el('button', { class: 'btn-ghost', onclick: saveStyle }, t('ex_save_style'))),
          el('hr', { class: 'sep' }),
          el('div', { class: 'field' },
            el('label', {}, t('ex_lang_label')),
            el('select', { id: 'ex-lang', class: 'select' },
              el('option', { value: 'id' }, t('ex_lang_id')),
              el('option', { value: 'en' }, t('ex_lang_en')),
              el('option', { value: 'auto' }, t('ex_lang_auto')))),
          el('div', { class: 'row', style: 'margin-top:12px' },
            el('button', { id: 'ex-transcribe-btn', class: 'btn', onclick: transcribe, disabled: true }, t('ex_transcribe'))),
          el('div', { id: 'ex-trans-status', class: 'status-line' })
        ),
        el('div', { class: 'card' },
          el('h3', { class: 'card-title' }, t('ex_preview_title')),
          el('div', { id: 'ex-player-wrap' }, el('div', { class: 'muted' }, t('ex_load_clip_hint'))),
          el('hr', { class: 'sep' }),
          el('div', { class: 'field' },
            el('label', {}, t('ex_transcript_label')),
            el('textarea', { id: 'ex-transcript', class: 'textarea', placeholder: t('ex_transcript_ph'), oninput: renderPreviewOverlay })),
          el('div', { class: 'row', style: 'margin-top:10px' },
            el('button', { class: 'btn-ghost', onclick: reloadTranscript }, t('ex_reload')),
            el('button', { class: 'btn-ghost', onclick: saveTranscript }, t('ex_save_edits'))),
          el('hr', { class: 'sep' }),
          el('div', { class: 'field' },
            el('label', {},
              el('input', { id: 'ex-overwrite', type: 'checkbox', style: 'margin-right:6px' }),
              t('ex_overwrite'))),
          el('div', { class: 'row' },
            el('button', { id: 'ex-export-btn', class: 'btn accent', onclick: doExport, disabled: true }, t('ex_export_video')),
            el('button', { class: 'btn-ghost', onclick: openExportFolder }, t('ex_open_export'))),
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
    toast(res.success ? t('ex_style_saved') : t('ex_style_save_failed'), res.success ? 'success' : 'error');
  }

  async function loadClipList() {
    const sel = $('#ex-clip'); if (!sel) return;
    const current = sel.value;
    sel.innerHTML = '<option value="">' + t('ex_select_clip') + '</option>';
    const clips = await api.library.getClips();
    clips.forEach(c => sel.append(el('option', { value: c.path }, c.name)));
    if (current) sel.value = current;
  }

  async function loadClip() {
    const path = $('#ex-clip').value;
    if (!path) return;
    $('#ex-transcribe-btn').disabled = false;

    // Build player stage with subtitle overlay
    const wrap = $('#ex-player-wrap'); wrap.innerHTML = '';
    const stage = el('div', { class: 'player-stage' });
    const v = el('video', { controls: true, id: 'ex-player' });
    const res = await api.library.localPreview(path);
    if (res.success) v.src = res.url;

    // Subtitle overlay
    const overlay = el('div', { class: 'subtitle-overlay', id: 'ex-sub-overlay' },
      el('span', { class: 'sub-text', id: 'ex-sub-text' }, t('ex_sample_text')));

    stage.append(v, overlay);
    wrap.append(stage);

    // Existing transcript?
    const tr = await api.subtitle.getText(path);
    $('#ex-transcript').value = tr.success ? tr.text : '';
    if (tr.success) $('#ex-export-btn').disabled = false;

    renderPreviewOverlay();
  }

  /** Parse first cue text from SRT, or use sample text. */
  function getPreviewText() {
    const raw = $('#ex-transcript').value.trim();
    if (!raw) return t('ex_sample_text');
    // SRT cue format: number\n timestamp\n text\n\n — grab first text block
    const lines = raw.split('\n');
    let textLineIdx = -1;
    for (let i = 0; i < lines.length; i++) {
      if (lines[i].includes('-->')) { textLineIdx = i + 1; break; }
    }
    if (textLineIdx >= 0 && lines[textLineIdx]) return lines[textLineIdx].trim();
    return t('ex_sample_text');
  }

  /** Apply current style form values to the subtitle overlay element. */
  function renderPreviewOverlay() {
    const textEl = $('#ex-sub-text');
    const overlay = $('#ex-sub-overlay');
    if (!textEl || !overlay) return;

    const style = readStyleFromForm();

    // Font + size (scale down for preview: the overlay is smaller than 1080p)
    textEl.style.fontFamily = style.font + ', sans-serif';
    const previewScale = 0.35; // approximate: 1080px → ~378px preview width scaling
    textEl.style.fontSize = Math.max(10, style.size * previewScale) + 'px';

    // Colors + outline
    textEl.style.color = style.baseColor;
    const outline = style.outlineWidth || 2;
    textEl.style.textShadow = `
      -${outline}px -${outline}px 0 ${style.outlineColor},
      ${outline}px -${outline}px 0 ${style.outlineColor},
      -${outline}px ${outline}px 0 ${style.outlineColor},
      ${outline}px ${outline}px 0 ${style.outlineColor}`;

    // Weight / italic
    const weightMap = { 'bold': 'bold', 'normal': 'normal', 'italic': 'normal', 'bold-italic': 'bold' };
    textEl.style.fontWeight = weightMap[style.weight] || 'normal';
    textEl.style.fontStyle = (style.weight === 'italic' || style.weight === 'bold-italic') ? 'italic' : 'normal';

    // Casing
    const caseMap = { 'original': 'none', 'upper': 'uppercase', 'lower': 'lowercase' };
    textEl.style.textTransform = caseMap[style.casing] || 'none';

    // Alignment (on the overlay container)
    const alignMap = { left: 'left', center: 'center', right: 'right' };
    overlay.style.textAlign = alignMap[style.alignment] || 'center';

    // Vertical position (0 = bottom, 100 = top)
    const bottomPct = 100 - (style.positionPct || 40);
    overlay.style.bottom = bottomPct + '%';

    // Text content
    textEl.textContent = getPreviewText();
  }

  async function transcribe() {
    const clipPath = $('#ex-clip').value;
    const lang = $('#ex-lang').value;
    if (!clipPath) return;
    $('#ex-transcribe-btn').disabled = true;
    $('#ex-trans-status').innerHTML = '<span class="spinner"></span> ' + t('ex_transcribing_long');

    const unsub = api.subtitle.onTranscriptionProgress(p => {
      if (p.stage === 'transcribing') {
        $('#ex-trans-status').innerHTML = '<span class="spinner"></span> ' + t('ex_transcribing') + ' ' + p.percent + '%';
      } else if (p.stage === 'done') {
        $('#ex-trans-status').innerHTML = '<span class="ok">' + t('ex_trans_done') + '</span>';
      }
    });

    const res = await api.subtitle.transcribe(clipPath, lang);
    unsub();
    $('#ex-transcribe-btn').disabled = false;
    if (res.success) {
      $('#ex-transcript').value = res.text;
      $('#ex-export-btn').disabled = false;
      renderPreviewOverlay();
      toast(t('ex_trans_complete'), 'success');
    } else {
      $('#ex-trans-status').innerHTML = '<span class="err">✗ ' + res.error + '</span>';
      toast(res.error, 'error');
    }
  }

  async function saveTranscript() {
    const clipPath = $('#ex-clip').value;
    const res = await api.subtitle.saveText(clipPath, $('#ex-transcript').value);
    toast(res.success ? t('ex_transcript_saved') : t('ex_save_failed'), res.success ? 'success' : 'error');
  }

  async function reloadTranscript() {
    const clipPath = $('#ex-clip').value;
    const res = await api.subtitle.getText(clipPath);
    $('#ex-transcript').value = res.success ? res.text : '';
    renderPreviewOverlay();
  }

  async function doExport() {
    const clipPath = $('#ex-clip').value;
    if (!clipPath) return;
    await saveTranscript();
    const style = readStyleFromForm();
    const overwrite = $('#ex-overwrite').checked;
    $('#ex-export-btn').disabled = true;
    $('#ex-export-prog').style.display = 'block';
    $('#ex-export-status').innerHTML = '<span class="spinner"></span> ' + t('ex_exporting');

    const unsub = api.subtitle.onExportProgress(p => {
      if (p.stage === 'exporting') {
        $('#ex-export-bar').style.width = p.percent + '%';
        $('#ex-export-status').textContent = t('ex_exporting') + ' ' + p.percent.toFixed(0) + '%';
      } else if (p.stage === 'done') {
        $('#ex-export-bar').style.width = '100%';
        $('#ex-export-status').innerHTML = '<span class="ok">' + t('ex_export_done') + '</span>';
      }
    });

    const res = await api.subtitle.export(clipPath, style, overwrite);
    unsub();
    $('#ex-export-btn').disabled = false;
    if (res.success) {
      toast(t('ex_exported') + ' ' + (res.outputName || ''), 'success');
    } else {
      toast(res.error || t('ex_export_failed'), 'error');
      $('#ex-export-status').innerHTML = '<span class="err">✗ ' + res.error + '</span>';
    }
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
        el('h3', { class: 'card-title' }, t('lic_status_title')),
        el('div', { id: 'lic-info', class: 'status-line' }, t('lic_checking'))),
      el('div', { class: 'card' },
        el('h3', { class: 'card-title' }, t('lic_about_title')),
        el('p', { class: 'muted' }, t('lic_about_desc')),
        el('p', { class: 'muted' }, t('lic_about_auth')),
        el('p', { class: 'muted' }, t('lic_version') + ' ' + (window.__version || '0.1.0')))
    );
  }
  async function refresh() {
    const host = $('#lic-info'); if (!host) return;
    const res = await api.license.check();
    if (res.success) {
      host.innerHTML = '<span class="ok">' + t('lic_active') + ' ' + res.type.toUpperCase() + '</span><br><span class="muted">' + res.name + ' · ' + (res.note || '') + '</span>';
    } else {
      host.innerHTML = '<span class="err">' + t('lic_not_licensed') + '</span>';
    }
  }
  return { build, refresh };
})();

/* ════════════════════════════════════ BOOT ════════════════════════════════════ */
async function boot() {
  initNav();

  // Build initial pages
  downloader.build();
  studio.build();
  await exportPage.build();
  licensePage.build();

  // Settings + sidebar info
  const settings = await api.settings.get();
  $('#brand-version').textContent = 'v' + settings.version;
  window.__version = settings.version;
  $('#workspace-path').title = settings.paths.workspace;

  // Language selector in sidebar footer
  const foot = $('.sidebar-foot');
  const existing = $('#lang-select');
  if (!existing) foot.prepend(buildLangSelector());

  downloader.refresh();
  licensePage.refresh();
}

document.addEventListener('DOMContentLoaded', boot);

})();
