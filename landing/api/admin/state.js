import { COOKIE_NAME, adminEnabled, readCookie, sessionValid } from "../_lib/auth.js";
import { parseState } from "../_lib/model.js";
import { backendName, readState, writeState } from "../_lib/store.js";

/** One guard for both verbs, so a new verb cannot be added without one. */
function denied(request, response) {
  if (!adminEnabled()) {
    response.status(404).end();
    return true;
  }
  if (!sessionValid(readCookie(request, COOKIE_NAME))) {
    response.status(401).json({ error: "no session" });
    return true;
  }
  return false;
}

export default async function handler(request, response) {
  if (denied(request, response)) return;

  if (request.method === "GET") {
    response.status(200).json({ state: await readState(), backend: backendName() });
    return;
  }

  if (request.method === "PUT") {
    let body;
    try {
      body = typeof request.body === "string" ? JSON.parse(request.body) : (request.body ?? {});
    } catch {
      response.status(400).json({ error: "expected json" });
      return;
    }

    // The client's updatedAt is discarded by writeState, which stamps its own.
    // A board saved from two tabs is last-write-wins; the alternative is a merge
    // protocol nobody needs for a single-operator board.
    const saved = await writeState(parseState(body));
    response.status(200).json({ state: saved, backend: backendName() });
    return;
  }

  response.setHeader("Allow", "GET, PUT");
  response.status(405).json({ error: "method not allowed" });
}
