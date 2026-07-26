import { randomUUID } from "node:crypto";

/**
 * The launch board's data shape.
 *
 * This file deliberately contains no content, only structure. The channel list
 * and the post copy are private working material and live in the store, never
 * in the repository, because a marketing plan read by the people it targets
 * stops being a plan. This repository is public, which makes that rule load
 * bearing rather than tidy.
 */

/** Where a channel sits between "not written yet" and "this is the live post". */
export const CHANNEL_STATUSES = ["todo", "ready", "scheduled", "posted", "skipped"];

/**
 * Which push a channel belongs to. Waves exist because posting the same thing
 * everywhere on one evening is a removal reason on Reddit and a ban reason on
 * Discord, so the plan has to carry its own spacing.
 */
export const WAVES = [1, 2, 3, 4];

export const EMPTY_STATE = {
  version: 1,
  updatedAt: "",
  channels: [],
  tasks: [],
  metrics: [],
};

const str = (v, max = 20000) => (typeof v === "string" ? v.slice(0, max) : "");
const num = (v) => (typeof v === "number" && Number.isFinite(v) ? v : 0);

/**
 * Everything arriving from the browser is rebuilt field by field rather than
 * trusted and stored. The panel is behind a password, so this is not a defence
 * against an attacker; it is a defence against a bad deploy writing a shape the
 * reader cannot parse, which would lose the board's contents.
 */
export function parseState(raw) {
  const o = raw ?? {};
  const channels = Array.isArray(o.channels) ? o.channels : [];
  const tasks = Array.isArray(o.tasks) ? o.tasks : [];
  const metrics = Array.isArray(o.metrics) ? o.metrics : [];

  return {
    version: 1,
    updatedAt: str(o.updatedAt, 40),
    channels: channels.slice(0, 500).map((c) => {
      const r = c ?? {};
      const wave = num(r.wave);
      const status = str(r.status, 20);
      return {
        id: str(r.id, 64) || randomUUID(),
        name: str(r.name, 200),
        group: str(r.group, 200),
        url: str(r.url, 2000),
        wave: WAVES.includes(wave) ? wave : 1,
        status: CHANNEL_STATUSES.includes(status) ? status : "todo",
        scheduledAt: str(r.scheduledAt, 40),
        postedUrl: str(r.postedUrl, 2000),
        rules: str(r.rules),
        title: str(r.title, 2000),
        body: str(r.body),
        notes: str(r.notes),
        result: str(r.result, 500),
      };
    }),
    tasks: tasks.slice(0, 500).map((t) => {
      const r = t ?? {};
      return {
        id: str(r.id, 64) || randomUUID(),
        text: str(r.text, 1000),
        done: r.done === true,
        due: str(r.due, 40),
      };
    }),
    metrics: metrics.slice(0, 2000).map((m) => {
      const r = m ?? {};
      return {
        id: str(r.id, 64) || randomUUID(),
        at: str(r.at, 40),
        stars: num(r.stars),
        visitors: num(r.visitors),
        signups: num(r.signups),
        note: str(r.note, 1000),
      };
    }),
  };
}
