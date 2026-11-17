// All sound is synthesized with WebAudio — no audio files, no network.
// The context only starts after the first user gesture (browser rule).
export function createAudio() {
  let ctx = null;
  let master = null;
  let engineOsc = null;
  let engineGain = null;
  let sirenOsc = null;
  let sirenGain = null;
  let sirenTimer = null;
  let started = false;
  let sirenOn = false;

  function ensure() {
    if (ctx) return true;
    try {
      const AC = window.AudioContext || window.webkitAudioContext;
      if (!AC) return false;
      ctx = new AC();
      master = ctx.createGain();
      master.gain.value = 0.35;
      master.connect(ctx.destination);
      started = true;
      return true;
    } catch {
      return false;
    }
  }

  function tone(freq, dur, type, vol, slideTo) {
    if (!ctx) return;
    const t = ctx.currentTime;
    const osc = ctx.createOscillator();
    const g = ctx.createGain();
    osc.type = type || 'sine';
    osc.frequency.setValueAtTime(freq, t);
    if (slideTo) osc.frequency.exponentialRampToValueAtTime(Math.max(20, slideTo), t + dur);
    g.gain.setValueAtTime(vol || 0.2, t);
    g.gain.exponentialRampToValueAtTime(0.001, t + dur);
    osc.connect(g);
    g.connect(master);
    osc.start(t);
    osc.stop(t + dur + 0.05);
  }

  function noise(dur, vol, lowFreq) {
    if (!ctx) return;
    const t = ctx.currentTime;
    const len = Math.max(1, Math.floor(ctx.sampleRate * dur));
    const buf = ctx.createBuffer(1, len, ctx.sampleRate);
    const data = buf.getChannelData(0);
    for (let i = 0; i < len; i += 1) data[i] = (Math.random() * 2 - 1) * (1 - i / len);
    const src = ctx.createBufferSource();
    src.buffer = buf;
    const filter = ctx.createBiquadFilter();
    filter.type = 'lowpass';
    filter.frequency.value = lowFreq || 800;
    const g = ctx.createGain();
    g.gain.value = vol || 0.25;
    src.connect(filter);
    filter.connect(g);
    g.connect(master);
    src.start(t);
  }

  return {
    get started() { return started; },
    get sirenOn() { return sirenOn; },
    // Call from any click / keydown. Returns true once the context exists.
    unlock() {
      const ok = ensure();
      if (ok && ctx.state === 'suspended') ctx.resume().catch(() => {});
      return ok;
    },
    click() { tone(660, 0.07, 'square', 0.12); },
    thud() { noise(0.18, 0.4, 300); tone(90, 0.16, 'sine', 0.35, 45); },
    horn() { tone(370, 0.35, 'square', 0.16); tone(466, 0.35, 'square', 0.12); },
    chime() {
      tone(523, 0.18, 'sine', 0.22);
      setTimeout(() => tone(659, 0.18, 'sine', 0.22), 140);
      setTimeout(() => tone(784, 0.35, 'sine', 0.25), 280);
    },
    busted() {
      tone(220, 0.3, 'sawtooth', 0.2, 110);
      setTimeout(() => tone(165, 0.5, 'sawtooth', 0.2, 82), 260);
    },
    crash() { noise(0.3, 0.45, 500); tone(70, 0.25, 'sine', 0.4, 35); },
    engine(on, speedNorm) {
      if (!ctx) return;
      if (on && !engineOsc) {
        engineOsc = ctx.createOscillator();
        engineGain = ctx.createGain();
        engineOsc.type = 'sawtooth';
        engineOsc.frequency.value = 60;
        engineGain.gain.value = 0.0;
        const filter = ctx.createBiquadFilter();
        filter.type = 'lowpass';
        filter.frequency.value = 500;
        engineOsc.connect(filter);
        filter.connect(engineGain);
        engineGain.connect(master);
        engineOsc.start();
      }
      if (!on && engineOsc) {
        try { engineOsc.stop(); } catch { /* already stopped */ }
        engineOsc = null;
        engineGain = null;
        return;
      }
      if (engineOsc) {
        engineOsc.frequency.value = 55 + (speedNorm || 0) * 140;
        engineGain.gain.value = 0.05 + (speedNorm || 0) * 0.06;
      }
    },
    siren(on) {
      if (!ctx) return;
      if (on && !sirenOsc) {
        sirenOsc = ctx.createOscillator();
        sirenGain = ctx.createGain();
        sirenOsc.type = 'triangle';
        sirenOsc.frequency.value = 700;
        sirenGain.gain.value = 0.05;
        sirenOsc.connect(sirenGain);
        sirenGain.connect(master);
        sirenOsc.start();
        let high = true;
        sirenTimer = setInterval(() => {
          if (!sirenOsc) return;
          high = !high;
          sirenOsc.frequency.value = high ? 950 : 650;
        }, 420);
        sirenOn = true;
      } else if (!on && sirenOsc) {
        clearInterval(sirenTimer);
        sirenTimer = null;
        try { sirenOsc.stop(); } catch { /* already stopped */ }
        sirenOsc = null;
        sirenGain = null;
        sirenOn = false;
      }
    },
  };
}
