// Sound, synthesized live with WebAudio: no audio files, nothing loads over the
// network. Engine hum, sirens, gunshots, pickups and a small music loop are all
// oscillators and filtered noise, started on the first user gesture (browsers
// refuse audio before one) and silenced with M.

export function createAudio() {
  let ctx = null;
  let master = null;
  let muted = false;
  let engineOsc = null;
  let engineGain = null;
  let sirenOsc = null;
  let sirenGain = null;
  let musicTimer = null;
  let musicStep = 0;

  /** Bass line and hats for the driving music, one bar looping. */
  const BASS = [55, 0, 55, 0, 65.4, 0, 49, 0, 55, 0, 55, 0, 73.4, 65.4, 58.3, 0];

  function ensure() {
    if (ctx) return true;
    try {
      const AudioContext = window.AudioContext || window.webkitAudioContext;
      ctx = new AudioContext();
      master = ctx.createGain();
      master.gain.value = 0.5;
      master.connect(ctx.destination);
      return true;
    } catch {
      return false;
    }
  }

  function now() {
    return ctx ? ctx.currentTime : 0;
  }

  function blip(freq, dur, type, volume, slideTo) {
    if (!ctx || muted) return;
    const osc = ctx.createOscillator();
    const gain = ctx.createGain();
    osc.type = type;
    osc.frequency.setValueAtTime(freq, now());
    if (slideTo) osc.frequency.exponentialRampToValueAtTime(slideTo, now() + dur);
    gain.gain.setValueAtTime(volume, now());
    gain.gain.exponentialRampToValueAtTime(0.001, now() + dur);
    osc.connect(gain);
    gain.connect(master);
    osc.start();
    osc.stop(now() + dur + 0.02);
  }

  function noiseBurst(dur, volume, cutoff) {
    if (!ctx || muted) return;
    const len = Math.max(1, Math.floor(ctx.sampleRate * dur));
    const buffer = ctx.createBuffer(1, len, ctx.sampleRate);
    const data = buffer.getChannelData(0);
    for (let i = 0; i < len; i += 1) data[i] = (Math.random() * 2 - 1) * (1 - i / len);
    const source = ctx.createBufferSource();
    source.buffer = buffer;
    const filter = ctx.createBiquadFilter();
    filter.type = 'lowpass';
    filter.frequency.value = cutoff;
    const gain = ctx.createGain();
    gain.gain.value = volume;
    source.connect(filter);
    filter.connect(gain);
    gain.connect(master);
    source.start();
  }

  function startEngine() {
    if (!ctx || engineOsc) return;
    engineOsc = ctx.createOscillator();
    engineOsc.type = 'sawtooth';
    engineOsc.frequency.value = 60;
    const filter = ctx.createBiquadFilter();
    filter.type = 'lowpass';
    filter.frequency.value = 320;
    engineGain = ctx.createGain();
    engineGain.gain.value = 0.0;
    engineOsc.connect(filter);
    filter.connect(engineGain);
    engineGain.connect(master);
    engineOsc.start();
  }

  function startSiren() {
    if (!ctx || sirenOsc) return;
    sirenOsc = ctx.createOscillator();
    sirenOsc.type = 'square';
    sirenOsc.frequency.value = 700;
    sirenGain = ctx.createGain();
    sirenGain.gain.value = 0.0;
    sirenOsc.connect(sirenGain);
    sirenGain.connect(master);
    sirenOsc.start();
  }

  let sirenHigh = false;
  let sirenClock = 0;

  function startMusic() {
    if (!ctx || musicTimer !== null) return;
    musicTimer = window.setInterval(() => {
      if (muted || !ctx) return;
      const note = BASS[musicStep % BASS.length];
      if (note > 0) blip(note, 0.22, 'triangle', 0.10);
      if (musicStep % 2 === 0) noiseBurst(0.03, 0.05, 6000);
      musicStep += 1;
    }, 240);
  }

  return {
    /** Call from the first gesture: builds the context and starts the loops. */
    unlock() {
      if (!ensure()) return;
      if (ctx.state === 'suspended') ctx.resume();
      startEngine();
      startSiren();
      startMusic();
    },
    toggleMute() {
      muted = !muted;
      if (master) master.gain.value = muted ? 0 : 0.5;
      return muted;
    },
    isMuted() {
      return muted;
    },
    /** Engine pitch and volume follow the car's speed (0 when on foot). */
    engine(speed, driving) {
      if (!ctx || !engineOsc || !engineGain) return;
      const target = driving ? 0.05 + Math.min(0.16, Math.abs(speed) / 560 * 0.16) : 0.0;
      engineGain.gain.setTargetAtTime(muted ? 0 : target, now(), 0.1);
      engineOsc.frequency.setTargetAtTime(55 + Math.abs(speed) * 0.22, now(), 0.08);
    },
    /** The two-tone siren while the player is wanted; silent otherwise. */
    siren(active, dt) {
      if (!ctx || !sirenOsc || !sirenGain) return;
      sirenClock += dt;
      if (sirenClock > 0.42) {
        sirenClock = 0;
        sirenHigh = !sirenHigh;
        sirenOsc.frequency.value = sirenHigh ? 950 : 700;
      }
      sirenGain.gain.setTargetAtTime(active && !muted ? 0.045 : 0, now(), 0.1);
    },
    gunshot() {
      noiseBurst(0.14, 0.5, 1800);
      blip(160, 0.1, 'square', 0.2, 60);
    },
    crash() {
      noiseBurst(0.25, 0.45, 900);
    },
    pickup() {
      blip(660, 0.09, 'sine', 0.22);
      window.setTimeout(() => blip(990, 0.12, 'sine', 0.22), 70);
    },
    missionDone() {
      [523, 659, 784, 1047].forEach((f, i) => window.setTimeout(() => blip(f, 0.22, 'triangle', 0.25), i * 110));
    },
    missionFail() {
      [392, 330, 262].forEach((f, i) => window.setTimeout(() => blip(f, 0.25, 'triangle', 0.22), i * 130));
    },
    wantedUp() {
      blip(440, 0.12, 'square', 0.18, 880);
    },
    arrest() {
      blip(220, 0.5, 'sawtooth', 0.2, 110);
    },
  };
}
