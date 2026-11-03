// Prototype audio engine: isolated interface allows replacement by a JUCE native service.
const DRUMS = ['kick', 'snare', 'hat', 'clap'];
export class StudioEngine {
  constructor() { this.ctx = null; this.master = null; this.noise = null; this.nextStep = 0; this.nextTime = 0; this.interval = null; this.playing = false; this.onStep = () => {}; this.getState = () => null; this.audioBuffers = new Map(); }
  async init() {
    if (!this.ctx) {
      this.ctx = new (window.AudioContext || window.webkitAudioContext)();
      this.master = this.ctx.createGain(); this.master.gain.value = 0.76;
      const limiter = this.ctx.createDynamicsCompressor(); limiter.threshold.value = -6; limiter.knee.value = 5; limiter.ratio.value = 8; limiter.attack.value = 0.003; limiter.release.value = 0.12;
      this.master.connect(limiter); limiter.connect(this.ctx.destination);
      const buffer = this.ctx.createBuffer(1, this.ctx.sampleRate, this.ctx.sampleRate);
      const data = buffer.getChannelData(0); for (let i = 0; i < data.length; i++) data[i] = Math.random() * 2 - 1;
      this.noise = buffer;
    }
    if (this.ctx.state === 'suspended') await this.ctx.resume();
  }
  channel(time, track) {
    const gain = this.ctx.createGain(); gain.gain.value = track?.muted ? 0 : (track?.volume ?? 0.8);
    const pan = this.ctx.createStereoPanner(); pan.pan.value = track?.pan ?? 0;
    gain.connect(pan); pan.connect(this.master);
    return gain;
  }
  synth(note, time, duration = 0.26, track = {}) {
    const osc = this.ctx.createOscillator(), sub = this.ctx.createOscillator(), env = this.ctx.createGain();
    const frequency = 440 * Math.pow(2, (note - 69) / 12);
    osc.type = 'sawtooth'; osc.frequency.setValueAtTime(frequency, time);
    sub.type = 'sine'; sub.frequency.setValueAtTime(frequency / 2, time);
    env.gain.setValueAtTime(0.0001, time); env.gain.exponentialRampToValueAtTime(0.28, time + 0.012);
    env.gain.exponentialRampToValueAtTime(0.12, time + 0.08); env.gain.exponentialRampToValueAtTime(0.0001, time + duration + 0.08);
    const output = this.channel(time, track); osc.connect(env); sub.connect(env); env.connect(output);
    osc.start(time); sub.start(time); osc.stop(time + duration + 0.1); sub.stop(time + duration + 0.1);
    osc.onended = () => { osc.disconnect(); sub.disconnect(); env.disconnect(); output.disconnect(); };
  }
  noiseHit(time, decay, filterFreq, track, loudness = 0.5) {
    const source = this.ctx.createBufferSource(); source.buffer = this.noise;
    const filter = this.ctx.createBiquadFilter(); filter.type = 'highpass'; filter.frequency.value = filterFreq;
    const env = this.ctx.createGain(); env.gain.setValueAtTime(loudness, time); env.gain.exponentialRampToValueAtTime(0.0001, time + decay);
    const output = this.channel(time, track); source.connect(filter); filter.connect(env); env.connect(output);
    source.start(time); source.stop(time + decay + 0.01);
    source.onended = () => { source.disconnect(); filter.disconnect(); env.disconnect(); output.disconnect(); };
  }
  drum(kind, time, track) {
    if (kind === 'kick') {
      const osc = this.ctx.createOscillator(), env = this.ctx.createGain(), output = this.channel(time, track);
      osc.type = 'sine'; osc.frequency.setValueAtTime(150, time); osc.frequency.exponentialRampToValueAtTime(43, time + 0.17);
      env.gain.setValueAtTime(0.85, time); env.gain.exponentialRampToValueAtTime(0.0001, time + 0.38);
      osc.connect(env); env.connect(output); osc.start(time); osc.stop(time + 0.4);
      osc.onended = () => { osc.disconnect(); env.disconnect(); output.disconnect(); };
    } else if (kind === 'snare') this.noiseHit(time, 0.16, 1000, track, 0.65);
    else if (kind === 'hat') this.noiseHit(time, 0.055, 6500, track, 0.29);
    else if (kind === 'clap') this.noiseHit(time, 0.12, 1550, track, 0.48);
  }
  async loadAudio(trackId, bytes) {
    await this.init();
    const cloned = bytes.slice(0);
    const buffer = await this.ctx.decodeAudioData(cloned);
    this.audioBuffers.set(trackId, buffer);
    return buffer.duration;
  }
  audioClip(track, time) {
    const buffer = this.audioBuffers.get(track.id); if (!buffer || track.muted) return;
    const source = this.ctx.createBufferSource(); source.buffer = buffer;
    const output = this.channel(time, track); source.connect(output); source.start(time);
    source.onended = () => { source.disconnect(); output.disconnect(); };
  }
  schedule(step, time, stepDuration) {
    const state = this.getState(); if (!state) return;
    for (const track of state.tracks) {
      if (track.muted) continue;
      if (DRUMS.includes(track.kind) && track.steps[step]) this.drum(track.kind, time, track);
      if (track.kind === 'synth') {
        for (const n of track.notes) if (n.step === step) this.synth(n.midi, time, Math.max(0.07, n.length * stepDuration * 0.9), track);
      }
      if (track.kind === 'audio' && step === 0) this.audioClip(track, time);
    }
  }
  tick() {
    if (!this.ctx) return;
    const state = this.getState(); if (!state) return;
    const stepDuration = 60 / state.bpm / 4;
    while (this.nextTime < this.ctx.currentTime + 0.10) {
      const step = this.nextStep; this.schedule(step, this.nextTime, stepDuration);
      const delay = Math.max(0, (this.nextTime - this.ctx.currentTime) * 1000);
      setTimeout(() => { if (this.playing) this.onStep(step); }, delay);
      this.nextTime += stepDuration; this.nextStep = (step + 1) % 16;
    }
  }
  async play() {
    await this.init(); if (this.playing) return;
    this.playing = true; this.nextStep = 0; this.nextTime = this.ctx.currentTime + 0.035;
    this.tick(); this.interval = setInterval(() => this.tick(), 25);
  }
  stop() { this.playing = false; if (this.interval) clearInterval(this.interval); this.interval = null; this.onStep(-1); }
  async preview(kind, midi = 60, track = {}) { await this.init(); if (DRUMS.includes(kind)) this.drum(kind, this.ctx.currentTime + 0.005, track); else this.synth(midi, this.ctx.currentTime + 0.005, 0.25, track); }
}
