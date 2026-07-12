# Clipper

Offline desktop app for clipping videos into short clips with AI-generated subtitles.

Download → cut → transcribe → style subtitles → export. Built with Electron, yt-dlp, ffmpeg, and whisper.cpp.

## Screenshots

| Downloader | Studio | Export |
|---|---|---|
| Paste a URL, pick quality, download with live progress | Cut clips, queue batch jobs, aspect-ratio transforms | AI transcribe, style subs, burn into video |

## Prerequisites

- [Node.js](https://nodejs.org/) 18+ (tested on 24)
- npm 9+

## Setup

```bash
# 1. Install dependencies
npm install

# 2. Place binaries in bin/
#    Clipper shells out to three external tools. Put their executables here:
#
#      bin/yt-dlp.exe          — https://github.com/yt-dlp/yt-dlp/releases
#      bin/ffmpeg.exe           — https://www.gyan.dev/ffmpeg/builds/ (or ffmpeg.org)
#      bin/ffprobe.exe          — ships with ffmpeg
#      bin/whisper/             — https://github.com/ggerganov/whisper.cpp
#        whisper-cli.exe
#        whisper.dll, ggml*.dll, SDL2.dll
#        models/ggml-small.bin  (or another model)
#
#    The bin/ folder is gitignored because these total ~960MB.
```

### Expected `bin/` layout

```
bin/
├── yt-dlp.exe
├── ffmpeg.exe
├── ffprobe.exe
└── whisper/
    ├── whisper-cli.exe
    ├── whisper.dll
    ├── ggml.dll
    ├── ggml-base.dll
    ├── ggml-cpu.dll
    ├── SDL2.dll
    └── models/
        └── ggml-small.bin      ← set in src/main/settings.js (binaries.whisperModel)
```

You can override any binary path with the `CLIPPER_BIN` env var, and the workspace
folder with `CLIPPER_WORKSPACE` (defaults to `Documents/Clipper`).

## Run

```bash
npm start
```

The app opens to the **Downloader**. Workflow:

1. **Downloader** — paste a video URL (YouTube/IG/TikTok/FB), Analyze, pick quality, Download.
2. **Studio** — select a downloaded video, set start time + duration + aspect ratio, Add to queue, Process Batch.
3. **Export** — select a clip, AI Transcribe (whisper → SRT), edit transcript if needed, pick subtitle style, Export Video.
4. **License** — currently a stub (full access). Online Supabase auth is scaffolded but disabled.

Output lands in `Documents/Clipper/export/`.

## Project structure

```
src/
├── main/
│   ├── index.js           Electron app lifecycle, window, CSP
│   ├── settings.js        Paths, version, Supabase placeholder
│   ├── workspace.js       Ensures data folders, reads/writes user config
│   ├── ipc/               IPC handlers (library, download, clip, subtitle, auth)
│   ├── engines/           Wrappers around yt-dlp, ffmpeg, whisper
│   └── auth/              License stub — swap for Supabase here
├── preload/index.js       contextBridge → window.api
└── renderer/              UI (HTML/CSS/JS, no framework)
```

### Adding Supabase auth later

`src/main/auth/index.js` always returns "active pro". To enable online auth:
fill in `settings.supabase.{url,anonKey}`, set `enabled: true`, and replace that
one file with a real verifier. The IPC layer and engines are unchanged.

## Tech

- **Electron 34** — desktop shell, secure IPC via contextBridge
- **yt-dlp** — video download + metadata
- **ffmpeg / ffprobe** — clipping, aspect transforms, subtitle burn-in
- **whisper.cpp** (`ggml-small`) — offline speech-to-text

## License

MIT
