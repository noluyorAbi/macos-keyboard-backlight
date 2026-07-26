import { promises as fs } from "node:fs";
import path from "node:path";
import { EMPTY_STATE, parseState } from "./model.js";

/**
 * Where the launch board lives.
 *
 * Two backends, chosen by whether a Blob token is present rather than by
 * NODE_ENV, so a local run against the real store is a matter of copying one
 * variable into .env and needs no code path of its own.
 *
 *  - Vercel Blob, `access: "private"`. A private blob is only readable with the
 *    store's token, so the board is not one guessed URL away from being public.
 *    This is the one that matters: the board holds unpublished post copy.
 *  - A file under `.data/`, for local work. `.data` is in landing/.gitignore.
 *
 * There is no third path. Without either, a write fails loudly instead of
 * pretending to have saved and losing an evening of writing.
 *
 * @vercel/blob is imported lazily. It is the only dependency this otherwise
 * dependency-free site has, and a local run without a token should not need it
 * installed at all.
 */

const BLOB_PATH = "launch/state.json";
const LOCAL_PATH = path.join(process.cwd(), ".data", "launch.json");

function blobConfigured() {
  const token = process.env.BLOB_READ_WRITE_TOKEN;
  return typeof token === "string" && token.length > 0;
}

/** Which backend a request will hit, so the panel can say so instead of guessing. */
export function backendName() {
  return blobConfigured() ? "blob" : "file";
}

export async function readState() {
  if (blobConfigured()) {
    const { get } = await import("@vercel/blob");
    // useCache: false because the panel writes and immediately re-reads. A CDN
    // hit here shows the previous version and reads as data loss.
    const found = await get(BLOB_PATH, { access: "private", useCache: false });
    if (!found || found.statusCode !== 200) return EMPTY_STATE;
    return parseState(JSON.parse(await new Response(found.stream).text()));
  }

  try {
    return parseState(JSON.parse(await fs.readFile(LOCAL_PATH, "utf8")));
  } catch (error) {
    // A missing file is an empty board, which is the correct first run. Any
    // other failure, including malformed JSON, must not be swallowed: it would
    // silently hand back an empty board that the next write then persists.
    if (error && error.code === "ENOENT") return EMPTY_STATE;
    throw error;
  }
}

export async function writeState(state) {
  const next = { ...state, version: 1, updatedAt: new Date().toISOString() };
  const body = JSON.stringify(next, null, 2);

  if (blobConfigured()) {
    const { put } = await import("@vercel/blob");
    await put(BLOB_PATH, body, {
      access: "private",
      addRandomSuffix: false,
      allowOverwrite: true,
      contentType: "application/json",
    });
    return next;
  }

  await fs.mkdir(path.dirname(LOCAL_PATH), { recursive: true });
  await fs.writeFile(LOCAL_PATH, body, "utf8");
  return next;
}
