const express = require("express");
const session = require("express-session");
const cors = require("cors");
const path = require("path");
const { createClient } = require("@supabase/supabase-js");

const app = express();
const PORT = process.env.PORT || 3000;

// ── Supabase ─────────────────────────────────────────
const supabase = createClient(
  process.env.SUPABASE_URL,
  process.env.SUPABASE_SERVICE_KEY  // service_role key, NO la anon
);

// ── Middlewares ──────────────────────────────────────
// CRÍTICO: necesario para que las cookies funcionen detrás de Coolify/Nginx
app.set("trust proxy", 1);

app.use(cors({
  origin: process.env.ALLOWED_ORIGIN || "https://qr.iorana.dev",
  credentials: true,
}));
app.use(express.json());
app.use(session({
  secret: process.env.SESSION_SECRET || "changeme-set-in-env",
  resave: false,
  saveUninitialized: false,
  cookie: {
    httpOnly: true,
    secure: process.env.NODE_ENV === "production",
    sameSite: "lax",
    maxAge: 8 * 60 * 60 * 1000, // 8 horas
  },
}));

// ── Rate limiting simple ─────────────────────────────
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

// ── Auth routes ──────────────────────────────────────
app.get("/api/me", (req, res) => {
  if (req.session?.authenticated) return res.json({ ok: true });
  res.status(401).json({ ok: false });
});

app.post("/api/login", rateLimitLogin, (req, res) => {
  const { username, password } = req.body;
  const validUser = process.env.ADMIN_USER || "admin";
  const validPass = process.env.ADMIN_PASS || "changeme";

  console.log(`Login attempt: user="${username}" match=${username === validUser && password === validPass}`);

  if (username === validUser && password === validPass) {
    req.session.authenticated = true;
    req.session.save(err => {
      if (err) {
        console.error("Session save error:", err);
        return res.status(500).json({ error: "Error al guardar sesión" });
      }
      res.json({ ok: true });
    });
  } else {
    res.status(401).json({ error: "Credenciales incorrectas" });
  }
});

app.post("/api/logout", (req, res) => {
  req.session.destroy();
  res.json({ ok: true });
});

// ── Redirección dinámica (pública) ───────────────────
app.get("/go/:id", async (req, res) => {
  const { data, error } = await supabase
    .from("qr_codes")
    .select("dest_url")
    .eq("id", req.params.id)
    .single();

  if (error || !data) return res.status(404).send("QR no encontrado");
  res.redirect(302, data.dest_url);
});

// ── API REST (protegida) ─────────────────────────────

// GET /api/qrs
app.get("/api/qrs", requireAuth, async (_req, res) => {
  const { data, error } = await supabase
    .from("qr_codes")
    .select("*")
    .order("created_at", { ascending: false });

  if (error) return res.status(500).json({ error: error.message });
  res.json(data);
});

// POST /api/qrs
app.post("/api/qrs", requireAuth, async (req, res) => {
  const { id, label, destUrl, fgColor, bgColor } = req.body;
  if (!id || !destUrl) return res.status(400).json({ error: "id y destUrl son obligatorios" });

  const { error } = await supabase.from("qr_codes").insert({
    id,
    label: label || "",
    dest_url: destUrl,
    fg_color: fgColor || "#000000",
    bg_color: bgColor || "#ffffff",
  });

  if (error) {
    if (error.code === "23505") return res.status(409).json({ error: "ID duplicado" });
    return res.status(500).json({ error: error.message });
  }
  res.status(201).json({ ok: true, id });
});

// PUT /api/qrs/:id
app.put("/api/qrs/:id", requireAuth, async (req, res) => {
  const { destUrl, label, fgColor, bgColor } = req.body;
  if (!destUrl) return res.status(400).json({ error: "destUrl es obligatorio" });

  const { error, count } = await supabase
    .from("qr_codes")
    .update({
      dest_url: destUrl,
      label: label || "",
      fg_color: fgColor || "#000000",
      bg_color: bgColor || "#ffffff",
    })
    .eq("id", req.params.id);

  if (error) return res.status(500).json({ error: error.message });
  if (count === 0) return res.status(404).json({ error: "QR no encontrado" });
  res.json({ ok: true });
});

// DELETE /api/qrs/:id
app.delete("/api/qrs/:id", requireAuth, async (req, res) => {
  const { error } = await supabase
    .from("qr_codes")
    .delete()
    .eq("id", req.params.id);

  if (error) return res.status(500).json({ error: error.message });
  res.json({ ok: true });
});

// ── Frontend estático ────────────────────────────────
app.use(express.static(path.join(__dirname, "public")));
app.get("*", (_req, res) => {
  res.sendFile(path.join(__dirname, "public", "index.html"));
});

app.listen(PORT, () => console.log(`Servidor en http://localhost:${PORT}`));
