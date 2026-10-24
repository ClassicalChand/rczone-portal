const DAY = 86400;
const enc = new TextEncoder();
const json = (data, status = 200, headers = {}) => new Response(JSON.stringify(data), {
  status, headers: { "content-type": "application/json; charset=utf-8", "cache-control": "no-store", ...headers }
});
async function digest(value) {
  const bytes = await crypto.subtle.digest("SHA-256", enc.encode(value));
  return [...new Uint8Array(bytes)].map(x => x.toString(16).padStart(2, "0")).join("");
}
async function passwordHash(password, salt) {
  const key = await crypto.subtle.importKey("raw", enc.encode(password), "PBKDF2", false, ["deriveBits"]);
  const bits = await crypto.subtle.deriveBits({ name: "PBKDF2", salt: enc.encode(salt), iterations: 210000, hash: "SHA-256" }, key, 256);
  return [...new Uint8Array(bits)].map(x => x.toString(16).padStart(2, "0")).join("");
}
function randomToken() {
  return [...crypto.getRandomValues(new Uint8Array(32))].map(x => x.toString(16).padStart(2, "0")).join("");
}
function cookieToken(request) {
  const cookies = request.headers.get("Cookie") || "";
  const item = cookies.split(";").map(x => x.trim()).find(x => x.startsWith("rczone_session="));
  return item ? item.slice("rczone_session=".length) : "";
}
async function readBody(request) { try { return await request.json(); } catch { return null; } }
const sessionCookie = token => `rczone_session=${token}; HttpOnly; Secure; SameSite=Lax; Path=/; Max-Age=${7 * DAY}`;
async function currentUser(request, env) {
  const token = cookieToken(request);
  if (!token) return null;
  return env.DB.prepare(
    "SELECT u.id,u.username,u.role,u.display_name,u.status FROM sessions s JOIN users u ON u.id=s.user_id WHERE s.token_hash=? AND s.expires_at>? AND u.status='active'"
  ).bind(await digest(token), Math.floor(Date.now() / 1000)).first();
}
function isValidUsername(v) { return typeof v === "string" && /^[a-zA-Z0-9._-]{4,40}$/.test(v); }

export default {
  async fetch(request, env) {
    const url = new URL(request.url);
    const path = url.pathname;
    try {
      if (path === "/api/health" && request.method === "GET") return json({ ok: true, app: "RCZONE" });

      // Create the first admin once. Set SETUP_KEY as a Worker secret before using.
      if (path === "/api/setup-admin" && request.method === "POST") {
        if (!env.SETUP_KEY || request.headers.get("X-Setup-Key") !== env.SETUP_KEY) return json({ error: "Setup not authorized" }, 403);
        if (await env.DB.prepare("SELECT id FROM users WHERE role='admin' LIMIT 1").first()) return json({ error: "Admin already exists" }, 409);
        const body = await readBody(request);
        if (!body || !isValidUsername(body.username) || typeof body.password !== "string" || body.password.length < 12 || typeof body.displayName !== "string" || !body.displayName.trim()) {
          return json({ error: "Use a 4–40 character username, display name, and password of at least 12 characters." }, 400);
        }
        const salt = randomToken();
        const stored = salt + ":" + await passwordHash(body.password, salt);
        await env.DB.prepare("INSERT INTO users(username,password_hash,role,display_name) VALUES(?,?,'admin',?)")
          .bind(body.username.toLowerCase(), stored, body.displayName.trim()).run();
        return json({ ok: true, message: "Admin created. Remove the SETUP_KEY secret now." }, 201);
      }

      if (path === "/api/login" && request.method === "POST") {
        const body = await readBody(request);
        if (!body || !isValidUsername(body.username) || typeof body.password !== "string") return json({ error: "Invalid username or password" }, 400);
        const user = await env.DB.prepare("SELECT * FROM users WHERE username=? AND status='active'").bind(body.username.toLowerCase()).first();
        if (!user) return json({ error: "Invalid username or password" }, 401);
        const parts = user.password_hash.split(":");
        if (parts.length !== 2 || await passwordHash(body.password, parts[0]) !== parts[1]) return json({ error: "Invalid username or password" }, 401);
        const token = randomToken();
        await env.DB.prepare("INSERT INTO sessions(token_hash,user_id,expires_at) VALUES(?,?,?)")
          .bind(await digest(token), user.id, Math.floor(Date.now() / 1000) + 7 * DAY).run();
        return json({ ok: true, user: { username: user.username, role: user.role, displayName: user.display_name } }, 200, { "set-cookie": sessionCookie(token) });
      }

      if (path === "/api/logout" && request.method === "POST") {
        const token = cookieToken(request);
        if (token) await env.DB.prepare("DELETE FROM sessions WHERE token_hash=?").bind(await digest(token)).run();
        return json({ ok: true }, 200, { "set-cookie": "rczone_session=; HttpOnly; Secure; SameSite=Lax; Path=/; Max-Age=0" });
      }

      if (path.startsWith("/api/")) {
        const user = await currentUser(request, env);
        if (!user) return json({ error: "Please sign in" }, 401);

        if (path === "/api/me" && request.method === "GET") return json({ user });

        if (path === "/api/retailers" && request.method === "GET") {
          if (user.role !== "admin") return json({ error: "Admin only" }, 403);
          const rows = await env.DB.prepare("SELECT id,username,display_name,status,created_at FROM users WHERE role='retailer' ORDER BY id DESC").all();
          return json({ retailers: rows.results || [] });
        }

        if (path === "/api/retailers" && request.method === "POST") {
          if (user.role !== "admin") return json({ error: "Admin only" }, 403);
          const body = await readBody(request);
          if (!body || !isValidUsername(body.username) || typeof body.password !== "string" || body.password.length < 12 || typeof body.displayName !== "string" || !body.displayName.trim()) {
            return json({ error: "Retailer username, display name, and password (12+ characters) are required." }, 400);
          }
          const salt = randomToken();
          try {
            await env.DB.prepare("INSERT INTO users(username,password_hash,role,display_name) VALUES(?,?,'retailer',?)")
              .bind(body.username.toLowerCase(), salt + ":" + await passwordHash(body.password, salt), body.displayName.trim()).run();
          } catch { return json({ error: "Username may already be in use." }, 409); }
          return json({ ok: true }, 201);
        }

        if (path === "/api/requests" && request.method === "GET") {
          const rows = user.role === "admin"
            ? await env.DB.prepare("SELECT r.id,r.service,r.note,r.status,r.created_at,u.username,u.display_name FROM service_requests r JOIN users u ON u.id=r.user_id ORDER BY r.id DESC").all()
            : await env.DB.prepare("SELECT id,service,note,status,created_at FROM service_requests WHERE user_id=? ORDER BY id DESC").bind(user.id).all();
          return json({ requests: rows.results || [] });
        }

        if (path === "/api/requests" && request.method === "POST") {
          const body = await readBody(request);
          const allowed = ["Aadhaar Services", "PAN Card", "Voter ID", "Ration Card", "PVC Printing", "Recharge & Bills", "AEPS / Banking", "Other Services"];
          if (!body || !allowed.includes(body.service) || (body.note && (typeof body.note !== "string" || body.note.length > 500))) return json({ error: "Choose a valid service and keep the note under 500 characters." }, 400);
          const result = await env.DB.prepare("INSERT INTO service_requests(user_id,service,note) VALUES(?,?,?)").bind(user.id, body.service, body.note || "").run();
          return json({ ok: true, id: result.meta.last_row_id }, 201);
        }

        return json({ error: "API route not found" }, 404);
      }

      return env.ASSETS.fetch(request);
    } catch (error) {
      return json({ error: "Server error. Check Worker logs." }, 500);
    }
  }
};
            
