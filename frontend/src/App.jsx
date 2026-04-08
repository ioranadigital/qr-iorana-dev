import { useState, useEffect, useRef, useCallback } from "react";

const BASE_URL = "https://qr.iorana.dev/go/";
const API = "/api/qrs";

function generateId() {
  return Math.random().toString(36).substring(2, 8).toUpperCase();
}

async function apiFetch(path, options = {}) {
  const res = await fetch(path, {
    headers: { "Content-Type": "application/json" },
    credentials: "include",
    ...options,
  });
  if (res.status === 401) throw new Error("__UNAUTH__");
  if (!res.ok) {
    const err = await res.json().catch(() => ({ error: res.statusText }));
    throw new Error(err.error || "Error desconocido");
  }
  return res.json();
}

// ── QR renderer ──────────────────────────────────────
function useQRImage(value, size = 200, fgColor = "#000000", bgColor = "#ffffff") {
  const [imgSrc, setImgSrc] = useState(null);

  const render = useCallback(() => {
    if (!value || !window.QRCode) return;
    const el = document.createElement("div");
    new window.QRCode(el, {
      text: value, width: size, height: size,
      colorDark: fgColor, colorLight: bgColor,
      correctLevel: window.QRCode.CorrectLevel.M,
    });
    setTimeout(() => {
      const canvas = el.querySelector("canvas");
      if (canvas) setImgSrc(canvas.toDataURL("image/png"));
    }, 150);
  }, [value, size, fgColor, bgColor]);

  useEffect(() => {
    if (!value) { setImgSrc(null); return; }
    if (window.QRCode) { render(); return; }
    const s = document.createElement("script");
    s.src = "https://cdnjs.cloudflare.com/ajax/libs/qrcodejs/1.0.0/qrcode.min.js";
    s.onload = render;
    document.head.appendChild(s);
  }, [value, render]);

  return imgSrc;
}

function QRImage({ value, size = 80, fgColor = "#000000", bgColor = "#ffffff" }) {
  const padding = Math.round(size * 0.1); // quiet zone ~10% del tamaño
  const innerSize = size - padding * 2;
  const src = useQRImage(value, innerSize, fgColor, bgColor);
  if (!src) return (
    <div style={{ width: size, height: size, background: bgColor, borderRadius: 6, display: "flex", alignItems: "center", justifyContent: "center" }}>
      <span style={{ fontSize: 10, color: "#9ca3af" }}>…</span>
    </div>
  );
  return (
    <div style={{ width: size, height: size, background: bgColor, borderRadius: 6, display: "flex", alignItems: "center", justifyContent: "center", flexShrink: 0 }}>
      <img src={src} width={innerSize} height={innerSize} style={{ display: "block" }} alt="QR" />
    </div>
  );
}

// ── Login ─────────────────────────────────────────────
function LoginScreen({ onLogin }) {
  const [username, setUsername] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState(null);
  const [loading, setLoading] = useState(false);

  const handleSubmit = async () => {
    if (!username || !password) return;
    setLoading(true);
    setError(null);
    try {
      await apiFetch("/api/login", {
        method: "POST",
        body: JSON.stringify({ username, password }),
      });
      onLogin();
    } catch (e) {
      setError(e.message === "__UNAUTH__" ? "Credenciales incorrectas" : e.message);
    } finally {
      setLoading(false);
    }
  };

  return (
    <div style={{ minHeight: "100vh", display: "flex", alignItems: "center", justifyContent: "center", background: "var(--color-background-tertiary)" }}>
      <div style={{ background: "var(--color-background-primary)", border: "0.5px solid var(--color-border-tertiary)", borderRadius: "var(--border-radius-lg)", padding: "2rem", width: 340, maxWidth: "92vw" }}>
        <div style={{ marginBottom: 24, textAlign: "center" }}>
          <p style={{ fontSize: 20, fontWeight: 500, margin: 0 }}>QR Manager</p>
          <p style={{ fontSize: 13, color: "var(--color-text-secondary)", margin: "4px 0 0" }}>qr.iorana.dev</p>
        </div>

        {error && (
          <div style={{ background: "var(--color-background-danger)", border: "0.5px solid var(--color-border-danger)", borderRadius: "var(--border-radius-md)", padding: "8px 12px", marginBottom: 14, fontSize: 13, color: "var(--color-text-danger)" }}>
            {error}
          </div>
        )}

        <label style={{ fontSize: 13, color: "var(--color-text-secondary)", display: "block", marginBottom: 4 }}>Usuario</label>
        <input value={username} onChange={e => setUsername(e.target.value)} style={{ width: "100%", boxSizing: "border-box", marginBottom: 12 }} onKeyDown={e => e.key === "Enter" && handleSubmit()} autoFocus />

        <label style={{ fontSize: 13, color: "var(--color-text-secondary)", display: "block", marginBottom: 4 }}>Contraseña</label>
        <input type="password" value={password} onChange={e => setPassword(e.target.value)} style={{ width: "100%", boxSizing: "border-box", marginBottom: 20 }} onKeyDown={e => e.key === "Enter" && handleSubmit()} />

        <button onClick={handleSubmit} disabled={loading || !username || !password} style={{ width: "100%", padding: "9px 0", fontSize: 14, cursor: "pointer", borderRadius: "var(--border-radius-md)", border: "0.5px solid var(--color-border-secondary)", background: "var(--color-background-primary)", color: "var(--color-text-primary)", opacity: loading ? 0.6 : 1 }}>
          {loading ? "Entrando…" : "Entrar"}
        </button>
      </div>
    </div>
  );
}

// ── Export Modal ──────────────────────────────────────
function ExportModal({ qr, onClose }) {
  const url = `${BASE_URL}${qr.id}`;
  const src = useQRImage(url, 512, qr.fgColor, qr.bgColor);
  const canvasRef = useRef(null);

  useEffect(() => {
    if (!src || !canvasRef.current) return;
    const img = new Image();
    img.onload = () => canvasRef.current.getContext("2d").drawImage(img, 0, 0);
    img.src = src;
  }, [src]);

  const exportSize = 512;
  const padding = Math.round(exportSize * 0.1);
  const innerSize = exportSize - padding * 2;

  const buildExportCanvas = () => {
    if (!src) return null;
    const canvas = document.createElement("canvas");
    canvas.width = exportSize;
    canvas.height = exportSize;
    const ctx = canvas.getContext("2d");
    // fondo con quiet zone
    ctx.fillStyle = qr.bgColor || "#ffffff";
    ctx.fillRect(0, 0, exportSize, exportSize);
    const img = new Image();
    return new Promise(resolve => {
      img.onload = () => {
        ctx.drawImage(img, padding, padding, innerSize, innerSize);
        resolve(canvas);
      };
      img.src = src;
    });
  };

  const downloadPNG = async () => {
    const canvas = await buildExportCanvas();
    if (!canvas) return;
    const a = document.createElement("a");
    a.download = `QR_${qr.id}.png`;
    a.href = canvas.toDataURL("image/png");
    a.click();
  };

  const downloadSVG = async () => {
    const canvas = await buildExportCanvas();
    if (!canvas) return;
    const dataUrl = canvas.toDataURL("image/png");
    const svg = `<svg xmlns="http://www.w3.org/2000/svg" width="512" height="512"><image href="${dataUrl}" width="512" height="512"/></svg>`;
    const a = document.createElement("a");
    a.download = `QR_${qr.id}.svg`;
    a.href = URL.createObjectURL(new Blob([svg], { type: "image/svg+xml" }));
    a.click();
  };

  return (
    <div style={{ position: "fixed", inset: 0, background: "rgba(0,0,0,0.45)", display: "flex", alignItems: "center", justifyContent: "center", zIndex: 100 }}>
      <div style={{ background: "var(--color-background-primary)", border: "0.5px solid var(--color-border-tertiary)", borderRadius: "var(--border-radius-lg)", padding: "1.5rem", width: 340, maxWidth: "92vw" }}>
        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 16 }}>
          <span style={{ fontWeight: 500, fontSize: 15 }}>Exportar — {qr.label}</span>
          <button onClick={onClose} style={{ background: "none", border: "none", fontSize: 20, cursor: "pointer", color: "var(--color-text-secondary)", lineHeight: 1 }}>×</button>
        </div>
        <div style={{ display: "flex", justifyContent: "center", marginBottom: 12 }}>
          <canvas ref={canvasRef} width={512} height={512} style={{ width: 180, height: 180, borderRadius: 8, border: "0.5px solid var(--color-border-tertiary)", background: "white" }} />
        </div>
        <p style={{ fontSize: 11, color: "var(--color-text-tertiary)", textAlign: "center", marginBottom: 16, wordBreak: "break-all", fontFamily: "var(--font-mono)" }}>{url}</p>
        <div style={{ display: "flex", gap: 8 }}>
          <button onClick={downloadPNG} disabled={!src} style={btnStyle(!src)}>PNG</button>
          <button onClick={downloadSVG} disabled={!src} style={btnStyle(!src)}>SVG</button>
        </div>
      </div>
    </div>
  );
}

const btnStyle = (disabled = false) => ({
  flex: 1, padding: "8px 0", fontSize: 13,
  cursor: disabled ? "not-allowed" : "pointer",
  opacity: disabled ? 0.45 : 1,
  borderRadius: "var(--border-radius-md)",
  border: "0.5px solid var(--color-border-secondary)",
  background: "var(--color-background-primary)",
  color: "var(--color-text-primary)",
});

// ── App principal ────────────────────────────────────
export default function App() {
  const [authed, setAuthed] = useState(null); // null=cargando, false=no auth, true=autenticado
  const [qrs, setQrs] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);

  const [destUrl, setDestUrl] = useState("");
  const [label, setLabel] = useState("");
  const [fgColor, setFgColor] = useState("#000000");
  const [bgColor, setBgColor] = useState("#ffffff");
  const [creating, setCreating] = useState(false);

  const [editId, setEditId] = useState(null);
  const [editUrl, setEditUrl] = useState("");
  const [editLabel, setEditLabel] = useState("");
  const [editFg, setEditFg] = useState("#000000");
  const [editBg, setEditBg] = useState("#ffffff");
  const [saving, setSaving] = useState(false);

  const [exportTarget, setExportTarget] = useState(null);
  const [copied, setCopied] = useState(null);

  // Comprobar sesión al cargar
  useEffect(() => {
    apiFetch("/api/me")
      .then(() => setAuthed(true))
      .catch(() => setAuthed(false));
  }, []);

  // Cargar QRs cuando esté autenticado
  useEffect(() => {
    if (!authed) return;
    apiFetch(API)
      .then(data => setQrs(data.map(normalize)))
      .catch(e => { if (e.message === "__UNAUTH__") setAuthed(false); else setError(e.message); })
      .finally(() => setLoading(false));
  }, [authed]);

  const normalize = (row) => ({
    id: row.id, label: row.label, destUrl: row.dest_url,
    fgColor: row.fg_color || "#000000", bgColor: row.bg_color || "#ffffff",
    createdAt: row.created_at,
  });

  const handleLogout = async () => {
    await apiFetch("/api/logout", { method: "POST" });
    setAuthed(false);
    setQrs([]);
  };

  const handleCreate = async () => {
    if (!destUrl.trim()) return;
    setCreating(true); setError(null);
    const id = generateId();
    try {
      await apiFetch(API, { method: "POST", body: JSON.stringify({ id, label: label.trim() || `QR #${id}`, destUrl: destUrl.trim(), fgColor, bgColor }) });
      setQrs(prev => [{ id, label: label.trim() || `QR #${id}`, destUrl: destUrl.trim(), fgColor, bgColor, createdAt: new Date().toISOString() }, ...prev]);
      setDestUrl(""); setLabel(""); setFgColor("#000000"); setBgColor("#ffffff");
    } catch (e) {
      if (e.message === "__UNAUTH__") setAuthed(false); else setError(e.message);
    } finally { setCreating(false); }
  };

  const handleSaveEdit = async (id) => {
    if (!editUrl.trim()) return;
    setSaving(true); setError(null);
    try {
      await apiFetch(`${API}/${id}`, { method: "PUT", body: JSON.stringify({ destUrl: editUrl.trim(), label: editLabel.trim(), fgColor: editFg, bgColor: editBg }) });
      setQrs(prev => prev.map(q => q.id === id ? { ...q, destUrl: editUrl.trim(), label: editLabel.trim(), fgColor: editFg, bgColor: editBg } : q));
      setEditId(null);
    } catch (e) {
      if (e.message === "__UNAUTH__") setAuthed(false); else setError(e.message);
    } finally { setSaving(false); }
  };

  const handleDelete = async (id) => {
    try {
      await apiFetch(`${API}/${id}`, { method: "DELETE" });
      setQrs(prev => prev.filter(q => q.id !== id));
    } catch (e) {
      if (e.message === "__UNAUTH__") setAuthed(false); else setError(e.message);
    }
  };

  const handleCopy = (text, key) => {
    navigator.clipboard.writeText(text).then(() => { setCopied(key); setTimeout(() => setCopied(null), 1500); });
  };

  const shortUrl = (id) => `${BASE_URL}${id}`;

  // Pantallas de carga / login
  if (authed === null) return (
    <div style={{ minHeight: "100vh", display: "flex", alignItems: "center", justifyContent: "center" }}>
      <span style={{ fontSize: 13, color: "var(--color-text-tertiary)" }}>Cargando…</span>
    </div>
  );
  if (authed === false) return <LoginScreen onLogin={() => setAuthed(true)} />;

  const COLORS = ["#000000", "#1a1a2e", "#16213e", "#e63946", "#2a9d8f", "#e9c46a", "#6a4c93", "#f4a261", "#264653", "#ffffff"];

  return (
    <div style={{ maxWidth: 820, margin: "0 auto", padding: "1.5rem 1rem", fontFamily: "var(--font-sans)" }}>
      {/* Header */}
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 28 }}>
        <div>
          <h1 style={{ fontSize: 20, fontWeight: 500, margin: 0 }}>QR Manager</h1>
          <p style={{ fontSize: 13, color: "var(--color-text-secondary)", margin: "4px 0 0" }}>qr.iorana.dev</p>
        </div>
        <button onClick={handleLogout} style={{ fontSize: 12, padding: "5px 14px", border: "0.5px solid var(--color-border-secondary)", borderRadius: "var(--border-radius-md)", cursor: "pointer", background: "var(--color-background-primary)", color: "var(--color-text-secondary)" }}>
          Cerrar sesión
        </button>
      </div>

      {error && (
        <div style={{ background: "var(--color-background-danger)", border: "0.5px solid var(--color-border-danger)", borderRadius: "var(--border-radius-md)", padding: "10px 14px", marginBottom: 16, fontSize: 13, color: "var(--color-text-danger)" }}>
          {error}
          <button onClick={() => setError(null)} style={{ float: "right", background: "none", border: "none", cursor: "pointer", color: "var(--color-text-danger)", fontSize: 16, lineHeight: 1 }}>×</button>
        </div>
      )}

      {/* Formulario + preview */}
      <div style={{ display: "grid", gridTemplateColumns: "1fr auto", gap: 20, alignItems: "start", marginBottom: 32 }}>
        <div style={{ background: "var(--color-background-primary)", border: "0.5px solid var(--color-border-tertiary)", borderRadius: "var(--border-radius-lg)", padding: "1.25rem" }}>
          <p style={{ fontSize: 11, fontWeight: 500, color: "var(--color-text-tertiary)", marginBottom: 14, textTransform: "uppercase", letterSpacing: "0.06em" }}>Nuevo QR dinámico</p>

          <label style={{ fontSize: 13, color: "var(--color-text-secondary)", display: "block", marginBottom: 4 }}>Etiqueta</label>
          <input value={label} onChange={e => setLabel(e.target.value)} placeholder="Ej: Menú restaurante" style={{ width: "100%", boxSizing: "border-box", marginBottom: 12 }} />

          <label style={{ fontSize: 13, color: "var(--color-text-secondary)", display: "block", marginBottom: 4 }}>URL de destino</label>
          <input value={destUrl} onChange={e => setDestUrl(e.target.value)} onKeyDown={e => e.key === "Enter" && handleCreate()} placeholder="https://ejemplo.com" style={{ width: "100%", boxSizing: "border-box", marginBottom: 14 }} />

          <div style={{ display: "flex", gap: 20, marginBottom: 16 }}>
            <div style={{ flex: 1 }}>
              <label style={{ fontSize: 13, color: "var(--color-text-secondary)", display: "block", marginBottom: 6 }}>Color QR</label>
              <ColorPicker value={fgColor} onChange={setFgColor} colors={COLORS} />
            </div>
            <div style={{ flex: 1 }}>
              <label style={{ fontSize: 13, color: "var(--color-text-secondary)", display: "block", marginBottom: 6 }}>Fondo</label>
              <ColorPicker value={bgColor} onChange={setBgColor} colors={COLORS} />
            </div>
          </div>

          <button onClick={handleCreate} disabled={!destUrl.trim() || creating} style={btnStyle(!destUrl.trim() || creating)}>
            {creating ? "Generando…" : "Generar QR"}
          </button>
        </div>

        {/* Preview */}
        <div style={{ display: "flex", flexDirection: "column", alignItems: "center", gap: 6 }}>
          <p style={{ fontSize: 11, color: "var(--color-text-tertiary)", margin: 0 }}>Vista previa</p>
          {destUrl ? (
            <div style={{ border: "0.5px solid var(--color-border-tertiary)", borderRadius: 8, padding: 10, background: bgColor }}>
              <QRImage value={destUrl} size={140} fgColor={fgColor} bgColor={bgColor} />
            </div>
          ) : (
            <div style={{ width: 160, height: 160, border: "0.5px dashed var(--color-border-tertiary)", borderRadius: 8, display: "flex", alignItems: "center", justifyContent: "center", padding: "0 12px" }}>
              <span style={{ fontSize: 11, color: "var(--color-text-tertiary)", textAlign: "center" }}>Escribe una URL para previsualizar</span>
            </div>
          )}
        </div>
      </div>

      {/* Lista */}
      <p style={{ fontSize: 11, fontWeight: 500, color: "var(--color-text-tertiary)", marginBottom: 12, textTransform: "uppercase", letterSpacing: "0.06em" }}>
        {loading ? "Cargando…" : `QRs creados (${qrs.length})`}
      </p>

      {!loading && qrs.length === 0 && (
        <div style={{ textAlign: "center", padding: "3rem 0", color: "var(--color-text-tertiary)", fontSize: 14 }}>
          Aún no hay QRs. Genera el primero arriba.
        </div>
      )}

      <div style={{ display: "flex", flexDirection: "column", gap: 10 }}>
        {qrs.map(qr => (
          <div key={qr.id} style={{ background: "var(--color-background-primary)", border: "0.5px solid var(--color-border-tertiary)", borderRadius: "var(--border-radius-lg)", padding: "1rem 1.25rem", display: "grid", gridTemplateColumns: "auto 1fr", gap: 14, alignItems: "start" }}>
            <div style={{ border: "0.5px solid var(--color-border-tertiary)", borderRadius: 6, padding: 6, background: qr.bgColor || "#ffffff", cursor: "pointer" }} onClick={() => setExportTarget(qr)} title="Click para exportar">
              <QRImage value={shortUrl(qr.id)} size={72} fgColor={qr.fgColor} bgColor={qr.bgColor} />
            </div>

            <div style={{ minWidth: 0 }}>
              <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 6 }}>
                {editId === qr.id
                  ? <input value={editLabel} onChange={e => setEditLabel(e.target.value)} style={{ fontSize: 14, fontWeight: 500, flex: 1, marginRight: 8 }} />
                  : <span style={{ fontWeight: 500, fontSize: 14 }}>{qr.label}</span>}
                <span style={{ fontSize: 11, color: "var(--color-text-tertiary)", whiteSpace: "nowrap", marginLeft: 8 }}>
                  {new Date(qr.createdAt).toLocaleDateString("es-ES")}
                </span>
              </div>

              <div style={{ display: "flex", alignItems: "center", gap: 6, marginBottom: 6 }}>
                <span style={{ fontSize: 11, fontFamily: "var(--font-mono)", background: "var(--color-background-secondary)", padding: "2px 8px", borderRadius: 4, color: "var(--color-text-secondary)", whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis", maxWidth: 240 }}>
                  {shortUrl(qr.id)}
                </span>
                <button onClick={() => handleCopy(shortUrl(qr.id), qr.id + "_s")} style={{ fontSize: 11, padding: "2px 8px", border: "0.5px solid var(--color-border-secondary)", borderRadius: 4, cursor: "pointer", background: "var(--color-background-primary)", color: "var(--color-text-secondary)", whiteSpace: "nowrap" }}>
                  {copied === qr.id + "_s" ? "✓" : "Copiar"}
                </button>
              </div>

              {editId === qr.id ? (
                <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
                  <input value={editUrl} onChange={e => setEditUrl(e.target.value)} onKeyDown={e => e.key === "Enter" && handleSaveEdit(qr.id)} placeholder="Nueva URL de destino" style={{ fontSize: 13, width: "100%", boxSizing: "border-box" }} />
                  <div style={{ display: "flex", gap: 16 }}>
                    <div style={{ flex: 1 }}>
                      <label style={{ fontSize: 12, color: "var(--color-text-secondary)", display: "block", marginBottom: 4 }}>Color QR</label>
                      <ColorPicker value={editFg} onChange={setEditFg} colors={COLORS} small />
                    </div>
                    <div style={{ flex: 1 }}>
                      <label style={{ fontSize: 12, color: "var(--color-text-secondary)", display: "block", marginBottom: 4 }}>Fondo</label>
                      <ColorPicker value={editBg} onChange={setEditBg} colors={COLORS} small />
                    </div>
                  </div>
                  <div style={{ display: "flex", gap: 6 }}>
                    <button onClick={() => handleSaveEdit(qr.id)} disabled={saving} style={btnStyle(saving)}>{saving ? "…" : "Guardar"}</button>
                    <button onClick={() => setEditId(null)} style={btnStyle()}>Cancelar</button>
                  </div>
                </div>
              ) : (
                <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
                  <span style={{ fontSize: 12, color: "var(--color-text-secondary)", overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap", flex: 1 }}>→ {qr.destUrl}</span>
                  <button onClick={() => { setEditId(qr.id); setEditUrl(qr.destUrl); setEditLabel(qr.label); setEditFg(qr.fgColor); setEditBg(qr.bgColor); }} style={{ fontSize: 12, padding: "3px 10px", border: "0.5px solid var(--color-border-secondary)", borderRadius: 4, cursor: "pointer", background: "var(--color-background-primary)", color: "var(--color-text-primary)", whiteSpace: "nowrap" }}>Editar</button>
                  <button onClick={() => setExportTarget(qr)} style={{ fontSize: 12, padding: "3px 10px", border: "0.5px solid var(--color-border-secondary)", borderRadius: 4, cursor: "pointer", background: "var(--color-background-primary)", color: "var(--color-text-primary)", whiteSpace: "nowrap" }}>Exportar</button>
                  <button onClick={() => handleDelete(qr.id)} style={{ fontSize: 12, padding: "3px 8px", border: "0.5px solid var(--color-border-tertiary)", borderRadius: 4, cursor: "pointer", background: "var(--color-background-primary)", color: "var(--color-text-tertiary)" }}>✕</button>
                </div>
              )}
            </div>
          </div>
        ))}
      </div>

      {exportTarget && <ExportModal qr={exportTarget} onClose={() => setExportTarget(null)} />}
    </div>
  );
}

// ── Color Picker ──────────────────────────────────────
function ColorPicker({ value, onChange, colors, small = false }) {
  const size = small ? 20 : 24;
  return (
    <div style={{ display: "flex", flexWrap: "wrap", gap: 5, alignItems: "center" }}>
      {colors.map(c => (
        <button
          key={c}
          onClick={() => onChange(c)}
          title={c}
          style={{
            width: size, height: size, borderRadius: "50%",
            background: c,
            border: value === c ? "2px solid var(--color-text-primary)" : "1px solid var(--color-border-secondary)",
            cursor: "pointer", padding: 0, flexShrink: 0,
            boxSizing: "border-box",
            outline: value === c ? "2px solid var(--color-background-primary)" : "none",
            outlineOffset: "-3px",
          }}
        />
      ))}
      <input type="color" value={value} onChange={e => onChange(e.target.value)}
        title="Color personalizado"
        style={{ width: size, height: size, border: "1px solid var(--color-border-secondary)", borderRadius: "50%", padding: 0, cursor: "pointer", background: "none", overflow: "hidden" }}
      />
    </div>
  );
}
