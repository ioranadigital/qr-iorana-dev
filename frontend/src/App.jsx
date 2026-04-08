import { useState, useEffect, useRef, useCallback } from "react";

const BASE_URL = "https://qr.iorana.dev/go/";
const API = "/api/qrs";

// ── Helpers ──────────────────────────────────────────
function generateId() {
  return Math.random().toString(36).substring(2, 8).toUpperCase();
}

async function apiFetch(path, options = {}) {
  const res = await fetch(path, {
    headers: { "Content-Type": "application/json" },
    ...options,
  });
  if (!res.ok) {
    const err = await res.json().catch(() => ({ error: res.statusText }));
    throw new Error(err.error || "Error desconocido");
  }
  return res.json();
}

// ── QR renderer (usa qrcodejs vía CDN) ───────────────
function useQRImage(value, size = 200) {
  const [imgSrc, setImgSrc] = useState(null);

  const render = useCallback(() => {
    if (!value || !window.QRCode) return;
    const el = document.createElement("div");
    new window.QRCode(el, {
      text: value,
      width: size,
      height: size,
      colorDark: "#000000",
      colorLight: "#ffffff",
      correctLevel: window.QRCode.CorrectLevel.M,
    });
    setTimeout(() => {
      const canvas = el.querySelector("canvas");
      if (canvas) setImgSrc(canvas.toDataURL("image/png"));
    }, 150);
  }, [value, size]);

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

function QRImage({ value, size = 80 }) {
  const src = useQRImage(value, size);
  if (!src) return (
    <div style={{ width: size, height: size, background: "#f3f4f6", borderRadius: 6, display: "flex", alignItems: "center", justifyContent: "center" }}>
      <span style={{ fontSize: 10, color: "#9ca3af" }}>…</span>
    </div>
  );
  return <img src={src} width={size} height={size} style={{ display: "block", borderRadius: 4 }} alt="QR" />;
}

// ── Modal de exportación ─────────────────────────────
function ExportModal({ qr, onClose }) {
  const url = `${BASE_URL}${qr.id}`;
  const src = useQRImage(url, 512);
  const canvasRef = useRef(null);

  useEffect(() => {
    if (!src || !canvasRef.current) return;
    const img = new Image();
    img.onload = () => canvasRef.current.getContext("2d").drawImage(img, 0, 0);
    img.src = src;
  }, [src]);

  const downloadPNG = () => {
    if (!src) return;
    const a = document.createElement("a");
    a.download = `QR_${qr.id}.png`;
    a.href = src;
    a.click();
  };

  const downloadSVG = () => {
    if (!src) return;
    const svg = `<svg xmlns="http://www.w3.org/2000/svg" width="512" height="512"><image href="${src}" width="512" height="512"/></svg>`;
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
          <button onClick={downloadPNG} disabled={!src} style={btnStyle(!src)}>Descargar PNG</button>
          <button onClick={downloadSVG} disabled={!src} style={btnStyle(!src)}>Descargar SVG</button>
        </div>
      </div>
    </div>
  );
}

// ── Estilos reutilizables ────────────────────────────
const btnStyle = (disabled = false) => ({
  flex: 1, padding: "8px 0", fontSize: 13,
  cursor: disabled ? "not-allowed" : "pointer",
  opacity: disabled ? 0.45 : 1,
  borderRadius: "var(--border-radius-md)",
  border: "0.5px solid var(--color-border-secondary)",
  background: "var(--color-background-primary)",
  color: "var(--color-text-primary)",
});

const inputStyle = {
  width: "100%", boxSizing: "border-box", marginBottom: 12,
};

// ── App principal ────────────────────────────────────
export default function App() {
  const [qrs, setQrs] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);

  const [destUrl, setDestUrl] = useState("");
  const [label, setLabel] = useState("");
  const [creating, setCreating] = useState(false);

  const [editId, setEditId] = useState(null);
  const [editUrl, setEditUrl] = useState("");
  const [editLabel, setEditLabel] = useState("");
  const [saving, setSaving] = useState(false);

  const [exportTarget, setExportTarget] = useState(null);
  const [copied, setCopied] = useState(null);

  // Cargar QRs desde la API al montar
  useEffect(() => {
    apiFetch(API)
      .then(data => {
        // La API devuelve snake_case; normalizamos a camelCase
        setQrs(data.map(normalize));
      })
      .catch(e => setError(e.message))
      .finally(() => setLoading(false));
  }, []);

  // snake_case → camelCase
  const normalize = (row) => ({
    id: row.id,
    label: row.label,
    destUrl: row.dest_url,
    createdAt: row.created_at,
  });

  const handleCreate = async () => {
    if (!destUrl.trim()) return;
    setCreating(true);
    setError(null);
    const id = generateId();
    try {
      await apiFetch(API, {
        method: "POST",
        body: JSON.stringify({ id, label: label.trim() || `QR #${id}`, destUrl: destUrl.trim() }),
      });
      setQrs(prev => [{
        id,
        label: label.trim() || `QR #${id}`,
        destUrl: destUrl.trim(),
        createdAt: new Date().toISOString(),
      }, ...prev]);
      setDestUrl("");
      setLabel("");
    } catch (e) {
      setError(e.message);
    } finally {
      setCreating(false);
    }
  };

  const handleSaveEdit = async (id) => {
    if (!editUrl.trim()) return;
    setSaving(true);
    setError(null);
    try {
      await apiFetch(`${API}/${id}`, {
        method: "PUT",
        body: JSON.stringify({ destUrl: editUrl.trim(), label: editLabel.trim() }),
      });
      setQrs(prev => prev.map(q =>
        q.id === id ? { ...q, destUrl: editUrl.trim(), label: editLabel.trim() } : q
      ));
      setEditId(null);
    } catch (e) {
      setError(e.message);
    } finally {
      setSaving(false);
    }
  };

  const handleDelete = async (id) => {
    setError(null);
    try {
      await apiFetch(`${API}/${id}`, { method: "DELETE" });
      setQrs(prev => prev.filter(q => q.id !== id));
    } catch (e) {
      setError(e.message);
    }
  };

  const handleCopy = (text, key) => {
    navigator.clipboard.writeText(text).then(() => {
      setCopied(key);
      setTimeout(() => setCopied(null), 1500);
    });
  };

  const shortUrl = (id) => `${BASE_URL}${id}`;

  // ── Render ─────────────────────────────────────────
  return (
    <div style={{ maxWidth: 820, margin: "0 auto", padding: "1.5rem 1rem", fontFamily: "var(--font-sans)" }}>

      {/* Header */}
      <div style={{ marginBottom: 28 }}>
        <h1 style={{ fontSize: 20, fontWeight: 500, color: "var(--color-text-primary)", margin: 0 }}>
          QR Manager
        </h1>
        <p style={{ fontSize: 13, color: "var(--color-text-secondary)", margin: "4px 0 0" }}>
          qr.iorana.dev — códigos QR dinámicos con destino editable
        </p>
      </div>

      {/* Error global */}
      {error && (
        <div style={{ background: "var(--color-background-danger)", border: "0.5px solid var(--color-border-danger)", borderRadius: "var(--border-radius-md)", padding: "10px 14px", marginBottom: 16, fontSize: 13, color: "var(--color-text-danger)" }}>
          {error}
          <button onClick={() => setError(null)} style={{ float: "right", background: "none", border: "none", cursor: "pointer", color: "var(--color-text-danger)", fontSize: 16, lineHeight: 1 }}>×</button>
        </div>
      )}

      {/* Formulario de creación + preview */}
      <div style={{ display: "grid", gridTemplateColumns: "1fr auto", gap: 20, alignItems: "start", marginBottom: 32 }}>
        <div style={{ background: "var(--color-background-primary)", border: "0.5px solid var(--color-border-tertiary)", borderRadius: "var(--border-radius-lg)", padding: "1.25rem" }}>
          <p style={{ fontSize: 11, fontWeight: 500, color: "var(--color-text-tertiary)", marginBottom: 14, textTransform: "uppercase", letterSpacing: "0.06em" }}>
            Nuevo QR dinámico
          </p>

          <label style={{ fontSize: 13, color: "var(--color-text-secondary)", display: "block", marginBottom: 4 }}>Etiqueta</label>
          <input
            value={label}
            onChange={e => setLabel(e.target.value)}
            placeholder="Ej: Menú restaurante, Cartel evento…"
            style={inputStyle}
          />

          <label style={{ fontSize: 13, color: "var(--color-text-secondary)", display: "block", marginBottom: 4 }}>URL de destino</label>
          <input
            value={destUrl}
            onChange={e => setDestUrl(e.target.value)}
            onKeyDown={e => e.key === "Enter" && handleCreate()}
            placeholder="https://ejemplo.com/pagina"
            style={inputStyle}
          />

          <button
            onClick={handleCreate}
            disabled={!destUrl.trim() || creating}
            style={btnStyle(!destUrl.trim() || creating)}
          >
            {creating ? "Generando…" : "Generar QR"}
          </button>
        </div>

        {/* Preview en tiempo real */}
        <div style={{ display: "flex", flexDirection: "column", alignItems: "center", gap: 6 }}>
          <p style={{ fontSize: 11, color: "var(--color-text-tertiary)", margin: 0 }}>Vista previa</p>
          {destUrl ? (
            <div style={{ border: "0.5px solid var(--color-border-tertiary)", borderRadius: 8, padding: 8, background: "white" }}>
              <QRImage value={destUrl} size={140} />
            </div>
          ) : (
            <div style={{ width: 156, height: 156, border: "0.5px dashed var(--color-border-tertiary)", borderRadius: 8, display: "flex", alignItems: "center", justifyContent: "center", padding: "0 12px" }}>
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

            {/* Miniatura QR */}
            <div
              style={{ border: "0.5px solid var(--color-border-tertiary)", borderRadius: 6, padding: 5, background: "white", cursor: "pointer" }}
              onClick={() => setExportTarget(qr)}
              title="Click para exportar"
            >
              <QRImage value={shortUrl(qr.id)} size={72} />
            </div>

            {/* Contenido */}
            <div style={{ minWidth: 0 }}>
              {/* Cabecera */}
              <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 6 }}>
                {editId === qr.id ? (
                  <input
                    value={editLabel}
                    onChange={e => setEditLabel(e.target.value)}
                    style={{ fontSize: 14, fontWeight: 500, flex: 1, marginRight: 8 }}
                  />
                ) : (
                  <span style={{ fontWeight: 500, fontSize: 14 }}>{qr.label}</span>
                )}
                <span style={{ fontSize: 11, color: "var(--color-text-tertiary)", whiteSpace: "nowrap", marginLeft: 8 }}>
                  {new Date(qr.createdAt).toLocaleDateString("es-ES")}
                </span>
              </div>

              {/* URL corta */}
              <div style={{ display: "flex", alignItems: "center", gap: 6, marginBottom: 6 }}>
                <span style={{ fontSize: 11, fontFamily: "var(--font-mono)", background: "var(--color-background-secondary)", padding: "2px 8px", borderRadius: 4, color: "var(--color-text-secondary)", whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis", maxWidth: 240 }}>
                  {shortUrl(qr.id)}
                </span>
                <button onClick={() => handleCopy(shortUrl(qr.id), qr.id + "_s")} style={{ fontSize: 11, padding: "2px 8px", border: "0.5px solid var(--color-border-secondary)", borderRadius: 4, cursor: "pointer", background: "var(--color-background-primary)", color: "var(--color-text-secondary)", whiteSpace: "nowrap" }}>
                  {copied === qr.id + "_s" ? "✓" : "Copiar"}
                </button>
              </div>

              {/* Destino / edición */}
              {editId === qr.id ? (
                <div style={{ display: "flex", gap: 6 }}>
                  <input
                    value={editUrl}
                    onChange={e => setEditUrl(e.target.value)}
                    onKeyDown={e => e.key === "Enter" && handleSaveEdit(qr.id)}
                    placeholder="Nueva URL de destino"
                    style={{ flex: 1, fontSize: 13 }}
                  />
                  <button onClick={() => handleSaveEdit(qr.id)} disabled={saving} style={btnStyle(saving)}>
                    {saving ? "…" : "Guardar"}
                  </button>
                  <button onClick={() => setEditId(null)} style={btnStyle()}>Cancelar</button>
                </div>
              ) : (
                <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
                  <span style={{ fontSize: 12, color: "var(--color-text-secondary)", overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap", flex: 1 }}>
                    → {qr.destUrl}
                  </span>
                  <button onClick={() => { setEditId(qr.id); setEditUrl(qr.destUrl); setEditLabel(qr.label); }} style={{ fontSize: 12, padding: "3px 10px", border: "0.5px solid var(--color-border-secondary)", borderRadius: 4, cursor: "pointer", background: "var(--color-background-primary)", color: "var(--color-text-primary)", whiteSpace: "nowrap" }}>
                    Editar
                  </button>
                  <button onClick={() => setExportTarget(qr)} style={{ fontSize: 12, padding: "3px 10px", border: "0.5px solid var(--color-border-secondary)", borderRadius: 4, cursor: "pointer", background: "var(--color-background-primary)", color: "var(--color-text-primary)", whiteSpace: "nowrap" }}>
                    Exportar
                  </button>
                  <button onClick={() => handleDelete(qr.id)} style={{ fontSize: 12, padding: "3px 8px", border: "0.5px solid var(--color-border-tertiary)", borderRadius: 4, cursor: "pointer", background: "var(--color-background-primary)", color: "var(--color-text-tertiary)" }}>
                    ✕
                  </button>
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