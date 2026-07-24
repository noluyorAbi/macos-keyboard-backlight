'use strict';

// kbdlight core: read/write the MacBook keyboard backlight through the private
// CoreBrightness `KeyboardBrightnessClient` API, driven entirely from JS via koffi.
//
// No native build step: koffi ships prebuilt for arm64 + x64, and we resolve the
// Objective-C selectors at runtime. Every exported function throws a descriptive
// Error on a non-macOS host or when no backlit keyboard is present.

const os = require('os');

const FRAMEWORK =
  '/System/Library/PrivateFrameworks/CoreBrightness.framework/CoreBrightness';
const LIBOBJC = '/usr/lib/libobjc.A.dylib';

let runtime = null;

function load() {
  if (runtime) return runtime;

  if (os.platform() !== 'darwin') {
    throw new Error('kbdlight only works on macOS (found: ' + os.platform() + ')');
  }

  let koffi;
  try {
    koffi = require('koffi');
  } catch (e) {
    throw new Error('kbdlight requires the "koffi" package: ' + e.message);
  }

  try {
    koffi.load(FRAMEWORK);
  } catch (e) {
    throw new Error('cannot load CoreBrightness framework: ' + e.message);
  }

  const objc = koffi.load(LIBOBJC);

  // The Objective-C dispatcher objc_msgSend is variadic at the C level; koffi
  // needs one concrete prototype per calling convention we use. Redeclaring the
  // same symbol with different signatures is allowed and returns distinct stubs.
  const getClass = objc.func('void* objc_getClass(const char*)');
  const sel = objc.func('void* sel_registerName(const char*)');
  const msg = {
    id_id: objc.func('void* objc_msgSend(void* self, void* op)'),
    u_id: objc.func('uint64 objc_msgSend(void* self, void* op)'),
    id_u: objc.func('void* objc_msgSend(void* self, void* op, uint64 a)'),
    f_u: objc.func('float objc_msgSend(void* self, void* op, uint64 a)'),
    b_u: objc.func('bool objc_msgSend(void* self, void* op, uint64 a)'),
    v_fu: objc.func('void objc_msgSend(void* self, void* op, float v, uint64 k)'),
    v_bu: objc.func('void objc_msgSend(void* self, void* op, bool v, uint64 k)'),
  };

  const cls = getClass('KeyboardBrightnessClient');
  if (!cls) {
    throw new Error('KeyboardBrightnessClient unavailable on this macOS version');
  }
  const client = msg.id_id(msg.id_id(cls, sel('alloc')), sel('init'));

  runtime = { sel, msg, client };
  return runtime;
}

// Returns the numeric IDs of every backlit built-in/attached keyboard.
function keyboardIDs() {
  const { sel, msg, client } = load();
  const ids = msg.id_id(client, sel('copyKeyboardBacklightIDs'));
  const count = Number(msg.u_id(ids, sel('count')));
  const out = [];
  for (let i = 0; i < count; i++) {
    const num = msg.id_u(ids, sel('objectAtIndex:'), BigInt(i));
    out.push(msg.u_id(num, sel('unsignedLongLongValue')));
  }
  return out;
}

function requireKeyboards() {
  const ids = keyboardIDs();
  if (!ids.length) throw new Error('no backlit keyboard found');
  return ids;
}

// Current brightness (0.0-1.0) of the first keyboard, or of `keyboardID` if given.
function get(keyboardID) {
  const { sel, msg, client } = load();
  const id = keyboardID != null ? BigInt(keyboardID) : requireKeyboards()[0];
  return msg.f_u(client, sel('brightnessForKeyboard:'), id);
}

// Set brightness (clamped to 0.0-1.0) on every keyboard, or on `keyboardID` only.
function set(level, keyboardID) {
  const { sel, msg, client } = load();
  let v = Number(level);
  if (Number.isNaN(v)) throw new Error('level must be a number 0.0-1.0');
  v = Math.max(0, Math.min(1, v));
  const ids = keyboardID != null ? [BigInt(keyboardID)] : requireKeyboards();
  for (const id of ids) msg.v_fu(client, sel('setBrightness:forKeyboard:'), v, id);
  return v;
}

// Whether the ambient-light auto-brightness is on for the first (or given) keyboard.
function isAuto(keyboardID) {
  const { sel, msg, client } = load();
  const id = keyboardID != null ? BigInt(keyboardID) : requireKeyboards()[0];
  return msg.b_u(client, sel('isAutoBrightnessEnabledForKeyboard:'), id);
}

// Enable/disable ambient auto-brightness on every keyboard, or on `keyboardID`.
function setAuto(enabled, keyboardID) {
  const { sel, msg, client } = load();
  const on = !!enabled;
  const ids = keyboardID != null ? [BigInt(keyboardID)] : requireKeyboards();
  for (const id of ids) msg.v_bu(client, sel('enableAutoBrightness:forKeyboard:'), on, id);
  return on;
}

module.exports = { keyboardIDs, get, set, isAuto, setAuto };
