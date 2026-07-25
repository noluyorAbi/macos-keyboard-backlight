'use strict';

// Kick-drum onset detection over a stream of mono 32-bit float samples.
//
// The whole method in one paragraph: low-pass the signal so only the bass band
// survives, reduce every short frame to an energy number, and call a frame a
// beat when its energy stands out against the average of the last second. Two
// guards keep it honest: an absolute noise floor, so silence never triggers,
// and a refractory window, so one kick does not fire three times while it
// decays.
//
// Time is derived from the sample count, not from the wall clock. That keeps
// the detector identical whether it is fed by a live capture or by a file read
// at whatever speed, which is what makes it testable.

const DEFAULTS = {
  sampleRate: 8000,
  frame: 128, // samples per analysis frame, 16 ms at 8 kHz
  cutoffHz: 120, // top of the kick band
  historyMs: 1000, // window the current frame is compared against
  sensitivity: 1.4, // how far above that average a frame must sit
  refractoryMs: 140, // minimum spacing between two beats
  noiseFloor: 1e-6, // below this it is silence, not a quiet beat
};

class BeatDetector {
  constructor(opts = {}) {
    const cfg = Object.assign({}, DEFAULTS, opts);
    Object.assign(this, cfg);

    this.onBeat = opts.onBeat || (() => {});
    // One-pole low-pass coefficient for the configured corner frequency.
    this.alpha = 1 - Math.exp((-2 * Math.PI * this.cutoffHz) / this.sampleRate);
    this.historyLen = Math.max(1, Math.round(this.historyMs / ((this.frame / this.sampleRate) * 1000)));

    this.lp = 0; // filter state
    this.leftover = Buffer.alloc(0); // partial float carried between chunks
    this.history = [];
    this.historySum = 0;
    this.samples = 0; // stream clock
    this.lastBeatMs = -Infinity;
    this.loudness = 0; // slow EMA of frame energy, used to drive a dim floor
    this.beats = 0;
  }

  get timeMs() {
    return (this.samples / this.sampleRate) * 1000;
  }

  // Feed raw f32le bytes. Any tail that is not a whole frame is kept for the
  // next call, so chunk boundaries never lose or duplicate samples.
  push(chunk) {
    const buf = this.leftover.length ? Buffer.concat([this.leftover, chunk]) : chunk;
    const frames = Math.floor(Math.floor(buf.length / 4) / this.frame);

    for (let f = 0; f < frames; f++) {
      let sum = 0;
      for (let i = 0; i < this.frame; i++) {
        const x = buf.readFloatLE((f * this.frame + i) * 4);
        this.lp += this.alpha * (x - this.lp);
        sum += this.lp * this.lp;
      }
      this.samples += this.frame;
      this._frame(sum / this.frame);
    }

    this.leftover = buf.subarray(frames * this.frame * 4);
  }

  _frame(energy) {
    const avg = this.history.length ? this.historySum / this.history.length : 0;
    const t = this.timeMs;

    if (
      this.history.length === this.historyLen && // wait for a full window
      energy > avg * this.sensitivity &&
      energy > this.noiseFloor &&
      t - this.lastBeatMs > this.refractoryMs
    ) {
      this.lastBeatMs = t;
      this.beats++;
      this.onBeat({ timeMs: t, energy, average: avg });
    }

    this.history.push(energy);
    this.historySum += energy;
    if (this.history.length > this.historyLen) this.historySum -= this.history.shift();
    this.loudness = this.loudness * 0.98 + energy * 0.02;
  }
}

module.exports = { BeatDetector, DEFAULTS };
