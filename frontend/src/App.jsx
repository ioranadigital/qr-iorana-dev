import { useState, useEffect, useCallback } from "react";

const BASE_URL = "https://qr.iorana.dev/go/";
const API = "/api/qrs";
const TABS_KEY = "qr_tabs";

const DEFAULT_TABS = [
  { id: "clientes", label: "Clientes" },
  { id: "empresa", label: "Empresa" },
];

const COLORS = ["#000000","#1a1a2e","#16213e","#e63946","#2a9d8f","#e9c46a","#6a4c93","#f4a261","#264653","#ffffff"];

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
    setTimeout(() => { const c = el.querySelector("canvas"); if (c) setImgSrc(c.toDataURL("image/png")); }, 150);
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
  const padding = Math.round(size * 0.05);
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

// ── Export Modal ─────────────────────────────────────
function ExportModal({ qr, slugPrefix, onClose }) {
  // URL que se graba en el QR físico exportado
  const physicalUrl = qr.slug && qr.slugDomain
    ? `https://${qr.slugDomain}/${slugPrefix}/${qr.slug}`
    : `${BASE_URL}${qr.id}`;
  const exportSize = 512;
  const padding = Math.round(exportSize * 0.05);
  const innerSize = exportSize - padding * 2;
  const src = useQRImage(physicalUrl, innerSize, qr.fgColor, qr.bgColor);

  const buildCanvas = () => new Promise(resolve => {
    if (!src) return resolve(null);
    const canvas = document.createElement("canvas");
    canvas.width = exportSize; canvas.height = exportSize;
    const ctx = canvas.getContext("2d");
    ctx.fillStyle = qr.bgColor || "#ffffff";
    ctx.fillRect(0, 0, exportSize, exportSize);
    const img = new Image();
    img.onload = () => { ctx.drawImage(img, padding, padding, innerSize, innerSize); resolve(canvas); };
    img.src = src;
  });

  const downloadPNG = async () => {
    const c = await buildCanvas(); if (!c) return;
    const a = document.createElement("a"); a.download = `QR_${qr.id}.png`; a.href = c.toDataURL("image/png"); a.click();
  };
  const downloadSVG = async () => {
    const c = await buildCanvas(); if (!c) return;
    const svg = `<svg xmlns="http://www.w3.org/2000/svg" width="512" height="512"><image href="${c.toDataURL()}" width="512" height="512"/></svg>`;
    const a = document.createElement("a"); a.download = `QR_${qr.id}.svg`; a.href = URL.createObjectURL(new Blob([svg], { type: "image/svg+xml" })); a.click();
  };

  const friendlyUrl = qr.slug && qr.slugDomain ? `https://${qr.slugDomain}/${slugPrefix}/${qr.slug}` : null;

  return (
    <div style={{ position: "fixed", inset: 0, background: "rgba(0,0,0,0.5)", display: "flex", alignItems: "center", justifyContent: "center", zIndex: 200 }}>
      <div style={{ background: "var(--color-background-primary)", border: "0.5px solid var(--color-border-tertiary)", borderRadius: "var(--border-radius-lg)", padding: "1.5rem", width: 360, maxWidth: "92vw" }}>
        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 16 }}>
          <span style={{ fontWeight: 500, fontSize: 15 }}>Exportar QR — {qr.label}</span>
          <button onClick={onClose} style={iconBtn}>×</button>
        </div>
        <div style={{ display: "flex", justifyContent: "center", marginBottom: 12 }}>
          <div style={{ background: qr.bgColor || "#fff", padding: 8, borderRadius: 8, border: "0.5px solid var(--color-border-tertiary)" }}>
            <QRImage value={physicalUrl} size={180} fgColor={qr.fgColor} bgColor={qr.bgColor} />
          </div>
        </div>
        <div style={{ background: "var(--color-background-secondary)", borderRadius: "var(--border-radius-md)", padding: "10px 12px", marginBottom: 14 }}>
          <p style={{ fontSize: 11, color: "var(--color-text-tertiary)", margin: "0 0 3px", textTransform: "uppercase", letterSpacing: "0.05em" }}>URL grabada en el QR</p>
          <p style={{ fontSize: 11, fontFamily: "var(--font-mono)", color: qr.slug ? "var(--color-text-info)" : "var(--color-text-secondary)", margin: 0, wordBreak: "break-all" }}>{physicalUrl}</p>
          <p style={{ fontSize: 11, color: "var(--color-text-tertiary)", margin: "8px 0 3px", textTransform: "uppercase", letterSpacing: "0.05em" }}>Destino final</p>
          <p style={{ fontSize: 11, fontFamily: "var(--font-mono)", color: "var(--color-text-secondary)", margin: 0, wordBreak: "break-all" }}>{qr.destUrl}</p>
        </div>
        <div style={{ display: "flex", gap: 8 }}>
          <button onClick={downloadPNG} disabled={!src} style={solidBtn(!src, "#1a1a2e")}>Descargar PNG</button>
          <button onClick={downloadSVG} disabled={!src} style={solidBtn(!src, "#264653")}>Descargar SVG</button>
        </div>
      </div>
    </div>
  );
}

// ── Delete Modal ──────────────────────────────────────
function DeleteModal({ qr, onConfirm, onClose }) {
  return (
    <div style={{ position: "fixed", inset: 0, background: "rgba(0,0,0,0.5)", display: "flex", alignItems: "center", justifyContent: "center", zIndex: 200 }}>
      <div style={{ background: "var(--color-background-primary)", border: "0.5px solid var(--color-border-tertiary)", borderRadius: "var(--border-radius-lg)", padding: "1.5rem", width: 320, maxWidth: "92vw" }}>
        <p style={{ fontWeight: 500, fontSize: 15, marginBottom: 8 }}>Eliminar QR</p>
        <p style={{ fontSize: 13, color: "var(--color-text-secondary)", marginBottom: 20 }}>
          ¿Seguro que quieres eliminar <strong>{qr.label}</strong>? Esta acción no se puede deshacer.
        </p>
        <div style={{ display: "flex", gap: 8 }}>
          <button onClick={onClose} style={outlineBtn}>Cancelar</button>
          <button onClick={onConfirm} style={solidBtn(false, "#e63946")}>Eliminar</button>
        </div>
      </div>
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
    setLoading(true); setError(null);
    try {
      await apiFetch("/api/login", { method: "POST", body: JSON.stringify({ username, password }) });
      onLogin();
    } catch (e) { setError(e.message === "__UNAUTH__" ? "Credenciales incorrectas" : e.message); }
    finally { setLoading(false); }
  };

  return (
    <div style={{ minHeight: "100vh", display: "flex", alignItems: "center", justifyContent: "center", background: "var(--color-background-tertiary)" }}>
      <div style={{ background: "var(--color-background-primary)", border: "0.5px solid var(--color-border-tertiary)", borderRadius: "var(--border-radius-lg)", padding: "2rem", width: 340, maxWidth: "92vw" }}>
        <div style={{ textAlign: "center", marginBottom: 24 }}>
          <div style={{ width: 48, height: 48, background: "#1a1a2e", borderRadius: 12, margin: "0 auto 12px", display: "flex", alignItems: "center", justifyContent: "center" }}>
            <svg width="24" height="24" viewBox="0 0 24 24" fill="none">
              <rect x="3" y="3" width="8" height="8" rx="1" fill="white"/><rect x="5" y="5" width="4" height="4" fill="#1a1a2e"/>
              <rect x="13" y="3" width="8" height="8" rx="1" fill="white"/><rect x="15" y="5" width="4" height="4" fill="#1a1a2e"/>
              <rect x="3" y="13" width="8" height="8" rx="1" fill="white"/><rect x="5" y="15" width="4" height="4" fill="#1a1a2e"/>
              <rect x="13" y="13" width="3" height="3" fill="white"/><rect x="18" y="13" width="3" height="3" fill="white"/>
              <rect x="13" y="18" width="3" height="3" fill="white"/><rect x="18" y="18" width="3" height="3" fill="white"/>
            </svg>
          </div>
          <p style={{ fontSize: 20, fontWeight: 500, margin: 0 }}>QR Manager</p>
          <p style={{ fontSize: 13, color: "var(--color-text-secondary)", margin: "4px 0 0" }}>qr.iorana.dev</p>
        </div>
        {error && <div style={{ background: "var(--color-background-danger)", border: "0.5px solid var(--color-border-danger)", borderRadius: "var(--border-radius-md)", padding: "8px 12px", marginBottom: 14, fontSize: 13, color: "var(--color-text-danger)" }}>{error}</div>}
        <label style={labelStyle}>Usuario</label>
        <input value={username} onChange={e => setUsername(e.target.value)} style={{ width: "100%", boxSizing: "border-box", marginBottom: 12 }} onKeyDown={e => e.key === "Enter" && handleSubmit()} autoFocus />
        <label style={labelStyle}>Contraseña</label>
        <input type="password" value={password} onChange={e => setPassword(e.target.value)} style={{ width: "100%", boxSizing: "border-box", marginBottom: 20 }} onKeyDown={e => e.key === "Enter" && handleSubmit()} />
        <button onClick={handleSubmit} disabled={loading || !username || !password} style={solidBtn(loading || !username || !password, "#1a1a2e", true)}>
          {loading ? "Entrando…" : "Entrar"}
        </button>
      </div>
    </div>
  );
}

// ── Color Picker ──────────────────────────────────────
function ColorPicker({ value, onChange, small = false }) {
  const sz = small ? 20 : 22;
  return (
    <div style={{ display: "flex", flexWrap: "wrap", gap: 4, alignItems: "center" }}>
      {COLORS.map(c => (
        <button key={c} onClick={() => onChange(c)} title={c} style={{ width: sz, height: sz, borderRadius: "50%", background: c, border: value === c ? "2.5px solid var(--color-text-primary)" : "1px solid var(--color-border-secondary)", cursor: "pointer", padding: 0, flexShrink: 0, boxSizing: "border-box", outline: value === c ? "2px solid var(--color-background-primary)" : "none", outlineOffset: "-3px" }} />
      ))}
      <input type="color" value={value} onChange={e => onChange(e.target.value)} title="Personalizado" style={{ width: sz, height: sz, border: "1px solid var(--color-border-secondary)", borderRadius: "50%", padding: 0, cursor: "pointer", background: "none", overflow: "hidden" }} />
    </div>
  );
}

// ── Shared styles ─────────────────────────────────────
const labelStyle = { fontSize: 13, color: "var(--color-text-secondary)", display: "block", marginBottom: 4 };
const iconBtn = { background: "none", border: "none", fontSize: 22, cursor: "pointer", color: "var(--color-text-secondary)", lineHeight: 1, padding: "0 2px" };
const outlineBtn = { flex: 1, padding: "8px 0", fontSize: 13, cursor: "pointer", borderRadius: "var(--border-radius-md)", border: "0.5px solid var(--color-border-secondary)", background: "var(--color-background-primary)", color: "var(--color-text-primary)" };
const solidBtn = (disabled = false, bg = "#1a1a2e", full = false) => ({
  width: full ? "100%" : undefined, flex: full ? undefined : 1,
  padding: "9px 16px", fontSize: 13, fontWeight: 500,
  cursor: disabled ? "not-allowed" : "pointer",
  opacity: disabled ? 0.45 : 1,
  borderRadius: "var(--border-radius-md)",
  border: "none",
  background: disabled ? "var(--color-background-secondary)" : bg,
  color: disabled ? "var(--color-text-tertiary)" : "#ffffff",
});

// ── App ───────────────────────────────────────────────
export default function App() {
  const [authed, setAuthed] = useState(null);
  const [qrs, setQrs] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [domains, setDomains] = useState(["iorana.digital"]);
  const [slugPrefix, setSlugPrefix] = useState("r");

  const [tabs, setTabs] = useState(() => {
    try { return JSON.parse(localStorage.getItem(TABS_KEY)) || DEFAULT_TABS; } catch { return DEFAULT_TABS; }
  });
  const [activeTab, setActiveTab] = useState(null);
  const [newTabName, setNewTabName] = useState("");
  const [showNewTab, setShowNewTab] = useState(false);

  // Formulario creación
  const [showForm, setShowForm] = useState(false);
  const [destUrl, setDestUrl] = useState("");
  const [label, setLabel] = useState("");
  const [fgColor, setFgColor] = useState("#000000");
  const [bgColor, setBgColor] = useState("#ffffff");
  const [slug, setSlug] = useState("");
  const [slugDomain, setSlugDomain] = useState("iorana.digital");
  const [creating, setCreating] = useState(false);

  // Edición
  const [editId, setEditId] = useState(null);
  const [editUrl, setEditUrl] = useState("");
  const [editLabel, setEditLabel] = useState("");
  const [editFg, setEditFg] = useState("#000000");
  const [editBg, setEditBg] = useState("#ffffff");
  const [editSlug, setEditSlug] = useState("");
  const [editSlugDomain, setEditSlugDomain] = useState("iorana.digital");
  const [saving, setSaving] = useState(false);

  const [exportTarget, setExportTarget] = useState(null);
  const [deleteTarget, setDeleteTarget] = useState(null);
  const [copied, setCopied] = useState(null);

  useEffect(() => {
    localStorage.setItem(TABS_KEY, JSON.stringify(tabs));
    if (!activeTab && tabs.length > 0) setActiveTab(tabs[0].id);
  }, [tabs]);

  useEffect(() => {
    apiFetch("/api/me").then(() => setAuthed(true)).catch(() => setAuthed(false));
  }, []);

  useEffect(() => {
    if (!authed) return;
    Promise.all([apiFetch(API), apiFetch("/api/domains")])
      .then(([qrData, domainData]) => {
        setQrs(qrData.map(normalize));
        const doms = domainData.domains || [domainData[0] || "iorana.digital"];
        setDomains(doms);
        setSlugPrefix(domainData.prefix || "r");
        setSlugDomain(doms[0]);
        setEditSlugDomain(doms[0]);
      })
      .catch(e => { if (e.message === "__UNAUTH__") setAuthed(false); else setError(e.message); })
      .finally(() => setLoading(false));
  }, [authed]);

  const normalize = r => ({
    id: r.id,
    label: r.label,
    destUrl: r.dest_url,
    fgColor: r.fg_color || "#000000",
    bgColor: r.bg_color || "#ffffff",
    createdAt: r.created_at,
    tab: r.tab || tabs[0]?.id || "general",
    slug: r.slug || "",
    slugDomain: r.slug_domain || "",
  });

  const handleLogout = async () => {
    await apiFetch("/api/logout", { method: "POST" });
    setAuthed(false); setQrs([]);
  };

  const resetForm = () => {
    setDestUrl(""); setLabel(""); setFgColor("#000000"); setBgColor("#ffffff"); setSlug(""); setShowForm(false);
  };

  const handleCreate = async () => {
    if (!destUrl.trim()) return;
    setCreating(true); setError(null);
    const id = generateId();
    try {
      await apiFetch(API, {
        method: "POST",
        body: JSON.stringify({ id, label: label.trim() || `QR #${id}`, destUrl: destUrl.trim(), fgColor, bgColor, tab: activeTab, slug: slug.trim() || null, slugDomain: slug.trim() ? slugDomain : null }),
      });
      setQrs(prev => [{ id, label: label.trim() || `QR #${id}`, destUrl: destUrl.trim(), fgColor, bgColor, createdAt: new Date().toISOString(), tab: activeTab, slug: slug.trim(), slugDomain: slug.trim() ? slugDomain : "" }, ...prev]);
      resetForm();
    } catch (e) { if (e.message === "__UNAUTH__") setAuthed(false); else setError(e.message); }
    finally { setCreating(false); }
  };

  const handleSaveEdit = async (id) => {
    if (!editUrl.trim()) return;
    setSaving(true);
    try {
      await apiFetch(`${API}/${id}`, {
        method: "PUT",
        body: JSON.stringify({ destUrl: editUrl.trim(), label: editLabel.trim(), fgColor: editFg, bgColor: editBg, slug: editSlug.trim() || null, slugDomain: editSlug.trim() ? editSlugDomain : null }),
      });
      setQrs(prev => prev.map(q => q.id === id
        ? { ...q, destUrl: editUrl.trim(), label: editLabel.trim(), fgColor: editFg, bgColor: editBg, slug: editSlug.trim(), slugDomain: editSlug.trim() ? editSlugDomain : "" }
        : q
      ));
      setEditId(null);
    } catch (e) { if (e.message === "__UNAUTH__") setAuthed(false); else setError(e.message); }
    finally { setSaving(false); }
  };

  const handleDelete = async (id) => {
    try {
      await apiFetch(`${API}/${id}`, { method: "DELETE" });
      setQrs(prev => prev.filter(q => q.id !== id));
      setDeleteTarget(null);
    } catch (e) { if (e.message === "__UNAUTH__") setAuthed(false); else setError(e.message); }
  };

  const handleAddTab = () => {
    if (!newTabName.trim()) return;
    const id = newTabName.trim().toLowerCase().replace(/\s+/g, "-");
    if (tabs.find(t => t.id === id)) return;
    const newTabs = [...tabs, { id, label: newTabName.trim() }];
    setTabs(newTabs); setActiveTab(id); setNewTabName(""); setShowNewTab(false);
  };

  const handleRemoveTab = (tabId) => {
    if (tabs.length <= 1) return;
    const newTabs = tabs.filter(t => t.id !== tabId);
    setTabs(newTabs); if (activeTab === tabId) setActiveTab(newTabs[0].id);
  };

  const handleCopy = (text, key) => {
    navigator.clipboard.writeText(text).then(() => { setCopied(key); setTimeout(() => setCopied(null), 1500); });
  };

  const shortUrl = id => `${BASE_URL}${id}`;

  // URL que se graba físicamente en el QR
  // Si tiene slug amigable → usa esa (el usuario la ve al escanear)
  // Si no tiene slug → fallback a la URL corta
  const qrPhysicalUrl = (qr) =>
    qr.slug && qr.slugDomain
      ? `https://${qr.slugDomain}/${slugPrefix}/${qr.slug}`
      : shortUrl(qr.id);
  const visibleQrs = qrs.filter(q => q.tab === activeTab);

  if (authed === null) return <div style={{ minHeight: "100vh", display: "flex", alignItems: "center", justifyContent: "center" }}><span style={{ fontSize: 13, color: "var(--color-text-tertiary)" }}>Cargando…</span></div>;
  if (!authed) return <LoginScreen onLogin={() => setAuthed(true)} />;

  return (
    <div style={{ maxWidth: 860, margin: "0 auto", padding: "0 1rem 2rem", fontFamily: "var(--font-sans)" }}>

      {/* Header */}
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", padding: "1.25rem 0 1rem", borderBottom: "0.5px solid var(--color-border-tertiary)" }}>
        <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
          <div style={{ width: 34, height: 34, background: "#1a1a2e", borderRadius: 8, display: "flex", alignItems: "center", justifyContent: "center" }}>
            <svg width="20" height="20" viewBox="0 0 24 24" fill="none">
              <rect x="3" y="3" width="8" height="8" rx="1" fill="white"/><rect x="5" y="5" width="4" height="4" fill="#1a1a2e"/>
              <rect x="13" y="3" width="8" height="8" rx="1" fill="white"/><rect x="15" y="5" width="4" height="4" fill="#1a1a2e"/>
              <rect x="3" y="13" width="8" height="8" rx="1" fill="white"/><rect x="5" y="15" width="4" height="4" fill="#1a1a2e"/>
              <rect x="13" y="13" width="3" height="3" fill="white"/><rect x="18" y="13" width="3" height="3" fill="white"/>
              <rect x="13" y="18" width="3" height="3" fill="white"/><rect x="18" y="18" width="3" height="3" fill="white"/>
            </svg>
          </div>
          <div>
            <p style={{ fontSize: 15, fontWeight: 500, margin: 0 }}>QR Manager</p>
            <p style={{ fontSize: 11, color: "var(--color-text-tertiary)", margin: 0 }}>qr.iorana.dev</p>
          </div>
        </div>
        <div style={{ display: "flex", gap: 8 }}>
          <button onClick={() => { setShowForm(v => !v); setEditId(null); }} style={{ ...solidBtn(false, "#1a1a2e"), padding: "7px 16px", display: "flex", alignItems: "center", gap: 6 }}>
            <span style={{ fontSize: 18, lineHeight: 1 }}>{showForm ? "−" : "+"}</span> Nuevo QR
          </button>
          <button onClick={handleLogout} style={{ ...outlineBtn, padding: "7px 14px", flex: "none" }}>Cerrar sesión</button>
        </div>
      </div>

      {/* Error */}
      {error && (
        <div style={{ background: "var(--color-background-danger)", border: "0.5px solid var(--color-border-danger)", borderRadius: "var(--border-radius-md)", padding: "10px 14px", margin: "12px 0", fontSize: 13, color: "var(--color-text-danger)", display: "flex", justifyContent: "space-between" }}>
          {error}
          <button onClick={() => setError(null)} style={{ background: "none", border: "none", cursor: "pointer", color: "var(--color-text-danger)", fontSize: 16, lineHeight: 1 }}>×</button>
        </div>
      )}

      {/* Formulario nuevo QR */}
      {showForm && (
        <div style={{ background: "var(--color-background-secondary)", border: "0.5px solid var(--color-border-tertiary)", borderRadius: "var(--border-radius-lg)", padding: "1.25rem", margin: "16px 0" }}>
          <p style={{ fontSize: 11, fontWeight: 500, color: "var(--color-text-tertiary)", marginBottom: 14, textTransform: "uppercase", letterSpacing: "0.06em" }}>
            Nuevo QR → {tabs.find(t => t.id === activeTab)?.label}
          </p>
          <div style={{ display: "grid", gridTemplateColumns: "1fr auto", gap: 20, alignItems: "start" }}>
            <div style={{ display: "flex", flexDirection: "column", gap: 12 }}>
              <div>
                <label style={labelStyle}>Etiqueta</label>
                <input value={label} onChange={e => setLabel(e.target.value)} placeholder="Ej: Menú restaurante" style={{ width: "100%", boxSizing: "border-box" }} />
              </div>
              <div>
                <label style={labelStyle}>URL amigable <span style={{ fontSize: 11, background: "var(--color-background-info)", color: "var(--color-text-info)", borderRadius: 4, padding: "1px 6px", marginLeft: 4 }}>opcional</span></label>
                <div style={{ display: "flex", gap: 8, alignItems: "center", marginBottom: 6 }}>
                  <select value={slugDomain} onChange={e => setSlugDomain(e.target.value)} style={{ fontSize: 13, padding: "6px 8px", borderRadius: "var(--border-radius-md)", border: "0.5px solid var(--color-border-secondary)", background: "var(--color-background-primary)", color: "var(--color-text-primary)", flexShrink: 0 }}>
                    {domains.map(d => <option key={d} value={d}>{d}</option>)}
                  </select>
                  <span style={{ fontSize: 13, color: "var(--color-text-tertiary)", flexShrink: 0 }}>/{slugPrefix}/</span>
                  <input value={slug} onChange={e => setSlug(e.target.value.replace(/\s+/g, "-").toLowerCase())} placeholder="vcard/nombre" style={{ flex: 1, fontSize: 13 }} />
                </div>
                {slug && (
                  <div style={{ background: "var(--color-background-info)", borderRadius: "var(--border-radius-md)", padding: "5px 10px" }}>
                    <span style={{ fontSize: 11, fontFamily: "var(--font-mono)", color: "var(--color-text-info)" }}>https://{slugDomain}/{slugPrefix}/{slug}</span>
                  </div>
                )}
              </div>
              <div>
                <label style={labelStyle}>URL destino final</label>
                <input value={destUrl} onChange={e => setDestUrl(e.target.value)} onKeyDown={e => e.key === "Enter" && handleCreate()} placeholder="https://ejemplo.com" style={{ width: "100%", boxSizing: "border-box" }} />
              </div>
              <div style={{ display: "flex", gap: 20 }}>
                <div><label style={labelStyle}>Color QR</label><ColorPicker value={fgColor} onChange={setFgColor} /></div>
                <div><label style={labelStyle}>Fondo</label><ColorPicker value={bgColor} onChange={setBgColor} /></div>
              </div>
              <div style={{ display: "flex", gap: 8 }}>
                <button onClick={handleCreate} disabled={!destUrl.trim() || creating} style={solidBtn(!destUrl.trim() || creating, "#1a1a2e")}>{creating ? "Generando…" : "Generar QR"}</button>
                <button onClick={resetForm} style={outlineBtn}>Cancelar</button>
              </div>
            </div>
            {/* Preview */}
            <div style={{ display: "flex", flexDirection: "column", alignItems: "center", gap: 6 }}>
              <span style={{ fontSize: 11, color: "var(--color-text-tertiary)" }}>Vista previa</span>
              {destUrl
                ? <div style={{ border: "0.5px solid var(--color-border-tertiary)", borderRadius: 8, padding: 6, background: bgColor }}><QRImage value={destUrl} size={130} fgColor={fgColor} bgColor={bgColor} /></div>
                : <div style={{ width: 142, height: 142, border: "0.5px dashed var(--color-border-tertiary)", borderRadius: 8, display: "flex", alignItems: "center", justifyContent: "center" }}><span style={{ fontSize: 11, color: "var(--color-text-tertiary)", textAlign: "center", padding: "0 12px" }}>Escribe una URL para previsualizar</span></div>
              }
            </div>
          </div>
        </div>
      )}

      {/* Pestañas */}
      <div style={{ display: "flex", alignItems: "center", borderBottom: "0.5px solid var(--color-border-tertiary)", marginTop: showForm ? 0 : 16, overflowX: "auto" }}>
        {tabs.map(tab => (
          <div key={tab.id} style={{ display: "flex", alignItems: "center", gap: 4, padding: "10px 16px", cursor: "pointer", borderBottom: activeTab === tab.id ? "2px solid #1a1a2e" : "2px solid transparent", marginBottom: "-0.5px", whiteSpace: "nowrap" }} onClick={() => setActiveTab(tab.id)}>
            <span style={{ fontSize: 13, fontWeight: activeTab === tab.id ? 500 : 400, color: activeTab === tab.id ? "var(--color-text-primary)" : "var(--color-text-secondary)" }}>{tab.label}</span>
            <span style={{ fontSize: 11, background: "var(--color-background-secondary)", color: "var(--color-text-tertiary)", borderRadius: 10, padding: "1px 6px" }}>{qrs.filter(q => q.tab === tab.id).length}</span>
            {tabs.length > 1 && <button onClick={e => { e.stopPropagation(); handleRemoveTab(tab.id); }} style={{ background: "none", border: "none", cursor: "pointer", color: "var(--color-text-tertiary)", fontSize: 14, lineHeight: 1, padding: "0 0 0 2px", opacity: 0.5 }}>×</button>}
          </div>
        ))}
        {showNewTab ? (
          <div style={{ display: "flex", alignItems: "center", gap: 6, padding: "6px 12px" }}>
            <input value={newTabName} onChange={e => setNewTabName(e.target.value)} onKeyDown={e => { if (e.key === "Enter") handleAddTab(); if (e.key === "Escape") setShowNewTab(false); }} placeholder="Nombre…" style={{ fontSize: 13, width: 120, padding: "4px 8px" }} autoFocus />
            <button onClick={handleAddTab} style={{ ...solidBtn(false, "#1a1a2e"), flex: "none", padding: "4px 10px", fontSize: 12 }}>Añadir</button>
            <button onClick={() => setShowNewTab(false)} style={{ ...outlineBtn, flex: "none", padding: "4px 8px", fontSize: 12 }}>×</button>
          </div>
        ) : (
          <button onClick={() => setShowNewTab(true)} style={{ background: "none", border: "none", cursor: "pointer", color: "var(--color-text-tertiary)", fontSize: 13, padding: "10px 14px", whiteSpace: "nowrap" }}>+ Nueva pestaña</button>
        )}
      </div>

      {/* Lista QRs */}
      <div style={{ marginTop: 16 }}>
        {loading && <p style={{ fontSize: 13, color: "var(--color-text-tertiary)", textAlign: "center", padding: "2rem 0" }}>Cargando…</p>}
        {!loading && visibleQrs.length === 0 && (
          <div style={{ textAlign: "center", padding: "3rem 0" }}>
            <p style={{ fontSize: 14, color: "var(--color-text-tertiary)", marginBottom: 12 }}>No hay QRs en esta pestaña.</p>
            <button onClick={() => setShowForm(true)} style={{ ...solidBtn(false, "#1a1a2e"), flex: "none", display: "inline-block" }}>+ Crear primer QR</button>
          </div>
        )}

        <div style={{ display: "flex", flexDirection: "column", gap: 10 }}>
          {visibleQrs.map(qr => (
            <div key={qr.id} style={{ background: "var(--color-background-primary)", border: "0.5px solid var(--color-border-tertiary)", borderRadius: "var(--border-radius-lg)", padding: "1rem 1.25rem", display: "grid", gridTemplateColumns: "auto 1fr", gap: 14, alignItems: "start" }}>

              {/* QR miniatura */}
              <div style={{ border: "0.5px solid var(--color-border-tertiary)", borderRadius: 8, background: qr.bgColor || "#fff", cursor: "pointer", overflow: "hidden" }} onClick={() => setExportTarget(qr)} title="Click para exportar">
                <QRImage value={qrPhysicalUrl(qr)} size={76} fgColor={qr.fgColor} bgColor={qr.bgColor} />
              </div>

              <div style={{ minWidth: 0 }}>
                {/* Cabecera — título + fecha */}
                <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 8 }}>
                  {editId === qr.id
                    ? <input value={editLabel} onChange={e => setEditLabel(e.target.value)} style={{ fontSize: 14, fontWeight: 500, flex: 1, marginRight: 8 }} />
                    : <span style={{ fontWeight: 500, fontSize: 14 }}>{qr.label}</span>}
                  <span style={{ fontSize: 11, color: "var(--color-text-tertiary)", whiteSpace: "nowrap", marginLeft: 8 }}>{new Date(qr.createdAt).toLocaleDateString("es-ES")}</span>
                </div>

                {/* Modo vista — tres URLs */}
                {editId !== qr.id && (
                  <div style={{ marginBottom: 10, display: "flex", flexDirection: "column", gap: 4 }}>

                    <div style={{ display: "flex", alignItems: "center", gap: 6 }}>
                      <span style={{ fontSize: 10, color: "var(--color-text-tertiary)", flexShrink: 0, width: 60, textAlign: "right" }}>QR físico</span>
                      <span style={{ fontSize: 11, fontFamily: "var(--font-mono)", background: qr.slug ? "var(--color-background-info)" : "var(--color-background-secondary)", padding: "2px 8px", borderRadius: 4, color: qr.slug ? "var(--color-text-info)" : "var(--color-text-secondary)", overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap", flex: 1 }}>{qrPhysicalUrl(qr)}</span>
                      <button onClick={() => handleCopy(qrPhysicalUrl(qr), qr.id + "_s")} style={{ fontSize: 11, padding: "2px 8px", border: "0.5px solid var(--color-border-secondary)", borderRadius: 4, cursor: "pointer", background: "var(--color-background-primary)", color: "var(--color-text-secondary)", whiteSpace: "nowrap" }}>{copied === qr.id + "_s" ? "✓" : "Copiar"}</button>
                    </div>

                    <div style={{ display: "flex", alignItems: "center", gap: 6 }}>
                      <span style={{ fontSize: 10, color: "var(--color-text-tertiary)", flexShrink: 0, width: 60, textAlign: "right" }}>Ve usuario</span>
                      {qr.slug ? (
                        <>
                          <span style={{ fontSize: 11, fontFamily: "var(--font-mono)", background: "var(--color-background-info)", padding: "2px 8px", borderRadius: 4, color: "var(--color-text-info)", overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap", flex: 1 }}>
                            https://{qr.slugDomain}/{slugPrefix}/{qr.slug}
                          </span>
                          <button onClick={() => handleCopy(`https://${qr.slugDomain}/${slugPrefix}/${qr.slug}`, qr.id + "_f")} style={{ fontSize: 11, padding: "2px 8px", border: "0.5px solid var(--color-border-secondary)", borderRadius: 4, cursor: "pointer", background: "var(--color-background-primary)", color: "var(--color-text-secondary)", whiteSpace: "nowrap" }}>{copied === qr.id + "_f" ? "✓" : "Copiar"}</button>
                        </>
                      ) : (
                        <span style={{ fontSize: 11, color: "var(--color-text-tertiary)", fontStyle: "italic" }}>Sin URL amigable</span>
                      )}
                    </div>

                    <div style={{ display: "flex", alignItems: "center", gap: 6 }}>
                      <span style={{ fontSize: 10, color: "var(--color-text-tertiary)", flexShrink: 0, width: 60, textAlign: "right" }}>Destino</span>
                      <span style={{ fontSize: 11, color: "var(--color-text-secondary)", overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap", flex: 1 }}>→ {qr.destUrl}</span>
                      <button onClick={() => handleCopy(qr.destUrl, qr.id + "_d")} style={{ fontSize: 11, padding: "2px 8px", border: "0.5px solid var(--color-border-secondary)", borderRadius: 4, cursor: "pointer", background: "var(--color-background-primary)", color: "var(--color-text-secondary)", whiteSpace: "nowrap" }}>{copied === qr.id + "_d" ? "✓" : "Copiar"}</button>
                    </div>

                  </div>
                )}

                {/* Modo edición */}
                {editId === qr.id ? (
                  <div style={{ display: "flex", flexDirection: "column", gap: 10 }}>

                    <div>
                      <label style={labelStyle}>Etiqueta</label>
                      <input value={editLabel} onChange={e => setEditLabel(e.target.value)} style={{ width: "100%", boxSizing: "border-box", fontSize: 13 }} />
                    </div>

                    <div>
                      <label style={labelStyle}>URL amigable <span style={{ fontSize: 11, background: "var(--color-background-info)", color: "var(--color-text-info)", borderRadius: 4, padding: "1px 6px", marginLeft: 4 }}>opcional</span></label>
                      <div style={{ display: "flex", gap: 8, alignItems: "center", marginBottom: 6 }}>
                        <select value={editSlugDomain} onChange={e => setEditSlugDomain(e.target.value)} style={{ fontSize: 13, padding: "6px 8px", borderRadius: "var(--border-radius-md)", border: "0.5px solid var(--color-border-secondary)", background: "var(--color-background-primary)", color: "var(--color-text-primary)", flexShrink: 0 }}>
                          {domains.map(d => <option key={d} value={d}>{d}</option>)}
                        </select>
                        <span style={{ fontSize: 13, color: "var(--color-text-tertiary)", flexShrink: 0 }}>/{slugPrefix}/</span>
                        <input value={editSlug} onChange={e => setEditSlug(e.target.value.replace(/\s+/g, "-").toLowerCase())} placeholder="vcard/nombre" style={{ flex: 1, fontSize: 13 }} />
                      </div>
                      {editSlug && (
                        <div style={{ background: "var(--color-background-info)", borderRadius: "var(--border-radius-md)", padding: "5px 10px", marginBottom: 4 }}>
                          <span style={{ fontSize: 11, fontFamily: "var(--font-mono)", color: "var(--color-text-info)" }}>
                            https://{editSlugDomain}/{slugPrefix}/{editSlug}
                          </span>
                        </div>
                      )}
                    </div>

                    <div>
                      <label style={labelStyle}>URL destino final</label>
                      <input value={editUrl} onChange={e => setEditUrl(e.target.value)} placeholder="https://ejemplo.com" style={{ width: "100%", boxSizing: "border-box", fontSize: 13 }} />
                    </div>

                    <div style={{ display: "flex", gap: 16 }}>
                      <div><label style={{ ...labelStyle, fontSize: 12 }}>Color QR</label><ColorPicker value={editFg} onChange={setEditFg} small /></div>
                      <div><label style={{ ...labelStyle, fontSize: 12 }}>Fondo</label><ColorPicker value={editBg} onChange={setEditBg} small /></div>
                    </div>

                    <div style={{ display: "flex", gap: 8 }}>
                      <button onClick={() => handleSaveEdit(qr.id)} disabled={saving} style={solidBtn(saving, "#1a1a2e")}>{saving ? "Guardando…" : "Guardar cambios"}</button>
                      <button onClick={() => setEditId(null)} style={outlineBtn}>Cancelar</button>
                    </div>

                  </div>
                ) : (
                  /* Botones de acción */
                  <div style={{ display: "flex", alignItems: "center", justifyContent: "flex-end", gap: 6 }}>
                    <button onClick={() => { setEditId(qr.id); setEditUrl(qr.destUrl); setEditLabel(qr.label); setEditFg(qr.fgColor); setEditBg(qr.bgColor); setEditSlug(qr.slug || ""); setEditSlugDomain(qr.slugDomain || domains[0]); }} style={{ fontSize: 12, padding: "5px 14px", border: "0.5px solid var(--color-border-secondary)", borderRadius: "var(--border-radius-md)", cursor: "pointer", background: "var(--color-background-primary)", color: "var(--color-text-primary)", whiteSpace: "nowrap" }}>Editar</button>
                    <button onClick={() => setExportTarget(qr)} style={{ fontSize: 12, padding: "5px 14px", border: "0.5px solid var(--color-border-secondary)", borderRadius: "var(--border-radius-md)", cursor: "pointer", background: "var(--color-background-primary)", color: "var(--color-text-primary)", whiteSpace: "nowrap" }}>Exportar</button>
                    <button onClick={() => setDeleteTarget(qr)} style={{ fontSize: 12, padding: "5px 12px", border: "0.5px solid var(--color-border-danger)", borderRadius: "var(--border-radius-md)", cursor: "pointer", background: "var(--color-background-primary)", color: "var(--color-text-danger)", whiteSpace: "nowrap" }}>Eliminar</button>
                  </div>
                )}
              </div>
            </div>
          ))}
        </div>
      </div>

      {exportTarget && <ExportModal qr={exportTarget} slugPrefix={slugPrefix} onClose={() => setExportTarget(null)} />}
      {deleteTarget && <DeleteModal qr={deleteTarget} onConfirm={() => handleDelete(deleteTarget.id)} onClose={() => setDeleteTarget(null)} />}
    </div>
  );
}
