'use strict';

// The mute window used to live here. It now ships with the package, because
// `kbdlight pulse` needs the same state and two implementations of "is the
// notifier muted right now" would eventually disagree.
//
// Kept as a re-export so the examples keep their local import path.

const p = require('../../src/pulse.js');

module.exports = {
  MUTE_FILE: p.MUTE_FILE,
  parseUntil: p.parseUntil,
  muteUntil: p.muteUntil,
  unmute: p.unmute,
  mutedUntil: p.mutedUntil,
  isMuted: p.isMuted,
};
