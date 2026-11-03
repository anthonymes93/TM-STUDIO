# TM-STUDIO

**A DAW from the future.** Electron + React UI, with a modular prototype Web Audio engine. This is a functional early-stage sequencer, not yet a JUCE-based production DAW.

## Run

```powershell
npm install
npm run desktop
```

## Features

- Futuristic channel rack, 16-step sequencer, piano roll, mixer and inspector
- Generated kick, snare, clap, hi-hat and synth playback with BPM control
- Per-track level, pan and mute
- Save/open `.tmstudio` projects
- Import audio clips (12 MB maximum in prototype)
- Space: start/stop; Ctrl+S: save

## Production architecture

Electron controls UI; dedicated native JUCE engine is planned for low-latency ASIO recording, plugin hosting, mixing and sample-clock scheduling. Live audio **must stay off Electron IPC**. No JUCE code or ASIO implementation is yet included.

Before commercial distribution, verify JUCE and VST3 licensing obligations. This repository contains no third-party samples or plugins.
