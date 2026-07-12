'use strict';

/* ════════════════════════════════════════════════════════════════
   Clipper — renderer. TikTok-inspired theme (Stitch design).
   Studio page fully redesigned; other pages adapted to new theme.
   ════════════════════════════════════════════════════════════════ */

(function () {
const api = window.api;
const t = window.i18n.t;
const FONT_OPTIONS = ['Arial', 'Arial Black', 'Impact', 'Tahoma', 'Verdana',
  'Montserrat', 'Poppins', 'Bebas Neue', 'Inter', 'Anton', 'Urbanist', 'Oswald', 'Raleway', 'Nunito'];

/* ─────────────────────────── helpers ─────────────────────────── */
const $  = (sel, root = document) => root.querySelector(sel);
const $$ = (sel, root = document) => [...root.querySelectorAll(sel)];

/** Create a DOM element. Supports `class`, `html`, `on*` handlers, and `icon` shortcut. */
function el(tag, attrs = {}, ...children) {
  const node = document.createElement(tag);
  for (const [k, v] of Object.entries(attrs)) {
    if (k === 'class') node.className = v;
    else if (k === 'html') node.innerHTML = v;
    else if (k === 'icon') { /* handled below */ }
    else if (k.startsWith('on') && typeof v === 'function') node.addEventListener(k.slice(2), v);
    else node.setAttribute(k, v);
  }
  // Icon shortcut: <span class="material-symbols-outlined">name</span>
  if (attrs.icon) {
    const ic = document.createElement('span');
    ic.className = 'material-symbols-outlined';
    ic.textContent = attrs.icon;
    node.prepend(ic);
  }
  for (const c of children.flat()) {
    if (c == null || c === false) continue;
    node.append(c.nodeType ? c : document.createTextNode(String(c)));
  }
  return node;
}

/** Material symbol icon element. */
function icon(name, opts = {}) {
  const span = document.createElement('span');
  span.className = 'material-symbols-outlined' + (opts.filled ? ' filled-icon' : '');
  span.textContent = name;
  if (opts.size) span.style.fontSize = opts.size;
  return span;
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

const PAGE_META = {
  downloader: { icon: 'download', titleKey: 'nav_downloader', subKey: 'dl_title' },
  studio:     { icon: 'content_cut', titleKey: 'nav_studio', subKey: 'st_source_title' },
  export:     { icon: 'ios_share', titleKey: 'nav_export', subKey: 'ex_preview_title' },
  license:    { icon: 'key', titleKey: 'nav_license', subKey: 'lic_status_title' },
};

function initNav() {
  $$('.nav-item').forEach(btn => {
    btn.addEventListener('click', () => switchPage(btn.dataset.target.replace('page-', '')));
  });
}

function switchPage(page) {
  currentPage = page;
  $$('.nav-item').forEach(b => b.classList.toggle('active', b.dataset.target === 'page-' + page));
  $$('.page').forEach(p => p.classList.toggle('active', p.id === 'page-' + page));
  rebuildTopbar(page);
  if (page === 'downloader') downloader.refresh();
  if (page === 'studio') studio.refresh();
  if (page === 'export') exportPage.refresh();
}

/** Build the top bar (title + subtitle) above the current page content. */
function rebuildTopbar(page) {
  const meta = PAGE_META[page] || PAGE_META.downloader;
  const pageEl = $('#page-' + page);
  // Remove existing topbar
  const existing = pageEl.querySelector('.topbar');
  if (existing) existing.remove();
  const bar = el('div', { class: 'topbar' },
    el('div', {},
      el('h2', { class: 'topbar-title' }, t(meta.titleKey)),
      el('div', { class: 'topbar-sub' }, t(meta.subKey))),
    el('div', { class: 'row', style: 'gap:8px' },
      el('button', { class: 'btn-ghost', icon: 'translate', onclick: cycleLang },
        window.i18n.getLang().toUpperCase()))
  );
  pageEl.prepend(bar);
}

function cycleLang() {
  const cur = window.i18n.getLang();
  const next = cur === 'en' ? 'id' : 'en';
  window.i18n.setLang(next);
  // Update selector
  const sel = $('#lang-select');
  if (sel) sel.value = next;
  rebuildAll();
}

/** Rebuild the entire UI — called on language change and initial boot. */
function rebuildAll() {
  // Update nav labels
  $$('.nav-item').forEach(item => {
    const page = item.dataset.target.replace('page-', '');
    const label = item.querySelector('[data-nav]');
    if (label) label.textContent = t('nav_' + page);
  });
  $('#workspace-path').textContent = t('workspace_label');
  // Update lang selector if present
  const sel = $('#lang-select');
  if (sel) sel.value = window.i18n.getLang();

  // Rebuild pages
  downloader.build();
  studio.build();
  exportPage.build();
  licensePage.build();

  rebuildTopbar(currentPage);
  if (currentPage === 'downloader') downloader.refresh();
  if (currentPage === 'studio') studio.refresh();
  if (currentPage === 'export') exportPage.refresh();
  licensePage.refresh();
}

function buildLangSelector() {
  const sel = el('select', { id: 'lang-select', class: 'select' });
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

/* ════════════════════════════════════ DOWNLOADER ════════════════════════════════════ */
const downloader = (() => {
  let lastInfo = null;

  async function analyze() {
    const url = $('#dl-url').value.trim();
    if (!url) return toast(t('dl_paste_first'), 'warn');
    const btn = $('#dl-analyze'); btn.disabled = true;
    const status = $('#dl-status');
    status.innerHTML = ''; status.append(icon('progress_activity'), ' ' + t('dl_analyzing'));
    const res = await api.download.getInfo(url);
    btn.disabled = false;
    if (!res.success) { status.innerHTML = `<span class="err">✗ ${res.error}</span>`; return; }
    lastInfo = res.data; status.innerHTML = ''; renderPreview(res.data);
  }

  function renderPreview(info) {
    const host = $('#dl-preview'); host.innerHTML = '';
    host.append(
      el('div', { class: 'preview-grid' },
        el('div', { class: 'thumb' }, info.thumbnail
          ? el('img', { src: info.thumbnail })
          : el('div', {}, t('dl_no_preview'))),
        el('div', {},
          el('div', { class: 'field' },
            el('label', {}, t('dl_col_title')),
            el('div', { class: 'input', style: 'font-weight:600;pointer-events:none' }, info.title)),
          el('div', { class: 'row', style: 'margin-top:10px' },
            el('div', { class: 'field' },
              el('label', {}, t('dl_col_duration')),
              el('div', { class: 'input', style: 'pointer-events:none' }, secsToHHMMSS(info.duration))),
            el('div', { class: 'field' },
              el('label', {}, t('dl_col_uploader')),
              el('div', { class: 'input', style: 'pointer-events:none' }, info.uploader || '—'))))
      )
    );
    $('#dl-download-btn').disabled = false;
  }

  async function download() {
    const url = $('#dl-url').value.trim();
    if (!url) return;
    const btn = $('#dl-download-btn'); btn.disabled = true;
    $('#dl-progress-wrap').style.display = 'block';
    setProgress(0, t('dl_starting'));
    const unsub = api.download.onProgress(p => {
      if (p.stage === 'downloading') setProgress(p.percent, t('dl_downloading') + ' ' + p.percent.toFixed(0) + '%');
      if (p.stage === 'done') setProgress(100, t('dl_done'));
    });
    const res = await api.download.start(url, $('#dl-quality').value);
    unsub(); btn.disabled = false;
    if (res.success) { toast(t('dl_complete'), 'success'); setProgress(100, t('dl_done')); }
    else { toast(res.error || t('dl_failed'), 'error'); setProgress(0, t('dl_error') + ': ' + res.error); }
  }

  function setProgress(pct, label) {
    $('#dl-progress-bar').style.width = pct + '%';
    $('#dl-progress-label').textContent = label;
    $('#dl-progress-pct').textContent = pct.toFixed(0) + '%';
  }

  function build() {
    const root = $('#page-downloader'); root.innerHTML = '';
    root.append(
      el('div', { class: 'card' },
        el('h3', { class: 'card-title' }, icon('download'), ' ' + t('dl_title')),
        el('div', { class: 'field' },
          el('label', {}, t('dl_url_label')),
          el('input', { id: 'dl-url', class: 'input', placeholder: t('dl_url_placeholder') })),
        el('div', { class: 'row', style: 'margin-top:12px' },
          el('div', { class: 'field' },
            el('label', {}, t('dl_quality_label')),
            el('select', { id: 'dl-quality', class: 'select' },
              ...['1080','720','480','360'].map(q => el('option', { value: q }, q + 'p')))),
          el('button', { id: 'dl-analyze', class: 'btn-ghost', icon: 'search', onclick: analyze }, t('dl_analyze')),
          el('button', { id: 'dl-download-btn', class: 'btn-success', icon: 'download', onclick: download, disabled: true }, t('dl_download'))),
        el('div', { id: 'dl-progress-wrap', style: 'display:none;margin-top:14px' },
          el('div', { class: 'progress' }, el('div', { id: 'dl-progress-bar', class: 'progress-bar' })),
          el('div', { class: 'progress-meta' },
            el('span', { id: 'dl-progress-label' }, ''),
            el('span', { id: 'dl-progress-pct' }, '0%'))),
        el('div', { id: 'dl-status', class: 'status-line' }),
        el('div', { id: 'dl-preview' })
      ),
      el('div', { class: 'card' },
        el('h3', { class: 'card-title' }, icon('video_library'), ' ' + t('dl_videos_title')),
        el('div', { id: 'dl-videolist' }))
    );
    $('#dl-quality').value = '720';
  }

  async function refresh() {
    const host = $('#dl-videolist'); if (!host) return;
    const videos = await api.library.getVideos();
    if (!videos.length) {
      host.innerHTML = '';
      host.append(el('div', { class: 'empty-state' }, el('div', { class: 'big' }, '∅'), t('dl_empty')));
      return;
    }
    host.innerHTML = '';
    host.append(el('table', { class: 'table' },
      el('thead', {}, el('tr', {},
        el('th', {}, t('dl_col_title')), el('th', {}, t('dl_col_size')), el('th', {}, t('dl_col_added')))),
      el('tbody', {}, ...videos.map(v => el('tr', {},
        el('td', {}, v.name), el('td', {}, fmtSize(v.size)), el('td', {}, fmtDate(v.mtime)))))));
  }

  return { build, refresh };
})();

/* ════════════════════════════════════ STUDIO (Stitch redesign) ════════════════════════════════════ */
const studio = (() => {
  const queue = [];
  let currentVideoPath = null;
  let videoDuration = 0;

  const ASPECTS = [
    { value: 'original', key: 'st_aspects_original', icon: 'crop_landscape', label: 'Original' },
    { value: '9:16-crop', key: 'st_aspects_crop',    icon: 'crop_portrait',  label: '9:16' },
    { value: '1:1',      key: 'st_aspects_square',   icon: 'crop_square',    label: '1:1' },
  ];

  function build() {
    const root = $('#page-studio'); root.innerHTML = '';

    const grid = el('div', { class: 'studio-grid' });

    // ── LEFT: source selector + player + waveform ──
    const left = el('div', { class: 'studio-left' });

    // Source card
    left.append(
      el('div', { class: 'card card-tight', style: 'display:flex;align-items:center;gap:16px;flex-shrink:0' },
        el('div', { style: 'flex:1' },
          el('label', { class: 'block', style: 'font-size:12px;font-weight:600;letter-spacing:0.05em;color:var(--text-dim);margin-bottom:8px;display:block' }, t('st_pick_video')),
          el('div', { style: 'position:relative' },
            (() => {
              const sel = el('select', { id: 'st-video', class: 'select', style: 'padding-right:36px;appearance:none;cursor:pointer' });
              sel.addEventListener('change', onVideoChange);
              return sel;
            })(),
            el('span', { class: 'material-symbols-outlined', style: 'position:absolute;right:12px;top:50%;transform:translateY(-50%);pointer-events:none;color:var(--text-dim)' }, 'expand_more')
          )
        ),
        el('div', { style: 'width:1px;height:48px;background:var(--outline-variant)' }),
        el('button', { class: 'btn-ghost', icon: 'folder_open', onclick: pickExternal }, t('st_browse'))
      )
    );

    // Player card
    const playerCard = el('div', { class: 'player-card' });
    const stage = el('div', { class: 'player-stage', id: 'st-player-stage' },
      el('div', { class: 'no-video' }, t('st_pick_video')));
    const transport = el('div', { class: 'transport-bar' },
      el('span', { id: 'st-rewind', class: 'material-symbols-outlined', onclick: () => skipVideo(-10) }, 'replay_10'),
      el('span', { id: 'st-play', class: 'material-symbols-outlined', onclick: togglePlay }, 'play_arrow'),
      el('span', { id: 'st-forward', class: 'material-symbols-outlined', onclick: () => skipVideo(10) }, 'forward_10'),
      el('div', { class: 'scrubber', id: 'st-scrubber', onclick: seekFromBar },
        el('div', { class: 'scrubber-fill', id: 'st-scrubber-fill', style: 'width:0%' },
          el('div', { class: 'scrubber-thumb' }))),
      el('span', { class: 'transport-time', id: 'st-current-time' }, '00:00:00'),
      el('span', { class: 'transport-time right', id: 'st-total-time' }, '00:00:00')
    );
    playerCard.append(stage, transport);
    left.append(playerCard);

    // Waveform card
    left.append(
      el('div', { class: 'card card-tight' },
        el('canvas', { class: 'waveform', id: 'st-waveform', width: 1200, height: 56 })
      )
    );

    grid.append(left);

    // ── RIGHT: clip config + queue ──
    const right = el('div', { class: 'studio-right' });

    // Create Clip form
    const clipForm = el('div', { class: 'card' },
      el('h3', { class: 'card-title' }, icon('add_box'), ' ' + t('st_add_clip_title')),
      el('div', { class: 'field', style: 'margin-bottom:16px' },
        el('label', {}, t('st_clip_title_label')),
        el('input', { id: 'st-title', class: 'input', placeholder: t('st_clip_title_ph') })),
      el('div', { class: 'grid-2', style: 'display:grid;grid-template-columns:1fr 1fr;gap:16px;margin-bottom:16px' },
        el('div', { class: 'field' },
          el('label', {}, t('st_start_label')),
          el('div', { style: 'position:relative' },
            icon('schedule', { size: '16px' }),
            el('input', { id: 'st-start', class: 'input', value: '00:00:00', style: 'padding-left:32px;font-family:JetBrains Mono,monospace;font-size:12px' }),
            el('button', { class: 'btn-ghost', style: 'position:absolute;right:4px;top:50%;transform:translateY(-50%);padding:4px 8px', onclick: () => captureTime('start') }, icon('my_location', { size: '16px' }))
          )
        ),
        el('div', { class: 'field' },
          el('label', {}, t('st_duration_label')),
          el('div', { style: 'position:relative' },
            icon('timer', { size: '16px' }),
            el('input', { id: 'st-duration', class: 'input', type: 'number', value: '15', style: 'padding-left:32px;font-family:JetBrains Mono,monospace;font-size:12px' })
          )
        )
      ),
      el('div', { class: 'field', style: 'margin-bottom:16px' },
        el('label', {}, t('st_aspect_label')),
        (() => {
          const grp = el('div', { class: 'aspect-group', id: 'st-aspect-group' });
          ASPECTS.forEach(a => {
            const btn = el('button', {
              class: 'aspect-btn' + (a.value === 'original' ? ' selected' : ''),
              'data-value': a.value,
              onclick: () => selectAspect(a.value)
            }, icon(a.icon), el('span', {}, t(a.key)));
            grp.append(btn);
          });
          return grp;
        })()
      ),
      el('button', { class: 'btn', icon: 'queue', onclick: addToQueue, style: 'width:100%;margin-top:8px' }, t('st_add_queue'))
    );
    right.append(clipForm);

    // Queue card
    const queueCard = el('div', { class: 'card', style: 'flex:1;display:flex;flex-direction:column;overflow:hidden;padding:0' },
      el('div', { class: 'queue-header' },
        el('span', { style: 'font-size:12px;font-weight:600;letter-spacing:0.05em' }, t('st_queue_title') + ' (', el('span', { id: 'st-queue-count' }, '0'), ')')
      ),
      el('div', { class: 'queue-list', id: 'st-queue' }),
      el('div', { class: 'queue-footer' },
        el('button', { class: 'btn-success', icon: 'electric_bolt', id: 'st-process-btn', onclick: processBatch, disabled: true, style: 'width:100%' }, t('st_process_batch'))
      )
    );
    right.append(queueCard);

    grid.append(right);
    root.append(grid);
  }

  function selectAspect(value) {
    $$('#st-aspect-group .aspect-btn').forEach(btn => {
      btn.classList.toggle('selected', btn.dataset.value === value);
    });
  }

  function getSelectedAspect() {
    const sel = $('#st-aspect-group .aspect-btn.selected');
    return sel ? sel.dataset.value : 'original';
  }

  async function pickExternal() {
    const res = await api.library.selectVideoFile();
    if (!res.success) return;
    const sel = $('#st-video');
    sel.append(el('option', { value: res.path, selected: true }, '[external] ' + res.path.split(/[\\/]/).pop()));
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

  async function onVideoChange() {
    const p = $('#st-video').value;
    if (p) loadPlayer(p);
  }

  async function loadPlayer(path) {
    currentVideoPath = path;
    const stage = $('#st-player-stage'); stage.innerHTML = '';
    const video = el('video', { id: 'st-player', style: 'width:100%;height:100%;object-fit:contain' });
    const res = await api.library.localPreview(path);
    if (res.success) video.src = res.url;
    stage.append(video);

    // Timecode overlay
    stage.append(el('div', { class: 'timecode-overlay', id: 'st-timecode' }, '00:00:00:00'));

    // Wire events
    video.addEventListener('loadedmetadata', () => {
      videoDuration = video.duration;
      $('#st-total-time').textContent = secsToHHMMSS(video.duration);
    });
    video.addEventListener('timeupdate', () => {
      const pct = videoDuration ? (video.currentTime / videoDuration) * 100 : 0;
      $('#st-scrubber-fill').style.width = pct + '%';
      $('#st-current-time').textContent = secsToHHMMSS(video.currentTime);
      // Timecode overlay with frames (approx: *24)
      const tc = secsToHHMMSS(video.currentTime);
      const frames = String(Math.floor((video.currentTime % 1) * 24)).padStart(2, '0');
      const tcEl = $('#st-timecode');
      if (tcEl) tcEl.textContent = tc + ':' + frames;
    });
    video.addEventListener('play', () => { const p = $('#st-play'); if (p) p.textContent = 'pause'; });
    video.addEventListener('pause', () => { const p = $('#st-play'); if (p) p.textContent = 'play_arrow'; });

    // Draw waveform
    drawWaveform(path);
  }

  function togglePlay() {
    const v = $('#st-player'); if (!v) return;
    if (v.paused) v.play(); else v.pause();
  }

  function skipVideo(delta) {
    const v = $('#st-player'); if (!v) return;
    v.currentTime = Math.max(0, Math.min(videoDuration || 999999, v.currentTime + delta));
  }

  function seekFromBar(e) {
    const v = $('#st-player'); if (!v || !videoDuration) return;
    const bar = $('#st-scrubber');
    const rect = bar.getBoundingClientRect();
    const ratio = (e.clientX - rect.left) / rect.width;
    v.currentTime = Math.max(0, Math.min(videoDuration, ratio * videoDuration));
  }

  async function drawWaveform(videoPath, canvas) {
    canvas = canvas || $('#st-waveform');
    if (!canvas) return;
    const ctx = canvas.getContext('2d');
    const W = canvas.width, H = canvas.height;
    ctx.fillStyle = '#000'; ctx.fillRect(0, 0, W, H);
    try {
      const AudioContext = window.AudioContext || window.webkitAudioContext;
      const ac = new AudioContext();
      const fileUrl = 'file:///' + videoPath.replace(/\\/g, '/').replace(/^\//, '');
      const resp = await fetch(fileUrl);
      const arrBuf = await resp.arrayBuffer();
      const audioBuf = await ac.decodeAudioData(arrBuf);
      ac.close();
      const data = audioBuf.getChannelData(0);
      const buckets = 500;
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
      const barW = W / buckets;
      const mid = H / 2;
      ctx.fillStyle = '#000'; ctx.fillRect(0, 0, W, H);
      for (let i = 0; i < buckets; i++) {
        const h = (peaks[i] / maxPeak) * (H * 0.9);
        const x = i * barW;
        const grad = ctx.createLinearGradient(0, mid - h/2, 0, mid + h/2);
        grad.addColorStop(0, '#fe2c55');
        grad.addColorStop(1, '#25f4ee');
        ctx.fillStyle = grad;
        ctx.fillRect(x, mid - h/2, Math.max(1, barW - 1), h);
      }
      // Click to seek
      canvas.onclick = (e) => {
        if (!videoDuration) return;
        const rect = canvas.getBoundingClientRect();
        const ratio = (e.clientX - rect.left) / rect.width;
        const v = $('#st-player');
        if (v) v.currentTime = ratio * videoDuration;
      };
    } catch (e) {
      ctx.fillStyle = '#333'; ctx.fillRect(0, H/2 - 1, W, 2);
    }
  }

  function captureTime(field) {
    const v = $('#st-player'); if (!v) return toast(t('st_pick_video_first'), 'warn');
    if (field === 'start') $('#st-start').value = secsToHHMMSS(v.currentTime);
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
      aspect: getSelectedAspect(),
    });
    $('#st-title').value = '';
    renderQueue();
    toast(t('st_added_queue'), 'success');
  }

  function renderQueue() {
    const host = $('#st-queue'); if (!host) return;
    host.innerHTML = '';
    const countEl = $('#st-queue-count');
    if (countEl) countEl.textContent = String(queue.length);
    $('#st-process-btn').disabled = queue.length === 0;
    if (!queue.length) {
      host.append(el('div', { class: 'empty-state', style: 'padding:24px' }, t('st_queue_empty')));
      return;
    }
    const aspectLabels = { 'original': 'Orig', '9:16-crop': '9:16', '9:16-pad': '9:16', '1:1': '1:1' };
    queue.forEach((q, i) => {
      host.append(
        el('div', { class: 'queue-item' },
          el('div', { class: 'queue-thumb' },
            icon('movie'),
            el('span', { class: 'ratio-badge' }, aspectLabels[q.aspect] || q.aspect)),
          el('div', { class: 'queue-body' },
            el('div', { class: 'queue-title' }, q.title),
            el('div', { class: 'queue-meta' }, secsToHHMMSS(q.startSec) + ' • ' + q.durationSec + 's')),
          el('button', { class: 'queue-delete', onclick: () => { queue.splice(i, 1); renderQueue(); } },
            icon('delete'))
        )
      );
    });
  }

  async function processBatch() {
    const videoPath = $('#st-video').value;
    if (!videoPath) return toast(t('st_pick_first'), 'warn');
    if (!queue.length) return;
    const jobs = queue.map(q => ({ ...q, videoPath }));
    $('#st-process-btn').disabled = true;
    const unsub = api.clip.onProgress(p => {
      if (p.stage === 'clipping') {
        $('#st-process-btn').textContent = t('st_clipping') + ' ' + (p.index + 1) + '/' + p.total;
      } else if (p.stage === 'done') {
        $('#st-process-btn').innerHTML = '';
        $('#st-process-btn').append(icon('electric_bolt'), ' ' + t('st_process_batch'));
      }
    });
    const res = await api.clip.run(jobs);
    unsub();
    $('#st-process-btn').disabled = false;
    if (res.success) {
      const ok = res.results.filter(r => r.success).length;
      toast(ok + '/' + res.results.length + ' ' + t('st_clips_created'), ok === res.results.length ? 'success' : 'warn');
      queue.length = 0; renderQueue();
    } else { toast(t('st_batch_failed'), 'error'); }
  }

  async function refresh() {
    await loadVideoList();
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
    const root = $('#page-export'); root.innerHTML = '';
    const cfg = await api.subtitle.getStyle();
    currentStyle = cfg.style;

    root.append(
      el('div', { class: 'card' },
        el('h3', { class: 'card-title' }, icon('movie'), ' ' + t('ex_clip_title')),
        el('div', { class: 'row' },
          el('div', { class: 'field', style: 'flex:2' },
            el('label', {}, t('ex_pick_clip')),
            el('select', { id: 'ex-clip', class: 'select' })),
          el('button', { class: 'btn-ghost', icon: 'upload', onclick: loadClip }, t('ex_load')))),
      el('div', { class: 'preview-grid' },
        el('div', { class: 'card' },
          el('h3', { class: 'card-title' }, icon('palette'), ' ' + t('ex_styling_title')),
          el('div', { class: 'grid-2', style: 'display:grid;grid-template-columns:1fr 1fr;gap:16px' },
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
              el('input', { id: 'ex-pos', class: 'input', type: 'number', min: '0', max: '100', value: currentStyle.positionPct, oninput: renderPreviewOverlay }))),
          el('div', { class: 'row', style: 'margin-top:14px' },
            el('button', { class: 'btn-ghost', icon: 'save', onclick: saveStyle }, t('ex_save_style'))),
          el('hr', { class: 'sep' }),
          el('div', { class: 'field' },
            el('label', {}, t('ex_lang_label')),
            el('select', { id: 'ex-lang', class: 'select' },
              el('option', { value: 'id' }, t('ex_lang_id')),
              el('option', { value: 'en' }, t('ex_lang_en')),
              el('option', { value: 'auto' }, t('ex_lang_auto')))),
          el('div', { class: 'row', style: 'margin-top:12px' },
            el('button', { id: 'ex-transcribe-btn', class: 'btn', icon: 'graphic_eq', onclick: transcribe, disabled: true }, t('ex_transcribe'))),
          el('div', { id: 'ex-trans-status', class: 'status-line' })
        ),
        el('div', { class: 'card' },
          el('h3', { class: 'card-title' }, icon('visibility'), ' ' + t('ex_preview_title')),
          el('div', { id: 'ex-player-wrap' }, el('div', { class: 'muted' }, t('ex_load_clip_hint'))),
          el('hr', { class: 'sep' }),
          el('div', { class: 'field' },
            el('label', {}, t('ex_transcript_label')),
            el('textarea', { id: 'ex-transcript', class: 'textarea', placeholder: t('ex_transcript_ph'), oninput: renderPreviewOverlay })),
          el('div', { class: 'row', style: 'margin-top:10px' },
            el('button', { class: 'btn-ghost', icon: 'refresh', onclick: reloadTranscript }, t('ex_reload')),
            el('button', { class: 'btn-ghost', icon: 'save', onclick: saveTranscript }, t('ex_save_edits'))),
          el('hr', { class: 'sep' }),
          el('div', { class: 'field', style: 'margin-bottom:12px' },
            el('label', {},
              el('input', { id: 'ex-overwrite', type: 'checkbox' }),
              t('ex_overwrite'))),
          el('div', { class: 'row' },
            el('button', { id: 'ex-export-btn', class: 'btn-success', icon: 'ios_share', onclick: doExport, disabled: true }, t('ex_export_video')),
            el('button', { class: 'btn-ghost', icon: 'folder_open', onclick: openExportFolder }, t('ex_open_export'))),
          el('div', { id: 'ex-export-status', class: 'status-line' }),
          el('div', { id: 'ex-export-prog', style: 'display:none;margin-top:8px' },
            el('div', { class: 'progress' }, el('div', { id: 'ex-export-bar', class: 'progress-bar' })))
        )
      )
    );
  }

  function readStyleFromForm() {
    return {
      font: $('#ex-font').value, size: parseInt($('#ex-size').value) || 100,
      baseColor: $('#ex-color').value, outlineColor: $('#ex-outline').value, outlineWidth: 2,
      weight: $('#ex-weight').value, casing: $('#ex-casing').value,
      alignment: $('#ex-align').value, positionPct: parseInt($('#ex-pos').value) || 40,
    };
  }

  async function saveStyle() {
    const res = await api.subtitle.saveStyle(readStyleFromForm());
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
    const path = $('#ex-clip').value; if (!path) return;
    $('#ex-transcribe-btn').disabled = false;
    const wrap = $('#ex-player-wrap'); wrap.innerHTML = '';
    const stage = el('div', { class: 'player-stage', style: 'aspect-ratio:16/9' });
    const v = el('video', { controls: true, id: 'ex-player', style: 'width:100%;height:100%' });
    const res = await api.library.localPreview(path);
    if (res.success) v.src = res.url;
    const overlay = el('div', { class: 'subtitle-overlay', id: 'ex-sub-overlay' },
      el('span', { class: 'sub-text', id: 'ex-sub-text' }, t('ex_sample_text')));
    stage.append(v, overlay);
    wrap.append(stage);
    const tr = await api.subtitle.getText(path);
    $('#ex-transcript').value = tr.success ? tr.text : '';
    if (tr.success) $('#ex-export-btn').disabled = false;
    renderPreviewOverlay();
  }

  function getPreviewText() {
    const raw = $('#ex-transcript').value.trim();
    if (!raw) return t('ex_sample_text');
    const lines = raw.split('\n');
    let idx = -1;
    for (let i = 0; i < lines.length; i++) { if (lines[i].includes('-->')) { idx = i + 1; break; } }
    if (idx >= 0 && lines[idx]) return lines[idx].trim();
    return t('ex_sample_text');
  }

  function renderPreviewOverlay() {
    const textEl = $('#ex-sub-text'); const overlay = $('#ex-sub-overlay');
    if (!textEl || !overlay) return;
    const s = readStyleFromForm();
    textEl.style.fontFamily = s.font + ', sans-serif';
    textEl.style.fontSize = Math.max(10, s.size * 0.35) + 'px';
    textEl.style.color = s.baseColor;
    const o = s.outlineWidth || 2;
    textEl.style.textShadow = `-${o}px -${o}px 0 ${s.outlineColor},${o}px -${o}px 0 ${s.outlineColor},-${o}px ${o}px 0 ${s.outlineColor},${o}px ${o}px 0 ${s.outlineColor}`;
    textEl.style.fontWeight = (s.weight === 'bold' || s.weight === 'bold-italic') ? 'bold' : 'normal';
    textEl.style.fontStyle = (s.weight === 'italic' || s.weight === 'bold-italic') ? 'italic' : 'normal';
    textEl.style.textTransform = s.casing === 'upper' ? 'uppercase' : s.casing === 'lower' ? 'lowercase' : 'none';
    overlay.style.textAlign = s.alignment;
    overlay.style.bottom = (100 - s.positionPct) + '%';
    textEl.textContent = getPreviewText();
  }

  async function transcribe() {
    const clipPath = $('#ex-clip').value; const lang = $('#ex-lang').value;
    if (!clipPath) return;
    $('#ex-transcribe-btn').disabled = true;
    $('#ex-trans-status').innerHTML = ''; $('#ex-trans-status').append(icon('progress_activity'), ' ' + t('ex_transcribing_long'));
    const unsub = api.subtitle.onTranscriptionProgress(p => {
      if (p.stage === 'transcribing') { $('#ex-trans-status').innerHTML = ''; $('#ex-trans-status').append(icon('progress_activity'), ' ' + t('ex_transcribing') + ' ' + p.percent + '%'); }
      else if (p.stage === 'done') { $('#ex-trans-status').innerHTML = '<span class="ok">' + t('ex_trans_done') + '</span>'; }
    });
    const res = await api.subtitle.transcribe(clipPath, lang);
    unsub(); $('#ex-transcribe-btn').disabled = false;
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
    const res = await api.subtitle.saveText($('#ex-clip').value, $('#ex-transcript').value);
    toast(res.success ? t('ex_transcript_saved') : t('ex_save_failed'), res.success ? 'success' : 'error');
  }
  async function reloadTranscript() {
    const res = await api.subtitle.getText($('#ex-clip').value);
    $('#ex-transcript').value = res.success ? res.text : '';
    renderPreviewOverlay();
  }
  async function doExport() {
    const clipPath = $('#ex-clip').value; if (!clipPath) return;
    await saveTranscript();
    const overwrite = $('#ex-overwrite').checked;
    $('#ex-export-btn').disabled = true;
    $('#ex-export-prog').style.display = 'block';
    $('#ex-export-status').innerHTML = ''; $('#ex-export-status').append(icon('progress_activity'), ' ' + t('ex_exporting'));
    const unsub = api.subtitle.onExportProgress(p => {
      if (p.stage === 'exporting') { $('#ex-export-bar').style.width = p.percent + '%'; $('#ex-export-status').textContent = t('ex_exporting') + ' ' + p.percent.toFixed(0) + '%'; }
      else if (p.stage === 'done') { $('#ex-export-bar').style.width = '100%'; $('#ex-export-status').innerHTML = '<span class="ok">' + t('ex_export_done') + '</span>'; }
    });
    const res = await api.subtitle.export(clipPath, readStyleFromForm(), overwrite);
    unsub(); $('#ex-export-btn').disabled = false;
    if (res.success) toast(t('ex_exported') + ' ' + (res.outputName || ''), 'success');
    else { toast(res.error || t('ex_export_failed'), 'error'); $('#ex-export-status').innerHTML = '<span class="err">✗ ' + res.error + '</span>'; }
  }
  async function openExportFolder() { await api.subtitle.openExportFolder(); }
  async function refresh() { await loadClipList(); }
  return { build, refresh };
})();

/* ════════════════════════════════════ LICENSE ════════════════════════════════════ */
const licensePage = (() => {
  function build() {
    const root = $('#page-license'); root.innerHTML = '';
    root.append(
      el('div', { class: 'card' },
        el('h3', { class: 'card-title' }, icon('verified_user'), ' ' + t('lic_status_title')),
        el('div', { id: 'lic-info', class: 'status-line' }, t('lic_checking'))),
      el('div', { class: 'card' },
        el('h3', { class: 'card-title' }, icon('info'), ' ' + t('lic_about_title')),
        el('p', { class: 'muted' }, t('lic_about_desc')),
        el('p', { class: 'muted' }, t('lic_about_auth')),
        el('p', { class: 'muted' }, t('lic_version') + ' ' + (window.__version || '0.2.0')))
    );
  }
  async function refresh() {
    const host = $('#lic-info'); if (!host) return;
    const res = await api.license.check();
    if (res.success) host.innerHTML = '<span class="ok">' + t('lic_active') + ' ' + res.type.toUpperCase() + '</span><br><span class="muted">' + res.name + ' · ' + (res.note || '') + '</span>';
    else host.innerHTML = '<span class="err">' + t('lic_not_licensed') + '</span>';
  }
  return { build, refresh };
})();

/* ════════════════════════════════════ BOOT ════════════════════════════════════ */
async function boot() {
  initNav();
  // Build initial pages
  downloader.build(); studio.build(); await exportPage.build(); licensePage.build();
  // Settings
  const settings = await api.settings.get();
  $('#brand-version').textContent = 'v' + settings.version;
  window.__version = settings.version;
  $('#workspace-path').title = settings.paths.workspace;
  // Language selector in sidebar footer
  const foot = $('.sidebar-foot');
  if (!$('#lang-select')) {
    const langWrap = el('div', { class: 'foot-line' });
    langWrap.append(icon('translate', { size: '16px' }));
    foot.prepend(langWrap);
    langWrap.append(buildLangSelector());
  }
  rebuildTopbar(currentPage);
  downloader.refresh();
  licensePage.refresh();
}

document.addEventListener('DOMContentLoaded', boot);

})();
