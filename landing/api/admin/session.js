import {
  COOKIE_NAME,
  SESSION_MAX_AGE_S,
  adminEnabled,
  clearFailures,
  clientKey,
  issueSession,
  passwordMatches,
  recordFailure,
  throttled,
} from "../_lib/auth.js";

/**
 * Log in and log out.
 *
 * A wrong password and a missing panel answer differently on purpose: 401 means
 * "there is a door here", 404 means "there is not". The 404 is what a
 * deployment without ADMIN_PASSWORD returns, so an install that never opted in
 * does not advertise an unlocked entrance.
 */
export default async function handler(request, response) {
  if (!adminEnabled()) {
    response.status(404).end();
    return;
  }

  if (request.method === "DELETE") {
    response.setHeader("Set-Cookie", `${COOKIE_NAME}=; HttpOnly; Path=/; Max-Age=0; SameSite=Lax`);
    response.status(204).end();
    return;
  }

  if (request.method !== "POST") {
    response.setHeader("Allow", "POST, DELETE");
    response.status(405).json({ error: "method not allowed" });
    return;
  }

  const key = clientKey(request);
  if (throttled(key)) {
    response.status(429).json({ error: "too many attempts, wait ten minutes" });
    return;
  }

  // Vercel parses a JSON body for us, but a local http server does not, so both
  // shapes are accepted rather than assuming the platform.
  let password = "";
  try {
    const body =
      typeof request.body === "string" ? JSON.parse(request.body) : (request.body ?? {});
    password = typeof body.password === "string" ? body.password : "";
  } catch {
    response.status(400).json({ error: "expected json" });
    return;
  }

  if (!passwordMatches(password)) {
    recordFailure(key);
    response.status(401).json({ error: "wrong password" });
    return;
  }

  const token = issueSession();
  if (token === null) {
    response.status(404).end();
    return;
  }

  clearFailures(key);
  // Secure would make the cookie unusable over plain http on localhost, so it
  // follows the deployment rather than being hard-coded on.
  const secure = process.env.VERCEL === "1" ? " Secure;" : "";
  response.setHeader(
    "Set-Cookie",
    `${COOKIE_NAME}=${token}; HttpOnly;${secure} Path=/; Max-Age=${SESSION_MAX_AGE_S}; SameSite=Lax`,
  );
  response.status(204).end();
}
