# Biosketch.Art Studio

A free, offline scientific illustration editor for scientists, by scientists. Desktop builds for Windows, macOS, and Linux — no account required, no subscriptions.

Download the latest release: [Releases page](../../releases/latest)

## Features

- Full scientific illustration canvas (shapes, text, membranes, 3D structures, molecules)
- Native **File / Edit / View / Help** menus with keyboard shortcuts (Ctrl+N / O / S / Shift+S, Zoom, Fullscreen, Grid, Rulers)
- `.biosketch` project files you own on your filesystem — Photoshop-style Save/Open
- Autosave + crash recovery (snapshots to local storage every 10 seconds)
- Export to PNG, JPG, SVG, PDF, PowerPoint
- Dozens of built-in scientific tools: Punnett squares, phylogenetic trees, plasmid viewer, DNA tools, chart studio, dilution calculator, and more
- Watermark toggle on exports ("Made with Biosketch.Art Studio")

## Download

Grab the latest installer from the **Releases** page:

- Windows: `.msi` or `-setup.exe`
- macOS: `.dmg` (Universal — Intel + Apple Silicon)
- Linux: `.AppImage` (portable) or `.deb`

**First-launch note:** Installers are unsigned. Windows may show "SmartScreen protected your PC" — click "More info" → "Run anyway". macOS may show "cannot verify developer" — right-click the app → Open → Open.

## Caveats

- Browsing new icons in the icon library needs internet (saved projects embed their icons and open offline fine)
- Account-gated features from the web version (community sharing, AI generators, project collaboration) are intentionally omitted

## Build from source

```bash
# Prerequisites: Node 20+, Rust (via rustup), platform webview libs
npm install
npm run tauri:dev     # dev with hot reload
npm run tauri:build   # produce installer
```

Linux build deps (Ubuntu/Debian):

```bash
sudo apt install libwebkit2gtk-4.1-dev libjavascriptcoregtk-4.1-dev \
                 libayatana-appindicator3-dev librsvg2-dev libxdo-dev
```

## License

MIT. See `LICENSE`.

Built on [Tauri 2](https://tauri.app).
