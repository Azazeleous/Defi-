/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

/**
 * GAIA / NEXUS — Harmonic Resonance Audio Synthesizer
 * Procedural client-side audio engine tuned to 432 Hz Pythagorean harmonic series
 * and coupled to 4D Hypergeometric levels, Hamiltonian phase & Coaxial crossings.
 */

export interface HarmonicAudioState {
  isMuted: boolean;
  activeLevel: number;
  masterVolume: number;
  frequencyHz: number;
}

export class HarmonicResonanceEngine {
  private static instance: HarmonicResonanceEngine;
  private ctx: AudioContext | null = null;
  private masterGain: GainNode | null = null;
  private droneOsc1: OscillatorNode | null = null;
  private droneOsc2: OscillatorNode | null = null;
  private droneGain: GainNode | null = null;
  private filterNode: BiquadFilterNode | null = null;

  private isMuted: boolean = true; // Safe default: muted until user engages
  private activeLevel: number = 1;
  private baseFrequencies: Record<number, number> = {
    1: 432.0,  // Tesseract (Fundamental Root A=432)
    2: 486.0,  // 24-Cell (Pythagorean Second 9:8)
    3: 540.0,  // 120-Cell (Major Third 5:4)
    4: 576.0,  // 600-Cell (Perfect Fourth 4:3)
    5: 648.0,  // Great 120-Cell (Perfect Fifth 3:2)
    6: 720.0,  // Grand Sephiroth Sphere (Octave Harmonic 5:3)
  };

  private listeners: Set<(state: HarmonicAudioState) => void> = new Set();

  public static getInstance(): HarmonicResonanceEngine {
    if (!HarmonicResonanceEngine.instance) {
      HarmonicResonanceEngine.instance = new HarmonicResonanceEngine();
    }
    return HarmonicResonanceEngine.instance;
  }

  private initAudio() {
    if (this.ctx) return;
    try {
      const AudioCtx = window.AudioContext || (window as unknown as { webkitAudioContext: typeof AudioContext }).webkitAudioContext;
      this.ctx = new AudioCtx();

      // Master output gain
      this.masterGain = this.ctx.createGain();
      this.masterGain.gain.setValueAtTime(this.isMuted ? 0.0 : 0.12, this.ctx.currentTime);

      // Lowpass resonant filter for celestial warmth
      this.filterNode = this.ctx.createBiquadFilter();
      this.filterNode.type = 'lowpass';
      this.filterNode.frequency.setValueAtTime(1200, this.ctx.currentTime);
      this.filterNode.Q.setValueAtTime(2.5, this.ctx.currentTime);

      // Drone sub-gain
      this.droneGain = this.ctx.createGain();
      this.droneGain.gain.setValueAtTime(0.08, this.ctx.currentTime);

      // Fundamental drone oscillator
      this.droneOsc1 = this.ctx.createOscillator();
      this.droneOsc1.type = 'sine';
      this.droneOsc1.frequency.setValueAtTime(this.baseFrequencies[this.activeLevel] * 0.5, this.ctx.currentTime);

      // Fifth overtone drone oscillator
      this.droneOsc2 = this.ctx.createOscillator();
      this.droneOsc2.type = 'triangle';
      this.droneOsc2.frequency.setValueAtTime(this.baseFrequencies[this.activeLevel] * 0.75, this.ctx.currentTime);

      this.droneOsc1.connect(this.droneGain);
      this.droneOsc2.connect(this.droneGain);
      this.droneGain.connect(this.filterNode);
      this.filterNode.connect(this.masterGain);
      this.masterGain.connect(this.ctx.destination);

      this.droneOsc1.start();
      this.droneOsc2.start();
    } catch {
      // AudioContext unavailable in environment
    }
  }

  public toggleMute(): boolean {
    this.initAudio();
    this.isMuted = !this.isMuted;
    if (this.ctx && this.masterGain) {
      if (this.ctx.state === 'suspended') {
        this.ctx.resume().catch(() => {});
      }
      const targetGain = this.isMuted ? 0.0 : 0.12;
      this.masterGain.gain.setTargetAtTime(targetGain, this.ctx.currentTime, 0.05);
    }
    this.notify();
    return this.isMuted;
  }

  public setLevel(level: number) {
    this.activeLevel = Math.max(1, Math.min(6, level));
    const targetFreq = this.baseFrequencies[this.activeLevel] || 432.0;

    if (this.ctx && this.droneOsc1 && this.droneOsc2) {
      const now = this.ctx.currentTime;
      this.droneOsc1.frequency.setTargetAtTime(targetFreq * 0.5, now, 0.15);
      this.droneOsc2.frequency.setTargetAtTime(targetFreq * 0.75, now, 0.15);
    }
    this.notify();
  }

  /**
   * Resonant crystalline chime when crossing 0.5 coaxial center
   */
  public playCoaxialChime() {
    if (this.isMuted) return;
    this.initAudio();
    if (!this.ctx || !this.masterGain) return;

    try {
      const now = this.ctx.currentTime;
      const osc = this.ctx.createOscillator();
      const gain = this.ctx.createGain();

      osc.type = 'sine';
      osc.frequency.setValueAtTime(864.0, now); // Octave overtone
      osc.frequency.exponentialRampToValueAtTime(432.0, now + 0.35);

      gain.gain.setValueAtTime(0.15, now);
      gain.gain.exponentialRampToValueAtTime(0.0001, now + 0.6);

      osc.connect(gain);
      gain.connect(this.masterGain);

      osc.start(now);
      osc.stop(now + 0.65);
    } catch {
      // Audio buffer safety
    }
  }

  /**
   * Chime swell for level shift
   */
  public playLevelShiftSound(level: number) {
    this.setLevel(level);
    if (this.isMuted) return;
    this.initAudio();
    if (!this.ctx || !this.masterGain) return;

    try {
      const now = this.ctx.currentTime;
      const osc = this.ctx.createOscillator();
      const gain = this.ctx.createGain();

      const freq = this.baseFrequencies[level] || 432.0;
      osc.type = 'sine';
      osc.frequency.setValueAtTime(freq, now);
      osc.frequency.exponentialRampToValueAtTime(freq * 1.5, now + 0.25);

      gain.gain.setValueAtTime(0.18, now);
      gain.gain.exponentialRampToValueAtTime(0.0001, now + 0.5);

      osc.connect(gain);
      gain.connect(this.masterGain);

      osc.start(now);
      osc.stop(now + 0.55);
    } catch {
      // Audio buffer safety
    }
  }

  /**
   * Rapid algorithmic arpeggio cascade when firing an instant cryptographic solve burst
   */
  public playSolveBurstSound() {
    if (this.isMuted) return;
    this.initAudio();
    if (!this.ctx || !this.masterGain) return;

    try {
      const now = this.ctx.currentTime;
      const notes = [432, 540, 648, 864, 1080];

      notes.forEach((freq, idx) => {
        if (!this.ctx || !this.masterGain) return;
        const osc = this.ctx.createOscillator();
        const gain = this.ctx.createGain();
        const noteStart = now + idx * 0.05;

        osc.type = 'triangle';
        osc.frequency.setValueAtTime(freq, noteStart);

        gain.gain.setValueAtTime(0.12, noteStart);
        gain.gain.exponentialRampToValueAtTime(0.0001, noteStart + 0.2);

        osc.connect(gain);
        gain.connect(this.masterGain);

        osc.start(noteStart);
        osc.stop(noteStart + 0.22);
      });
    } catch {
      // Audio buffer safety
    }
  }

  public getState(): HarmonicAudioState {
    return {
      isMuted: this.isMuted,
      activeLevel: this.activeLevel,
      masterVolume: 0.12,
      frequencyHz: this.baseFrequencies[this.activeLevel] || 432.0,
    };
  }

  public subscribe(cb: (state: HarmonicAudioState) => void): () => void {
    this.listeners.add(cb);
    cb(this.getState());
    return () => this.listeners.delete(cb);
  }

  private notify() {
    const state = this.getState();
    this.listeners.forEach((cb) => cb(state));
  }
}

export const globalHarmonicEngine = HarmonicResonanceEngine.getInstance();
