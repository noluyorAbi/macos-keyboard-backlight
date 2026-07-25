'use strict';

// Music sync: flash the keyboard backlight on the kick drum.
//
// WHAT IT DOES
//   Listens to an audio device, detects beats in the bass band, and drives the
//   backlight from a brightness envelope: snap to full on a beat, decay after,
//   with a dim floor that follows the overall loudness so quiet passages stay
//   lit and loud ones glow.
//
// WHERE THE AUDIO COMES FROM
//   macOS gives no process access to system output audio, so to react to what
//   is *playing* you need a loopback driver that presents the output as a
//   capture device. BlackHole is the usual one:
//
//       brew install blackhole-2ch
//
//   Then in Audio MIDI Setup create a Multi-Output Device containing both your
//   speakers and BlackHole, and select it as the system output. That way you
//   hear the music and this script sees it.
//
//   Without a loopback device it falls back to the default input, normally the
//   built-in microphone. That works for music playing out loud in the room; it
//   needs microphone permission for your terminal app.
//
// HOW IT WORKS
//   ffmpeg decodes the device to mono 32-bit float at 8 kHz, which is plenty
//   for a kick (roughly 40 to 120 Hz). The detection itself lives in
//   lib/beat-detect.js and is documented there.
//
//   The 16 ms render loop is deliberately decoupled from the audio callback:
//   detection only sets the envelope to full, the loop alone owns the writes.
//   Otherwise a beat arriving mid-ramp would fight the ramp for the keyboard.
//
// USAGE
//   node examples/music-sync.js                    auto-pick device, run until Ctrl-C
//   node examples/music-sync.js --list             list capture devices and exit
//   node examples/music-sync.js --device 2         pick by ffmpeg index
//   node examples/music-sync.js --device blackhole pick by name substring
//   node examples/music-sync.js --sensitivity 1.6  less trigger-happy
//   node examples/music-sync.js --seconds 30       stop by itself
//   node examples/music-sync.js --verbose          print beats and a live BPM

const { spawn, spawnSync } = require('child_process');
const { session, sleep, clamp, STEP_MS } = require('./lib/backlight');
const { BeatDetector } = require('./lib/beat-detect');

// --- args -----------------------------------------------------------------

function arg(name, fallback) {
  const i = process.argv.indexOf('--' + name);
  return i !== -1 && process.argv[i + 1] ? process.argv[i + 1] : fallback;
}
const has = (name) => process.argv.includes('--' + name);

const SAMPLE_RATE = 8000;
const SENSITIVITY = Number(arg('sensitivity', 1.4));
const REFRACTORY_MS = Number(arg('refractory', 140));
const SECONDS = Number(arg('seconds', 0)); // 0 means run until interrupted
const VERBOSE = has('verbose');

// --- audio devices --------------------------------------------------------

// Device names are localised by macOS, so matching on words like "microphone"
// is useless. Loopback drivers ship under stable product names instead.
const LOOPBACK = /blackhole|loopback|soundflower|vb-?cable|virtual audio/i;

// ffmpeg prints the device list to stderr and then exits with an error,
// because listing is not a real capture. That exit code is expected.
function listDevices() {
  const out = spawnSync(
    'ffmpeg',
    ['-hide_banner', '-f', 'avfoundation', '-list_devices', 'true', '-i', ''],
    { encoding: 'utf8' }
  );
  if (out.error) {
    throw new Error('ffmpeg not found. Install it with: brew install ffmpeg');
  }
  const lines = (out.stderr || '').split('\n');
  const start = lines.findIndex((l) => /AVFoundation audio devices/.test(l));
  if (start === -1) return [];
  const devices = [];
  for (const line of lines.slice(start + 1)) {
    const m = line.match(/\[(\d+)\]\s+(.*?)\s*$/);
    if (!m) break; // the audio block ends at the first non-device line
    devices.push({ index: Number(m[1]), name: m[2] });
  }
  return devices;
}

function pickDevice(devices, wanted) {
  if (wanted) {
    if (/^\d+$/.test(wanted)) {
      const hit = devices.find((d) => d.index === Number(wanted));
      if (!hit) throw new Error('no audio device with index ' + wanted);
      return hit;
    }
    const hit = devices.find((d) => d.name.toLowerCase().includes(wanted.toLowerCase()));
    if (!hit) throw new Error('no audio device matching "' + wanted + '"');
    return hit;
  }
  const loop = devices.find((d) => LOOPBACK.test(d.name));
  if (loop) return loop;
  if (!devices.length) throw new Error('no audio capture devices found');
  // Not devices[0]: index 0 is often a Continuity iPhone microphone, which is
  // not what anyone means by "just listen". avfoundation understands the
  // literal "default", which is whatever macOS has selected as the input.
  return { index: 'default', name: 'system default input' };
}

// --- main -----------------------------------------------------------------

const devices = listDevices();

if (has('list')) {
  if (!devices.length) console.log('no audio capture devices found');
  for (const d of devices) {
    console.log('  [' + d.index + '] ' + d.name + (LOOPBACK.test(d.name) ? '  (loopback)' : ''));
  }
  return;
}

const device = pickDevice(devices, arg('device', null));
const isLoopback = LOOPBACK.test(device.name);

console.log('listening on [' + device.index + '] ' + device.name);
if (!isLoopback) {
  console.log('no loopback device found, so this is hearing the room, not the');
  console.log('system output. Play the music out loud, or install BlackHole:');
  console.log('  brew install blackhole-2ch');
}
console.log('Ctrl-C to stop');

const kb = session();
let stopping = false; // set before we kill ffmpeg, so its death is not an error

const ffmpeg = spawn(
  'ffmpeg',
  [
    '-hide_banner',
    '-loglevel', 'error',
    '-f', 'avfoundation',
    '-i', ':' + device.index,
    '-ac', '1', // mono: a kick is not stereo information
    '-ar', String(SAMPLE_RATE),
    '-f', 'f32le',
    '-',
  ],
  { stdio: ['ignore', 'pipe', 'pipe'] }
);

let ffmpegErr = '';
ffmpeg.stderr.on('data', (b) => {
  ffmpegErr = (ffmpegErr + b.toString()).slice(-800);
});
ffmpeg.on('error', () => {
  console.error('ffmpeg not found. Install it with: brew install ffmpeg');
  kb.restore();
  process.exit(1);
});
ffmpeg.on('exit', (code) => {
  if (stopping || kb.stopped || code === 0) return;
  console.error('\nffmpeg exited with code ' + code);
  if (ffmpegErr.trim()) console.error(ffmpegErr.trim());
  if (!isLoopback) {
    console.error('If this is a permissions error, allow microphone access for');
    console.error('your terminal in System Settings > Privacy & Security.');
  }
  kb.restore();
  process.exit(1);
});

// --- detection ------------------------------------------------------------

let envelope = 0; // what the render loop writes
const beatTimes = [];

const detector = new BeatDetector({
  sampleRate: SAMPLE_RATE,
  sensitivity: SENSITIVITY,
  refractoryMs: REFRACTORY_MS,
  onBeat: ({ timeMs }) => {
    envelope = 1;
    if (!VERBOSE) return;
    beatTimes.push(timeMs);
    if (beatTimes.length > 8) beatTimes.shift();
    let bpm = '';
    if (beatTimes.length > 2) {
      const span = beatTimes[beatTimes.length - 1] - beatTimes[0];
      bpm = ' ~' + Math.round((60000 * (beatTimes.length - 1)) / span) + ' bpm';
    }
    process.stdout.write('beat' + bpm + '\n');
  },
});

ffmpeg.stdout.on('data', (chunk) => detector.push(chunk));

// --- render ---------------------------------------------------------------

// Exponential decay per frame, tuned so a flash is visibly gone after ~200 ms.
const DECAY = 0.8;

(async () => {
  const until = SECONDS ? Date.now() + SECONDS * 1000 : Infinity;
  try {
    while (!kb.stopped && Date.now() < until) {
      // The floor keeps the keyboard alive between beats and rides the overall
      // level, so a quiet intro is dim and a loud drop glows.
      const floor = clamp(0.03 + Math.sqrt(detector.loudness) * 1.5) * 0.35;
      envelope = Math.max(floor, envelope * DECAY);
      kb.write(envelope);
      await sleep(STEP_MS);
    }
  } finally {
    stopping = true;
    ffmpeg.kill('SIGKILL');
    kb.restore();
  }
})();
