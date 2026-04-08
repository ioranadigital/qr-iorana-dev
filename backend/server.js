const express = require("express");
const Database = require("better-sqlite3");
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
    created_at TEXT NOT NULL DEFAULT (datetime('now'))
  )
`);

// ── Middlewares ──────────────────────────────────────
app.use(cors({
  origin: process.env.ALLOWED_ORIGIN || "https://qr.iorana.dev",
  methods: ["GET", "POST", "PUT", "DELETE"],
}));
app.use(express.json());

// ── Logging mínimo ───────────────────────────────────
app.use((req, _res, next) => {
  console.log(`${new Date().toISOString()}  ${req.method}  ${req.path}`);
  next();
});

// ── Redirección dinámica ─────────────────────────────
// Esta es la URL que se graba en el QR físico: qr.iorana.dev/go/:id
app.get("/go/:id", (req, res) => {
  const row = db
    .prepare("SELECT dest_url FROM qr_codes WHERE id = ?")
    .get(req.params.id);

  if (row) {
    return res.redirect(302, row.dest_url);
  }
  res.status(404).send("QR no encontrado");
});

// ── API REST ─────────────────────────────────────────

// GET /api/qrs — listar todos
app.get("/api/qrs", (_req, res) => {
  const rows = db
    .prepare("SELECT * FROM qr_codes ORDER BY created_at DESC")
    .all();
  res.json(rows);
});

// POST /api/qrs — crear nuevo QR
app.post("/api/qrs", (req, res) => {
  const { id, label, destUrl } = req.body;

  if (!id || !destUrl) {
    return res.status(400).json({ error: "id y destUrl son obligatorios" });
  }

  try {
    db.prepare(
      "INSERT INTO qr_codes (id, label, dest_url) VALUES (?, ?, ?)"
    ).run(id, label || "", destUrl);

    res.status(201).json({ ok: true, id });
  } catch (err) {
    if (err.message.includes("UNIQUE")) {
      return res.status(409).json({ error: "ID duplicado" });
    }
    res.status(500).json({ error: err.message });
  }
});

// PUT /api/qrs/:id — editar destino y/o etiqueta
app.put("/api/qrs/:id", (req, res) => {
  const { destUrl, label } = req.body;

  if (!destUrl) {
    return res.status(400).json({ error: "destUrl es obligatorio" });
  }

  const result = db
    .prepare("UPDATE qr_codes SET dest_url = ?, label = ? WHERE id = ?")
    .run(destUrl, label || "", req.params.id);

  if (result.changes === 0) {
    return res.status(404).json({ error: "QR no encontrado" });
  }
  res.json({ ok: true });
});

// DELETE /api/qrs/:id — eliminar QR
app.delete("/api/qrs/:id", (req, res) => {
  const result = db
    .prepare("DELETE FROM qr_codes WHERE id = ?")
    .run(req.params.id);

  if (result.changes === 0) {
    return res.status(404).json({ error: "QR no encontrado" });
  }
  res.json({ ok: true });
});

// ── Frontend estático ────────────────────────────────
// Sirve el build de React compilado por el Dockerfile
app.use(express.static(path.join(__dirname, "public")));

app.get("*", (req, res) => {
  res.sendFile(path.join(__dirname, "public", "index.html"));
});

// ── Arranque ─────────────────────────────────────────
app.listen(PORT, () => {
  console.log(`Servidor corriendo en http://localhost:${PORT}`);
});