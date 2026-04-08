const express = require("express");
const Database = require("better-sqlite3");
const session = require("express-session");
const cors = require("cors");
const path = require("path");

const app = express();
const PORT = process.env.PORT || 3000;

// ── Base de datos ────────────────────────────────────
const db = new Database(process.env.DB_PATH || "qr.db");
db.exec(`
  CREATE TABLE IF NOT EXISTS qr_codes (
    id         TEXT PRIMARY KEY,
    label      TEXT NOT NULL DEFAULT '',
    dest_url   TEXT NOT NULL,
    fg_color   TEXT NOT NULL DEFAULT '#000000',
    bg_color   TEXT NOT NULL DEFAULT '#ffffff',
    created_at TEXT NOT NULL DEFAULT (datetime('now'))
  )
`);

// ── Middlewares ──────────────────────────────────────
app.use(cors({ origin: process.env.ALLOWED_ORIGIN || "https://qr.iorana.dev", credentials: true }));
app.use(express.json());
app.use(session({
  secret: process.env.SESSION_SECRET || "changeme-use-env-var",
  resave: false,
  saveUninitialized: false,
  cookie: {
    httpOnly: true,
    secure: process.env.NODE_ENV === "production",
    maxAge: 8 * 60 * 60 * 1000, // 8 horas
  },
}));

// ── Rate limiting simple para login ─────────────────
const loginAttempts = new Map();
function rateLimitLogin(req, res, next) {
  const ip = req.ip;
  const now = Date.now();
  const entry = loginAttempts.get(ip) || { count: 0, first: now };
  if (now - entry.first > 15 * 60 * 1000) {
    loginAttempts.set(ip, { count: 1, first: now });
    return next();
  }
  if (entry.count >= 5) {
    return res.status(429).json({ error: "Demasiados intentos. Espera 15 minutos." });
  }
  entry.count++;
  loginAttempts.set(ip, entry);
  next();
}

// ── Middleware de autenticación ──────────────────────
function requireAuth(req, res, next) {
  if (req.session?.authenticated) return next();
  res.status(401).json({ error: "No autenticado" });
}

// ── Logging ──────────────────────────────────────────
app.use((req, _res, next) => {
  console.log(`${new Date().toISOString()}  ${req.method}  ${req.path}`);
  next();
});

// ── Rutas de autenticación ───────────────────────────
app.get("/api/me", (req, res) => {
  if (req.session?.authenticated) return res.json({ ok: true });
  res.status(401).json({ ok: false });
});

app.post("/api/login", rateLimitLogin, (req, res) => {
  const { username, password } = req.body;
  const validUser = process.env.ADMIN_USER || "admin";
  const validPass = process.env.ADMIN_PASS || "changeme";
  if (username === validUser && password === validPass) {
    req.session.authenticated = true;
    return res.json({ ok: true });
  }
  res.status(401).json({ error: "Credenciales incorrectas" });
});

app.post("/api/logout", (req, res) => {
  req.session.destroy();
  res.json({ ok: true });
});

// ── Redirección dinámica (pública) ───────────────────
app.get("/go/:id", (req, res) => {
  const row = db.prepare("SELECT dest_url FROM qr_codes WHERE id = ?").get(req.params.id);
  if (row) return res.redirect(302, row.dest_url);
  res.status(404).send("QR no encontrado");
});

// ── API REST (protegida) ─────────────────────────────
app.get("/api/qrs", requireAuth, (_req, res) => {
  res.json(db.prepare("SELECT * FROM qr_codes ORDER BY created_at DESC").all());
});

app.post("/api/qrs", requireAuth, (req, res) => {
  const { id, label, destUrl, fgColor, bgColor } = req.body;
  if (!id || !destUrl) return res.status(400).json({ error: "id y destUrl son obligatorios" });
  try {
    db.prepare("INSERT INTO qr_codes (id, label, dest_url, fg_color, bg_color) VALUES (?, ?, ?, ?, ?)")
      .run(id, label || "", destUrl, fgColor || "#000000", bgColor || "#ffffff");
    res.status(201).json({ ok: true, id });
  } catch (err) {
    if (err.message.includes("UNIQUE")) return res.status(409).json({ error: "ID duplicado" });
    res.status(500).json({ error: err.message });
  }
});

app.put("/api/qrs/:id", requireAuth, (req, res) => {
  const { destUrl, label, fgColor, bgColor } = req.body;
  if (!destUrl) return res.status(400).json({ error: "destUrl es obligatorio" });
  const result = db.prepare(
    "UPDATE qr_codes SET dest_url = ?, label = ?, fg_color = ?, bg_color = ? WHERE id = ?"
  ).run(destUrl, label || "", fgColor || "#000000", bgColor || "#ffffff", req.params.id);
  if (result.changes === 0) return res.status(404).json({ error: "QR no encontrado" });
  res.json({ ok: true });
});

app.delete("/api/qrs/:id", requireAuth, (req, res) => {
  const result = db.prepare("DELETE FROM qr_codes WHERE id = ?").run(req.params.id);
  if (result.changes === 0) return res.status(404).json({ error: "QR no encontrado" });
  res.json({ ok: true });
});

// ── Frontend estático ────────────────────────────────
app.use(express.static(path.join(__dirname, "public")));
app.get("*", (_req, res) => {
  res.sendFile(path.join(__dirname, "public", "index.html"));
});

app.listen(PORT, () => console.log(`Servidor en http://localhost:${PORT}`));
