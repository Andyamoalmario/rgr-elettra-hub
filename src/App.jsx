import { useState, useEffect, useRef } from "react";

// ─── CONFIG ───────────────────────────────────────────────────────────────────
const APPS_SCRIPT_URL = "https://script.google.com/macros/s/AKfycbyC6K7iR_RhRn1CNxcawlzoUGOhiBXFjDldV3qn1YEcDaEMxwH3ugZyL7At5DCWGlpE/exec";
const DIPENDENTE_COLORS = [
  "#00b894","#0984e3","#e17055","#6c5ce7","#fdcb6e","#00cec9","#fd79a8","#55efc4"
];

const INITIAL_USERS = [
  { id: 1, username: "mario.rossi",   password: "1234",  name: "Mario Rossi",   role: "Operaio",       color: DIPENDENTE_COLORS[0] },
  { id: 2, username: "luca.bianchi",  password: "1234",  name: "Luca Bianchi",  role: "Capo Cantiere", color: DIPENDENTE_COLORS[1] },
  { id: 3, username: "admin",         password: "admin", name: "Admin",         role: "Admin",         color: DIPENDENTE_COLORS[2] },
];

const MEZZI = [
  { id: 1, targa: "AB 123 CD", tipo: "Furgone Iveco" },
  { id: 2, targa: "EF 456 GH", tipo: "Camion Mercedes" },
  { id: 3, targa: "IL 789 MN", tipo: "Auto Aziendale Fiat" },
  { id: 4, targa: "OP 321 QR", tipo: "Pickup Ford" },
];

const INITIAL_NOTIFICATIONS = [
  { id: 1, title: "Aggiornamento Procedure Sicurezza", body: "A partire dal 01/04/2024 sono in vigore le nuove norme DPI.", type: "mandatory", date: "2024-03-15", read: [], createdBy: "Admin" },
  { id: 2, title: "Chiusura Uffici - Pasqua", body: "Gli uffici resteranno chiusi dal 29 Marzo al 2 Aprile.", type: "info", date: "2024-03-10", read: [], createdBy: "Admin" },
];

// ─── HELPERS ──────────────────────────────────────────────────────────────────
function calcOre(inizio, fine, pausaMin) {
  if (!inizio || !fine) return { totaleMin: 0, straordinari: 0, ordinarie: "00:00", extraMin: 0 };
  const [hI, mI] = inizio.split(":").map(Number);
  const [hF, mF] = fine.split(":").map(Number);
  const totaleMin = (hF * 60 + mF) - (hI * 60 + mI) - (pausaMin || 0);
  const ordMin = Math.min(Math.max(totaleMin, 0), 480);
  const extraMin = Math.max(0, totaleMin - 480);
  return { totaleMin, straordinari: Math.floor(extraMin / 60), ordinarie: Math.floor(ordMin/60).toString().padStart(2,"0") + ":" + (ordMin%60).toString().padStart(2,"0"), extraMin };
}
function calcPausaMin(inizio, fine) {
  if (!inizio || !fine) return 0;
  const [hI, mI] = inizio.split(":").map(Number);
  const [hF, mF] = fine.split(":").map(Number);
  const d = (hF*60+mF)-(hI*60+mI);
  return d > 0 ? d : 0;
}
function fmt(min) {
  if (!min || min <= 0) return "0h 00m";
  return Math.floor(min/60) + "h " + (min%60).toString().padStart(2,"0") + "m";
}
function today() { return new Date().toISOString().slice(0,10); }

async function inviaASheets(tipo, dati) {
  if (!APPS_SCRIPT_URL || APPS_SCRIPT_URL.includes("INCOLLA")) return { ok: false, locale: true };
  try {
    const res = await fetch(APPS_SCRIPT_URL, { method: "POST", headers: { "Content-Type": "text/plain" }, body: JSON.stringify({ tipo, dati }) });
    return await res.json();
  } catch (e) { return { ok: false, errore: e.message }; }
}

// ─── ICONS ────────────────────────────────────────────────────────────────────
const Icon = ({ name, size = 20, color = "currentColor" }) => {
  const icons = {
    home:      <path d="M3 9l9-7 9 7v11a2 2 0 01-2 2H5a2 2 0 01-2-2z"/>,
    plus:      <><line x1="12" y1="5" x2="12" y2="19"/><line x1="5" y1="12" x2="19" y2="12"/></>,
    list:      <><line x1="8" y1="6" x2="21" y2="6"/><line x1="8" y1="12" x2="21" y2="12"/><line x1="8" y1="18" x2="21" y2="18"/><line x1="3" y1="6" x2="3.01" y2="6"/><line x1="3" y1="12" x2="3.01" y2="12"/><line x1="3" y1="18" x2="3.01" y2="18"/></>,
    bell:      <><path d="M18 8A6 6 0 006 8c0 7-3 9-3 9h18s-3-2-3-9"/><path d="M13.73 21a2 2 0 01-3.46 0"/></>,
    user:      <><path d="M20 21v-2a4 4 0 00-4-4H8a4 4 0 00-4 4v2"/><circle cx="12" cy="7" r="4"/></>,
    alert:     <><path d="M10.29 3.86L1.82 18a2 2 0 001.71 3h16.94a2 2 0 001.71-3L13.71 3.86a2 2 0 00-3.42 0z"/><line x1="12" y1="9" x2="12" y2="13"/><line x1="12" y1="17" x2="12.01" y2="17"/></>,
    logout:    <><path d="M9 21H5a2 2 0 01-2-2V5a2 2 0 012-2h4"/><polyline points="16 17 21 12 16 7"/><line x1="21" y1="12" x2="9" y2="12"/></>,
    check:     <polyline points="20 6 9 17 4 12"/>,
    x:         <><line x1="18" y1="6" x2="6" y2="18"/><line x1="6" y1="6" x2="18" y2="18"/></>,
    shield:    <path d="M12 22s8-4 8-10V5l-8-3-8 3v7c0 6 8 10 8 10z"/>,
    trash:     <><polyline points="3 6 5 6 21 6"/><path d="M19 6l-1 14H6L5 6"/><path d="M10 11v6"/><path d="M14 11v6"/><path d="M9 6V4h6v2"/></>,
    edit:      <><path d="M11 4H4a2 2 0 00-2 2v14a2 2 0 002 2h14a2 2 0 002-2v-7"/><path d="M18.5 2.5a2.121 2.121 0 013 3L12 15l-4 1 1-4 9.5-9.5z"/></>,
    pin:       <><path d="M21 10c0 7-9 13-9 13s-9-6-9-13a9 9 0 0118 0z"/><circle cx="12" cy="10" r="3"/></>,
    info:      <><circle cx="12" cy="12" r="10"/><line x1="12" y1="8" x2="12" y2="12"/><line x1="12" y1="16" x2="12.01" y2="16"/></>,
    send:      <><line x1="22" y1="2" x2="11" y2="13"/><polygon points="22 2 15 22 11 13 2 9 22 2"/></>,
    briefcase: <><rect x="2" y="7" width="20" height="14" rx="2" ry="2"/><path d="M16 21V5a2 2 0 00-2-2h-4a2 2 0 00-2 2v16"/></>,
    camera:    <><path d="M23 19a2 2 0 01-2 2H3a2 2 0 01-2-2V8a2 2 0 012-2h4l2-3h6l2 3h4a2 2 0 012 2z"/><circle cx="12" cy="13" r="4"/></>,
    file:      <><path d="M13 2H6a2 2 0 00-2 2v16a2 2 0 002 2h12a2 2 0 002-2V9z"/><polyline points="13 2 13 9 20 9"/></>,
    cloud:     <><polyline points="16 16 12 12 8 16"/><line x1="12" y1="12" x2="12" y2="21"/><path d="M20.39 18.39A5 5 0 0018 9h-1.26A8 8 0 103 16.3"/></>,
    truck:     <><rect x="1" y="3" width="15" height="13"/><polygon points="16 8 20 8 23 11 23 16 16 16 16 8"/><circle cx="5.5" cy="18.5" r="2.5"/><circle cx="18.5" cy="18.5" r="2.5"/></>,
    calendar:  <><rect x="3" y="4" width="18" height="18" rx="2" ry="2"/><line x1="16" y1="2" x2="16" y2="6"/><line x1="8" y1="2" x2="8" y2="6"/><line x1="3" y1="10" x2="21" y2="10"/></>,
    chevLeft:  <polyline points="15 18 9 12 15 6"/>,
    chevRight: <polyline points="9 18 15 12 9 6"/>,
    users:     <><path d="M17 21v-2a4 4 0 00-4-4H5a4 4 0 00-4 4v2"/><circle cx="9" cy="7" r="4"/><path d="M23 21v-2a4 4 0 00-3-3.87"/><path d="M16 3.13a4 4 0 010 7.75"/></>,
    key:       <><path d="M21 2l-2 2m-7.61 7.61a5.5 5.5 0 11-7.778 7.778 5.5 5.5 0 017.777-7.777zm0 0L15.5 7.5m0 0l3 3L22 7l-3-3m-3.5 3.5L19 4"/></>,
    lock:      <><rect x="3" y="11" width="18" height="11" rx="2" ry="2"/><path d="M7 11V7a5 5 0 0110 0v4"/></>,
  };
  return (
    <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke={color} strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      {icons[name]}
    </svg>
  );
};

// ─── CSS ─────────────────────────────────────────────────────────────────────
const css = `
  @import url('https://fonts.googleapis.com/css2?family=DM+Sans:wght@300;400;500;600;700&family=DM+Mono:wght@400;500&display=swap');
  *,*::before,*::after{box-sizing:border-box;margin:0;padding:0;-webkit-tap-highlight-color:transparent}
  :root{
    --bg:#0f1117;--surface:#181c25;--surface2:#1e2330;--border:#2a3045;
    --accent:#00b894;--accent2:#0984e3;--success:#22c55e;--warning:#f59e0b;
    --danger:#ef4444;--text:#e8ecf3;--text2:#8892a4;--text3:#4a5568;
    --radius:14px;--radius-sm:8px;--shadow:0 4px 24px rgba(0,0,0,.4);
  }
  body{background:var(--bg);color:var(--text);font-family:'DM Sans',sans-serif;min-height:100vh}
  .app{max-width:430px;margin:0 auto;min-height:100dvh;display:flex;flex-direction:column}
  .login-screen{min-height:100dvh;display:flex;flex-direction:column;justify-content:center;align-items:center;padding:32px 24px;background:radial-gradient(ellipse at 20% 50%,rgba(0,184,148,.12) 0%,transparent 60%),radial-gradient(ellipse at 80% 20%,rgba(9,132,227,.12) 0%,transparent 50%),var(--bg)}
  .login-logo{text-align:center;margin-bottom:36px}
  .login-logo .logo-icon{width:88px;height:88px;border-radius:50%;background:linear-gradient(135deg,var(--accent),var(--accent2));border:3px solid var(--accent);box-shadow:0 0 20px rgba(0,184,148,.35);display:flex;align-items:center;justify-content:center;margin:0 auto 14px;font-size:26px;font-weight:700;color:white}
  .login-logo h1{font-size:24px;font-weight:700;letter-spacing:-.5px}
  .login-logo p{font-size:13px;color:var(--text2);margin-top:4px}
  .login-form{width:100%;max-width:340px}
  .form-group{margin-bottom:14px}
  .form-group label{display:block;font-size:11px;font-weight:700;color:var(--text2);text-transform:uppercase;letter-spacing:.8px;margin-bottom:6px}
  .input{width:100%;background:var(--surface);border:1.5px solid var(--border);border-radius:var(--radius-sm);padding:13px 14px;font-size:15px;color:var(--text);font-family:inherit;transition:border-color .2s;outline:none}
  .input:focus{border-color:var(--accent)}
  .input::placeholder{color:var(--text3)}
  .input.err{border-color:var(--danger)}
  select.input{appearance:none;background-image:url("data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' width='16' height='16' viewBox='0 0 24 24' fill='none' stroke='%238892a4' stroke-width='2'%3E%3Cpolyline points='6 9 12 15 18 9'/%3E%3C/svg%3E");background-repeat:no-repeat;background-position:right 12px center;padding-right:36px}
  textarea.input{resize:none;min-height:80px}
  .field-err{font-size:11px;color:var(--danger);margin-top:4px}
  .btn{width:100%;padding:14px;border:none;border-radius:var(--radius-sm);font-size:15px;font-weight:600;font-family:inherit;cursor:pointer;transition:all .2s;display:flex;align-items:center;justify-content:center;gap:8px}
  .btn-primary{background:linear-gradient(135deg,var(--accent),var(--accent2));color:white;box-shadow:0 4px 20px rgba(0,184,148,.3)}
  .btn-primary:active{transform:scale(.98)}
  .btn-primary:disabled{opacity:.4;cursor:not-allowed}
  .btn-ghost{background:transparent;color:var(--text2);border:1.5px solid var(--border)}
  .btn-danger{background:rgba(239,68,68,.15);color:var(--danger);border:1.5px solid rgba(239,68,68,.3)}
  .btn-success{background:rgba(34,197,94,.15);color:var(--success);border:1.5px solid rgba(34,197,94,.3)}
  .btn-warning{background:rgba(245,158,11,.15);color:var(--warning);border:1.5px solid rgba(245,158,11,.3)}
  .btn-sm{padding:8px 13px;font-size:13px;width:auto;border-radius:8px}
  .error-msg{background:rgba(239,68,68,.12);border:1px solid rgba(239,68,68,.3);color:#fca5a5;border-radius:8px;padding:12px;font-size:13px;margin-bottom:14px;text-align:center}
  .header{background:var(--surface);border-bottom:1px solid var(--border);padding:12px 18px;display:flex;align-items:center;justify-content:space-between;position:sticky;top:0;z-index:50}
  .header-logo{display:flex;align-items:center;gap:10px}
  .header-logo .logo-sm{width:32px;height:32px;border-radius:50%;background:linear-gradient(135deg,var(--accent),var(--accent2));display:flex;align-items:center;justify-content:center;font-size:11px;font-weight:700;color:white}
  .header-title{font-size:16px;font-weight:700}
  .header-sub{font-size:11px;color:var(--text2);margin-top:1px}
  .notif-badge{position:relative}
  .badge-dot{position:absolute;top:-3px;right:-3px;width:9px;height:9px;background:var(--danger);border-radius:50%;border:2px solid var(--surface)}
  .bottom-nav{background:var(--surface);border-top:1px solid var(--border);display:flex;position:sticky;bottom:0;z-index:50;padding:8px 0}
  .nav-item{flex:1;display:flex;flex-direction:column;align-items:center;gap:3px;padding:6px;border:none;background:none;color:var(--text3);cursor:pointer;transition:color .2s;font-family:inherit;position:relative}
  .nav-item.active{color:var(--accent)}
  .nav-item span{font-size:10px;font-weight:600}
  .nav-fab{width:52px!important;height:52px!important;border-radius:50%!important;background:linear-gradient(135deg,var(--accent),var(--accent2))!important;color:white!important;box-shadow:0 4px 20px rgba(0,184,148,.4);margin-top:-20px;border:3px solid var(--bg)!important}
  .content{flex:1;overflow-y:auto;padding:16px;padding-bottom:0}
  .card{background:var(--surface);border:1px solid var(--border);border-radius:var(--radius);padding:16px;margin-bottom:12px}
  .section-title{font-size:11px;font-weight:700;text-transform:uppercase;letter-spacing:1px;color:var(--text2);margin:18px 0 10px;display:flex;align-items:center;gap:6px}
  .section-title::after{content:'';flex:1;height:1px;background:var(--border)}
  .stats-row{display:grid;grid-template-columns:1fr 1fr;gap:10px;margin-bottom:14px}
  .stat-card{background:var(--surface);border:1px solid var(--border);border-radius:var(--radius);padding:14px}
  .stat-value{font-size:26px;font-weight:700;font-family:'DM Mono',monospace}
  .stat-label{font-size:11px;color:var(--text2);margin-top:2px;text-transform:uppercase;letter-spacing:.6px}
  .stat-accent{color:var(--accent)}.stat-success{color:var(--success)}.stat-warning{color:var(--warning)}
  .mezzo-card{background:var(--surface);border:1.5px solid var(--accent);border-radius:var(--radius);padding:12px 16px;margin-bottom:14px;display:flex;align-items:center;gap:12px}
  .mezzo-icon{background:rgba(0,184,148,.15);border-radius:8px;padding:8px;flex-shrink:0}
  .mezzo-info{flex:1;min-width:0}
  .mezzo-lbl{font-size:10px;font-weight:700;text-transform:uppercase;letter-spacing:.8px;color:var(--text2);margin-bottom:2px}
  .mezzo-targa{font-size:15px;font-weight:700;font-family:'DM Mono',monospace;color:var(--accent)}
  .mezzo-sel{background:rgba(0,184,148,.1);border:1px solid rgba(0,184,148,.3);border-radius:8px;color:var(--accent);font-size:12px;font-weight:600;padding:6px 10px;cursor:pointer;font-family:inherit;appearance:none}
  .record-item{background:var(--surface);border:1px solid var(--border);border-radius:var(--radius);padding:14px 16px;margin-bottom:10px;cursor:pointer;transition:border-color .2s}
  .record-item:hover{border-color:var(--accent)}
  .record-top{display:flex;align-items:center;justify-content:space-between;margin-bottom:6px}
  .record-date{font-family:'DM Mono',monospace;font-size:12px;color:var(--text2)}
  .record-badges{display:flex;gap:5px;align-items:center}
  .rbadge{font-size:11px;padding:3px 8px;border-radius:20px;font-weight:600}
  .rbadge-ore{background:rgba(0,184,148,.15);color:var(--accent)}
  .rbadge-str{background:rgba(245,158,11,.15);color:var(--warning)}
  .record-body{display:flex;justify-content:space-between;align-items:flex-start;gap:8px}
  .record-left{flex:1;min-width:0}
  .record-client{font-size:15px;font-weight:600;margin-bottom:2px}
  .record-cantiere{font-size:13px;color:var(--text2);display:flex;align-items:center;gap:4px}
  .record-targa{font-size:12px;font-weight:600;font-family:'DM Mono',monospace;color:var(--accent);display:flex;align-items:center;gap:4px;justify-content:flex-end}
  .record-actions{display:flex;gap:6px;margin-top:10px;padding-top:10px;border-top:1px solid var(--border)}
  .steps-bar{display:flex;gap:5px;margin-bottom:16px}
  .step-btn{flex:1;padding:8px 4px;border-radius:20px;border:none;font-family:inherit;font-size:11px;font-weight:600;text-align:center;white-space:nowrap;transition:all .2s}
  .step-active{background:var(--accent);color:white;cursor:pointer}
  .step-done{background:rgba(34,197,94,.15);color:var(--success);cursor:pointer}
  .step-todo{background:var(--surface2);color:var(--text3);cursor:default}
  .time-result{background:linear-gradient(135deg,rgba(0,184,148,.1),rgba(9,132,227,.07));border:1px solid rgba(0,184,148,.25);border-radius:var(--radius);padding:14px 16px;display:flex;align-items:center;gap:14px;margin:12px 0}
  .time-cell{flex:1;text-align:center}
  .time-val{font-family:'DM Mono',monospace;font-size:20px;font-weight:600}
  .time-lbl{font-size:10px;color:var(--text2);margin-top:2px;text-transform:uppercase;letter-spacing:.5px}
  .divider-v{width:1px;height:40px;background:var(--border)}
  .row-2{display:grid;grid-template-columns:1fr 1fr;gap:10px}
  .mat-row{display:flex;gap:8px;align-items:center;margin-bottom:8px}
  .mat-row .input{flex:1}
  .upload-area{border:2px dashed var(--border);border-radius:var(--radius);padding:20px;text-align:center;color:var(--text2);font-size:13px;cursor:pointer;transition:border-color .2s}
  .gps-box{background:var(--surface2);border:1px solid var(--border);border-radius:var(--radius-sm);padding:12px 14px;display:flex;align-items:center;gap:12px}
  .gps-coords{font-family:'DM Mono',monospace;font-size:12px;color:var(--success)}
  .notif-card{background:var(--surface);border:1px solid var(--border);border-radius:var(--radius);padding:16px;margin-bottom:12px}
  .notif-card.mandatory{border-color:rgba(245,158,11,.4);background:rgba(245,158,11,.05)}
  .notif-card.unread{border-left:3px solid var(--accent)}
  .notif-type{font-size:10px;font-weight:700;text-transform:uppercase;letter-spacing:.8px;padding:2px 8px;border-radius:20px;display:inline-flex;align-items:center;gap:4px}
  .notif-type.mandatory{background:rgba(245,158,11,.15);color:var(--warning)}
  .notif-type.info{background:rgba(0,184,148,.15);color:var(--accent)}
  .notif-title{font-size:15px;font-weight:600;margin:8px 0 6px}
  .notif-body{font-size:13px;color:var(--text2);line-height:1.5}
  .notif-date{font-size:11px;color:var(--text3);margin-top:8px}
  .overlay{position:fixed;inset:0;background:rgba(0,0,0,.7);z-index:100;display:flex;align-items:flex-end;justify-content:center}
  .overlay-center{position:fixed;inset:0;background:rgba(0,0,0,.75);z-index:100;display:flex;align-items:center;justify-content:center;padding:20px}
  .modal{background:var(--surface);border-radius:20px 20px 0 0;padding:24px 20px;width:100%;max-width:430px;max-height:90dvh;overflow-y:auto}
  .modal-center{background:var(--surface);border-radius:var(--radius);padding:24px 20px;width:100%;max-width:380px;max-height:90dvh;overflow-y:auto}
  .modal-handle{width:40px;height:4px;background:var(--border);border-radius:2px;margin:0 auto 20px}
  .modal-title{font-size:18px;font-weight:700;margin-bottom:16px}
  .detail-row{display:flex;justify-content:space-between;align-items:flex-start;padding:10px 0;border-bottom:1px solid var(--border)}
  .detail-label{font-size:12px;color:var(--text2)}
  .detail-value{font-size:14px;font-weight:500;text-align:right;max-width:60%}
  .whistle-header{text-align:center;padding:20px 0 14px}
  .whistle-icon{width:56px;height:56px;background:rgba(9,132,227,.15);border-radius:50%;display:flex;align-items:center;justify-content:center;margin:0 auto 12px}
  .anon-toggle{display:flex;align-items:center;justify-content:space-between;background:var(--surface2);border:1px solid var(--border);border-radius:var(--radius-sm);padding:12px 14px;margin:12px 0}
  .toggle{width:44px;height:24px;border-radius:12px;background:var(--border);border:none;cursor:pointer;position:relative;transition:background .2s}
  .toggle.on{background:var(--accent)}
  .toggle::after{content:'';position:absolute;width:18px;height:18px;border-radius:50%;background:white;top:3px;left:3px;transition:transform .2s}
  .toggle.on::after{transform:translateX(20px)}
  .profile-avatar{width:72px;height:72px;border-radius:50%;background:linear-gradient(135deg,var(--accent),var(--accent2));display:flex;align-items:center;justify-content:center;font-size:26px;font-weight:700;margin:0 auto 12px}
  .profile-name{text-align:center;font-size:20px;font-weight:700}
  .profile-role{text-align:center;font-size:13px;color:var(--accent);margin-top:3px}
  .profile-item{display:flex;align-items:center;justify-content:space-between;padding:13px 0;border-bottom:1px solid var(--border)}
  .profile-label{font-size:14px;color:var(--text2)}
  .profile-value{font-size:14px;font-weight:500}
  .scroll-pad{height:90px}
  .sheets-ok{display:flex;align-items:center;gap:7px;padding:9px 13px;border-radius:var(--radius-sm);font-size:12px;font-weight:600;margin-bottom:10px;background:rgba(34,197,94,.1);border:1px solid rgba(34,197,94,.25);color:var(--success)}
  .sheets-err{display:flex;align-items:center;gap:7px;padding:9px 13px;border-radius:var(--radius-sm);font-size:12px;font-weight:600;margin-bottom:10px;background:rgba(239,68,68,.1);border:1px solid rgba(239,68,68,.25);color:var(--danger)}
  .sheets-load{display:flex;align-items:center;gap:7px;padding:9px 13px;border-radius:var(--radius-sm);font-size:12px;font-weight:600;margin-bottom:10px;background:rgba(0,184,148,.1);border:1px solid rgba(0,184,148,.25);color:var(--accent)}
  .sheets-local{display:flex;align-items:center;gap:7px;padding:9px 13px;border-radius:var(--radius-sm);font-size:12px;font-weight:600;margin-bottom:10px;background:rgba(245,158,11,.1);border:1px solid rgba(245,158,11,.25);color:var(--warning)}
  .toast{position:fixed;top:20px;left:50%;transform:translateX(-50%);background:var(--surface);border:1px solid var(--border);border-radius:10px;padding:11px 18px;font-size:14px;font-weight:500;z-index:200;box-shadow:var(--shadow);display:flex;align-items:center;gap:8px;white-space:nowrap;animation:slideDown .3s ease;max-width:90vw}
  .toast.success{border-color:rgba(34,197,94,.4);color:var(--success)}
  .toast.error{border-color:rgba(239,68,68,.4);color:var(--danger)}
  @keyframes slideDown{from{opacity:0;transform:translateX(-50%) translateY(-10px)}to{opacity:1;transform:translateX(-50%) translateY(0)}}
  .pausa-info{background:rgba(34,197,94,.08);border:1px solid rgba(34,197,94,.25);border-radius:8px;padding:10px 13px;font-size:13px;color:var(--success);margin-bottom:12px}
  .req{color:var(--danger);margin-left:3px}
  /* CALENDAR */
  .cal-header{display:flex;align-items:center;justify-content:space-between;margin-bottom:14px}
  .cal-month{font-size:17px;font-weight:700}
  .cal-toggle{display:flex;background:var(--surface2);border-radius:8px;padding:3px;gap:2px}
  .cal-toggle-btn{padding:5px 12px;border-radius:6px;border:none;font-size:12px;font-weight:600;cursor:pointer;font-family:inherit;color:var(--text2);background:transparent;transition:all .2s}
  .cal-toggle-btn.active{background:var(--accent);color:white}
  .cal-grid{display:grid;grid-template-columns:repeat(7,1fr);gap:2px}
  .cal-dow{text-align:center;font-size:10px;font-weight:700;color:var(--text3);padding:4px 0;text-transform:uppercase}
  .cal-day{min-height:52px;background:var(--surface);border:1px solid var(--border);border-radius:6px;padding:4px;cursor:pointer;transition:border-color .2s;position:relative}
  .cal-day:hover{border-color:var(--accent)}
  .cal-day.today{border-color:var(--accent);border-width:2px}
  .cal-day.other-month{opacity:.35}
  .cal-day-num{font-size:11px;font-weight:600;color:var(--text2);margin-bottom:2px}
  .cal-day.today .cal-day-num{color:var(--accent)}
  .cal-event{font-size:9px;font-weight:600;border-radius:3px;padding:1px 4px;margin-bottom:1px;overflow:hidden;white-space:nowrap;text-overflow:ellipsis;color:white}
  .week-grid{display:flex;flex-direction:column;gap:4px}
  .week-day-row{background:var(--surface);border:1px solid var(--border);border-radius:var(--radius-sm);padding:10px 12px}
  .week-day-label{font-size:12px;font-weight:700;color:var(--text2);margin-bottom:6px;display:flex;align-items:center;gap:6px}
  .week-day-label.today-lbl{color:var(--accent)}
  .week-event{display:flex;align-items:center;gap:8px;padding:6px 8px;border-radius:6px;margin-bottom:4px;cursor:pointer}
  .week-event-dot{width:8px;height:8px;border-radius:50%;flex-shrink:0}
  .week-event-info{flex:1;min-width:0}
  .week-event-title{font-size:13px;font-weight:600;white-space:nowrap;overflow:hidden;text-overflow:ellipsis}
  .week-event-sub{font-size:11px;color:var(--text2)}
  /* ADMIN PANEL */
  .admin-tab{display:flex;gap:4px;background:var(--surface2);border-radius:10px;padding:4px;margin-bottom:16px}
  .admin-tab-btn{flex:1;padding:8px;border:none;border-radius:8px;font-size:12px;font-weight:600;cursor:pointer;font-family:inherit;color:var(--text2);background:transparent;transition:all .2s}
  .admin-tab-btn.active{background:var(--accent);color:white}
  .user-card{background:var(--surface);border:1px solid var(--border);border-radius:var(--radius);padding:14px;margin-bottom:10px;display:flex;align-items:center;gap:12px}
  .user-avatar-sm{width:40px;height:40px;border-radius:50%;display:flex;align-items:center;justify-content:center;font-size:14px;font-weight:700;color:white;flex-shrink:0}
  .read-chip{display:inline-flex;align-items:center;gap:4px;font-size:11px;padding:2px 8px;border-radius:20px;font-weight:600;margin:2px}
  .read-chip.yes{background:rgba(34,197,94,.15);color:var(--success)}
  .read-chip.no{background:rgba(239,68,68,.15);color:var(--danger)}
`;

// ─── TOAST ────────────────────────────────────────────────────────────────────
let _setToast = null;
function Toast() {
  const [t, setT] = useState(null);
  _setToast = setT;
  useEffect(() => { if (t) { const id = setTimeout(() => setT(null), 3000); return () => clearTimeout(id); } }, [t]);
  if (!t) return null;
  return <div className={"toast " + t.type}><Icon name={t.type === "success" ? "check" : "alert"} size={15}/>{t.msg}</div>;
}
function showToast(msg, type = "success") { if (_setToast) _setToast({ msg, type }); }

function SheetsStatus({ status }) {
  if (status === "idle") return null;
  const map = { loading:{cls:"sheets-load",icon:"cloud",text:"Invio a Google Sheets..."}, ok:{cls:"sheets-ok",icon:"check",text:"Salvato su Google Sheets"}, error:{cls:"sheets-err",icon:"alert",text:"Errore Sheets - salvato in locale"}, local:{cls:"sheets-local",icon:"info",text:"Sheets non configurato - solo locale"} };
  const s = map[status]; if (!s) return null;
  return <div className={s.cls}><Icon name={s.icon} size={14}/>{s.text}</div>;
}

function Field({ label, required, err, children }) {
  return (
    <div className="form-group">
      <label>{label}{required && <span className="req">*</span>}</label>
      {children}
      {err && <div className="field-err">- {err}</div>}
    </div>
  );
}

// ─── MANDATORY MODAL ──────────────────────────────────────────────────────────
function MandatoryNotifModal({ notif, userName, onConfirm }) {
  return (
    <div className="overlay">
      <div className="modal" style={{ borderTop:"3px solid var(--warning)" }}>
        <div className="modal-handle"/>
        <div style={{ display:"flex", alignItems:"center", gap:10, marginBottom:16 }}>
          <div style={{ background:"rgba(245,158,11,.15)", borderRadius:10, padding:10 }}><Icon name="alert" size={22} color="var(--warning)"/></div>
          <div>
            <div style={{ fontSize:11, color:"var(--warning)", fontWeight:700, textTransform:"uppercase" }}>Avviso Obbligatorio</div>
            <div style={{ fontSize:17, fontWeight:700 }}>{notif.title}</div>
          </div>
        </div>
        <p style={{ fontSize:14, color:"var(--text2)", lineHeight:1.6, marginBottom:24 }}>{notif.body}</p>
        <button className="btn btn-primary" onClick={onConfirm}><Icon name="check" size={16}/> Ho letto e confermo</button>
      </div>
    </div>
  );
}

// ─── MEZZO POPUP ──────────────────────────────────────────────────────────────
function MezzoPopup({ user, ultimoMezzo, onConfirm }) {
  const [mezzo, setMezzo] = useState(ultimoMezzo || "");
  const ora = new Date().getHours();
  const saluto = ora < 12 ? "Buongiorno" : ora < 18 ? "Buon pomeriggio" : "Buonasera";
  return (
    <div className="overlay-center">
      <div className="modal-center" style={{ border:"1.5px solid var(--accent)" }}>
        <div style={{ textAlign:"center", marginBottom:20 }}>
          <div style={{ width:54, height:54, borderRadius:"50%", background:"linear-gradient(135deg,var(--accent),var(--accent2))", display:"flex", alignItems:"center", justifyContent:"center", margin:"0 auto 12px" }}>
            <Icon name="truck" size={26} color="white"/>
          </div>
          <h2 style={{ fontSize:18, fontWeight:700 }}>{saluto}, {user.name.split(" ")[0]}!</h2>
          <p style={{ fontSize:13, color:"var(--text2)", marginTop:6 }}>{ultimoMezzo ? "Conferma o cambia il mezzo di oggi:" : "Che mezzo utilizzi oggi?"}</p>
        </div>
        <div className="form-group">
          <label>Mezzo<span className="req">*</span></label>
          <select className="input" value={mezzo} onChange={e => setMezzo(e.target.value)} style={{ borderColor: mezzo ? "var(--accent)" : "var(--border)" }}>
            <option value="">Seleziona targa...</option>
            {MEZZI.map(m => <option key={m.id} value={m.targa + " - " + m.tipo}>{m.targa} - {m.tipo}</option>)}
          </select>
        </div>
        <button className="btn btn-primary" onClick={() => mezzo && onConfirm(mezzo)} disabled={!mezzo} style={{ opacity: mezzo ? 1 : 0.4 }}>
          <Icon name="check" size={16}/> Inizia la giornata
        </button>
      </div>
    </div>
  );
}

// ─── HOME ─────────────────────────────────────────────────────────────────────
function HomeScreen({ user, records, mezzoAttivo, onCambioMezzo, onNewRecord }) {
  const tDay = today();
  const mese = tDay.slice(0,7);
  const myRecords = records.filter(r => r.userId === user.id);
  const rOggi = myRecords.filter(r => r.data === tDay);
  const rMese = myRecords.filter(r => r.data.startsWith(mese));
  const totOggi = rOggi.reduce((s,r) => s + calcOre(r.oraInizio,r.oraFine,r.pausa).totaleMin, 0);
  const totStr  = rMese.reduce((s,r) => s + calcOre(r.oraInizio,r.oraFine,r.pausa).straordinari, 0);
  const targa = mezzoAttivo ? mezzoAttivo.split(" - ")[0] : "—";
  // 3 lavori più recenti in assoluto
  const recent = [...myRecords].sort((a,b) => b.id - a.id).slice(0, 3);
  const isAdmin = user.role === "Admin";
  return (
    <div className="content">
      <div style={{ marginBottom:14 }}>
        <h2 style={{ fontSize:21, fontWeight:700 }}>Ciao, {user.name.split(" ")[0]} 👋</h2>
        <p style={{ fontSize:13, color:"var(--text2)", marginTop:2 }}>{new Date().toLocaleDateString("it-IT",{weekday:"long",day:"numeric",month:"long"})}</p>
      </div>
      {!isAdmin && (
        <div className="mezzo-card">
          <div className="mezzo-icon"><Icon name="truck" size={20} color="var(--accent)"/></div>
          <div className="mezzo-info"><div className="mezzo-lbl">Mezzo attivo</div><div className="mezzo-targa">{targa}</div></div>
          <select className="mezzo-sel" value={mezzoAttivo} onChange={e => onCambioMezzo(e.target.value)}>
            {MEZZI.map(m => <option key={m.id} value={m.targa + " - " + m.tipo}>{m.targa}</option>)}
          </select>
        </div>
      )}
      <div className="stats-row">
        <div className="stat-card"><div className="stat-value stat-accent">{fmt(totOggi)}</div><div className="stat-label">Ore oggi</div></div>
        <div className="stat-card"><div className="stat-value stat-success">{rOggi.length}</div><div className="stat-label">Lavori oggi</div></div>
        <div className="stat-card"><div className="stat-value">{rMese.length}</div><div className="stat-label">Lavori mese</div></div>
        <div className="stat-card"><div className="stat-value stat-warning">{totStr}h</div><div className="stat-label">Straordinari</div></div>
      </div>

      {/* Sezione lavori recenti + pulsante + */}
      {!isAdmin && (
        <>
          <div className="section-title">Lavori recenti</div>
          {/* Pulsante aggiungi */}
          <button
            onClick={onNewRecord}
            style={{ width:"100%", background:"var(--surface)", border:"2px dashed var(--accent)", borderRadius:"var(--radius)", padding:"16px", display:"flex", alignItems:"center", justifyContent:"center", gap:10, cursor:"pointer", marginBottom:10, color:"var(--accent)", fontFamily:"inherit", fontWeight:600, fontSize:14, transition:"background .2s" }}
            onMouseEnter={e=>e.currentTarget.style.background="rgba(0,184,148,.08)"}
            onMouseLeave={e=>e.currentTarget.style.background="var(--surface)"}
          >
            <div style={{ width:32, height:32, borderRadius:"50%", background:"linear-gradient(135deg,var(--accent),var(--accent2))", display:"flex", alignItems:"center", justifyContent:"center" }}>
              <Icon name="plus" size={18} color="white"/>
            </div>
            Registra nuovo lavoro
          </button>

          {recent.length === 0 && (
            <div style={{ textAlign:"center", padding:"16px", color:"var(--text3)", fontSize:13 }}>
              Nessun lavoro ancora registrato
            </div>
          )}
          {recent.map(r => <RecordItem key={r.id} r={r} compact/>)}
          {myRecords.length > 3 && (
            <div style={{ textAlign:"center", padding:"10px 0", fontSize:13, color:"var(--text2)" }}>
              +{myRecords.length - 3} altri lavori nella tab <strong>Lavori</strong>
            </div>
          )}
        </>
      )}
      <div className="scroll-pad"/>
    </div>
  );
}

// ─── RECORD ITEM ─────────────────────────────────────────────────────────────
function RecordItem({ r, compact, onEdit, onDelete, onClick }) {
  const { totaleMin, straordinari } = calcOre(r.oraInizio, r.oraFine, r.pausa);
  const targa = r.mezzo ? r.mezzo.split(" - ")[0] : null;
  return (
    <div className="record-item" onClick={onClick}>
      <div className="record-top">
        <span className="record-date">{r.data} · {r.oraInizio}–{r.oraFine}</span>
        <div className="record-badges">
          <span className="rbadge rbadge-ore">{fmt(totaleMin)}</span>
          {straordinari > 0 && <span className="rbadge rbadge-str">+{straordinari}h str.</span>}
        </div>
      </div>
      <div className="record-body">
        <div className="record-left">
          <div className="record-client">{r.cliente || "—"}</div>
          <div className="record-cantiere"><Icon name="pin" size={11} color="var(--text3)"/>{r.cantiere || "—"}{r.ordine ? " - Ord. " + r.ordine : ""}</div>
        </div>
        {targa && <div className="record-targa"><Icon name="truck" size={11} color="var(--accent)"/>{targa}</div>}
      </div>
      {!compact && (onEdit || onDelete) && (
        <div className="record-actions" onClick={e => e.stopPropagation()}>
          {onEdit && <button className="btn btn-sm btn-ghost" style={{ flex:1 }} onClick={onEdit}><Icon name="edit" size={13}/> Modifica</button>}
          {onDelete && <button className="btn btn-sm btn-danger" style={{ flex:1 }} onClick={onDelete}><Icon name="trash" size={13}/> Elimina</button>}
        </div>
      )}
    </div>
  );
}

// ─── RECORD LIST ─────────────────────────────────────────────────────────────
function RecordListScreen({ records, user, onEdit, onDelete, onSelect }) {
  const [filter, setFilter] = useState("");
  const myRecords = user.role === "Admin" ? records : records.filter(r => r.userId === user.id);
  const filtered = myRecords.filter(r =>
    !filter ||
    (r.cliente && r.cliente.toLowerCase().includes(filter.toLowerCase())) ||
    (r.cantiere && r.cantiere.toLowerCase().includes(filter.toLowerCase())) ||
    (r.mezzo && r.mezzo.toLowerCase().includes(filter.toLowerCase()))
  );
  return (
    <div className="content">
      <div className="section-title" style={{ marginTop:4 }}>Tutti i lavori ({myRecords.length})</div>
      <input className="input" placeholder="Cerca cliente, cantiere o targa..." value={filter} onChange={e => setFilter(e.target.value)} style={{ marginBottom:12 }}/>
      {filtered.length === 0 && <div style={{ textAlign:"center", padding:"40px 0", color:"var(--text2)" }}><Icon name="list" size={28} color="var(--text3)"/><br/><br/>Nessun risultato</div>}
      {filtered.map(r => (
        <RecordItem key={r.id} r={r}
          onClick={() => onSelect(r)}
          onEdit={() => onEdit(r)}
          onDelete={() => { if (window.confirm("Eliminare questo lavoro?")) onDelete(r.id); }}
        />
      ))}
      <div className="scroll-pad"/>
    </div>
  );
}

// ─── RECORD DETAIL MODAL ─────────────────────────────────────────────────────
function RecordDetailModal({ r, onClose, onEdit, onDelete }) {
  const { totaleMin, straordinari, ordinarie } = calcOre(r.oraInizio, r.oraFine, r.pausa);
  const rows = [
    ["Data", r.data],["Inizio", r.oraInizio],["Fine", r.oraFine],
    ["Pausa pranzo", r.pausa > 0 ? r.pausa + " min" : null],
    ["Altre pause", r.altrePause],
    ["Ore totali", fmt(totaleMin)],["Ore ordinarie", ordinarie],
    ["Straordinari", straordinari + "h"],
    ["Cliente", r.cliente],["Cantiere", r.cantiere],
    ["N. Ordine", r.ordine],["Mezzo", r.mezzo],["Note", r.note],
  ];
  return (
    <div className="overlay" onClick={onClose}>
      <div className="modal" onClick={e => e.stopPropagation()}>
        <div className="modal-handle"/>
        <div className="modal-title">{r.cliente || "Lavoro"}</div>
        {rows.map(([l,v]) => v ? <div key={l} className="detail-row"><span className="detail-label">{l}</span><span className="detail-value">{v}</span></div> : null)}
        {r.descrizione && <><div className="section-title">Attività svolte</div><p style={{ fontSize:14, color:"var(--text2)", lineHeight:1.6 }}>{r.descrizione}</p></>}
        {r.materiali && r.materiali.length > 0 && <><div className="section-title">Materiali</div>{r.materiali.map((m,i)=><div key={i} style={{ fontSize:14, padding:"4px 0", color:"var(--text2)" }}>- {m}</div>)}</>}
        {r.gps && <><div className="section-title">GPS</div><div className="gps-box"><Icon name="pin" size={18} color="var(--success)"/><span className="gps-coords">Lat {r.gps.lat}, Lng {r.gps.lng}</span></div></>}
        <div style={{ height:16 }}/>
        <div className="row-2">
          <button className="btn btn-ghost" onClick={onClose}>Chiudi</button>
          {onEdit && <button className="btn btn-warning" onClick={onEdit}><Icon name="edit" size={14}/> Modifica</button>}
        </div>
        {onDelete && <button className="btn btn-danger" style={{ marginTop:8 }} onClick={onDelete}><Icon name="trash" size={14}/> Elimina</button>}
      </div>
    </div>
  );
}

// ─── NEW / EDIT RECORD FORM ───────────────────────────────────────────────────
function RecordFormScreen({ onSave, currentUser, mezzoAttivo, editRecord, onCancel }) {
  const tDay = today();
  const blank = { data: tDay, oraInizio:"", oraFine:"", inizioPausa:"", finePausa:"", altrePauseTipo:"", altrePauseDurata:0, cliente:"", cantiere:"", ordine:"", mezzo: mezzoAttivo||"", descrizione:"", materiali:[""], allegati:[], note:"" };
  const [form, setForm] = useState(editRecord ? { ...blank, ...editRecord, inizioPausa:"", finePausa:"" } : blank);
  const [gps, setGps] = useState(editRecord?.gps || null);
  const [gpsLoading, setGpsL] = useState(false);
  const [gpsErr, setGpsErr] = useState("");
  const [step, setStep] = useState(0);
  const [errors, setErrors] = useState({});
  const [sheetsStatus, setSS] = useState("idle");
  const fileRef = useRef();
  const isEdit = !!editRecord;

  const set = (k,v) => { setForm(f => ({...f,[k]:v})); if (errors[k]) setErrors(e => ({...e,[k]:""})); };
  const pausaPranzoMin = calcPausaMin(form.inizioPausa, form.finePausa);
  const calc = calcOre(form.oraInizio, form.oraFine, pausaPranzoMin);
  const orariOk = form.data && form.oraInizio && form.oraFine;

  const captureGPS = () => {
    if (!navigator.geolocation) { setGpsErr("GPS non supportato"); return; }
    setGpsErr(""); setGpsL(true);
    navigator.geolocation.getCurrentPosition(
      pos => { setGps({ lat: pos.coords.latitude.toFixed(6), lng: pos.coords.longitude.toFixed(6) }); setGpsL(false); showToast("Posizione acquisita"); },
      err => { setGpsL(false); setGpsErr("Errore GPS: " + (err.message||"")); showToast("Errore GPS","error"); },
      { enableHighAccuracy:true, timeout:10000, maximumAge:0 }
    );
  };

  const validate = s => {
    const e = {};
    if (s===0) { if(!form.data) e.data="Obbligatorio"; if(!form.oraInizio) e.oraInizio="Obbligatorio"; if(!form.oraFine) e.oraFine="Obbligatorio"; if(!form.cliente) e.cliente="Obbligatorio"; if(!form.cantiere) e.cantiere="Obbligatorio"; if(!form.mezzo) e.mezzo="Obbligatorio"; if(!form.descrizione) e.descrizione="Obbligatorio"; }
    if (s===1) { if(!form.materiali.some(m=>m.trim())) e.materiali="Inserisci almeno un materiale"; }
    if (s===2) { if(form.inizioPausa&&!form.finePausa) e.finePausa="Inserisci la fine pausa"; if(!form.inizioPausa&&form.finePausa) e.inizioPausa="Inserisci l'inizio pausa"; if(form.altrePauseTipo&&!form.altrePauseDurata) e.altrePauseDurata="Seleziona durata"; }
    setErrors(e); return Object.keys(e).length===0;
  };
  const goNext = s => { if(validate(s)) setStep(s+1); };

  const handleSave = async () => {
    const materiali = form.materiali.filter(m=>m.trim());
    const altrePause = form.altrePauseTipo ? form.altrePauseTipo+(form.altrePauseDurata?" - "+form.altrePauseDurata+" min":"") : "";
    const record = { ...form, id: isEdit ? editRecord.id : Date.now(), pausa: pausaPranzoMin, altrePause, materiali, gps, userId: currentUser.id };
    onSave(record);
    setSS("loading");
    const res = await inviaASheets(isEdit?"lavoro_edit":"lavoro", { ...record, nomeDipendente: currentUser.name });
    if(res.locale) { setSS("local"); showToast("Salvato (Sheets non configurato)","error"); }
    else if(res.ok) { setSS("ok"); showToast(isEdit?"Lavoro aggiornato!":"Lavoro salvato!"); }
    else { setSS("error"); showToast("Errore Sheets","error"); }
  };

  const STEPS = ["Lavoro","Materiali","Pause","Note"];
  return (
    <div className="content">
      <div style={{ display:"flex", alignItems:"center", gap:10, marginBottom:14 }}>
        <button className="btn btn-ghost btn-sm" style={{ width:"auto" }} onClick={onCancel}><Icon name="x" size={14}/></button>
        <span style={{ fontWeight:700, fontSize:16 }}>{isEdit?"Modifica lavoro":"Nuovo lavoro"}</span>
      </div>
      <SheetsStatus status={sheetsStatus}/>
      <div className="steps-bar">
        {STEPS.map((s,i) => (
          <button key={i} className={"step-btn "+(i===step?"step-active":i<step?"step-done":"step-todo")} onClick={()=>i<step&&setStep(i)}>
            {i<step?"✓":(i+1)+"."} {s}
          </button>
        ))}
      </div>

      {step===0 && (
        <div>
          <div className="section-title">Orario</div>
          <Field label="Data" required err={errors.data}><input type="date" className={"input"+(errors.data?" err":"")} value={form.data} onChange={e=>set("data",e.target.value)}/></Field>
          <div className="row-2">
            <Field label="Ora inizio" required err={errors.oraInizio}><input type="time" className={"input"+(errors.oraInizio?" err":"")} value={form.oraInizio} onChange={e=>set("oraInizio",e.target.value)}/></Field>
            <Field label="Ora fine" required err={errors.oraFine}><input type="time" className={"input"+(errors.oraFine?" err":"")} value={form.oraFine} onChange={e=>set("oraFine",e.target.value)}/></Field>
          </div>
          {orariOk && (
            <div className="time-result">
              <div className="time-cell"><div className="time-val" style={{color:"var(--accent)"}}>{fmt(calc.totaleMin)}</div><div className="time-lbl">Ore nette</div></div>
              <div className="divider-v"/>
              <div className="time-cell"><div className="time-val" style={{color:"var(--success)"}}>{calc.ordinarie}</div><div className="time-lbl">Ordinarie</div></div>
              <div className="divider-v"/>
              <div className="time-cell"><div className="time-val" style={{color:calc.straordinari>0?"var(--warning)":"var(--text3)"}}>{calc.straordinari}h</div><div className="time-lbl">Straord.</div></div>
            </div>
          )}
          {orariOk && <>
            <div className="section-title">Dettagli</div>
            <Field label="Nome Cliente" required err={errors.cliente}><input className={"input"+(errors.cliente?" err":"")} placeholder="Es. Rossi S.r.l." value={form.cliente} onChange={e=>set("cliente",e.target.value)}/></Field>
            <Field label="Cantiere / Luogo" required err={errors.cantiere}><input className={"input"+(errors.cantiere?" err":"")} placeholder="Es. Via Roma 10" value={form.cantiere} onChange={e=>set("cantiere",e.target.value)}/></Field>
            <Field label="Numero Ordine" err={errors.ordine}><input className="input" placeholder="Es. ORD-2024-001" value={form.ordine} onChange={e=>set("ordine",e.target.value)}/></Field>
            <Field label="Mezzo" required err={errors.mezzo}>
              <select className={"input"+(errors.mezzo?" err":"")} value={form.mezzo} onChange={e=>set("mezzo",e.target.value)}>
                <option value="">Seleziona mezzo...</option>
                {MEZZI.map(m=><option key={m.id} value={m.targa+" - "+m.tipo}>{m.targa} - {m.tipo}</option>)}
              </select>
            </Field>
            <Field label="Attività svolte" required err={errors.descrizione}><textarea className={"input"+(errors.descrizione?" err":"")} placeholder="Descrivi..." value={form.descrizione} onChange={e=>set("descrizione",e.target.value)} rows={3}/></Field>
            <div className="section-title">GPS</div>
            <div className="gps-box" style={{marginBottom:16,flexWrap:"wrap",gap:8}}>
              <Icon name="pin" size={18} color={gps?"var(--success)":"var(--text3)"}/>
              <div style={{flex:1}}>{gps?<span className="gps-coords">Lat {gps.lat}, Lng {gps.lng}</span>:<span style={{color:"var(--text2)",fontSize:13}}>Non acquisita</span>}</div>
              <button className="btn btn-sm btn-ghost" onClick={captureGPS} disabled={gpsLoading} style={{width:"auto"}}>{gpsLoading?"Attendi...":gps?"Aggiorna":"Acquisisci"}</button>
            </div>
            {gpsErr && <div style={{fontSize:11,color:"var(--danger)",marginBottom:12}}>{gpsErr}</div>}
          </>}
          <button className="btn btn-primary" onClick={()=>goNext(0)} disabled={!orariOk} style={{opacity:orariOk?1:.4,marginTop:8}}>Avanti</button>
        </div>
      )}

      {step===1 && (
        <div>
          <div className="section-title">Materiali<span className="req">*</span></div>
          {errors.materiali && <div className="field-err" style={{marginBottom:10}}>{errors.materiali}</div>}
          {form.materiali.map((m,i) => (
            <div key={i} className="mat-row">
              <input className="input" placeholder={"Materiale "+(i+1)} value={m} onChange={e=>{const a=form.materiali.slice();a[i]=e.target.value;set("materiali",a);}}/>
              {form.materiali.length>1&&<button className="btn btn-sm btn-danger" onClick={()=>set("materiali",form.materiali.filter((_,j)=>j!==i))} style={{width:36,padding:"8px"}}><Icon name="trash" size={13}/></button>}
            </div>
          ))}
          <button className="btn btn-ghost btn-sm" style={{marginBottom:20}} onClick={()=>set("materiali",form.materiali.concat(""))}>+ Aggiungi</button>
          <div className="row-2"><button className="btn btn-ghost" onClick={()=>setStep(0)}>Indietro</button><button className="btn btn-primary" onClick={()=>goNext(1)}>Avanti</button></div>
        </div>
      )}

      {step===2 && (
        <div>
          <div className="section-title">Pausa pranzo</div>
          <div className="row-2">
            <Field label="Inizio" err={errors.inizioPausa}><input type="time" className={"input"+(errors.inizioPausa?" err":"")} value={form.inizioPausa} onChange={e=>set("inizioPausa",e.target.value)}/></Field>
            <Field label="Fine" err={errors.finePausa}><input type="time" className={"input"+(errors.finePausa?" err":"")} value={form.finePausa} onChange={e=>set("finePausa",e.target.value)}/></Field>
          </div>
          {pausaPranzoMin>0&&<div className="pausa-info">Pausa pranzo: <strong>{pausaPranzoMin} min</strong> — Ore nette: <strong>{fmt(calc.totaleMin)}</strong></div>}
          <div className="section-title">Altre pause</div>
          <div className="row-2">
            <Field label="Tipo"><select className="input" value={form.altrePauseTipo} onChange={e=>set("altrePauseTipo",e.target.value)}><option value="">Nessuna</option><option value="ROL">ROL</option><option value="Malattia">Malattia</option><option value="Altro">Altro</option></select></Field>
            <Field label="Durata" err={errors.altrePauseDurata}><select className="input" value={form.altrePauseDurata} onChange={e=>set("altrePauseDurata",Number(e.target.value))} disabled={!form.altrePauseTipo} style={{opacity:form.altrePauseTipo?1:.4}}><option value={0}>Seleziona...</option>{[30,60,90,120,150,180,210,240].map(v=><option key={v} value={v}>{v} min</option>)}</select></Field>
          </div>
          <div className="row-2" style={{marginTop:8}}><button className="btn btn-ghost" onClick={()=>setStep(1)}>Indietro</button><button className="btn btn-primary" onClick={()=>goNext(2)}>Avanti</button></div>
        </div>
      )}

      {step===3 && (
        <div>
          <div className="section-title">Note <span style={{fontSize:11,color:"var(--text3)",textTransform:"none",fontWeight:400}}>(opzionale)</span></div>
          <textarea className="input" placeholder="Note aggiuntive..." value={form.note} onChange={e=>set("note",e.target.value)} rows={3}/>
          <div className="section-title">Allegati <span style={{fontSize:11,color:"var(--text3)",textTransform:"none",fontWeight:400}}>(opzionale)</span></div>
          <input ref={fileRef} type="file" multiple style={{display:"none"}} onChange={e=>{const f=Array.from(e.target.files||[]);set("allegati",form.allegati.concat(f.map(x=>x.name)));}}/>
          <div className="upload-area" onClick={()=>fileRef.current&&fileRef.current.click()}><Icon name="camera" size={24} color="var(--text3)"/><p style={{marginTop:8}}>Tocca per aggiungere foto</p></div>
          {form.allegati.length>0&&<div className="attach-list" style={{marginTop:10}}>{form.allegati.map((a,i)=><div key={i} style={{background:"var(--surface2)",border:"1px solid var(--border)",borderRadius:8,padding:"6px 10px",fontSize:12,display:"flex",alignItems:"center",gap:6}}><Icon name="file" size={12} color="var(--accent)"/>{a}<button style={{background:"none",border:"none",cursor:"pointer",color:"var(--text3)",padding:0,marginLeft:4}} onClick={()=>set("allegati",form.allegati.filter((_,j)=>j!==i))}><Icon name="x" size={12}/></button></div>)}</div>}
          <div style={{marginTop:20}} className="row-2">
            <button className="btn btn-ghost" onClick={()=>setStep(2)}>Indietro</button>
            <button className="btn btn-primary" onClick={handleSave} disabled={sheetsStatus==="loading"}>{sheetsStatus==="loading"?"Invio...":isEdit?"Aggiorna":"Salva"}</button>
          </div>
        </div>
      )}
      <div className="scroll-pad"/>
    </div>
  );
}

// ─── NOTIFICATIONS SCREEN ────────────────────────────────────────────────────
function NotificationsScreen({ notifications, user, onConfirm }) {
  const myNotifs = notifications.filter(n => n.type === "info" || n.type === "mandatory");
  return (
    <div className="content">
      <div className="section-title" style={{marginTop:4}}>Notifiche ({myNotifs.filter(n=>!n.read.includes(user.id)).length} non lette)</div>
      {myNotifs.map(n => {
        const isRead = n.read.includes(user.id);
        return (
          <div key={n.id} className={"notif-card "+n.type+(!isRead?" unread":"")}>
            <div style={{display:"flex",alignItems:"center",justifyContent:"space-between"}}>
              <span className={"notif-type "+n.type}>{n.type==="mandatory"?<><Icon name="alert" size={10}/> Obbligatoria</>:<><Icon name="info" size={10}/> Info</>}</span>
              {isRead&&<span style={{fontSize:11,color:"var(--success)"}}><Icon name="check" size={11} color="var(--success)"/> Confermata</span>}
            </div>
            <div className="notif-title">{n.title}</div>
            <div className="notif-body">{n.body}</div>
            <div className="notif-date">{n.date}</div>
            {!isRead && n.type==="mandatory" && (
              <button className="btn btn-success btn-sm" style={{marginTop:12,width:"100%"}} onClick={()=>onConfirm(n.id)}>
                <Icon name="check" size={14}/> Confermo lettura
              </button>
            )}
          </div>
        );
      })}
      <div className="scroll-pad"/>
    </div>
  );
}

// ─── WHISTLEBLOWING ───────────────────────────────────────────────────────────
function WhistleblowingScreen({ currentUser }) {
  const [anon, setAnon] = useState(false);
  const [category, setCat] = useState("");
  const [msg, setMsg] = useState("");
  const [sent, setSent] = useState(false);
  const [sheetsStatus, setSS] = useState("idle");
  const handleSend = async () => {
    if(!msg.trim()){showToast("Inserisci descrizione","error");return;}
    if(!category){showToast("Seleziona categoria","error");return;}
    setSS("loading");
    const res = await inviaASheets("whistleblowing",{anonima:anon,nomeMittente:anon?null:currentUser?.name,categoria:category,messaggio:msg});
    if(res.locale){setSS("local");showToast("Salvata in locale","error");}
    else if(res.ok){setSS("ok");showToast("Segnalazione inviata!");}
    else{setSS("error");showToast("Errore invio","error");}
    setSent(true);
  };
  if(sent) return (
    <div className="content" style={{display:"flex",flexDirection:"column",alignItems:"center",justifyContent:"center",minHeight:"60vh"}}>
      <div style={{background:"rgba(34,197,94,.12)",borderRadius:"50%",padding:24,marginBottom:16}}><Icon name="check" size={36} color="var(--success)"/></div>
      <h2 style={{fontSize:20,fontWeight:700,marginBottom:8}}>Segnalazione inviata</h2>
      <p style={{color:"var(--text2)",fontSize:14,textAlign:"center",lineHeight:1.6,marginBottom:16}}>Trasmessa in modo {anon?"completamente anonimo":"riservato"}.</p>
      <SheetsStatus status={sheetsStatus}/>
      <button className="btn btn-ghost" style={{marginTop:16,maxWidth:220}} onClick={()=>{setSent(false);setMsg("");setCat("");setSS("idle");}}>Nuova segnalazione</button>
    </div>
  );
  return (
    <div className="content">
      <div className="whistle-header">
        <div className="whistle-icon"><Icon name="shield" size={28} color="var(--accent2)"/></div>
        <div style={{fontSize:20,fontWeight:700}}>Whistleblowing</div>
        <div style={{fontSize:13,color:"var(--text2)",marginTop:4,lineHeight:1.5}}>Segnala situazioni anomale in modo sicuro.<br/>Protetto ai sensi del D.Lgs 24/2023.</div>
      </div>
      <SheetsStatus status={sheetsStatus}/>
      <div className="anon-toggle">
        <div><div style={{fontSize:14,fontWeight:600}}>Segnalazione Anonima</div><div style={{fontSize:12,color:"var(--text2)",marginTop:2}}>{anon?"Il tuo nome NON verrà salvato":"Il tuo nome sarà visibile al responsabile"}</div></div>
        <button className={"toggle "+(anon?"on":"")} onClick={()=>setAnon(!anon)}/>
      </div>
      <div className="form-group"><label>Categoria</label><select className="input" value={category} onChange={e=>setCat(e.target.value)}><option value="">Seleziona...</option><option>Sicurezza sul lavoro</option><option>Comportamento scorretto</option><option>Irregolarità amministrative</option><option>Discriminazione / Molestie</option><option>Frode o corruzione</option><option>Altro</option></select></div>
      <div className="form-group"><label>Descrizione</label><textarea className="input" rows={6} placeholder="Descrivi..." value={msg} onChange={e=>setMsg(e.target.value)}/></div>
      <div style={{background:"rgba(9,132,227,.08)",border:"1px solid rgba(9,132,227,.2)",borderRadius:10,padding:12,marginBottom:20,fontSize:12,color:"var(--text2)",lineHeight:1.5}}>{anon?"Modalità ANONIMA: nessun dato identificativo.":"Modalità RISERVATA: nominativo visibile solo al responsabile."}</div>
      <button className="btn btn-primary" onClick={handleSend} disabled={sheetsStatus==="loading"}><Icon name="send" size={16}/> Invia segnalazione</button>
      <div className="scroll-pad"/>
    </div>
  );
}

// ─── PROFILE SCREEN ───────────────────────────────────────────────────────────
function ProfileScreen({ user, records, onLogout, onChangePassword }) {
  const [showPwd, setShowPwd] = useState(false);
  const [pwd, setPwd] = useState({ current:"", new1:"", new2:"" });
  const [pwdErr, setPwdErr] = useState("");
  const initials = user.name.split(" ").map(w=>w[0]).join("");
  const mese = today().slice(0,7);
  const rMese = records.filter(r=>r.data.startsWith(mese)&&r.userId===user.id);
  const totStraord = rMese.reduce((s,r)=>s+calcOre(r.oraInizio,r.oraFine,r.pausa).straordinari,0);

  const handleChangePwd = () => {
    if(pwd.current!==user.password){setPwdErr("Password attuale errata");return;}
    if(pwd.new1.length<4){setPwdErr("La nuova password deve avere almeno 4 caratteri");return;}
    if(pwd.new1!==pwd.new2){setPwdErr("Le password non corrispondono");return;}
    onChangePassword(pwd.new1);
    setPwd({current:"",new1:"",new2:""});
    setPwdErr("");
    setShowPwd(false);
    showToast("Password aggiornata!");
  };

  return (
    <div className="content">
      <div style={{paddingTop:20,paddingBottom:8}}>
        <div className="profile-avatar" style={{background:`linear-gradient(135deg,${user.color||"var(--accent)"},var(--accent2))`}}>{initials}</div>
        <div className="profile-name">{user.name}</div>
        <div className="profile-role">{user.role}</div>
      </div>
      <div className="section-title">Riepilogo mese</div>
      <div className="stats-row">
        <div className="stat-card"><div className="stat-value stat-accent">{rMese.length}</div><div className="stat-label">Lavori</div></div>
        <div className="stat-card"><div className="stat-value stat-warning">{totStraord}h</div><div className="stat-label">Straordinari</div></div>
      </div>
      <div className="section-title">Account</div>
      {[["Username",user.username],["Ruolo",user.role],["ID","#"+user.id]].map(([l,v])=>(
        <div key={l} className="profile-item"><span className="profile-label">{l}</span><span className="profile-value">{v}</span></div>
      ))}
      <div style={{marginTop:16}}>
        <button className="btn btn-ghost" onClick={()=>setShowPwd(!showPwd)}>
          <Icon name="lock" size={15}/> {showPwd?"Annulla":"Cambia password"}
        </button>
      </div>
      {showPwd && (
        <div style={{marginTop:12,padding:16,background:"var(--surface2)",borderRadius:"var(--radius)",border:"1px solid var(--border)"}}>
          {pwdErr && <div className="error-msg">{pwdErr}</div>}
          <Field label="Password attuale"><input className="input" type="password" value={pwd.current} onChange={e=>setPwd(p=>({...p,current:e.target.value}))}/></Field>
          <Field label="Nuova password"><input className="input" type="password" value={pwd.new1} onChange={e=>setPwd(p=>({...p,new1:e.target.value}))}/></Field>
          <Field label="Conferma nuova password"><input className="input" type="password" value={pwd.new2} onChange={e=>setPwd(p=>({...p,new2:e.target.value}))}/></Field>
          <button className="btn btn-primary" onClick={handleChangePwd}><Icon name="check" size={15}/> Salva password</button>
        </div>
      )}
      <div style={{marginTop:24}}>
        <button className="btn btn-danger" onClick={onLogout}><Icon name="logout" size={16}/> Esci dall'app</button>
      </div>
      <div className="scroll-pad"/>
    </div>
  );
}

// ─── CALENDAR ─────────────────────────────────────────────────────────────────
function CalendarScreen({ records, users, user, onAddEvent }) {
  const [view, setView] = useState("month");
  const [cursor, setCursor] = useState(new Date());
  const [selectedDay, setSelectedDay] = useState(null);

  const MESI = ["Gennaio","Febbraio","Marzo","Aprile","Maggio","Giugno","Luglio","Agosto","Settembre","Ottobre","Novembre","Dicembre"];
  const GIORNI = ["Lu","Ma","Me","Gi","Ve","Sa","Do"];

  const getUserColor = uid => (users.find(u=>u.id===uid)||{}).color || "#8892a4";
  const getUserName  = uid => (users.find(u=>u.id===uid)||{}).name || "?";

  // Month view
  const buildMonthDays = () => {
    const y = cursor.getFullYear(), m = cursor.getMonth();
    const first = new Date(y,m,1);
    const startDow = (first.getDay()+6)%7; // Lu=0
    const days = [];
    for(let i=0;i<startDow;i++){const d=new Date(y,m,1-startDow+i);days.push({date:d,cur:false});}
    const tot = new Date(y,m+1,0).getDate();
    for(let i=1;i<=tot;i++) days.push({date:new Date(y,m,i),cur:true});
    while(days.length%7!==0){const l=days[days.length-1].date;days.push({date:new Date(l.getTime()+86400000),cur:false});}
    return days;
  };

  const getEventsForDate = d => {
    const ds = d.toISOString().slice(0,10);
    return records.filter(r=>r.data===ds && (user.role==="Admin" || r.userId===user.id));
  };

  // Week view
  const buildWeekDays = () => {
    const d = new Date(cursor);
    const dow = (d.getDay()+6)%7;
    const mon = new Date(d); mon.setDate(d.getDate()-dow);
    return Array.from({length:7},(_,i)=>{const day=new Date(mon);day.setDate(mon.getDate()+i);return day;});
  };

  const prevPeriod = () => { const d=new Date(cursor); view==="month"?d.setMonth(d.getMonth()-1):d.setDate(d.getDate()-7); setCursor(d); };
  const nextPeriod = () => { const d=new Date(cursor); view==="month"?d.setMonth(d.getMonth()+1):d.setDate(d.getDate()+7); setCursor(d); };

  const todayStr = today();

  return (
    <div className="content">
      <div className="cal-header">
        <button className="btn btn-ghost btn-sm" style={{width:"auto",padding:"8px"}} onClick={prevPeriod}><Icon name="chevLeft" size={16}/></button>
        <div>
          <div className="cal-month">{view==="month"?MESI[cursor.getMonth()]+" "+cursor.getFullYear():buildWeekDays()[0].toLocaleDateString("it-IT",{day:"numeric",month:"short"})+" – "+buildWeekDays()[6].toLocaleDateString("it-IT",{day:"numeric",month:"short",year:"numeric"})}</div>
        </div>
        <button className="btn btn-ghost btn-sm" style={{width:"auto",padding:"8px"}} onClick={nextPeriod}><Icon name="chevRight" size={16}/></button>
      </div>

      <div className="cal-toggle" style={{marginBottom:14}}>
        <button className={"cal-toggle-btn"+(view==="month"?" active":"")} onClick={()=>setView("month")}>Mese</button>
        <button className={"cal-toggle-btn"+(view==="week"?" active":"")} onClick={()=>setView("week")}>Settimana</button>
      </div>

      {/* Legenda utenti (solo admin) */}
      {user.role==="Admin" && (
        <div style={{display:"flex",flexWrap:"wrap",gap:6,marginBottom:12}}>
          {users.filter(u=>u.role!=="Admin").map(u=>(
            <div key={u.id} style={{display:"flex",alignItems:"center",gap:5,fontSize:11,fontWeight:600}}>
              <div style={{width:10,height:10,borderRadius:3,background:u.color}}/>
              {u.name.split(" ")[0]}
            </div>
          ))}
        </div>
      )}

      {view==="month" && (
        <>
          <div className="cal-grid" style={{marginBottom:4}}>
            {GIORNI.map(g=><div key={g} className="cal-dow">{g}</div>)}
          </div>
          <div className="cal-grid">
            {buildMonthDays().map((item,i)=>{
              const evs = getEventsForDate(item.date);
              const ds = item.date.toISOString().slice(0,10);
              const isToday = ds===todayStr;
              return (
                <div key={i} className={"cal-day"+(item.cur?"":" other-month")+(isToday?" today":"")}
                  onClick={()=>{ setSelectedDay(item.date); if(user.role==="Admin") onAddEvent(item.date); }}>
                  <div className="cal-day-num">{item.date.getDate()}</div>
                  {evs.slice(0,2).map((ev,j)=>(
                    <div key={j} className="cal-event" style={{background:getUserColor(ev.userId)}}>{user.role==="Admin"?getUserName(ev.userId).split(" ")[0]:ev.cliente||"Lavoro"}</div>
                  ))}
                  {evs.length>2&&<div style={{fontSize:9,color:"var(--text3)"}}>+{evs.length-2}</div>}
                </div>
              );
            })}
          </div>
        </>
      )}

      {view==="week" && (
        <div className="week-grid">
          {buildWeekDays().map((day,i)=>{
            const ds = day.toISOString().slice(0,10);
            const evs = getEventsForDate(day);
            const isToday = ds===todayStr;
            return (
              <div key={i} className="week-day-row">
                <div className={"week-day-label"+(isToday?" today-lbl":"")}>
                  {day.toLocaleDateString("it-IT",{weekday:"short",day:"numeric",month:"short"})}
                  {isToday&&<span style={{fontSize:10,background:"var(--accent)",color:"white",borderRadius:4,padding:"1px 5px"}}>oggi</span>}
                  {user.role==="Admin"&&<button className="btn btn-sm btn-ghost" style={{width:"auto",padding:"3px 8px",marginLeft:"auto",fontSize:11}} onClick={()=>onAddEvent(day)}><Icon name="plus" size={11}/></button>}
                </div>
                {evs.length===0&&<div style={{fontSize:12,color:"var(--text3)",padding:"4px 0"}}>Nessun lavoro</div>}
                {evs.map((ev,j)=>(
                  <div key={j} className="week-event" style={{background:getUserColor(ev.userId)+"22"}}>
                    <div className="week-event-dot" style={{background:getUserColor(ev.userId)}}/>
                    <div className="week-event-info">
                      <div className="week-event-title" style={{color:getUserColor(ev.userId)}}>{user.role==="Admin"?getUserName(ev.userId)+" – ":""}{ev.cliente||"Lavoro"}</div>
                      <div className="week-event-sub">{ev.oraInizio}–{ev.oraFine} · {ev.cantiere||""}</div>
                    </div>
                  </div>
                ))}
              </div>
            );
          })}
        </div>
      )}
      <div className="scroll-pad"/>
    </div>
  );
}

// ─── ADMIN PANEL ──────────────────────────────────────────────────────────────
function AdminPanel({ users, setUsers, notifications, setNotifications, records }) {
  const [tab, setTab] = useState("notifiche");

  return (
    <div className="content">
      <div className="admin-tab">
        <button className={"admin-tab-btn"+(tab==="notifiche"?" active":"")} onClick={()=>setTab("notifiche")}><Icon name="bell" size={13}/> Avvisi</button>
        <button className={"admin-tab-btn"+(tab==="utenti"?" active":"")} onClick={()=>setTab("utenti")}><Icon name="users" size={13}/> Utenti</button>
      </div>
      {tab==="notifiche" && <AdminNotifiche notifications={notifications} setNotifications={setNotifications} users={users}/>}
      {tab==="utenti" && <AdminUtenti users={users} setUsers={setUsers} records={records}/>}
      <div className="scroll-pad"/>
    </div>
  );
}

// ─── ADMIN: NOTIFICHE ─────────────────────────────────────────────────────────
function AdminNotifiche({ notifications, setNotifications, users }) {
  const [showForm, setShowForm] = useState(false);
  const [form, setForm] = useState({ title:"", body:"", type:"info" });
  const [err, setErr] = useState("");

  const handleSend = () => {
    if(!form.title.trim()||!form.body.trim()){setErr("Compila titolo e testo");return;}
    const n = { id: Date.now(), title:form.title, body:form.body, type:form.type, date:today(), read:[], createdBy:"Admin" };
    setNotifications(ns=>[n,...ns]);
    setForm({title:"",body:"",type:"info"});
    setShowForm(false);
    showToast("Avviso inviato a tutti!");
  };

  const handleDelete = id => {
    if(window.confirm("Eliminare questo avviso?")) setNotifications(ns=>ns.filter(n=>n.id!==id));
  };

  const dipendenti = users.filter(u=>u.role!=="Admin");

  return (
    <div>
      <div style={{display:"flex",alignItems:"center",justifyContent:"space-between",marginBottom:12}}>
        <span style={{fontWeight:700,fontSize:15}}>Avvisi inviati</span>
        <button className="btn btn-primary btn-sm" onClick={()=>setShowForm(!showForm)}><Icon name="plus" size={13}/> Nuovo avviso</button>
      </div>

      {showForm && (
        <div style={{background:"var(--surface2)",border:"1px solid var(--border)",borderRadius:"var(--radius)",padding:16,marginBottom:16}}>
          <div style={{fontWeight:700,fontSize:14,marginBottom:12}}>Nuovo avviso</div>
          {err&&<div className="error-msg">{err}</div>}
          <Field label="Tipo">
            <select className="input" value={form.type} onChange={e=>setForm(f=>({...f,type:e.target.value}))}>
              <option value="info">📢 Informativo (nessuna conferma richiesta)</option>
              <option value="mandatory">⚠️ Obbligatorio (conferma lettura richiesta)</option>
            </select>
          </Field>
          <Field label="Titolo"><input className="input" placeholder="Es. Aggiornamento procedure" value={form.title} onChange={e=>setForm(f=>({...f,title:e.target.value}))}/></Field>
          <Field label="Testo"><textarea className="input" rows={4} placeholder="Scrivi il testo dell'avviso..." value={form.body} onChange={e=>setForm(f=>({...f,body:e.target.value}))}/></Field>
          <div style={{background:form.type==="mandatory"?"rgba(245,158,11,.08)":"rgba(0,184,148,.08)",border:`1px solid ${form.type==="mandatory"?"rgba(245,158,11,.3)":"rgba(0,184,148,.3)"}`,borderRadius:8,padding:10,marginBottom:12,fontSize:12,color:"var(--text2)"}}>
            {form.type==="mandatory"?"⚠️ Avviso OBBLIGATORIO: ogni dipendente dovrà premere 'Confermo lettura'. Apparirà in popup al prossimo accesso.":"📢 Avviso INFORMATIVO: appare nella sezione notifiche. Nessuna conferma richiesta."}
          </div>
          <div className="row-2">
            <button className="btn btn-ghost" onClick={()=>setShowForm(false)}>Annulla</button>
            <button className="btn btn-primary" onClick={handleSend}><Icon name="send" size={14}/> Invia</button>
          </div>
        </div>
      )}

      {notifications.length===0&&<div style={{textAlign:"center",padding:"30px 0",color:"var(--text2)"}}>Nessun avviso inviato</div>}
      {notifications.map(n=>{
        const total = dipendenti.length;
        const letti = n.read.length;
        return (
          <div key={n.id} className={"notif-card "+n.type} style={{position:"relative"}}>
            <div style={{display:"flex",alignItems:"center",justifyContent:"space-between",marginBottom:6}}>
              <span className={"notif-type "+n.type}>{n.type==="mandatory"?<><Icon name="alert" size={10}/> Obbligatorio</>:<><Icon name="info" size={10}/> Info</>}</span>
              <button className="btn btn-danger btn-sm" style={{width:"auto",padding:"3px 8px"}} onClick={()=>handleDelete(n.id)}><Icon name="trash" size={11}/></button>
            </div>
            <div className="notif-title">{n.title}</div>
            <div className="notif-body">{n.body}</div>
            <div className="notif-date">{n.date}</div>
            {n.type==="mandatory" && (
              <div style={{marginTop:10}}>
                <div style={{fontSize:11,fontWeight:700,color:"var(--text2)",marginBottom:6,textTransform:"uppercase",letterSpacing:".5px"}}>Conferme lettura ({letti}/{total})</div>
                <div style={{display:"flex",flexWrap:"wrap",gap:4}}>
                  {dipendenti.map(u=>(
                    <span key={u.id} className={"read-chip "+(n.read.includes(u.id)?"yes":"no")}>
                      {n.read.includes(u.id)?<Icon name="check" size={10}/>:<Icon name="x" size={10}/>} {u.name.split(" ")[0]}
                    </span>
                  ))}
                </div>
              </div>
            )}
          </div>
        );
      })}
    </div>
  );
}

// ─── ADMIN: UTENTI ────────────────────────────────────────────────────────────
function AdminUtenti({ users, setUsers, records }) {
  const [showForm, setShowForm] = useState(false);
  const [form, setForm] = useState({ name:"", role:"Operaio", password:"1234" });
  const [err, setErr] = useState("");

  const colorFor = idx => DIPENDENTE_COLORS[idx % DIPENDENTE_COLORS.length];

  const handleAdd = async () => {
    if(!form.name.trim()){setErr("Inserisci nome e cognome");return;}
    const parts = form.name.trim().split(" ");
    if(parts.length<2){setErr("Inserisci nome E cognome");return;}
    const username = parts.map(p=>p.toLowerCase()).join(".");
    if(users.find(u=>u.username===username)){setErr("Utente già esistente");return;}
    const newUser = { id: Date.now(), username, password: form.password||"1234", name: form.name.trim(), role: form.role, color: colorFor(users.length) };
    setUsers(us=>[...us,newUser]);
    await inviaASheets("nuovo_utente",{ username, name:newUser.name, role:newUser.role });
    setForm({name:"",role:"Operaio",password:"1234"});
    setShowForm(false);
    showToast("Utente "+newUser.name+" creato!");
  };

  const handleDelete = id => {
    if(window.confirm("Eliminare questo utente?")) setUsers(us=>us.filter(u=>u.id!==id));
  };

  const handleResetPwd = (id, name) => {
    if(window.confirm("Reimpostare la password di "+name+" a '1234'?"))
      setUsers(us=>us.map(u=>u.id===id?{...u,password:"1234"}:u));
    showToast("Password reimpostata per "+name);
  };

  const dipendenti = users.filter(u=>u.role!=="Admin");

  return (
    <div>
      <div style={{display:"flex",alignItems:"center",justifyContent:"space-between",marginBottom:12}}>
        <span style={{fontWeight:700,fontSize:15}}>Dipendenti ({dipendenti.length})</span>
        <button className="btn btn-primary btn-sm" onClick={()=>setShowForm(!showForm)}><Icon name="plus" size={13}/> Nuovo</button>
      </div>

      {showForm && (
        <div style={{background:"var(--surface2)",border:"1px solid var(--border)",borderRadius:"var(--radius)",padding:16,marginBottom:16}}>
          <div style={{fontWeight:700,fontSize:14,marginBottom:12}}>Nuovo dipendente</div>
          {err&&<div className="error-msg">{err}</div>}
          <Field label="Nome e Cognome"><input className="input" placeholder="Es. Marco Verdi" value={form.name} onChange={e=>setForm(f=>({...f,name:e.target.value}))}/></Field>
          <div style={{fontSize:11,color:"var(--text3)",marginTop:-8,marginBottom:10}}>Username generato: {form.name.trim().split(" ").filter(Boolean).map(p=>p.toLowerCase()).join(".")}</div>
          <Field label="Ruolo">
            <select className="input" value={form.role} onChange={e=>setForm(f=>({...f,role:e.target.value}))}>
              <option>Operaio</option><option>Capo Cantiere</option><option>Magazziniere</option><option>Altro</option>
            </select>
          </Field>
          <Field label="Password iniziale"><input className="input" type="text" value={form.password} onChange={e=>setForm(f=>({...f,password:e.target.value}))}/></Field>
          <div className="row-2">
            <button className="btn btn-ghost" onClick={()=>setShowForm(false)}>Annulla</button>
            <button className="btn btn-primary" onClick={handleAdd}><Icon name="check" size={14}/> Crea</button>
          </div>
        </div>
      )}

      {dipendenti.map(u => {
        const nLavori = records.filter(r=>r.userId===u.id).length;
        return (
          <div key={u.id} className="user-card">
            <div className="user-avatar-sm" style={{background:u.color}}>{u.name.split(" ").map(w=>w[0]).join("")}</div>
            <div style={{flex:1,minWidth:0}}>
              <div style={{fontWeight:600,fontSize:14}}>{u.name}</div>
              <div style={{fontSize:11,color:"var(--text2)",marginTop:2}}>{u.role} · @{u.username} · {nLavori} lavori</div>
            </div>
            <div style={{display:"flex",gap:6}}>
              <button className="btn btn-sm btn-ghost" style={{width:"auto",padding:"5px 8px"}} title="Reset password" onClick={()=>handleResetPwd(u.id,u.name)}><Icon name="key" size={13}/></button>
              <button className="btn btn-sm btn-danger" style={{width:"auto",padding:"5px 8px"}} onClick={()=>handleDelete(u.id)}><Icon name="trash" size={13}/></button>
            </div>
          </div>
        );
      })}
    </div>
  );
}

// ─── ADD EVENT MODAL (admin) ──────────────────────────────────────────────────
function AddEventModal({ date, users, onClose, onAdd }) {
  const [form, setForm] = useState({ userId:"", cliente:"", cantiere:"", oraInizio:"08:00", oraFine:"17:00", note:"" });
  const dipendenti = users.filter(u=>u.role!=="Admin");
  const handleAdd = () => {
    if(!form.userId||!form.cliente){showToast("Compila dipendente e cliente","error");return;}
    const ev = { ...form, userId:Number(form.userId), id:Date.now(), data:date.toISOString().slice(0,10), pausa:0, mezzo:"", descrizione:"Lavoro pianificato", materiali:[], altrePause:"", allegati:[], gps:null, nota:form.note, pianificato:true };
    onAdd(ev);
    showToast("Lavoro aggiunto al calendario!");
    onClose();
  };
  return (
    <div className="overlay-center" onClick={onClose}>
      <div className="modal-center" onClick={e=>e.stopPropagation()}>
        <div style={{fontWeight:700,fontSize:16,marginBottom:14}}>📅 Pianifica lavoro — {date.toLocaleDateString("it-IT",{weekday:"short",day:"numeric",month:"long"})}</div>
        <Field label="Dipendente" required>
          <select className="input" value={form.userId} onChange={e=>setForm(f=>({...f,userId:e.target.value}))}>
            <option value="">Seleziona...</option>
            {dipendenti.map(u=><option key={u.id} value={u.id}>{u.name}</option>)}
          </select>
        </Field>
        <Field label="Cliente" required><input className="input" placeholder="Es. Rossi S.r.l." value={form.cliente} onChange={e=>setForm(f=>({...f,cliente:e.target.value}))}/></Field>
        <Field label="Cantiere"><input className="input" placeholder="Es. Via Roma 10" value={form.cantiere} onChange={e=>setForm(f=>({...f,cantiere:e.target.value}))}/></Field>
        <div className="row-2">
          <Field label="Inizio"><input type="time" className="input" value={form.oraInizio} onChange={e=>setForm(f=>({...f,oraInizio:e.target.value}))}/></Field>
          <Field label="Fine"><input type="time" className="input" value={form.oraFine} onChange={e=>setForm(f=>({...f,oraFine:e.target.value}))}/></Field>
        </div>
        <Field label="Note"><textarea className="input" rows={2} value={form.note} onChange={e=>setForm(f=>({...f,note:e.target.value}))}/></Field>
        <div className="row-2">
          <button className="btn btn-ghost" onClick={onClose}>Annulla</button>
          <button className="btn btn-primary" onClick={handleAdd}><Icon name="check" size={14}/> Aggiungi</button>
        </div>
      </div>
    </div>
  );
}

// ─── APP ROOT ─────────────────────────────────────────────────────────────────
export default function App() {
  const [users, setUsers]           = useState(INITIAL_USERS);
  const [user, setUser]             = useState(null);
  const [records, setRecords]       = useState([]);
  const [notifs, setNotifs]         = useState(INITIAL_NOTIFICATIONS);
  const [mezzoAttivo, setMezzo]     = useState("");
  const [showMezzoPopup, setSMP]    = useState(false);
  const [screen, setScreen]         = useState("home");
  const [selRecord, setSelRecord]   = useState(null);
  const [editRecord, setEditRecord] = useState(null);
  const [addEventDate, setAddEventDate] = useState(null);
  const [loginForm, setLF]          = useState({ username:"", password:"" });
  const [loginError, setLE]         = useState("");

  const currentUser = user ? users.find(u=>u.id===user.id) : null;
  const mandatoryUnread = currentUser ? notifs.find(n=>n.type==="mandatory"&&!n.read.includes(currentUser.id)) : null;
  const unreadCount = currentUser ? notifs.filter(n=>!n.read.includes(currentUser.id)).length : 0;

  useEffect(()=>{ if(user) setSMP(true); },[user]);

  const handleLogin = () => {
    const found = users.find(u=>u.username===loginForm.username&&u.password===loginForm.password);
    if(!found){setLE("Credenziali non corrette");return;}
    setUser(found); setLE("");
  };
  const handleLogout = () => { setUser(null); setScreen("home"); setSMP(false); };

  const handleSaveRecord = r => {
    setRecords(rs => rs.find(x=>x.id===r.id) ? rs.map(x=>x.id===r.id?r:x) : [r,...rs]);
    setEditRecord(null);
    setScreen("home");
  };
  const handleDeleteRecord = id => { setRecords(rs=>rs.filter(r=>r.id!==id)); setSelRecord(null); showToast("Lavoro eliminato"); };
  const handleConfirmNotif = id => setNotifs(ns=>ns.map(n=>n.id===id?{...n,read:[...n.read,currentUser.id]}:n));
  const handleCambioMezzo  = m => { setMezzo(m); showToast("Mezzo: "+m.split(" - ")[0]); };
  const handleChangePassword = newPwd => setUsers(us=>us.map(u=>u.id===currentUser.id?{...u,password:newPwd}:u));

  const isAdmin = currentUser?.role==="Admin";

  const navItems = isAdmin
    ? [
        { id:"home",   icon:"home",     label:"Home" },
        { id:"cal",    icon:"calendar", label:"Calendario" },
        { id:"admin",  icon:"users",    label:"Admin" },
        { id:"notifs", icon:"bell",     label:"Avvisi" },
        { id:"profile",icon:"user",     label:"Profilo" },
      ]
    : [
        { id:"home",   icon:"home",     label:"Home" },
        { id:"list",   icon:"list",     label:"Lavori" },
        { id:"cal",    icon:"calendar", label:"Calendario" },
        { id:"notifs", icon:"bell",     label:"Avvisi" },
        { id:"profile",icon:"user",     label:"Profilo" },
      ];

  const titles = { home:"RGR Elettra Hub", list:"Storico Lavori", new:"Nuovo Lavoro", notifs:"Notifiche", profile:"Profilo", whistleblowing:"Segnalazioni", cal:"Calendario", admin:"Pannello Admin" };

  if(!user) return (
    <>
      <style>{css}</style>
      <Toast/>
      <div className="login-screen">
        <div className="login-logo">
          <div className="logo-icon">RGR</div>
          <h1>RGR Elettra Hub</h1>
          <p>Impianti Tecnologici</p>
        </div>
        <div className="login-form">
          {loginError&&<div className="error-msg">{loginError}</div>}
          <div className="form-group"><label>Username</label><input className="input" placeholder="mario.rossi" value={loginForm.username} onChange={e=>setLF(f=>({...f,username:e.target.value}))} onKeyDown={e=>e.key==="Enter"&&handleLogin()}/></div>
          <div className="form-group"><label>Password</label><input className="input" type="password" placeholder="..." value={loginForm.password} onChange={e=>setLF(f=>({...f,password:e.target.value}))} onKeyDown={e=>e.key==="Enter"&&handleLogin()}/></div>
          <button className="btn btn-primary" onClick={handleLogin}>Accedi</button>
          <p style={{fontSize:12,color:"var(--text3)",textAlign:"center",marginTop:16}}>Demo: mario.rossi / 1234 · admin / admin</p>
        </div>
      </div>
    </>
  );

  return (
    <>
      <style>{css}</style>
      <Toast/>

      {showMezzoPopup && !isAdmin && (
        <MezzoPopup user={currentUser} ultimoMezzo={mezzoAttivo}
          onConfirm={m=>{ setMezzo(m); setSMP(false); showToast("Mezzo: "+m.split(" - ")[0]); }}/>
      )}
      {!showMezzoPopup && mandatoryUnread && screen!=="notifs" && (
        <MandatoryNotifModal notif={mandatoryUnread} userName={currentUser?.name}
          onConfirm={()=>{ handleConfirmNotif(mandatoryUnread.id); showToast("Avviso confermato"); }}/>
      )}
      {selRecord && (
        <RecordDetailModal r={selRecord} onClose={()=>setSelRecord(null)}
          onEdit={()=>{ setEditRecord(selRecord); setSelRecord(null); setScreen("new"); }}
          onDelete={()=>handleDeleteRecord(selRecord.id)}/>
      )}
      {addEventDate && isAdmin && (
        <AddEventModal date={addEventDate} users={users}
          onClose={()=>setAddEventDate(null)}
          onAdd={ev=>{ setRecords(rs=>[ev,...rs]); setAddEventDate(null); }}/>
      )}

      <div className="app">
        <div className="header">
          <div className="header-logo">
            <div className="logo-sm">RGR</div>
            <div>
              <div className="header-title">{titles[screen]||"RGR Elettra Hub"}</div>
              <div className="header-sub">{currentUser?.name}</div>
            </div>
          </div>
          <div style={{display:"flex",gap:8,alignItems:"center"}}>
            <button style={{background:"none",border:"none",cursor:"pointer",color:"var(--text2)",padding:6}} onClick={()=>setScreen("whistleblowing")}>
              <Icon name="shield" size={20}/>
            </button>
            <div className="notif-badge" style={{cursor:"pointer"}} onClick={()=>setScreen("notifs")}>
              <Icon name="bell" size={22} color={unreadCount>0?"var(--accent)":"var(--text2)"}/>
              {unreadCount>0&&<div className="badge-dot"/>}
            </div>
          </div>
        </div>

        {screen==="home"           && <HomeScreen user={currentUser} records={records} mezzoAttivo={mezzoAttivo} onCambioMezzo={handleCambioMezzo} onNewRecord={()=>{setEditRecord(null);setScreen("new");}}/>}
        {screen==="list"           && <RecordListScreen records={records} user={currentUser} onEdit={r=>{setEditRecord(r);setScreen("new");}} onDelete={handleDeleteRecord} onSelect={setSelRecord}/>}
        {screen==="new"            && <RecordFormScreen onSave={handleSaveRecord} currentUser={currentUser} mezzoAttivo={mezzoAttivo} editRecord={editRecord} onCancel={()=>{setEditRecord(null);setScreen(isAdmin?"home":"list");}}/>}
        {screen==="notifs"         && <NotificationsScreen notifications={notifs} user={currentUser} onConfirm={handleConfirmNotif}/>}
        {screen==="profile"        && <ProfileScreen user={currentUser} records={records} onLogout={handleLogout} onChangePassword={handleChangePassword}/>}
        {screen==="whistleblowing" && <WhistleblowingScreen currentUser={currentUser}/>}
        {screen==="cal"            && <CalendarScreen records={records} users={users} user={currentUser} onAddEvent={d=>{setAddEventDate(d);}}/>}
        {screen==="admin"          && <AdminPanel users={users} setUsers={setUsers} notifications={notifs} setNotifications={setNotifs} records={records}/>}

        <div className="bottom-nav">
          {navItems.map(item=>(
            <button key={item.id}
              className={"nav-item "+(item.fab?"nav-fab ":"")+(screen===item.id?"active":"")}
              onClick={()=>{ if(item.id==="new"){setEditRecord(null);} setScreen(item.id); }}>
              <div className={item.id==="notifs"?"notif-badge":""}>
                <Icon name={item.icon} size={item.fab?22:20}/>
                {item.id==="notifs"&&unreadCount>0&&<div className="badge-dot"/>}
              </div>
              {!item.fab&&<span>{item.label}</span>}
            </button>
          ))}
        </div>
      </div>
    </>
  );
}
