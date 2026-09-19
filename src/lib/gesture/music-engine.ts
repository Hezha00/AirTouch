import * as Tone from "tone";

/* ------------------------------------------------------------------ */
/*  Types                                                              */
/* ------------------------------------------------------------------ */
export type LayerName = "strings" | "piano" | "bass" | "drums" | "lead";

export type MusicState = {
  tempo: number;
  intensity: number;          // 0..1 discrete-ish
  activeLayers: LayerName[];
  currentChordIndex: number;
  currentChordName: string;
  scaleName: string;
  progressionName: string;
  melodyDegree: number;       // 0..6 scale degree
  melodyNote: string;
  dynamic: string;            // pp..ff
};

/* ------------------------------------------------------------------ */
/*  Scales (semitone offsets from root) + diatonic triad builder       */
/* ------------------------------------------------------------------ */
type Scale = { name: string; root: number; intervals: number[] };

export const SCALES: Scale[] = [
  { name: "C Major",       root: 60, intervals: [0, 2, 4, 5, 7, 9, 11] },
  { name: "A Minor",       root: 57, intervals: [0, 2, 3, 5, 7, 8, 10] },
  { name: "D Dorian",      root: 62, intervals: [0, 2, 3, 5, 7, 9, 10] },
  { name: "C Pentatonic",  root: 60, intervals: [0, 2, 4, 7, 9] },
];

function noteAtDegree(scale: Scale, degree: number, octaveShift = 0): number {
  const n = scale.intervals.length;
  const idx = ((degree % n) + n) % n;
  const oct = Math.floor(degree / n) + octaveShift;
  return scale.root + scale.intervals[idx] + oct * 12;
}

function midiToNote(midi: number): string {
  const names = ["C", "C#", "D", "D#", "E", "F", "F#", "G", "G#", "A", "A#", "B"];
  const octave = Math.floor(midi / 12) - 1;
  return names[midi % 12] + octave;
}

// diatonic triad on a scale degree (stack thirds within the scale)
function triad(scale: Scale, degree: number, octaveShift = 0): string[] {
  const n = scale.intervals.length;
  return [
    midiToNote(noteAtDegree(scale, degree, octaveShift)),
    midiToNote(noteAtDegree(scale, degree + 2, octaveShift)),
    midiToNote(noteAtDegree(scale, degree + 4, octaveShift)),
  ];
}

/* ------------------------------------------------------------------ */
/*  Progressions (scale-degree based, work in any scale)               */
/* ------------------------------------------------------------------ */
type Progression = { name: string; degrees: number[] };

export const PROGRESSIONS: Progression[] = [
  { name: "Pop",        degrees: [0, 4, 5, 3] },   // I – V – vi – IV
  { name: "Cinematic",  degrees: [0, 5, 3, 4] },   // I – vi – IV – V
  { name: "Dramatic",   degrees: [5, 3, 0, 4] },   // vi – IV – I – V
  { name: "Anthem",     degrees: [0, 3, 4, 0] },   // I – IV – V – I
];

const ROMAN = ["I", "II", "III", "IV", "V", "VI", "VII"];

/* ------------------------------------------------------------------ */
/*  MusicEngine                                                        */
/* ------------------------------------------------------------------ */
export class MusicEngine {
  private scale: Scale = SCALES[0];
  private progression: Progression = PROGRESSIONS[0];
  private chordIndex = 0;
  private barCount = 0;
  private octaveShift = 0;
  private swing = 0;
  private dynamicLevel = 3; // 0..5 (pp..ff)
  private readonly DYNAMICS = ["pp", "p", "mp", "mf", "f", "ff"];
  private readonly DYN_VEL  = [0.30, 0.45, 0.60, 0.75, 0.90, 1.00];

  // instruments
  private strings!: Tone.PolySynth;
  private piano!: Tone.PolySynth;
  private bass!: Tone.MonoSynth;
  private lead!: Tone.MonoSynth;
  private kick!: Tone.MembraneSynth;
  private snare!: Tone.NoiseSynth;
  private hihat!: Tone.MetalSynth;

  // gains
  private layerGains!: Record<LayerName, Tone.Gain>;
  private masterGain!: Tone.Gain;
  private reverb!: Tone.Reverb;
  private delay!: Tone.FeedbackDelay;

  // loops
  private chordLoop!: Tone.Loop;
  private pianoLoop!: Tone.Loop;
  private bassLoop!: Tone.Loop;
  private drumLoop!: Tone.Loop;
  private melodyLoop!: Tone.Loop;

  private started = false;
  private layersEnabled: Record<LayerName, boolean> = {
    strings: true, piano: true, bass: true, drums: true, lead: true,
  };
  private locked = false;
  private melodyEnabled = true;
  private melodyDegree = 0;

  state: MusicState = {
    tempo: 90,
    intensity: 0.5,
    activeLayers: ["strings", "piano", "bass", "drums", "lead"],
    currentChordIndex: 0,
    currentChordName: "I",
    scaleName: "C Major",
    progressionName: "Pop",
    melodyDegree: 0,
    melodyNote: "C4",
    dynamic: "mf",
  };

  /* -------------------------------------------------------------- */
  async init() {
    if (this.started) return;
    await Tone.start();

    this.masterGain = new Tone.Gain(0.8).toDestination();
    this.reverb = new Tone.Reverb({ decay: 5, wet: 0.3 }).connect(this.masterGain);
    this.delay = new Tone.FeedbackDelay({ delayTime: "8n", feedback: 0.25, wet: 0.15 }).connect(this.reverb);

    const makeGain = (v: number) => new Tone.Gain(v).connect(this.reverb);
    this.layerGains = {
      strings: makeGain(0.5),
      piano: makeGain(0.6),
      bass: new Tone.Gain(0.7).connect(this.masterGain),
      drums: new Tone.Gain(0.7).connect(this.masterGain),
      lead: makeGain(0.55),
    };

    this.strings = new Tone.PolySynth(Tone.Synth, {
      oscillator: { type: "sawtooth" },
      envelope: { attack: 0.8, decay: 0.3, sustain: 0.8, release: 2.5 },
      volume: -14,
    }).connect(this.layerGains.strings);

    this.piano = new Tone.PolySynth(Tone.Synth, {
      oscillator: { type: "triangle" },
      envelope: { attack: 0.005, decay: 0.4, sustain: 0.2, release: 1.2 },
      volume: -10,
    }).connect(this.layerGains.piano);

    this.bass = new Tone.MonoSynth({
      oscillator: { type: "sine" },
      envelope: { attack: 0.02, decay: 0.2, sustain: 0.6, release: 0.5 },
      filterEnvelope: { attack: 0.02, decay: 0.2, sustain: 0.5, release: 0.5, baseFrequency: 200, octaves: 2.5 },
      volume: -10,
    }).connect(this.layerGains.bass);

    this.lead = new Tone.MonoSynth({
      oscillator: { type: "square" },
      envelope: { attack: 0.01, decay: 0.2, sustain: 0.3, release: 0.6 },
      filterEnvelope: { attack: 0.01, decay: 0.2, sustain: 0.3, release: 0.4, baseFrequency: 800, octaves: 3 },
      volume: -12,
    }).connect(this.layerGains.lead);
    this.lead.connect(this.delay);

    this.kick = new Tone.MembraneSynth({
      pitchDecay: 0.05, octaves: 6, envelope: { attack: 0.001, decay: 0.4, sustain: 0 },
      volume: -6,
    }).connect(this.layerGains.drums);
    this.snare = new Tone.NoiseSynth({
      noise: { type: "white" },
      envelope: { attack: 0.001, decay: 0.2, sustain: 0 },
      volume: -12,
    }).connect(this.layerGains.drums);
    this.hihat = new Tone.MetalSynth({
      envelope: { attack: 0.001, decay: 0.1, release: 0.01 },
      harmonicity: 5.1, modulationIndex: 32, resonance: 4000, octaves: 1.5,
      volume: -22,
    }).connect(this.layerGains.drums);

    Tone.Transport.bpm.value = this.state.tempo;
    Tone.Transport.swing = this.swing;
    Tone.Transport.swingSubdivision = "16n";

    // chord changes every 2 bars
    this.chordLoop = new Tone.Loop((time) => {
      if (this.locked) return;
      const deg = this.progression.degrees[this.chordIndex];
      const notes = triad(this.scale, deg, this.octaveShift);
      if (this.layersEnabled.strings) {
        this.strings.triggerAttackRelease(notes, "2m", time, this.dynVel());
      }
      this.state.currentChordName = ROMAN[deg % 7] || "I";
      this.state.currentChordIndex = this.chordIndex;
    }, "2m").start(0);

    Tone.Transport.scheduleRepeat((time) => {
      if (this.locked) return;
      this.barCount++;
      if (this.barCount % 2 === 0) {
        this.chordIndex = (this.chordIndex + 1) % this.progression.degrees.length;
      }
    }, "1m");

    // piano stabs on the chord
    let pianoStep = 0;
    this.pianoLoop = new Tone.Loop((time) => {
      if (!this.layersEnabled.piano) return;
      const deg = this.progression.degrees[this.chordIndex];
      const notes = triad(this.scale, deg, this.octaveShift);
      const idx = pianoStep % notes.length;
      this.piano.triggerAttackRelease(notes[idx], "8n", time, this.dynVel());
      pianoStep++;
    }, "4n").start("8n");

    // bass on root
    this.bassLoop = new Tone.Loop((time) => {
      if (!this.layersEnabled.bass) return;
      const deg = this.progression.degrees[this.chordIndex];
      const root = midiToNote(noteAtDegree(this.scale, deg, this.octaveShift) - 12);
      this.bass.triggerAttackRelease(root, "4n", time, this.dynVel());
    }, "2n").start(0);

    // drums
    let beat = 0;
    this.drumLoop = new Tone.Loop((time) => {
      if (!this.layersEnabled.drums) return;
      const b = beat % 4;
      const v = this.dynVel();
      if (b === 0 || b === 2) this.kick.triggerAttackRelease("C1", "8n", time, 0.8 + v * 0.2);
      if (b === 1 || b === 3) this.snare.triggerAttackRelease("8n", time, 0.5 + v * 0.4);
      this.hihat.triggerAttackRelease("C5", "32n", time, 0.3 + v * 0.4);
      beat++;
    }, "4n").start(0);

    // melody: play the selected scale degree every 8th
    this.melodyLoop = new Tone.Loop((time) => {
      if (!this.layersEnabled.lead || !this.melodyEnabled) return;
      const n = noteAtDegree(this.scale, this.melodyDegree, this.octaveShift + 1);
      const note = midiToNote(n);
      this.lead.triggerAttackRelease(note, "8n", time, this.dynVel() * 0.9);
      this.state.melodyNote = note;
      this.state.melodyDegree = this.melodyDegree;
    }, "8n").start("4n");

    this.started = true;
  }

  /* -------------------------------------------------------------- */
  private dynVel(): number {
    return this.DYN_VEL[this.dynamicLevel];
  }

  /* -------------------------------------------------------------- */
  start() {
    if (!this.started) return;
    Tone.Transport.start();
  }
  stop() {
    if (!this.started) return;
    Tone.Transport.stop();
    this.strings.releaseAll();
    this.piano.releaseAll();
  }

  setTempo(bpm: number) {
    const t = Math.max(50, Math.min(200, Math.round(bpm)));
    this.state.tempo = t;
    Tone.Transport.bpm.rampTo(t, 0.5);
  }

  // discrete dynamic level 0..5
  setDynamicLevel(level: number) {
    this.dynamicLevel = Math.max(0, Math.min(5, Math.round(level)));
    this.state.dynamic = this.DYNAMICS[this.dynamicLevel];
    this.state.intensity = this.dynamicLevel / 5;
    // reverb wetness scales with dynamics
    this.reverb.wet.rampTo(0.2 + (this.dynamicLevel / 5) * 0.35, 0.6);
    // delay wet too
    this.delay.wet.rampTo(0.08 + (this.dynamicLevel / 5) * 0.18, 0.6);
  }

  setScale(idx: number) {
    const s = SCALES[Math.max(0, Math.min(SCALES.length - 1, idx))];
    this.scale = s;
    this.state.scaleName = s.name;
  }

  setProgression(idx: number) {
    const p = PROGRESSIONS[Math.max(0, Math.min(PROGRESSIONS.length - 1, idx))];
    this.progression = p;
    this.chordIndex = 0;
    this.state.progressionName = p.name;
  }

  setMelodyDegree(degree: number) {
    const n = this.scale.intervals.length;
    this.melodyDegree = Math.max(0, Math.min(n * 2 - 1, Math.round(degree)));
    this.state.melodyDegree = this.melodyDegree;
  }

  setMelodyEnabled(on: boolean) {
    this.melodyEnabled = on;
  }

  setLayer(name: LayerName, enabled: boolean) {
    this.layersEnabled[name] = enabled;
    this.layerGains[name].gain.rampTo(enabled ? this.layerGains[name].gain.value || 0.6 : 0, 0.2);
    // fix: re-set a sensible default if disabling
    if (enabled && this.layerGains[name].gain.value === 0) {
      this.layerGains[name].gain.rampTo(0.6, 0.2);
    }
    this.state.activeLayers = (Object.keys(this.layersEnabled) as LayerName[]).filter((k) => this.layersEnabled[k]);
  }

  setLayerVolume(name: LayerName, vol: number) {
    // vol 0..1
    this.layersEnabled[name] = vol > 0.01;
    this.layerGains[name].gain.rampTo(vol, 0.15);
    this.state.activeLayers = (Object.keys(this.layersEnabled) as LayerName[]).filter((k) => this.layersEnabled[k] && this.layerGains[k].gain.value > 0.01);
  }

  setReverb(amount: number) {
    this.reverb.wet.rampTo(Math.max(0, Math.min(1, amount)), 0.3);
  }

  setSwing(amount: number) {
    this.swing = Math.max(0, Math.min(1, amount));
    Tone.Transport.swing = this.swing;
  }

  setOctave(shift: number) {
    this.octaveShift = Math.max(-2, Math.min(2, Math.round(shift)));
  }

  setLocked(locked: boolean) {
    this.locked = locked;
  }

  // big build-up + drop
  triggerDrop() {
    if (!this.started) return;
    // ramp tempo up slightly + bring all layers in
    const targetTempo = Math.min(180, this.state.tempo + 20);
    Tone.Transport.bpm.rampTo(targetTempo, 2);
    (Object.keys(this.layersEnabled) as LayerName[]).forEach((l) => {
      this.layersEnabled[l] = true;
      this.layerGains[l].gain.rampTo(0.6, 1.5);
    });
    this.dynamicLevel = 5;
    this.setDynamicLevel(5);
    // a dramatic hit
    const deg = this.progression.degrees[this.chordIndex];
    const notes = triad(this.scale, deg, this.octaveShift);
    this.strings.triggerAttackRelease(notes, "2n", undefined, 1);
  }

  dispose() {
    if (!this.started) return;
    this.stop();
    this.chordLoop.dispose();
    this.pianoLoop.dispose();
    this.bassLoop.dispose();
    this.drumLoop.dispose();
    this.melodyLoop.dispose();
    this.strings.dispose();
    this.piano.dispose();
    this.bass.dispose();
    this.lead.dispose();
    this.kick.dispose();
    this.snare.dispose();
    this.hihat.dispose();
    this.reverb.dispose();
    this.delay.dispose();
    this.masterGain.dispose();
    this.started = false;
  }
}
