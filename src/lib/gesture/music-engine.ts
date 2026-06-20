import * as Tone from "tone";

/* ------------------------------------------------------------------ */
/*  Types                                                              */
/* ------------------------------------------------------------------ */
export type LayerName = "strings" | "piano" | "bass" | "drums";

export type MusicState = {
  tempo: number;            // BPM
  intensity: number;        // 0..1
  activeLayers: LayerName[];
  currentChordIndex: number;
  currentChordName: string;
};

/* ------------------------------------------------------------------ */
/*  Harmony: C major scale + chord progressions                        */
/* ------------------------------------------------------------------ */
// Note: Tone.js uses note names. We build chords from scale degrees.
// C major scale notes
const SCALE_ROOT = "C4";
// chord progressions (root + quality), as scale-degree semitone offsets
// We define each chord as a root MIDI note + triad intervals.
type Chord = { name: string; root: number; type: "maj" | "min" };

const PROGRESSIONS: Chord[][] = [
  // C → Am → F → G
  [
    { name: "C",  root: 60, type: "maj" },
    { name: "Am", root: 57, type: "min" },
    { name: "F",  root: 65, type: "maj" },
    { name: "G",  root: 67, type: "maj" },
  ],
  // F → G → Am → C
  [
    { name: "F",  root: 65, type: "maj" },
    { name: "G",  root: 67, type: "maj" },
    { name: "Am", root: 57, type: "min" },
    { name: "C",  root: 60, type: "maj" },
  ],
];

function midiToNote(midi: number): string {
  const names = ["C", "C#", "D", "D#", "E", "F", "F#", "G", "G#", "A", "A#", "B"];
  const octave = Math.floor(midi / 12) - 1;
  return names[midi % 12] + octave;
}

function chordNotes(chord: Chord, octaveOffset = 0): string[] {
  const root = chord.root + octaveOffset * 12;
  const third = chord.type === "maj" ? root + 4 : root + 3;
  const fifth = root + 7;
  return [midiToNote(root), midiToNote(third), midiToNote(fifth)];
}

/* ------------------------------------------------------------------ */
/*  MusicEngine                                                        */
/* ------------------------------------------------------------------ */
export class MusicEngine {
  private progression: Chord[] = PROGRESSIONS[0];
  private chordIndex = 0;
  private barCount = 0;

  // instruments
  private strings!: Tone.PolySynth;
  private piano!: Tone.PolySynth;
  private bass!: Tone.MonoSynth;
  private kick!: Tone.MembraneSynth;
  private snare!: Tone.NoiseSynth;
  private hihat!: Tone.MetalSynth;

  // gain nodes (per layer)
  private stringsGain!: Tone.Gain;
  private pianoGain!: Tone.Gain;
  private bassGain!: Tone.Gain;
  private drumsGain!: Tone.Gain;
  private masterGain!: Tone.Gain;

  // reverb for cinematic space
  private reverb!: Tone.Reverb;

  // loop handles
  private chordLoop!: Tone.Loop;
  private drumLoop!: Tone.Loop;
  private bassLoop!: Tone.Loop;
  private pianoLoop!: Tone.Loop;

  private started = false;
  private layersEnabled: Record<LayerName, boolean> = {
    strings: true, piano: true, bass: true, drums: true,
  };
  private locked = false;

  // current state for external reads
  state: MusicState = {
    tempo: 90,
    intensity: 0.4,
    activeLayers: ["strings", "piano", "bass", "drums"],
    currentChordIndex: 0,
    currentChordName: "C",
  };

  /* -------------------------------------------------------------- */
  async init() {
    if (this.started) return;
    await Tone.start();

    // master chain
    this.masterGain = new Tone.Gain(0.8).toDestination();
    this.reverb = new Tone.Reverb({ decay: 4, wet: 0.35 }).connect(this.masterGain);

    // per-layer gains
    this.stringsGain = new Tone.Gain(0.5).connect(this.reverb);
    this.pianoGain = new Tone.Gain(0.6).connect(this.reverb);
    this.bassGain = new Tone.Gain(0.7).connect(this.masterGain);
    this.drumsGain = new Tone.Gain(0.7).connect(this.masterGain);

    // strings — warm pad
    this.strings = new Tone.PolySynth(Tone.Synth, {
      oscillator: { type: "sawtooth" },
      envelope: { attack: 0.8, decay: 0.3, sustain: 0.8, release: 2.5 },
      volume: -14,
    }).connect(this.stringsGain);

    // piano — triangle pluck
    this.piano = new Tone.PolySynth(Tone.Synth, {
      oscillator: { type: "triangle" },
      envelope: { attack: 0.005, decay: 0.4, sustain: 0.2, release: 1.2 },
      volume: -12,
    }).connect(this.pianoGain);

    // bass — mono synth
    this.bass = new Tone.MonoSynth({
      oscillator: { type: "sine" },
      envelope: { attack: 0.02, decay: 0.2, sustain: 0.6, release: 0.5 },
      filterEnvelope: { attack: 0.02, decay: 0.2, sustain: 0.5, release: 0.5, baseFrequency: 200, octaves: 2.5 },
      volume: -10,
    }).connect(this.bassGain);

    // drums
    this.kick = new Tone.MembraneSynth({
      pitchDecay: 0.05, octaves: 6, envelope: { attack: 0.001, decay: 0.4, sustain: 0 },
      volume: -6,
    }).connect(this.drumsGain);

    this.snare = new Tone.NoiseSynth({
      noise: { type: "white" },
      envelope: { attack: 0.001, decay: 0.2, sustain: 0 },
      volume: -12,
    }).connect(this.drumsGain);

    this.hihat = new Tone.MetalSynth({
      envelope: { attack: 0.001, decay: 0.1, release: 0.01 },
      harmonicity: 5.1, modulationIndex: 32, resonance: 4000, octaves: 1.5,
      volume: -22,
    }).connect(this.drumsGain);

    Tone.Transport.bpm.value = this.state.tempo;

    // ---- scheduling ----
    // Chord changes every 2 bars (a "phrase")
    this.chordLoop = new Tone.Loop((time) => {
      if (this.locked) return;
      const chord = this.progression[this.chordIndex];
      // strings: sustain the chord
      const notes = chordNotes(chord, 0);
      this.strings.triggerAttackRelease(notes, "2m", time);
      this.state.currentChordName = chord.name;
      this.state.currentChordIndex = this.chordIndex;
    }, "2m").start(0);

    // advance chord every 2 bars
    Tone.Transport.scheduleRepeat((time) => {
      if (this.locked) return;
      this.barCount++;
      if (this.barCount % 2 === 0) {
        this.chordIndex = (this.chordIndex + 1) % this.progression.length;
      }
    }, "1m");

    // Piano: rhythmic stabs on the chord
    this.pianoLoop = new Tone.Loop((time) => {
      if (!this.layersEnabled.piano) return;
      const chord = this.progression[this.chordIndex];
      const notes = chordNotes(chord, 0);
      // play a short stab every quarter
      const idx = Math.floor((Tone.Transport.position as any).split(":")[1]) % notes.length;
      this.piano.triggerAttackRelease(notes[idx], "8n", time, 0.5 + this.state.intensity * 0.4);
    }, "4n").start("8n");

    // Bass: root note on beat 1 and 3
    this.bassLoop = new Tone.Loop((time) => {
      if (!this.layersEnabled.bass) return;
      const chord = this.progression[this.chordIndex];
      const root = midiToNote(chord.root - 12); // one octave down
      this.bass.triggerAttackRelease(root, "4n", time);
    }, "2n").start(0);

    // Drums: kick on 1,3 ; snare on 2,4 ; hihat on 8ths
    let beat = 0;
    this.drumLoop = new Tone.Loop((time) => {
      if (!this.layersEnabled.drums) return;
      const b = beat % 4;
      if (b === 0 || b === 2) {
        this.kick.triggerAttackRelease("C1", "8n", time, 0.8 + this.state.intensity * 0.2);
      }
      if (b === 1 || b === 3) {
        this.snare.triggerAttackRelease("8n", time, 0.5 + this.state.intensity * 0.4);
      }
      // hihat every 8th
      this.hihat.triggerAttackRelease("C5", "32n", time, 0.3 + this.state.intensity * 0.4);
      beat++;
    }, "4n").start(0);

    this.started = true;
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

  /* -------------------------------------------------------------- */
  // tempo (60..180)
  setTempo(bpm: number) {
    const t = Math.max(60, Math.min(180, Math.round(bpm)));
    this.state.tempo = t;
    Tone.Transport.bpm.rampTo(t, 0.4);
  }

  // intensity 0..1 -> affects velocity + reverb wet
  setIntensity(v: number) {
    const i = Math.max(0, Math.min(1, v));
    this.state.intensity = i;
    // map intensity to master gain a touch + reverb wet
    this.reverb.wet.rampTo(0.25 + i * 0.3, 0.5);
  }

  // layer enable/disable
  setLayer(name: LayerName, enabled: boolean) {
    this.layersEnabled[name] = enabled;
    const gain = { strings: this.stringsGain, piano: this.pianoGain, bass: this.bassGain, drums: this.drumsGain }[name];
    gain.gain.rampTo(enabled ? 0.6 : 0, 0.2);
    this.state.activeLayers = (Object.keys(this.layersEnabled) as LayerName[]).filter((k) => this.layersEnabled[k]);
  }

  // mix: 0..1 left=strings, 0.5=piano, 1=choir/pads (we boost strings on left, piano center)
  setMix(mix: number) {
    // strings louder on the left (mix<0.5), piano louder center
    const stringsVol = 0.3 + (1 - Math.min(mix * 2, 1)) * 0.5;
    const pianoVol = 0.3 + (1 - Math.abs(mix - 0.5) * 2) * 0.5;
    this.stringsGain.gain.rampTo(this.layersEnabled.strings ? stringsVol : 0, 0.3);
    this.pianoGain.gain.rampTo(this.layersEnabled.piano ? pianoVol : 0, 0.3);
  }

  // lock/freeze the current chord progression
  setLocked(locked: boolean) {
    this.locked = locked;
  }

  // solo: only the named layer audible
  solo(name: LayerName | null) {
    (["strings", "piano", "bass", "drums"] as LayerName[]).forEach((l) => {
      const gain = { strings: this.stringsGain, piano: this.pianoGain, bass: this.bassGain, drums: this.drumsGain }[l];
      const audible = name === null ? this.layersEnabled[l] : (l === name);
      gain.gain.rampTo(audible ? 0.6 : 0, 0.2);
    });
  }

  dispose() {
    if (!this.started) return;
    this.stop();
    this.chordLoop.dispose();
    this.pianoLoop.dispose();
    this.bassLoop.dispose();
    this.drumLoop.dispose();
    this.strings.dispose();
    this.piano.dispose();
    this.bass.dispose();
    this.kick.dispose();
    this.snare.dispose();
    this.hihat.dispose();
    this.reverb.dispose();
    this.masterGain.dispose();
    this.started = false;
  }
}
