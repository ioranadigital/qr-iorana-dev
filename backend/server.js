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
  process.env.SUPABASE_SERVICE_KEY
);

// ── Middlewares ──────────────────────────────────────
app.set("trust proxy", 1);
app.use(cors({ origin: process.env.ALLOWED_ORIGIN || "https://qr.iorana.dev", credentials: true }));
app.use(express.json());
app.use(session({
  secret: process.env.SESSION_SECRET || "changeme-set-in-env",
  resave: false,
  saveUninitialized: false,
  cookie: {
    httpOnly: true,
    secure: process.env.NODE_ENV === "production",
    sameSite: "lax",
    maxAge: 8 * 60 * 60 * 1000,
  },
}));

// ── Rate limiting login ──────────────────────────────
const loginAttempts = new Map();
function rateLimitLogin(req, res, next) {
  const ip = req.ip;
  const now = Date.now();
  const entry = loginAttempts.get(ip) || { count: 0, first: now };
  if (now - entry.first > 15 * 60 * 1000) { loginAttempts.set(ip, { count: 1, first: now }); return next(); }
  if (entry.count >= 5) return res.status(429).json({ error: "Demasiados intentos. Espera 15 minutos." });
  entry.count++;
  loginAttempts.set(ip, entry);
  next();
}

// ── Auth middleware ──────────────────────────────────
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
      if (err) { console.error("Session save error:", err); return res.status(500).json({ error: "Error al guardar sesión" }); }
      res.json({ ok: true });
    });
  } else {
    res.status(401).json({ error: "Credenciales incorrectas" });
  }
});

app.post("/api/logout", (req, res) => { req.session.destroy(); res.json({ ok: true }); });

// ── Redirección por ID corto (URL grabada en el QR) ──
// Si tiene slug amigable → redirige a la URL amigable primero
// Si no tiene slug → redirige directo al destino final
app.get("/go/:id", async (req, res) => {
  const { data, error } = await supabase
    .from("qr_codes")
    .select("dest_url, slug, slug_domain")
    .eq("id", req.params.id)
    .single();

  if (error || !data) return res.status(404).send("QR no encontrado");

  const prefix = process.env.SLUG_PREFIX || "r";

  if (data.slug && data.slug_domain) {
    // Redirige a la URL amigable — el usuario ve este dominio
    return res.redirect(302, `https://${data.slug_domain}/${prefix}/${data.slug}`);
  }

  // Sin URL amigable → directo al destino
  res.redirect(302, data.dest_url);
});

// ── Redirección por slug amigable ────────────────────
// Traefik hace stripPrefix(/r/) antes de reenviar, y añade
// el dominio origen en la cabecera X-Forwarded-Host.
// Ruta recibida: /slug/iorana.digital/vcard/nombre
app.get("/slug/:domain/*", async (req, res) => {
  // Limpiar barras al inicio y al final
  const slug = req.params[0].replace(/^\/+|\/+$/g, "");
  const domain = req.params.domain;

  console.log(`Slug lookup: domain=${domain} slug=${slug}`);

  const { data, error } = await supabase
    .from("qr_codes")
    .select("dest_url")
    .eq("slug", slug)
    .eq("slug_domain", domain)
    .single();

  if (error || !data) {
    console.log(`Slug not found: ${domain}/${slug}`);
    return res.status(404).send("Página no encontrada");
  }
  res.redirect(302, data.dest_url);
});

// ── Health check (útil para Coolify) ─────────────────
app.get("/health", (_req, res) => res.json({ ok: true }));

// ── API: dominios y prefijo configurados ─────────────
app.get("/api/domains", requireAuth, (_req, res) => {
  const domains = (process.env.SLUG_DOMAINS || "iorana.digital")
    .split(",").map(d => d.trim()).filter(Boolean);
  const prefix = process.env.SLUG_PREFIX || "r";
  res.json({ domains, prefix });
});

// ── API REST QRs ─────────────────────────────────────
app.get("/api/qrs", requireAuth, async (_req, res) => {
  const { data, error } = await supabase
    .from("qr_codes").select("*").order("created_at", { ascending: false });
  if (error) return res.status(500).json({ error: error.message });
  res.json(data);
});

app.post("/api/qrs", requireAuth, async (req, res) => {
  const { id, label, destUrl, fgColor, bgColor, tab, slug, slugDomain } = req.body;
  if (!id || !destUrl) return res.status(400).json({ error: "id y destUrl son obligatorios" });

  // Validar slug único si se proporciona
  if (slug && slugDomain) {
    const { data: existing } = await supabase
      .from("qr_codes").select("id").eq("slug", slug).eq("slug_domain", slugDomain).single();
    if (existing) return res.status(409).json({ error: `El slug "${slug}" ya está en uso en ${slugDomain}` });
  }

  const { error } = await supabase.from("qr_codes").insert({
    id,
    label: label || "",
    dest_url: destUrl,
    fg_color: fgColor || "#000000",
    bg_color: bgColor || "#ffffff",
    tab: tab || "general",
    slug: slug || null,
    slug_domain: slug ? (slugDomain || null) : null,
  });

  if (error) {
    if (error.code === "23505") return res.status(409).json({ error: "ID o slug duplicado" });
    return res.status(500).json({ error: error.message });
  }
  res.status(201).json({ ok: true, id });
});

app.put("/api/qrs/:id", requireAuth, async (req, res) => {
  const { destUrl, label, fgColor, bgColor, slug, slugDomain } = req.body;
  if (!destUrl) return res.status(400).json({ error: "destUrl es obligatorio" });

  // Validar slug único excluyendo el registro actual
  if (slug && slugDomain) {
    const { data: existing } = await supabase
      .from("qr_codes").select("id").eq("slug", slug).eq("slug_domain", slugDomain).neq("id", req.params.id).single();
    if (existing) return res.status(409).json({ error: `El slug "${slug}" ya está en uso en ${slugDomain}` });
  }

  const { tab } = req.body;
  const { error } = await supabase.from("qr_codes").update({
    dest_url: destUrl,
    label: label || "",
    fg_color: fgColor || "#000000",
    bg_color: bgColor || "#ffffff",
    slug: slug || null,
    slug_domain: slug ? (slugDomain || null) : null,
    ...(tab ? { tab } : {}),
  }).eq("id", req.params.id);

  if (error) return res.status(500).json({ error: error.message });
  res.json({ ok: true });
});

app.delete("/api/qrs/:id", requireAuth, async (req, res) => {
  const { error } = await supabase.from("qr_codes").delete().eq("id", req.params.id);
  if (error) return res.status(500).json({ error: error.message });
  res.json({ ok: true });
});

// ── Frontend estático ────────────────────────────────
app.use(express.static(path.join(__dirname, "public")));
app.get("*", (_req, res) => res.sendFile(path.join(__dirname, "public", "index.html")));

app.listen(PORT, () => console.log(`Servidor en http://localhost:${PORT}`));