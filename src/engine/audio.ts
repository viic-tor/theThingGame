class SoundEngine {
  private ctx: AudioContext | null = null;
  private muted = false;

  private ensureContext(): AudioContext | null {
    if (this.muted || typeof window === 'undefined') return null;
    if (!this.ctx) {
      const AudioCtx = window.AudioContext || (window as unknown as { webkitAudioContext?: typeof AudioContext }).webkitAudioContext;
      if (AudioCtx) {
        this.ctx = new AudioCtx();
      }
    }
    if (this.ctx && this.ctx.state === 'suspended') {
      void this.ctx.resume().catch(() => {});
    }
    return this.ctx;
  }

  setMuted(muted: boolean): void {
    this.muted = muted;
  }

  isMuted(): boolean {
    return this.muted;
  }

  private playTone(
    freqStart: number,
    freqEnd: number,
    durationSec: number,
    type: OscillatorType = 'sine',
    volume = 0.14,
    delaySec = 0
  ): void {
    const ctx = this.ensureContext();
    if (!ctx) return;

    const now = ctx.currentTime + delaySec;
    const osc = ctx.createOscillator();
    const gain = ctx.createGain();
    osc.type = type;
    osc.frequency.setValueAtTime(freqStart, now);
    if (freqEnd !== freqStart) {
      osc.frequency.exponentialRampToValueAtTime(Math.max(20, freqEnd), now + durationSec);
    }

    gain.gain.setValueAtTime(0.001, now);
    gain.gain.linearRampToValueAtTime(volume, now + 0.015);
    gain.gain.exponentialRampToValueAtTime(0.001, now + durationSec);

    osc.connect(gain);
    gain.connect(ctx.destination);
    osc.start(now);
    osc.stop(now + durationSec + 0.02);
  }

  playClick(): void {
    this.playTone(540, 680, 0.06, 'triangle', 0.07);
  }

  playTaskComplete(): void {
    this.playTone(523.25, 523.25, 0.12, 'triangle', 0.12, 0);
    this.playTone(659.25, 659.25, 0.12, 'triangle', 0.12, 0.1);
    this.playTone(783.99, 1046.5, 0.25, 'triangle', 0.14, 0.2);
  }

  playKill(): void {
    this.playTone(220, 55, 0.28, 'sawtooth', 0.2, 0);
    this.playTone(110, 38, 0.35, 'square', 0.14, 0.06);
  }

  playVent(): void {
    this.playTone(320, 140, 0.16, 'sine', 0.12, 0);
    this.playTone(150, 290, 0.12, 'triangle', 0.08, 0.12);
  }

  playEmergency(): void {
    this.playTone(620, 880, 0.22, 'sawtooth', 0.16, 0);
    this.playTone(620, 880, 0.22, 'sawtooth', 0.16, 0.28);
    this.playTone(520, 740, 0.35, 'sawtooth', 0.14, 0.56);
  }

  playReport(): void {
    this.playTone(440, 290, 0.22, 'sawtooth', 0.18, 0);
    this.playTone(587, 320, 0.35, 'sawtooth', 0.18, 0.2);
  }

  playSabotage(): void {
    this.playTone(440, 340, 0.25, 'sawtooth', 0.11, 0);
    this.playTone(340, 440, 0.25, 'sawtooth', 0.11, 0.26);
  }

  playVote(): void {
    this.playTone(480, 640, 0.08, 'sine', 0.1);
  }

  playVictory(): void {
    const notes = [523.25, 659.25, 783.99, 1046.5];
    notes.forEach((n, i) => {
      this.playTone(n, n, 0.28, 'triangle', 0.14, i * 0.13);
    });
  }

  playDefeat(): void {
    const notes = [392, 349.23, 311.13, 261.63];
    notes.forEach((n, i) => {
      this.playTone(n, n * 0.96, 0.34, 'sawtooth', 0.12, i * 0.16);
    });
  }
}

export const soundEngine = new SoundEngine();
