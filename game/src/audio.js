// WebAudio synth sound for Neon Bay v2: every sound is synthesized with
// oscillators and filtered noise — no audio files, no network. The context
// is created lazily on the first user gesture (browsers block audio before
// one), M toggles mute, and the engine hum follows the player's speed.
export function createAudio() {
  let ctx = null;
  let master = null;
  let engineOsc = null;
  let engineGain = null;
  let sirenOsc = null;
  let sirenGain = null;
  let sirenTimer = 0;
  let muted = false;

  function ensure() {
    if (ctx) {
      if (ctx.state === 'suspended') ctx.resume();
      return true;
    }
    try {
      const AC = window.AudioContext || window.webkitAudioContext;
      if (!AC) return false;
      ctx = new AC();
      master = ctx.createGain();
      master.gain.value = 0.5;
      master.connect(ctx.destination);
      engineOsc = ctx.createOscillator();
      engineOsc.type = 'sawtooth';
      engineOsc.frequency.value = 55;
      engineGain = ctx.createGain();
      engineGain.gain.value = 0;
      const engineFilter = ctx.createBiquadFilter();
      engineFilter.type = 'lowpass';
      engineFilter.frequency.value = 320;
      engineOsc.connect(engineFilter);
      engineFilter.connect(engineGain);
      engineGain.connect(master);
      engineOsc.start();
      sirenOsc = ctx.createOscillator();
      sirenOsc.type = 'triangle';
      sirenOsc.frequency.value = 720;
      sirenGain = ctx.createGain();
      sirenGain.gain.value = 0;
      sirenOsc.connect(sirenGain);
      sirenGain.connect(master);
      sirenOsc.start();
      return true;
    } catch {
      return false;
    }
  }

  function blip(freq, dur, type, vol, slideTo) {
    if (!ctx || muted) return;
    const t = ctx.currentTime;
    const osc = ctx.createOscillator();
    osc.type = type || 'sine';
    osc.frequency.setValueAtTime(freq, t);
    if (slideTo) osc.frequency.exponentialRampToValueAtTime(slideTo, t + dur);
    const g = ctx.createGain();
    g.gain.setValueAtTime(vol, t);
    g.gain.exponentialRampToValueAtTime(0.001, t + dur);
    osc.connect(g);
    g.connect(master);
    osc.start(t);
    osc.stop(t + dur + 0.02);
  }

  function noise(dur, vol, filterFreq) {
    if (!ctx || muted) return;
    const t = ctx.currentTime;
    const len = Math.max(1, Math.floor(ctx.sampleRate * dur));
    const buffer = ctx.createBuffer(1, len, ctx.sampleRate);
    const data = buffer.getChannelData(0);
    for (let i = 0; i < len; i += 1) data[i] = (Math.random() * 2 - 1) * (1 - i / len);
    const src = ctx.createBufferSource();
    src.buffer = buffer;
    const filter = ctx.createBiquadFilter();
    filter.type = 'lowpass';
    filter.frequency.value = filterFreq || 1800;
    const g = ctx.createGain();
    g.gain.setValueAtTime(vol, t);
    g.gain.exponentialRampToValueAtTime(0.001, t + dur);
    src.connect(filter);
    filter.connect(g);
    g.connect(master);
    src.start(t);
  }

  return {
    get muted() { return muted; },
    ensure,
    setMuted(m) {
      muted = !!m;
      if (master) master.gain.value = muted ? 0 : 0.5;
    },
    toggleMute() { this.setMuted(!muted); return muted; },
    /** Engine hum: speed 0..900, silent on foot. */
    setEngine(speed, inCar) {
      if (!ctx || muted) return;
      const target = inCar ? 0.05 + Math.min(0.16, Math.abs(speed) / 5200) : 0;
      engineGain.gain.setTargetAtTime(target, ctx.currentTime, 0.08);
      engineOsc.frequency.setTargetAtTime(52 + Math.abs(speed) * 0.16, ctx.currentTime, 0.08);
    },
    setSiren(on, dt) {
      if (!ctx) return;
      sirenTimer += dt || 0;
      if (on && !muted) {
        sirenGain.gain.setTargetAtTime(0.045, ctx.currentTime, 0.1);
        sirenOsc.frequency.setTargetAtTime(660 + Math.sin(sirenTimer * 3.2) * 220, ctx.currentTime, 0.05);
      } else {
        sirenGain.gain.setTargetAtTime(0, ctx.currentTime, 0.1);
      }
    },
    shot() { noise(0.14, 0.5, 2400); blip(190, 0.09, 'square', 0.22, 60); },
    punch() { noise(0.08, 0.35, 700); blip(120, 0.07, 'sine', 0.25, 70); },
    pickup() { blip(660, 0.1, 'sine', 0.25); setTimeout(() => blip(990, 0.14, 'sine', 0.25), 90); },
    cash() { blip(880, 0.09, 'triangle', 0.25); setTimeout(() => blip(1174, 0.12, 'triangle', 0.25), 80); },
    jingle() {
      [523, 659, 784, 1046].forEach((f, i) => setTimeout(() => blip(f, 0.22, 'triangle', 0.28), i * 130));
    },
    fail() { blip(320, 0.3, 'sawtooth', 0.2, 140); },
    sirenBlip() { blip(880, 0.18, 'triangle', 0.2, 660); },
    click() { blip(440, 0.05, 'square', 0.12); },
  };
}
