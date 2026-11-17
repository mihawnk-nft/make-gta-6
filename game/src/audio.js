// Sound and music, all synthesized in code with WebAudio: no audio files.
// A soft synthwave pad loop, a car-engine hum, and one-shot effects
// (click, horn, pickup, siren). Starts only after a user gesture.
export function createAudio() {
  let ctx = null;
  let master = null;
  let musicNodes = null;
  let muted = false;
  let engineOsc = null;
  let engineGain = null;

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

  function tone(freq, dur, type, vol, when = 0, slideTo = 0) {
    if (!ctx || muted) return;
    const osc = ctx.createOscillator();
    const gain = ctx.createGain();
    osc.type = type;
    osc.frequency.setValueAtTime(freq, ctx.currentTime + when);
    if (slideTo) osc.frequency.exponentialRampToValueAtTime(slideTo, ctx.currentTime + when + dur);
    gain.gain.setValueAtTime(0, ctx.currentTime + when);
    gain.gain.linearRampToValueAtTime(vol, ctx.currentTime + when + 0.02);
    gain.gain.exponentialRampToValueAtTime(0.001, ctx.currentTime + when + dur);
    osc.connect(gain);
    gain.connect(master);
    osc.start(ctx.currentTime + when);
    osc.stop(ctx.currentTime + when + dur + 0.05);
  }

  // Am–F–C–G pad: two detuned triangle waves per chord, slow attack.
  const CHORDS = [
    [220.0, 261.63, 329.63],
    [174.61, 220.0, 261.63],
    [261.63, 329.63, 392.0],
    [196.0, 246.94, 293.66],
  ];

  return {
    unlock() {
      if (!ensure()) return;
      if (ctx.state === 'suspended') void ctx.resume();
      this.startMusic();
    },
    startMusic() {
      if (!ctx || musicNodes || muted) return;
      const padGain = ctx.createGain();
      padGain.gain.value = 0.06;
      const filter = ctx.createBiquadFilter();
      filter.type = 'lowpass';
      filter.frequency.value = 900;
      padGain.connect(filter);
      filter.connect(master);
      let chordIndex = 0;
      let nextTime = ctx.currentTime + 0.1;
      const schedule = () => {
        if (!ctx) return;
        while (nextTime < ctx.currentTime + 2) {
          const chord = CHORDS[chordIndex % CHORDS.length];
          for (const freq of chord) {
            for (const detune of [-4, 4]) {
              const osc = ctx.createOscillator();
              osc.type = 'triangle';
              osc.frequency.value = freq;
              osc.detune.value = detune;
              const g = ctx.createGain();
              g.gain.setValueAtTime(0, nextTime);
              g.gain.linearRampToValueAtTime(0.5, nextTime + 1.2);
              g.gain.linearRampToValueAtTime(0, nextTime + 4);
              osc.connect(g);
              g.connect(padGain);
              osc.start(nextTime);
              osc.stop(nextTime + 4.1);
            }
          }
          chordIndex += 1;
          nextTime += 4;
        }
        musicNodes = setTimeout(schedule, 1000);
      };
      schedule();
    },
    click() { tone(660, 0.08, 'square', 0.12); },
    horn() { tone(370, 0.35, 'sawtooth', 0.18, 0, 340); tone(466, 0.35, 'sawtooth', 0.12); },
    pickup() { tone(523, 0.12, 'sine', 0.2); tone(784, 0.18, 'sine', 0.2, 0.1); },
    siren() { tone(700, 0.5, 'sine', 0.1, 0, 950); tone(950, 0.5, 'sine', 0.1, 0.5, 700); },
    setEngine(on, speed01) {
      if (!ctx || muted) return;
      if (on && !engineOsc) {
        engineOsc = ctx.createOscillator();
        engineOsc.type = 'sawtooth';
        engineGain = ctx.createGain();
        engineGain.gain.value = 0.03;
        const filter = ctx.createBiquadFilter();
        filter.type = 'lowpass';
        filter.frequency.value = 500;
        engineOsc.connect(filter);
        filter.connect(engineGain);
        engineGain.connect(master);
        engineOsc.start();
      }
      if (engineOsc) {
        engineOsc.frequency.value = 60 + speed01 * 140;
        engineGain.gain.value = on ? 0.02 + speed01 * 0.05 : 0;
      }
    },
    toggleMute() {
      muted = !muted;
      if (master) master.gain.value = muted ? 0 : 0.5;
      return muted;
    },
    get isMuted() { return muted; },
  };
}
