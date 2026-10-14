const express = require("express");
const session = require("express-session");
const cors = require("cors");
const path = require("path");
const crypto = require("crypto");
const { createClient } = require("@supabase/supabase-js");

const app = express();
const PORT = process.env.PORT || 3000;

// ── Supabase ─────────────────────────────────────────
const supabase = createClient(
  process.env.SUPABASE_URL,
  process.env.SUPABASE_SERVICE_KEY
);

// ── Rutas públicas (sin autenticación) ────────────────
// QR redirects y health checks pueden accederse sin login
function isPublicRoute(req) {
  return (
    req.path === "/health" ||
    req.path === "/" ||
    req.path === "/login.html" ||
    req.path.startsWith("/go/") ||
    req.path.startsWith("/slug/")
  );
}

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
// Para API: rechaza si no está autenticado
function requireAuth(req, res, next) {
  if (req.session?.authenticated) return next();
  res.status(401).json({ error: "No autenticado" });
}

// Para UI: redirige al login si no está autenticado
function requireAuthUI(req, res, next) {
  if (req.session?.authenticated) return next();
  res.redirect("/login.html");
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
// Dominios base (SLUG_DOMAINS, no borrables) + dominios añadidos desde la UI
// (tabla slug_domains en Supabase; ver docs/database/slug_domains.sql).
const envDomains = () => (process.env.SLUG_DOMAINS || "iorana.digital")
  .split(",").map(d => d.trim().toLowerCase()).filter(Boolean);

const DOMAIN_RE = /^(?=.{4,253}$)([a-z0-9]([a-z0-9-]{0,61}[a-z0-9])?\.)+[a-z]{2,63}$/;

async function dbDomains() {
  const { data, error } = await supabase.from("slug_domains").select("domain").order("created_at");
  if (error) { console.error("slug_domains:", error.message); return { rows: [], error }; }
  return { rows: data.map(r => r.domain), error: null };
}

app.get("/api/domains", requireAuth, async (_req, res) => {
  const base = envDomains();
  const { rows } = await dbDomains();
  const domains = [...new Set([...base, ...rows])];
  const prefix = process.env.SLUG_PREFIX || "r";
  res.json({ domains, custom: rows.filter(d => !base.includes(d)), prefix });
});

app.post("/api/domains", requireAuth, async (req, res) => {
  const domain = String(req.body.domain || "").trim().toLowerCase()
    .replace(/^https?:\/\//, "").replace(/\/.*$/, "");
  if (!DOMAIN_RE.test(domain)) return res.status(400).json({ error: "Dominio no válido (ej: midominio.com)" });
  if (envDomains().includes(domain)) return res.status(409).json({ error: "El dominio ya existe" });

  const { error } = await supabase.from("slug_domains").insert({ domain });
  if (error) {
    if (error.code === "23505") return res.status(409).json({ error: "El dominio ya existe" });
    if (error.code === "42P01" || error.code === "PGRST205")
      return res.status(500).json({ error: "Falta la tabla slug_domains en Supabase (ver docs/database/slug_domains.sql)" });
    return res.status(500).json({ error: error.message });
  }
  res.status(201).json({ ok: true, domain });
});

app.delete("/api/domains/:domain", requireAuth, async (req, res) => {
  const domain = req.params.domain.toLowerCase();
  if (envDomains().includes(domain)) return res.status(400).json({ error: "Dominio base: se configura en SLUG_DOMAINS" });
  const { count } = await supabase.from("qr_codes").select("id", { count: "exact", head: true }).eq("slug_domain", domain);
  if (count > 0) return res.status(409).json({ error: `${count} QR usan este dominio; cámbialos antes de eliminarlo` });
  const { error } = await supabase.from("slug_domains").delete().eq("domain", domain);
  if (error) return res.status(500).json({ error: error.message });
  res.json({ ok: true });
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
// index:false evita que "/" sirva index.html automáticamente
// antes de pasar por el chequeo de sesión
app.use(express.static(path.join(__dirname, "public"), { index: false }));

// Cualquier ruta de la SPA: exige sesión y sirve el index del panel
app.get("*", requireAuthUI, (_req, res) => {
  res.sendFile(path.join(__dirname, "public", "index.html"));
});

app.listen(PORT, () => console.log(`Servidor en http://localhost:${PORT}`));