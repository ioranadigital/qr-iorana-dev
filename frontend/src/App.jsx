import { useState, useEffect, useCallback } from "react";

const BASE_URL = "https://qr.iorana.dev/go/";
const API = "/api/qrs";
const TABS_KEY = "qr_tabs";

const DEFAULT_TABS = [
  { id: "clientes", label: "Clientes" },
  { id: "empresa", label: "Empresa" },
];

const COLORS = ["#000000","#1a1a2e","#16213e","#e63946","#2a9d8f","#e9c46a","#6a4c93","#f4a261","#264653","#ffffff"];

// ── Brand tokens ─────────────────────────────────────
const B = {
  bg:       "#08223A",
  surface:  "#161b27",
  card:     "#0A2B49",
  border:   "#2a3348",
  orange:   "#ff8c22",
  orangeD:  "#ea580c",
  text:     "#ffffff",
  muted:    "#ffffff",
  dim:      "#64748b",
};

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
    new window.QRCode(el, { text: value, width: size, height: size, colorDark: fgColor, colorLight: bgColor, correctLevel: window.QRCode.CorrectLevel.M });
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
  return (
    <div style={{ width: size, height: size, background: bgColor, borderRadius: 8, display: "flex", alignItems: "center", justifyContent: "center", flexShrink: 0 }}>
      {src
        ? <img src={src} width={innerSize} height={innerSize} style={{ display: "block" }} alt="QR" />
        : <span style={{ fontSize: 10, color: "#9ca3af" }}>…</span>}
    </div>
  );
}

// ── Export Modal ─────────────────────────────────────
function ExportModal({ qr, slugPrefix, onClose }) {
  const physicalUrl = qr.slug && qr.slugDomain
    ? `https://${qr.slugDomain}/${slugPrefix}/${qr.slug}`
    : `${BASE_URL}${qr.id}`;
  const exportSize = 512;
  const padding = Math.round(exportSize * 0.06);
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

  const downloadPNG = async () => { const c = await buildCanvas(); if (!c) return; const a = document.createElement("a"); a.download = `QR_${qr.id}.png`; a.href = c.toDataURL("image/png"); a.click(); };
  const downloadSVG = async () => { const c = await buildCanvas(); if (!c) return; const svg = `<svg xmlns="http://www.w3.org/2000/svg" width="512" height="512"><image href="${c.toDataURL()}" width="512" height="512"/></svg>`; const a = document.createElement("a"); a.download = `QR_${qr.id}.svg`; a.href = URL.createObjectURL(new Blob([svg], { type: "image/svg+xml" })); a.click(); };

  return (
    <div style={{ position: "fixed", inset: 0, background: "rgba(0,0,0,0.75)", display: "flex", alignItems: "center", justifyContent: "center", zIndex: 200 }}>
      <div style={{ background: B.card, border: `1px solid ${B.border}`, borderRadius: 16, padding: "1.5rem", width: 380, maxWidth: "92vw" }}>
        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 20 }}>
          <span style={{ fontWeight: 700, fontSize: 16, color: B.text }}>Exportar QR</span>
          <button onClick={onClose} style={{ background: "none", border: "none", fontSize: 22, cursor: "pointer", color: B.muted, lineHeight: 1 }}>×</button>
        </div>

        {/* QR con fondo blanco visible */}
        <div style={{ display: "flex", justifyContent: "center", marginBottom: 16 }}>
          <div style={{ background: "#ffffff", padding: 16, borderRadius: 12, boxShadow: "0 0 0 1px rgba(255,255,255,0.1)" }}>
            <QRImage value={physicalUrl} size={200} fgColor={qr.fgColor} bgColor={qr.bgColor} />
          </div>
        </div>

        <div style={{ background: B.surface, borderRadius: 10, padding: "12px 14px", marginBottom: 16 }}>
          <p style={{ fontSize: 10, color: B.dim, margin: "0 0 3px", textTransform: "uppercase", letterSpacing: "0.08em" }}>URL grabada en el QR</p>
          <p style={{ fontSize: 11, fontFamily: "monospace", color: qr.slug ? B.orange : B.muted, margin: "0 0 10px", wordBreak: "break-all" }}>{physicalUrl}</p>
          <p style={{ fontSize: 10, color: B.dim, margin: "0 0 3px", textTransform: "uppercase", letterSpacing: "0.08em" }}>Destino final</p>
          <p style={{ fontSize: 11, fontFamily: "monospace", color: B.muted, margin: 0, wordBreak: "break-all" }}>{qr.destUrl}</p>
        </div>

        <div style={{ display: "flex", gap: 8 }}>
          <button onClick={downloadPNG} disabled={!src} style={orangeBtn(!src)}>Descargar PNG</button>
          <button onClick={downloadSVG} disabled={!src} style={ghostBtn(!src)}>Descargar SVG</button>
        </div>
      </div>
    </div>
  );
}

// ── Delete Modal ──────────────────────────────────────
function DeleteModal({ qr, onConfirm, onClose }) {
  return (
    <div style={{ position: "fixed", inset: 0, background: "rgba(0,0,0,0.75)", display: "flex", alignItems: "center", justifyContent: "center", zIndex: 200 }}>
      <div style={{ background: B.card, border: `1px solid ${B.border}`, borderRadius: 16, padding: "1.5rem", width: 340, maxWidth: "92vw" }}>
        <p style={{ fontWeight: 700, fontSize: 16, color: B.text, marginBottom: 8 }}>Eliminar QR</p>
        <p style={{ fontSize: 13, color: B.muted, marginBottom: 20 }}>¿Seguro que quieres eliminar <strong style={{ color: B.text }}>{qr.label}</strong>? Esta acción no se puede deshacer.</p>
        <div style={{ display: "flex", gap: 8 }}>
          <button onClick={onClose} style={ghostBtn()}>Cancelar</button>
          <button onClick={onConfirm} style={{ ...orangeBtn(), background: "#e63946", flex: 1 }}>Eliminar</button>
        </div>
      </div>
    </div>
  );
}

// ── Move Modal ────────────────────────────────────────
function MoveModal({ qr, tabs, onMove, onClose }) {
  const [selected, setSelected] = useState(qr.tab);
  return (
    <div style={{ position: "fixed", inset: 0, background: "rgba(0,0,0,0.75)", display: "flex", alignItems: "center", justifyContent: "center", zIndex: 200 }}>
      <div style={{ background: B.card, border: `1px solid ${B.border}`, borderRadius: 16, padding: "1.5rem", width: 340, maxWidth: "92vw" }}>
        <p style={{ fontWeight: 700, fontSize: 16, color: B.text, marginBottom: 8 }}>Mover QR</p>
        <p style={{ fontSize: 13, color: B.muted, marginBottom: 16 }}>Selecciona la pestaña destino para <strong style={{ color: B.text }}>{qr.label}</strong></p>
        <div style={{ display: "flex", flexDirection: "column", gap: 8, marginBottom: 20 }}>
          {tabs.map(tab => (
            <button key={tab.id} onClick={() => setSelected(tab.id)} style={{ padding: "10px 14px", borderRadius: 8, border: `1px solid ${selected === tab.id ? B.orange : B.border}`, background: selected === tab.id ? "rgba(249,115,22,0.1)" : B.surface, color: selected === tab.id ? B.orange : B.muted, cursor: "pointer", textAlign: "left", fontSize: 13, fontWeight: selected === tab.id ? 600 : 400, display: "flex", alignItems: "center", gap: 8 }}>
              {selected === tab.id && <span style={{ color: B.orange }}>✓</span>}
              {tab.label}
              {tab.id === qr.tab && <span style={{ fontSize: 11, color: B.dim, marginLeft: "auto" }}>actual</span>}
            </button>
          ))}
        </div>
        <div style={{ display: "flex", gap: 8 }}>
          <button onClick={onClose} style={ghostBtn()}>Cancelar</button>
          <button onClick={() => onMove(selected)} disabled={selected === qr.tab} style={orangeBtn(selected === qr.tab)}>Mover</button>
        </div>
      </div>
    </div>
  );
}

// ── Login ─────────────────────────────────────────────
function LoginScreen({ onLogin }) {
  const [username, setUsername] = useState("");
  const [password, setPassword] = useState("");
  const [showPass, setShowPass] = useState(false);
  const [error, setError] = useState(null);
  const [loading, setLoading] = useState(false);
  const [time, setTime] = useState(new Date().toLocaleTimeString("es-ES", { hour: "2-digit", minute: "2-digit", second: "2-digit" }));

  useEffect(() => {
    const t = setInterval(() => setTime(new Date().toLocaleTimeString("es-ES", { hour: "2-digit", minute: "2-digit", second: "2-digit" })), 1000);
    return () => clearInterval(t);
  }, []);

  const handleSubmit = async () => {
    if (!username || !password) return;
    setLoading(true); setError(null);
    try { await apiFetch("/api/login", { method: "POST", body: JSON.stringify({ username, password }) }); onLogin(); }
    catch (e) { setError(e.message === "__UNAUTH__" ? "Credenciales incorrectas" : e.message); }
    finally { setLoading(false); }
  };

  return (
    <div style={{ minHeight: "100vh", display: "flex", alignItems: "center", justifyContent: "center", background: B.bg, fontFamily: "var(--font-sans)" }}>
      <div style={{ background: B.surface, border: `1px solid ${B.border}`, borderRadius: 20, padding: "2.5rem 2rem", width: 380, maxWidth: "92vw", position: "relative", overflow: "hidden" }}>

        {/* Accent line top */}
        <div style={{ position: "absolute", top: 0, left: 0, right: 0, height: 3, background: `linear-gradient(90deg, ${B.orange}, ${B.orangeD})`, borderRadius: "20px 20px 0 0" }} />

        {/* Badge */}
        <div style={{ display: "inline-flex", alignItems: "center", gap: 6, background: "rgba(249,115,22,0.12)", border: `1px solid rgba(249,115,22,0.3)`, borderRadius: 20, padding: "4px 12px", marginBottom: 20 }}>
          <div style={{ width: 7, height: 7, borderRadius: "50%", background: B.orange }} />
          <span style={{ fontSize: 11, color: B.orange, fontWeight: 600, textTransform: "uppercase", letterSpacing: "0.08em" }}>Entorno privado</span>
        </div>

        <h1 style={{ fontSize: 26, fontWeight: 800, color: B.text, margin: "0 0 4px", lineHeight: 1.2 }}>Accede al</h1>
        <h1 style={{ fontSize: 26, fontWeight: 800, color: B.orange, margin: "0 0 6px", lineHeight: 1.2, fontStyle: "italic" }}>portal interno.</h1>
        <p style={{ fontSize: 13, color: B.dim, margin: "0 0 28px" }}>Área exclusiva de gestión · iorana.dev</p>

        {error && (
          <div style={{ background: "rgba(230,57,70,0.12)", border: "1px solid rgba(230,57,70,0.3)", borderRadius: 8, padding: "10px 14px", marginBottom: 16, fontSize: 13, color: "#f87171" }}>{error}</div>
        )}

        <label style={loginLabel}>Usuario</label>
        <input value={username} onChange={e => setUsername(e.target.value)} onKeyDown={e => e.key === "Enter" && handleSubmit()} placeholder="Introduce tu usuario" autoFocus style={loginInput} />

        <label style={loginLabel}>Contraseña</label>
        <div style={{ position: "relative", marginBottom: 24 }}>
          <input type={showPass ? "text" : "password"} value={password} onChange={e => setPassword(e.target.value)} onKeyDown={e => e.key === "Enter" && handleSubmit()} placeholder="Introduce tu contraseña" style={{ ...loginInput, marginBottom: 0, paddingRight: 44 }} />
          <button onClick={() => setShowPass(v => !v)} style={{ position: "absolute", right: 12, top: "50%", transform: "translateY(-50%)", background: "none", border: "none", cursor: "pointer", color: B.dim, fontSize: 16 }}>
            {showPass ? "🙈" : "👁"}
          </button>
        </div>

        <button onClick={handleSubmit} disabled={loading || !username || !password} style={{ width: "100%", padding: "13px", fontSize: 14, fontWeight: 700, cursor: loading || !username || !password ? "not-allowed" : "pointer", opacity: loading || !username || !password ? 0.5 : 1, borderRadius: 10, border: "none", background: `linear-gradient(135deg, ${B.orange}, ${B.orangeD})`, color: "#fff", letterSpacing: "0.05em", textTransform: "uppercase" }}>
          {loading ? "Verificando…" : "Acceder →"}
        </button>

        <div style={{ display: "flex", justifyContent: "space-between", marginTop: 20, paddingTop: 16, borderTop: `1px solid ${B.border}` }}>
          <span style={{ fontSize: 11, color: B.dim }}>Estado <span style={{ color: "#4ade80", fontWeight: 600 }}>ONLINE</span></span>
          <span style={{ fontSize: 11, color: B.dim, fontFamily: "monospace" }}>{time}</span>
        </div>
      </div>
    </div>
  );
}

// ── Slug Field con dos inputs ─────────────────────────
function SlugField({ slugDomain, setSlugDomain, domains, slugPrefix, value, onChange }) {
  const parts = value ? value.split("/") : ["", ""];
  const cat = parts[0] || "";
  const name = parts.slice(1).join("/") || "";

  const update = (newCat, newName) => {
    const combined = newName ? `${newCat}/${newName}` : newCat;
    onChange(combined.replace(/\s+/g, "-").replace(/[^a-z0-9\-\/]/gi, "").replace(/\/+$/, "").toLowerCase());
  };

  const friendlyUrl = value && slugDomain ? `https://${slugDomain}/${slugPrefix}/${value}` : null;

  return (
    <div>
      <label style={fieldLabel}>URL amigable <span style={{ fontSize: 10, color: B.orange, background: "rgba(249,115,22,0.1)", borderRadius: 4, padding: "1px 6px", marginLeft: 4 }}>opcional</span></label>
      <div style={{ display: "flex", gap: 6, alignItems: "center", marginBottom: 6, flexWrap: "wrap" }}>
        <select value={slugDomain} onChange={e => setSlugDomain(e.target.value)} style={{ ...fieldInput, width: "auto", flexShrink: 0, flex: "none" }}>
          {domains.map(d => <option key={d} value={d}>{d}</option>)}
        </select>
        <span style={{ fontSize: 13, color: B.dim, flexShrink: 0 }}>/{slugPrefix}/</span>
        <input
          value={cat}
          onChange={e => update(e.target.value, name)}
          placeholder="vcard"
          style={{ ...fieldInput, flex: 1, minWidth: 70 }}
        />
        <span style={{ fontSize: 16, color: B.dim, flexShrink: 0, fontWeight: 700 }}>/</span>
        <input
          value={name}
          onChange={e => update(cat, e.target.value)}
          placeholder="nombre"
          style={{ ...fieldInput, flex: 1, minWidth: 70 }}
        />
      </div>
      {friendlyUrl && (
        <div style={{ background: "rgba(249,115,22,0.08)", border: "1px solid rgba(249,115,22,0.2)", borderRadius: 8, padding: "6px 10px" }}>
          <span style={{ fontSize: 11, fontFamily: "monospace", color: B.orange }}>{friendlyUrl}</span>
        </div>
      )}
      {!value && <p style={{ fontSize: 11, color: B.dim, margin: "4px 0 0" }}>Deja vacío para usar solo la URL corta del sistema.</p>}
    </div>
  );
}
function ColorPicker({ value, onChange, small = false }) {
  const sz = small ? 20 : 22;
  return (
    <div style={{ display: "flex", flexWrap: "wrap", gap: 5, alignItems: "center" }}>
      {COLORS.map(c => (
        <button key={c} onClick={() => onChange(c)} style={{ width: sz, height: sz, borderRadius: "50%", background: c, border: value === c ? `2.5px solid ${B.orange}` : `1px solid ${B.border}`, cursor: "pointer", padding: 0, flexShrink: 0, boxSizing: "border-box", outline: value === c ? `2px solid ${B.surface}` : "none", outlineOffset: "-3px" }} />
      ))}
      <input type="color" value={value} onChange={e => onChange(e.target.value)} style={{ width: sz, height: sz, border: `1px solid ${B.border}`, borderRadius: "50%", padding: 0, cursor: "pointer", background: "none", overflow: "hidden" }} />
    </div>
  );
}

// ── Shared styles ─────────────────────────────────────
const loginLabel = { fontSize: 11, color: B.dim, display: "block", marginBottom: 6, textTransform: "uppercase", letterSpacing: "0.08em", fontWeight: 600 };
const loginInput = { width: "100%", boxSizing: "border-box", marginBottom: 16, background: B.card, border: `1px solid ${B.border}`, borderRadius: 10, padding: "12px 14px", fontSize: 14, color: B.text, outline: "none" };
const fieldLabel = { fontSize: 11, color: B.dim, display: "block", marginBottom: 5, textTransform: "uppercase", letterSpacing: "0.06em", fontWeight: 600 };
const fieldInput = { width: "100%", boxSizing: "border-box", background: B.card, border: `1px solid ${B.border}`, borderRadius: 8, padding: "9px 12px", fontSize: 13, color: B.text, outline: "none" };
const orangeBtn = (disabled = false) => ({ flex: 1, padding: "10px 16px", fontSize: 13, fontWeight: 700, cursor: disabled ? "not-allowed" : "pointer", opacity: disabled ? 0.4 : 1, borderRadius: 8, border: "none", background: disabled ? B.surface : `linear-gradient(135deg, ${B.orange}, ${B.orangeD})`, color: disabled ? B.dim : "#fff" });
const ghostBtn = (disabled = false) => ({ flex: 1, padding: "10px 16px", fontSize: 13, fontWeight: 600, cursor: disabled ? "not-allowed" : "pointer", opacity: disabled ? 0.4 : 1, borderRadius: 8, border: `1px solid ${B.border}`, background: "transparent", color: disabled ? B.dim : B.muted });

// ── App ───────────────────────────────────────────────
export default function App() {
  const [authed, setAuthed] = useState(null);
  const [qrs, setQrs] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [domains, setDomains] = useState(["iorana.digital"]);
  const [slugPrefix, setSlugPrefix] = useState("r");

  const [tabs, setTabs] = useState(() => { try { return JSON.parse(localStorage.getItem(TABS_KEY)) || DEFAULT_TABS; } catch { return DEFAULT_TABS; } });
  const [activeTab, setActiveTab] = useState(null);
  const [newTabName, setNewTabName] = useState("");
  const [showNewTab, setShowNewTab] = useState(false);

  const [showForm, setShowForm] = useState(false);
  const [destUrl, setDestUrl] = useState("");
  const [label, setLabel] = useState("");
  const [fgColor, setFgColor] = useState("#000000");
  const [bgColor, setBgColor] = useState("#ffffff");
  const [slug, setSlug] = useState("");
  const [slugDomain, setSlugDomain] = useState("iorana.digital");
  const [creating, setCreating] = useState(false);

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
  const [moveTarget, setMoveTarget] = useState(null);
  const [copied, setCopied] = useState(null);

  useEffect(() => { localStorage.setItem(TABS_KEY, JSON.stringify(tabs)); if (!activeTab && tabs.length > 0) setActiveTab(tabs[0].id); }, [tabs]);
  useEffect(() => { apiFetch("/api/me").then(() => setAuthed(true)).catch(() => setAuthed(false)); }, []);
  useEffect(() => {
    if (!authed) return;
    Promise.all([apiFetch(API), apiFetch("/api/domains")])
      .then(([qrData, domainData]) => {
        setQrs(qrData.map(normalize));
        const doms = domainData.domains || ["iorana.digital"];
        setDomains(doms); setSlugPrefix(domainData.prefix || "r");
        setSlugDomain(doms[0]); setEditSlugDomain(doms[0]);
      })
      .catch(e => { if (e.message === "__UNAUTH__") setAuthed(false); else setError(e.message); })
      .finally(() => setLoading(false));
  }, [authed]);

  const normalize = r => ({ id: r.id, label: r.label, destUrl: r.dest_url, fgColor: r.fg_color || "#000000", bgColor: r.bg_color || "#ffffff", createdAt: r.created_at, tab: r.tab || tabs[0]?.id || "general", slug: r.slug || "", slugDomain: r.slug_domain || "" });

  const handleLogout = async () => { await apiFetch("/api/logout", { method: "POST" }); setAuthed(false); setQrs([]); };
  const resetForm = () => { setDestUrl(""); setLabel(""); setFgColor("#000000"); setBgColor("#ffffff"); setSlug(""); setShowForm(false); };

  const handleCreate = async () => {
    if (!destUrl.trim()) return;
    setCreating(true); setError(null);
    const id = generateId();
    try {
      await apiFetch(API, { method: "POST", body: JSON.stringify({ id, label: label.trim() || `QR #${id}`, destUrl: destUrl.trim(), fgColor, bgColor, tab: activeTab, slug: slug.trim() || null, slugDomain: slug.trim() ? slugDomain : null }) });
      setQrs(prev => [{ id, label: label.trim() || `QR #${id}`, destUrl: destUrl.trim(), fgColor, bgColor, createdAt: new Date().toISOString(), tab: activeTab, slug: slug.trim(), slugDomain: slug.trim() ? slugDomain : "" }, ...prev]);
      resetForm();
    } catch (e) { if (e.message === "__UNAUTH__") setAuthed(false); else setError(e.message); }
    finally { setCreating(false); }
  };

  const handleSaveEdit = async (id) => {
    if (!editUrl.trim()) return;
    setSaving(true);
    try {
      await apiFetch(`${API}/${id}`, { method: "PUT", body: JSON.stringify({ destUrl: editUrl.trim(), label: editLabel.trim(), fgColor: editFg, bgColor: editBg, slug: editSlug.trim() || null, slugDomain: editSlug.trim() ? editSlugDomain : null }) });
      setQrs(prev => prev.map(q => q.id === id ? { ...q, destUrl: editUrl.trim(), label: editLabel.trim(), fgColor: editFg, bgColor: editBg, slug: editSlug.trim(), slugDomain: editSlug.trim() ? editSlugDomain : "" } : q));
      setEditId(null);
    } catch (e) { if (e.message === "__UNAUTH__") setAuthed(false); else setError(e.message); }
    finally { setSaving(false); }
  };

  const handleDelete = async (id) => {
    try { await apiFetch(`${API}/${id}`, { method: "DELETE" }); setQrs(prev => prev.filter(q => q.id !== id)); setDeleteTarget(null); }
    catch (e) { if (e.message === "__UNAUTH__") setAuthed(false); else setError(e.message); }
  };

  const handleMove = async (qr, newTab) => {
    try {
      await apiFetch(`${API}/${qr.id}`, { method: "PUT", body: JSON.stringify({ destUrl: qr.destUrl, label: qr.label, fgColor: qr.fgColor, bgColor: qr.bgColor, slug: qr.slug || null, slugDomain: qr.slugDomain || null, tab: newTab }) });
      setQrs(prev => prev.map(q => q.id === qr.id ? { ...q, tab: newTab } : q));
      setMoveTarget(null);
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

  const handleCopy = (text, key) => { navigator.clipboard.writeText(text).then(() => { setCopied(key); setTimeout(() => setCopied(null), 1500); }); };
  const shortUrl = id => `${BASE_URL}${id}`;
  const qrPhysicalUrl = qr => qr.slug && qr.slugDomain ? `https://${qr.slugDomain}/${slugPrefix}/${qr.slug}` : shortUrl(qr.id);
  const visibleQrs = qrs.filter(q => q.tab === activeTab);

  if (authed === null) return <div style={{ minHeight: "100vh", display: "flex", alignItems: "center", justifyContent: "center", background: B.bg }}><span style={{ fontSize: 13, color: B.muted }}>Cargando…</span></div>;
  if (!authed) return <LoginScreen onLogin={() => setAuthed(true)} />;

  return (
    <div style={{ minHeight: "100vh", background: B.bg, fontFamily: "var(--font-sans)", color: B.text }}>

      {/* Header */}
      <div style={{ background: B.surface, borderBottom: `1px solid ${B.border}`, padding: "0 2rem" }}>
        <div style={{ maxWidth: 900, margin: "0 auto", display: "flex", justifyContent: "space-between", alignItems: "center", height: 60 }}>
          <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
            <div style={{ width: 34, height: 34, background: `linear-gradient(135deg, ${B.orange}, ${B.orangeD})`, borderRadius: 8, display: "flex", alignItems: "center", justifyContent: "center" }}>
              <svg width="18" height="18" viewBox="0 0 24 24" fill="none">
                <rect x="3" y="3" width="8" height="8" rx="1" fill="white"/><rect x="5" y="5" width="4" height="4" fill="#f97316"/>
                <rect x="13" y="3" width="8" height="8" rx="1" fill="white"/><rect x="15" y="5" width="4" height="4" fill="#f97316"/>
                <rect x="3" y="13" width="8" height="8" rx="1" fill="white"/><rect x="5" y="15" width="4" height="4" fill="#f97316"/>
                <rect x="13" y="13" width="3" height="3" fill="white"/><rect x="18" y="13" width="3" height="3" fill="white"/>
                <rect x="13" y="18" width="3" height="3" fill="white"/><rect x="18" y="18" width="3" height="3" fill="white"/>
              </svg>
            </div>
            <div>
              <p style={{ fontSize: 14, fontWeight: 700, margin: 0, color: B.text }}>QR Manager</p>
              <p style={{ fontSize: 11, color: B.dim, margin: 0 }}>iorana.dev</p>
            </div>
          </div>
          <div style={{ display: "flex", gap: 8, alignItems: "center" }}>
            <button onClick={() => { setShowForm(v => !v); setEditId(null); }} style={{ ...orangeBtn(false), flex: "none", display: "flex", alignItems: "center", gap: 6, padding: "8px 18px" }}>
              <span style={{ fontSize: 18, lineHeight: 1 }}>{showForm ? "−" : "+"}</span> Nuevo QR
            </button>
            <button onClick={handleLogout} style={{ ...ghostBtn(), flex: "none", padding: "8px 14px" }}>Salir</button>
          </div>
        </div>
      </div>

      <div style={{ maxWidth: 900, margin: "0 auto", padding: "1.5rem 2rem" }}>

        {/* Error */}
        {error && (
          <div style={{ background: "rgba(230,57,70,0.1)", border: "1px solid rgba(230,57,70,0.3)", borderRadius: 10, padding: "10px 14px", marginBottom: 16, fontSize: 13, color: "#f87171", display: "flex", justifyContent: "space-between" }}>
            {error}
            <button onClick={() => setError(null)} style={{ background: "none", border: "none", cursor: "pointer", color: "#f87171", fontSize: 16, lineHeight: 1 }}>×</button>
          </div>
        )}

        {/* Formulario */}
        {showForm && (
          <div style={{ background: B.card, border: `1px solid ${B.border}`, borderRadius: 14, padding: "1.25rem", marginBottom: 20 }}>
            <p style={{ fontSize: 11, fontWeight: 700, color: B.orange, marginBottom: 16, textTransform: "uppercase", letterSpacing: "0.08em" }}>
              + Nuevo QR → {tabs.find(t => t.id === activeTab)?.label}
            </p>
            <div style={{ display: "grid", gridTemplateColumns: "1fr auto", gap: 20, alignItems: "start" }}>
              <div style={{ display: "flex", flexDirection: "column", gap: 12 }}>
                <div>
                  <label style={fieldLabel}>Etiqueta</label>
                  <input value={label} onChange={e => setLabel(e.target.value)} placeholder="Ej: Menú restaurante" style={fieldInput} />
                </div>
                <div>
                  <label style={fieldLabel}>URL amigable <span style={{ fontSize: 10, color: B.orange, background: "rgba(249,115,22,0.1)", borderRadius: 4, padding: "1px 6px", marginLeft: 4 }}>opcional</span></label>
                  <div style={{ display: "flex", gap: 8, alignItems: "center", marginBottom: 6 }}>
                    <select value={slugDomain} onChange={e => setSlugDomain(e.target.value)} style={{ ...fieldInput, width: "auto", flexShrink: 0 }}>
                      {domains.map(d => <option key={d} value={d}>{d}</option>)}
                    </select>
                    <span style={{ fontSize: 13, color: B.dim }}>/{slugPrefix}/</span>
                    <input value={slug} onChange={e => setSlug(e.target.value.replace(/\s+/g, "-").replace(/[^a-z0-9\-\/]/gi, "").replace(/\/+$/, "").toLowerCase())} placeholder="vcard/ricardo" style={{ ...fieldInput, flex: 1 }} />
                  </div>
                  {slug && <div style={{ background: "rgba(249,115,22,0.08)", border: "1px solid rgba(249,115,22,0.2)", borderRadius: 8, padding: "6px 10px" }}><span style={{ fontSize: 11, fontFamily: "monospace", color: B.orange }}>https://{slugDomain}/{slugPrefix}/{slug}</span></div>}
                </div>
                <div>
                  <label style={fieldLabel}>URL destino final</label>
                  <input value={destUrl} onChange={e => setDestUrl(e.target.value)} onKeyDown={e => e.key === "Enter" && handleCreate()} placeholder="https://ejemplo.com" style={fieldInput} />
                </div>
                <div style={{ display: "flex", gap: 20 }}>
                  <div><label style={fieldLabel}>Color QR</label><ColorPicker value={fgColor} onChange={setFgColor} /></div>
                  <div><label style={fieldLabel}>Fondo</label><ColorPicker value={bgColor} onChange={setBgColor} /></div>
                </div>
                <div style={{ display: "flex", gap: 8 }}>
                  <button onClick={handleCreate} disabled={!destUrl.trim() || creating} style={orangeBtn(!destUrl.trim() || creating)}>{creating ? "Generando…" : "Generar QR"}</button>
                  <button onClick={resetForm} style={ghostBtn()}>Cancelar</button>
                </div>
              </div>
              <div style={{ display: "flex", flexDirection: "column", alignItems: "center", gap: 8 }}>
                <span style={{ fontSize: 11, color: B.dim, textTransform: "uppercase", letterSpacing: "0.06em" }}>Vista previa</span>
                <div style={{ background: bgColor, padding: 10, borderRadius: 10, border: `1px solid ${B.border}` }}>
                  {destUrl
                    ? <QRImage value={destUrl} size={130} fgColor={fgColor} bgColor={bgColor} />
                    : <div style={{ width: 130, height: 130, display: "flex", alignItems: "center", justifyContent: "center" }}><span style={{ fontSize: 11, color: B.dim, textAlign: "center" }}>Escribe una URL</span></div>}
                </div>
              </div>
            </div>
          </div>
        )}

        {/* Pestañas */}
        <div style={{ display: "flex", alignItems: "center", borderBottom: `1px solid ${B.border}`, marginBottom: 16, overflowX: "auto" }}>
          {tabs.map(tab => (
            <div key={tab.id} style={{ display: "flex", alignItems: "center", gap: 6, padding: "10px 16px", cursor: "pointer", borderBottom: activeTab === tab.id ? `2px solid ${B.orange}` : "2px solid transparent", marginBottom: "-1px", whiteSpace: "nowrap" }} onClick={() => setActiveTab(tab.id)}>
              <span style={{ fontSize: 13, fontWeight: activeTab === tab.id ? 700 : 400, color: activeTab === tab.id ? B.orange : B.muted }}>{tab.label}</span>
              <span style={{ fontSize: 11, background: activeTab === tab.id ? "rgba(249,115,22,0.15)" : B.card, color: activeTab === tab.id ? B.orange : B.dim, borderRadius: 10, padding: "1px 7px" }}>{qrs.filter(q => q.tab === tab.id).length}</span>
              {tabs.length > 1 && <button onClick={e => { e.stopPropagation(); handleRemoveTab(tab.id); }} style={{ background: "none", border: "none", cursor: "pointer", color: B.dim, fontSize: 14, lineHeight: 1, padding: "0 0 0 2px", opacity: 0.5 }}>×</button>}
            </div>
          ))}
          {showNewTab ? (
            <div style={{ display: "flex", alignItems: "center", gap: 6, padding: "6px 12px" }}>
              <input value={newTabName} onChange={e => setNewTabName(e.target.value)} onKeyDown={e => { if (e.key === "Enter") handleAddTab(); if (e.key === "Escape") setShowNewTab(false); }} placeholder="Nombre…" style={{ ...fieldInput, width: 120, padding: "4px 8px", fontSize: 13 }} autoFocus />
              <button onClick={handleAddTab} style={{ ...orangeBtn(false), flex: "none", padding: "5px 12px", fontSize: 12 }}>Añadir</button>
              <button onClick={() => setShowNewTab(false)} style={{ ...ghostBtn(), flex: "none", padding: "5px 8px", fontSize: 12 }}>×</button>
            </div>
          ) : (
            <button onClick={() => setShowNewTab(true)} style={{ background: "none", border: "none", cursor: "pointer", color: B.dim, fontSize: 13, padding: "10px 14px", whiteSpace: "nowrap" }}>+ Nueva pestaña</button>
          )}
        </div>

        {/* Lista QRs */}
        {loading && <p style={{ fontSize: 13, color: B.dim, textAlign: "center", padding: "3rem 0" }}>Cargando…</p>}
        {!loading && visibleQrs.length === 0 && (
          <div style={{ textAlign: "center", padding: "4rem 0" }}>
            <p style={{ fontSize: 14, color: B.dim, marginBottom: 16 }}>No hay QRs en esta pestaña.</p>
            <button onClick={() => setShowForm(true)} style={{ ...orangeBtn(false), flex: "none", display: "inline-block" }}>+ Crear primer QR</button>
          </div>
        )}

        <div style={{ display: "flex", flexDirection: "column", gap: 10 }}>
          {visibleQrs.map(qr => (
            <div key={qr.id} style={{ background: B.card, border: `1px solid ${B.border}`, borderRadius: 14, padding: "1rem 1.25rem", display: "grid", gridTemplateColumns: "auto 1fr", gap: 14, alignItems: "start" }}>

              {/* QR miniatura */}
              <div style={{ background: qr.bgColor || "#fff", borderRadius: 10, padding: 6, cursor: "pointer", border: `1px solid ${B.border}` }} onClick={() => setExportTarget(qr)} title="Click para exportar">
                <QRImage value={qrPhysicalUrl(qr)} size={72} fgColor={qr.fgColor} bgColor={qr.bgColor} />
              </div>

              <div style={{ minWidth: 0 }}>
                {/* Título + fecha */}
                <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 8 }}>
                  {editId === qr.id
                    ? <input value={editLabel} onChange={e => setEditLabel(e.target.value)} style={{ ...fieldInput, fontSize: 14, fontWeight: 700, flex: 1, marginRight: 8 }} />
                    : <span style={{ fontWeight: 700, fontSize: 14, color: B.text }}>{qr.label}</span>}
                  <span style={{ fontSize: 11, color: B.dim, whiteSpace: "nowrap", marginLeft: 8 }}>{new Date(qr.createdAt).toLocaleDateString("es-ES")}</span>
                </div>

                {/* Vista — tres URLs */}
                {editId !== qr.id && (
                  <div style={{ marginBottom: 10, display: "flex", flexDirection: "column", gap: 4 }}>
                    {[
                      { label: "QR físico", value: qrPhysicalUrl(qr), key: "_s", highlight: !!qr.slug },
                      { label: "Ve usuario", value: qr.slug ? `https://${qr.slugDomain}/${slugPrefix}/${qr.slug}` : null, key: "_f", highlight: true },
                      { label: "Destino", value: qr.destUrl, key: "_d", highlight: false },
                    ].map(row => row.value && (
                      <div key={row.key} style={{ display: "flex", alignItems: "center", gap: 6 }}>
                        <span style={{ fontSize: 10, color: B.dim, flexShrink: 0, width: 60, textAlign: "right", textTransform: "uppercase", letterSpacing: "0.05em" }}>{row.label}</span>
                        <span style={{ fontSize: 11, fontFamily: "monospace", background: row.highlight ? "rgba(249,115,22,0.08)" : B.surface, border: `1px solid ${row.highlight ? "rgba(249,115,22,0.2)" : B.border}`, padding: "2px 8px", borderRadius: 6, color: row.highlight ? B.orange : B.muted, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap", flex: 1 }}>{row.value}</span>
                        <button onClick={() => handleCopy(row.value, qr.id + row.key)} style={{ fontSize: 11, padding: "2px 8px", border: `1px solid ${B.border}`, borderRadius: 6, cursor: "pointer", background: "transparent", color: B.dim, whiteSpace: "nowrap" }}>{copied === qr.id + row.key ? "✓" : "Copiar"}</button>
                      </div>
                    ))}
                    {!qr.slug && (
                      <div style={{ display: "flex", alignItems: "center", gap: 6 }}>
                        <span style={{ fontSize: 10, color: B.dim, flexShrink: 0, width: 60, textAlign: "right", textTransform: "uppercase", letterSpacing: "0.05em" }}>Ve usuario</span>
                        <span style={{ fontSize: 11, color: B.dim, fontStyle: "italic" }}>Sin URL amigable</span>
                      </div>
                    )}
                  </div>
                )}

                {/* Modo edición */}
                {editId === qr.id ? (
                  <div style={{ display: "flex", flexDirection: "column", gap: 10 }}>
                    <div>
                      <label style={fieldLabel}>URL amigable <span style={{ fontSize: 10, color: B.orange, background: "rgba(249,115,22,0.1)", borderRadius: 4, padding: "1px 6px", marginLeft: 4 }}>opcional</span></label>
                      <div style={{ display: "flex", gap: 8, alignItems: "center", marginBottom: 6 }}>
                        <select value={editSlugDomain} onChange={e => setEditSlugDomain(e.target.value)} style={{ ...fieldInput, width: "auto", flexShrink: 0 }}>
                          {domains.map(d => <option key={d} value={d}>{d}</option>)}
                        </select>
                        <span style={{ fontSize: 13, color: B.dim }}>/{slugPrefix}/</span>
                        <input value={editSlug} onChange={e => setEditSlug(e.target.value.replace(/\s+/g, "-").replace(/\/+$/, "").toLowerCase())} placeholder="vcard/nombre" style={{ ...fieldInput, flex: 1 }} />
                      </div>
                      {editSlug && <div style={{ background: "rgba(249,115,22,0.08)", border: "1px solid rgba(249,115,22,0.2)", borderRadius: 8, padding: "6px 10px", marginBottom: 4 }}><span style={{ fontSize: 11, fontFamily: "monospace", color: B.orange }}>https://{editSlugDomain}/{slugPrefix}/{editSlug}</span></div>}
                    </div>
                    <div>
                      <label style={fieldLabel}>URL destino final</label>
                      <input value={editUrl} onChange={e => setEditUrl(e.target.value)} style={fieldInput} />
                    </div>
                    <div style={{ display: "flex", gap: 16 }}>
                      <div><label style={fieldLabel}>Color QR</label><ColorPicker value={editFg} onChange={setEditFg} small /></div>
                      <div><label style={fieldLabel}>Fondo</label><ColorPicker value={editBg} onChange={setEditBg} small /></div>
                    </div>
                    <div style={{ display: "flex", gap: 8 }}>
                      <button onClick={() => handleSaveEdit(qr.id)} disabled={saving} style={orangeBtn(saving)}>{saving ? "Guardando…" : "Guardar cambios"}</button>
                      <button onClick={() => setEditId(null)} style={ghostBtn()}>Cancelar</button>
                    </div>
                  </div>
                ) : (
                  <div style={{ display: "flex", alignItems: "center", justifyContent: "flex-end", gap: 6 }}>
                    <button onClick={() => { setEditId(qr.id); setEditUrl(qr.destUrl); setEditLabel(qr.label); setEditFg(qr.fgColor); setEditBg(qr.bgColor); setEditSlug(qr.slug || ""); setEditSlugDomain(qr.slugDomain || domains[0]); }} style={{ fontSize: 12, padding: "5px 12px", border: `1px solid ${B.border}`, borderRadius: 8, cursor: "pointer", background: "transparent", color: B.muted }}>Editar</button>
                    <button onClick={() => setMoveTarget(qr)} style={{ fontSize: 12, padding: "5px 12px", border: `1px solid ${B.border}`, borderRadius: 8, cursor: "pointer", background: "transparent", color: B.muted }}>Mover</button>
                    <button onClick={() => setExportTarget(qr)} style={{ fontSize: 12, padding: "5px 12px", border: `1px solid ${B.border}`, borderRadius: 8, cursor: "pointer", background: "transparent", color: B.muted }}>Exportar</button>
                    <button onClick={() => setDeleteTarget(qr)} style={{ fontSize: 12, padding: "5px 12px", border: "1px solid rgba(230,57,70,0.3)", borderRadius: 8, cursor: "pointer", background: "transparent", color: "#f87171" }}>Eliminar</button>
                  </div>
                )}
              </div>
            </div>
          ))}
        </div>
      </div>

      {exportTarget && <ExportModal qr={exportTarget} slugPrefix={slugPrefix} onClose={() => setExportTarget(null)} />}
      {deleteTarget && <DeleteModal qr={deleteTarget} onConfirm={() => handleDelete(deleteTarget.id)} onClose={() => setDeleteTarget(null)} />}
      {moveTarget && <MoveModal qr={moveTarget} tabs={tabs} onMove={(newTab) => handleMove(moveTarget, newTab)} onClose={() => setMoveTarget(null)} />}
    </div>
  );
}