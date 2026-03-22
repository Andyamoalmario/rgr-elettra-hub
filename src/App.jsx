import { useState, useEffect, useRef } from "react";

const APPS_SCRIPT_URL = "INCOLLA_QUI_IL_TUO_APPS_SCRIPT_URL";

const USERS = [
  { id: 1, username: "mario.rossi",  password: "1234", name: "Mario Rossi",  role: "Operaio" },
  { id: 2, username: "luca.bianchi", password: "1234", name: "Luca Bianchi", role: "Capo Cantiere" },
];
const MEZZI = [
  { id: 1, targa: "AB 123 CD", tipo: "Furgone Iveco" },
  { id: 2, targa: "EF 456 GH", tipo: "Camion Mercedes" },
  { id: 3, targa: "IL 789 MN", tipo: "Auto Aziendale Fiat" },
  { id: 4, targa: "OP 321 QR", tipo: "Pickup Ford" },
];
const INITIAL_NOTIFICATIONS = [
  { id: 1, title: "Aggiornamento Procedure Sicurezza", body: "A partire dal 01/04/2024 sono in vigore le nuove norme DPI. La lettura e conferma di questo avviso è obbligatoria prima di accedere al cantiere.", type: "mandatory", date: "2024-03-15", read: false },
  { id: 2, title: "Chiusura Uffici - Pasqua", body: "Gli uffici resteranno chiusi dal 29 Marzo al 2 Aprile. Buone feste a tutti.", type: "info", date: "2024-03-10", read: false },
];

// ─── BUSINESS LOGIC ───────────────────────────────────────────────────────────
function calcOre(inizio, fine, pausaMin) {
  if (!inizio || !fine) return { totaleMin: 0, straordinari: 0, ordinarie: "00:00", extraMin: 0 };
  const [hI, mI] = inizio.split(":").map(Number);
  const [hF, mF] = fine.split(":").map(Number);
  const totaleMin = (hF * 60 + mF) - (hI * 60 + mI) - (pausaMin || 0);
  const ordMin = Math.min(Math.max(totaleMin, 0), 480);
  const extraMin = Math.max(0, totaleMin - 480);
  const straordinari = Math.floor(extraMin / 60);
  return {
    totaleMin,
    straordinari,
    ordinarie: Math.floor(ordMin/60).toString().padStart(2,"0") + ":" + (ordMin%60).toString().padStart(2,"0"),
    extraMin
  };
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

// ─── STORAGE ──────────────────────────────────────────────────────────────────
const store = {
  get: (k, def) => { try { const v = JSON.parse(localStorage.getItem(k)); return v !== null ? v : def; } catch { return def; } },
  set: (k, v) => { try { localStorage.setItem(k, JSON.stringify(v)); } catch {} },
};

// ─── SHEETS ───────────────────────────────────────────────────────────────────
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
    pin:       <><path d="M21 10c0 7-9 13-9 13s-9-6-9-13a9 9 0 0118 0z"/><circle cx="12" cy="10" r="3"/></>,
    info:      <><circle cx="12" cy="12" r="10"/><line x1="12" y1="8" x2="12" y2="12"/><line x1="12" y1="16" x2="12.01" y2="16"/></>,
    send:      <><line x1="22" y1="2" x2="11" y2="13"/><polygon points="22 2 15 22 11 13 2 9 22 2"/></>,
    briefcase: <><rect x="2" y="7" width="20" height="14" rx="2" ry="2"/><path d="M16 21V5a2 2 0 00-2-2h-4a2 2 0 00-2 2v16"/></>,
    camera:    <><path d="M23 19a2 2 0 01-2 2H3a2 2 0 01-2-2V8a2 2 0 012-2h4l2-3h6l2 3h4a2 2 0 012 2z"/><circle cx="12" cy="13" r="4"/></>,
    file:      <><path d="M13 2H6a2 2 0 00-2 2v16a2 2 0 002 2h12a2 2 0 002-2V9z"/><polyline points="13 2 13 9 20 9"/></>,
    cloud:     <><polyline points="16 16 12 12 8 16"/><line x1="12" y1="12" x2="12" y2="21"/><path d="M20.39 18.39A5 5 0 0018 9h-1.26A8 8 0 103 16.3"/></>,
    truck:     <><rect x="1" y="3" width="15" height="13"/><polygon points="16 8 20 8 23 11 23 16 16 16 16 8"/><circle cx="5.5" cy="18.5" r="2.5"/><circle cx="18.5" cy="18.5" r="2.5"/></>,
  };
  return (
    <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke={color} strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      {icons[name]}
    </svg>
  );
};

// ─── STYLES ───────────────────────────────────────────────────────────────────
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
  .login-logo img{width:88px;height:88px;object-fit:cover;border:3px solid var(--accent);box-shadow:0 0 20px rgba(0,184,148,.35);display:block;margin:0 auto 14px}
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
  .btn-sm{padding:8px 13px;font-size:13px;width:auto;border-radius:8px}
  .error-msg{background:rgba(239,68,68,.12);border:1px solid rgba(239,68,68,.3);color:#fca5a5;border-radius:8px;padding:12px;font-size:13px;margin-bottom:14px;text-align:center}
  .header{background:var(--surface);border-bottom:1px solid var(--border);padding:12px 18px;display:flex;align-items:center;justify-content:space-between;position:sticky;top:0;z-index:50}
  .header-logo{display:flex;align-items:center;gap:10px}
  .header-logo img{width:32px;height:32px;object-fit:cover;border:2px solid var(--accent)}
  .header-title{font-size:16px;font-weight:700}
  .header-sub{font-size:11px;color:var(--text2);margin-top:1px}
  .notif-badge{position:relative}
  .badge-dot{position:absolute;top:-3px;right:-3px;width:9px;height:9px;background:var(--danger);border-radius:50%;border:2px solid var(--surface)}
  .bottom-nav{background:var(--surface);border-top:1px solid var(--border);display:flex;position:sticky;bottom:0;z-index:50;padding:8px 0 max(8px,env(safe-area-inset-bottom))}
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
  .record-item:active{border-color:var(--accent)}
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
  .upload-area:active{border-color:var(--accent)}
  .attach-list{margin-top:10px;display:flex;flex-wrap:wrap;gap:8px}
  .attach-chip{background:var(--surface2);border:1px solid var(--border);border-radius:8px;padding:6px 10px;font-size:12px;display:flex;align-items:center;gap:6px}
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
  .modal-center{background:var(--surface);border-radius:var(--radius);padding:24px 20px;width:100%;max-width:360px}
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

// ─── SHEETS STATUS ────────────────────────────────────────────────────────────
function SheetsStatus({ status }) {
  if (status === "idle") return null;
  const map = {
    loading: { cls: "sheets-load", icon: "cloud",  text: "Invio a Google Sheets..." },
    ok:      { cls: "sheets-ok",   icon: "check",  text: "Salvato su Google Sheets" },
    error:   { cls: "sheets-err",  icon: "alert",  text: "Errore Sheets - salvato in locale" },
    local:   { cls: "sheets-local",icon: "info",   text: "Sheets non configurato - solo locale" },
  };
  const s = map[status];
  if (!s) return null;
  return <div className={s.cls}><Icon name={s.icon} size={14}/>{s.text}</div>;
}

// ─── MANDATORY MODAL ─────────────────────────────────────────────────────────
function MandatoryNotifModal({ notif, onConfirm }) {
  return (
    <div className="overlay">
      <div className="modal" style={{ borderTop: "3px solid var(--warning)" }}>
        <div className="modal-handle"/>
        <div style={{ display:"flex", alignItems:"center", gap:10, marginBottom:16 }}>
          <div style={{ background:"rgba(245,158,11,.15)", borderRadius:10, padding:10 }}>
            <Icon name="alert" size={22} color="var(--warning)"/>
          </div>
          <div>
            <div style={{ fontSize:11, color:"var(--warning)", fontWeight:700, textTransform:"uppercase" }}>Avviso Obbligatorio</div>
            <div style={{ fontSize:17, fontWeight:700 }}>{notif.title}</div>
          </div>
        </div>
        <p style={{ fontSize:14, color:"var(--text2)", lineHeight:1.6, marginBottom:24 }}>{notif.body}</p>
        <button className="btn btn-primary" onClick={onConfirm}>
          <Icon name="check" size={16}/> Ho letto e confermo
        </button>
      </div>
    </div>
  );
}

// ─── MEZZO POPUP ─────────────────────────────────────────────────────────────
function MezzoPopup({ user, ultimoMezzo, onConfirm }) {
  const [mezzo, setMezzo] = useState(ultimoMezzo || "");
  const ora = new Date().getHours();
  const saluto = ora < 12 ? "Buongiorno" : ora < 18 ? "Buon pomeriggio" : "Buonasera";
  return (
    <div className="overlay-center">
      <div className="modal-center" style={{ border: "1.5px solid var(--accent)" }}>
        <div style={{ textAlign:"center", marginBottom:20 }}>
          <div style={{ width:54, height:54, borderRadius:"50%", background:"linear-gradient(135deg,var(--accent),var(--accent2))", display:"flex", alignItems:"center", justifyContent:"center", margin:"0 auto 12px" }}>
            <Icon name="truck" size={26} color="white"/>
          </div>
          <h2 style={{ fontSize:18, fontWeight:700 }}>{saluto}, {user.name.split(" ")[0]}!</h2>
          <p style={{ fontSize:13, color:"var(--text2)", marginTop:6, lineHeight:1.5 }}>
            {ultimoMezzo ? "Conferma o cambia il mezzo di oggi:" : "Che mezzo utilizzi oggi?"}
          </p>
        </div>
        <div className="form-group">
          <label>Mezzo<span className="req">*</span></label>
          <select className="input" value={mezzo} onChange={e => setMezzo(e.target.value)}
            style={{ borderColor: mezzo ? "var(--accent)" : "var(--border)" }}>
            <option value="">Seleziona targa...</option>
            {MEZZI.map(m => <option key={m.id} value={m.targa + " - " + m.tipo}>{m.targa} - {m.tipo}</option>)}
          </select>
        </div>
        {ultimoMezzo && (
          <p style={{ fontSize:11, color:"var(--text3)", marginBottom:12, textAlign:"center" }}>
            Ultimo mezzo usato: {ultimoMezzo.split(" - ")[0]}
          </p>
        )}
        <button className="btn btn-primary" onClick={() => mezzo && onConfirm(mezzo)}
          disabled={!mezzo} style={{ opacity: mezzo ? 1 : 0.4 }}>
          <Icon name="check" size={16}/> Inizia la giornata
        </button>
      </div>
    </div>
  );
}

// ─── HOME ─────────────────────────────────────────────────────────────────────
function HomeScreen({ user, records, mezzoAttivo, onCambioMezzo }) {
  const oggi = new Date().toISOString().slice(0,10);
  const mese = new Date().toISOString().slice(0,7);
  const rOggi = records.filter(r => r.data === oggi);
  const rMese = records.filter(r => r.data.startsWith(mese));
  const totOggi = rOggi.reduce((s,r) => s + calcOre(r.oraInizio,r.oraFine,r.pausa).totaleMin, 0);
  const totStr  = rMese.reduce((s,r) => s + calcOre(r.oraInizio,r.oraFine,r.pausa).straordinari, 0);
  const targa = mezzoAttivo ? mezzoAttivo.split(" - ")[0] : "—";
  return (
    <div className="content">
      <div style={{ marginBottom:14 }}>
        <h2 style={{ fontSize:21, fontWeight:700, letterSpacing:"-.3px" }}>Ciao, {user.name.split(" ")[0]} 👋</h2>
        <p style={{ fontSize:13, color:"var(--text2)", marginTop:2 }}>
          {new Date().toLocaleDateString("it-IT",{weekday:"long",day:"numeric",month:"long"})}
        </p>
      </div>
      <div className="mezzo-card">
        <div className="mezzo-icon"><Icon name="truck" size={20} color="var(--accent)"/></div>
        <div className="mezzo-info">
          <div className="mezzo-lbl">Mezzo attivo</div>
          <div className="mezzo-targa">{targa}</div>
        </div>
        <select className="mezzo-sel" value={mezzoAttivo} onChange={e => onCambioMezzo(e.target.value)}>
          {MEZZI.map(m => <option key={m.id} value={m.targa + " - " + m.tipo}>{m.targa}</option>)}
        </select>
      </div>
      <div className="stats-row">
        <div className="stat-card"><div className="stat-value stat-accent">{fmt(totOggi)}</div><div className="stat-label">Ore oggi</div></div>
        <div className="stat-card"><div className="stat-value stat-success">{rOggi.length}</div><div className="stat-label">Lavori oggi</div></div>
        <div className="stat-card"><div className="stat-value">{rMese.length}</div><div className="stat-label">Lavori mese</div></div>
        <div className="stat-card"><div className="stat-value stat-warning">{totStr}h</div><div className="stat-label">Straordinari</div></div>
      </div>
      {rOggi.length > 0 && <><div className="section-title">Lavori di oggi</div>{rOggi.map(r=><RecordItem key={r.id} r={r}/>)}</>}
      {rOggi.length === 0 && (
        <div className="card" style={{ textAlign:"center", padding:"28px 16px" }}>
          <Icon name="briefcase" size={30} color="var(--text3)"/>
          <p style={{ color:"var(--text2)", fontSize:14, marginTop:10 }}>Nessun lavoro registrato oggi</p>
          <p style={{ color:"var(--text3)", fontSize:12, marginTop:4 }}>Premi + per inserire un nuovo lavoro</p>
        </div>
      )}
      <div className="scroll-pad"/>
    </div>
  );
}

// ─── RECORD ITEM ─────────────────────────────────────────────────────────────
function RecordItem({ r, onClick }) {
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
        {targa && <div><div className="record-targa"><Icon name="truck" size={11} color="var(--accent)"/>{targa}</div></div>}
      </div>
    </div>
  );
}

// ─── RECORD LIST ─────────────────────────────────────────────────────────────
function RecordListScreen({ records, onSelect }) {
  const [filter, setFilter] = useState("");
  const filtered = records.filter(r =>
    !filter ||
    (r.cliente && r.cliente.toLowerCase().includes(filter.toLowerCase())) ||
    (r.cantiere && r.cantiere.toLowerCase().includes(filter.toLowerCase())) ||
    (r.mezzo && r.mezzo.toLowerCase().includes(filter.toLowerCase()))
  );
  return (
    <div className="content">
      <div className="section-title" style={{ marginTop:4 }}>Tutti i lavori ({records.length})</div>
      <input className="input" placeholder="Cerca cliente, cantiere o targa..." value={filter}
        onChange={e => setFilter(e.target.value)} style={{ marginBottom:12 }}/>
      {filtered.length === 0 && (
        <div style={{ textAlign:"center", padding:"40px 0", color:"var(--text2)" }}>
          <Icon name="list" size={28} color="var(--text3)"/><br/><br/>Nessun risultato
        </div>
      )}
      {filtered.map(r => <RecordItem key={r.id} r={r} onClick={() => onSelect(r)}/>)}
      <div className="scroll-pad"/>
    </div>
  );
}

// ─── RECORD DETAIL MODAL ─────────────────────────────────────────────────────
function RecordDetailModal({ r, onClose }) {
  const { totaleMin, straordinari, ordinarie } = calcOre(r.oraInizio, r.oraFine, r.pausa);
  const rows = [
    ["Data", r.data], ["Inizio", r.oraInizio], ["Fine", r.oraFine],
    ["Pausa pranzo", r.pausa > 0 ? r.pausa + " min" : null],
    ["Altre pause", r.altrePause],
    ["Ore totali", fmt(totaleMin)], ["Ore ordinarie", ordinarie],
    ["Straordinari", straordinari + "h"],
    ["Cliente", r.cliente], ["Cantiere", r.cantiere],
    ["N. Ordine", r.ordine], ["Mezzo", r.mezzo], ["Note", r.note],
  ];
  return (
    <div className="overlay" onClick={onClose}>
      <div className="modal" onClick={e => e.stopPropagation()}>
        <div className="modal-handle"/>
        <div className="modal-title">{r.cliente || "Lavoro"}</div>
        {rows.map(([l,v]) => v ? <div key={l} className="detail-row"><span className="detail-label">{l}</span><span className="detail-value">{v}</span></div> : null)}
        {r.descrizione && <><div className="section-title">Attivita svolte</div><p style={{ fontSize:14, color:"var(--text2)", lineHeight:1.6 }}>{r.descrizione}</p></>}
        {r.materiali && r.materiali.length > 0 && <><div className="section-title">Materiali</div>{r.materiali.map((m,i)=><div key={i} style={{ fontSize:14, padding:"4px 0", color:"var(--text2)" }}>- {m}</div>)}</>}
        {r.allegati && r.allegati.length > 0 && <><div className="section-title">Allegati</div><div className="attach-list">{r.allegati.map((a,i)=><div key={i} className="attach-chip"><Icon name="file" size={12} color="var(--accent)"/>{a}</div>)}</div></>}
        {r.gps && <><div className="section-title">GPS</div><div className="gps-box"><Icon name="pin" size={18} color="var(--success)"/><span className="gps-coords">Lat {r.gps.lat}, Lng {r.gps.lng}</span></div></>}
        <div style={{ height:20 }}/>
        <button className="btn btn-ghost" onClick={onClose}>Chiudi</button>
      </div>
    </div>
  );
}

// ─── FIELD (top-level per evitare re-mount) ───────────────────────────────────
function Field({ label, required, err, children }) {
  return (
    <div className="form-group">
      <label>{label}{required && <span className="req">*</span>}</label>
      {children}
      {err && <div className="field-err">- {err}</div>}
    </div>
  );
}

// ─── NEW RECORD FORM ──────────────────────────────────────────────────────────
function NewRecordScreen({ onSave, currentUser, mezzoAttivo }) {
  const today = new Date().toISOString().slice(0,10);
  const [form, setForm] = useState({
    data: today, oraInizio: "", oraFine: "",
    inizioPausa: "", finePausa: "",
    altrePauseTipo: "", altrePauseDurata: 0,
    cliente: "", cantiere: "", ordine: "",
    mezzo: mezzoAttivo || "",
    descrizione: "", materiali: [""], allegati: [], note: "",
  });
  const [gps, setGps]         = useState(null);
  const [gpsLoading, setGpsL] = useState(false);
  const [gpsErr, setGpsErr]   = useState("");
  const [step, setStep]       = useState(0);
  const [errors, setErrors]   = useState({});
  const [sheetsStatus, setSS] = useState("idle");
  const fileRef = useRef();

  const set = (k, v) => {
    setForm(f => Object.assign({}, f, { [k]: v }));
    if (errors[k]) setErrors(e => Object.assign({}, e, { [k]: "" }));
  };

  const pausaPranzoMin = calcPausaMin(form.inizioPausa, form.finePausa);
  const calc = calcOre(form.oraInizio, form.oraFine, pausaPranzoMin);
  const orariOk = form.data && form.oraInizio && form.oraFine;

  // GPS
  const captureGPS = () => {
    if (!navigator.geolocation) { setGpsErr("GPS non supportato"); showToast("GPS non disponibile", "error"); return; }
    setGpsErr(""); setGpsL(true);
    navigator.geolocation.getCurrentPosition(
      pos => {
        setGps({ lat: pos.coords.latitude.toFixed(6), lng: pos.coords.longitude.toFixed(6), acc: Math.round(pos.coords.accuracy) });
        setGpsL(false); showToast("Posizione acquisita");
      },
      err => {
        setGpsL(false);
        const msgs = { 1: "Permesso negato - abilita la posizione nelle impostazioni", 2: "Posizione non disponibile", 3: "Timeout - riprova" };
        const m = msgs[err.code] || "Errore GPS";
        setGpsErr(m); showToast(m, "error");
      },
      { enableHighAccuracy: true, timeout: 10000, maximumAge: 0 }
    );
  };

  // Validate step
  const validate = (s) => {
    const e = {};
    if (s === 0) {
      if (!form.data)        e.data        = "Campo obbligatorio";
      if (!form.oraInizio)   e.oraInizio   = "Campo obbligatorio";
      if (!form.oraFine)     e.oraFine     = "Campo obbligatorio";
      if (!form.cliente)     e.cliente     = "Campo obbligatorio";
      if (!form.cantiere)    e.cantiere    = "Campo obbligatorio";
      if (!form.mezzo)       e.mezzo       = "Campo obbligatorio";
      if (!form.descrizione) e.descrizione = "Campo obbligatorio";
    }
    if (s === 1) {
      if (!form.materiali.some(m => m.trim())) e.materiali = "Inserisci almeno un materiale";
    }
    if (s === 2) {
      if (form.inizioPausa && !form.finePausa)    e.finePausa    = "Inserisci la fine pausa";
      if (!form.inizioPausa && form.finePausa)    e.inizioPausa  = "Inserisci l'inizio pausa";
      if (pausaPranzoMin < 0)                     e.finePausa    = "Orario non valido";
      if (form.altrePauseTipo && !form.altrePauseDurata) e.altrePauseDurata = "Seleziona durata";
    }
    setErrors(e);
    return Object.keys(e).length === 0;
  };

  const goNext = (s) => { if (validate(s)) setStep(s + 1); };

  const handleSave = async () => {
    const materiali = form.materiali.filter(m => m.trim());
    const altrePause = form.altrePauseTipo
      ? form.altrePauseTipo + (form.altrePauseDurata ? " - " + form.altrePauseDurata + " min" : "")
      : "";
    const record = Object.assign({}, form, { id: Date.now(), pausa: pausaPranzoMin, altrePause, materiali, gps });
    onSave(record);
    setSS("loading");
    const res = await inviaASheets("lavoro", Object.assign({}, record, { nomeDipendente: currentUser ? currentUser.name : "" }));
    if (res.locale)      { setSS("local"); showToast("Salvato in locale (Sheets non configurato)", "error"); }
    else if (res.ok)     { setSS("ok");    showToast("Lavoro salvato e inviato a Google Sheets!"); }
    else                 { setSS("error"); showToast("Errore Sheets - salvato in locale", "error"); }
  };

  const STEPS = ["Lavoro", "Materiali", "Pause", "Note"];

  return (
    <div className="content">
      <SheetsStatus status={sheetsStatus}/>

      {/* Step bar */}
      <div className="steps-bar">
        {STEPS.map((s, i) => (
          <button key={i}
            className={"step-btn " + (i === step ? "step-active" : i < step ? "step-done" : "step-todo")}
            onClick={() => i < step && setStep(i)}>
            {i < step ? "v" : (i + 1) + "."} {s}
          </button>
        ))}
      </div>

      {/* STEP 0 — LAVORO */}
      {step === 0 && (
        <div>
          <div className="section-title">Orario di lavoro</div>
          <Field label="Data" required err={errors.data}>
            <input type="date" className={"input" + (errors.data ? " err" : "")} value={form.data} onChange={e => set("data", e.target.value)}/>
          </Field>
          <div className="row-2">
            <Field label="Ora inizio" required err={errors.oraInizio}>
              <input type="time" className={"input" + (errors.oraInizio ? " err" : "")} value={form.oraInizio} onChange={e => set("oraInizio", e.target.value)}/>
            </Field>
            <Field label="Ora fine" required err={errors.oraFine}>
              <input type="time" className={"input" + (errors.oraFine ? " err" : "")} value={form.oraFine} onChange={e => set("oraFine", e.target.value)}/>
            </Field>
          </div>

          {orariOk && (
            <div className="time-result">
              <div className="time-cell"><div className="time-val" style={{ color:"var(--accent)" }}>{fmt(calc.totaleMin)}</div><div className="time-lbl">Ore nette</div></div>
              <div className="divider-v"/>
              <div className="time-cell"><div className="time-val" style={{ color:"var(--success)" }}>{calc.ordinarie}</div><div className="time-lbl">Ordinarie</div></div>
              <div className="divider-v"/>
              <div className="time-cell"><div className="time-val" style={{ color: calc.straordinari > 0 ? "var(--warning)" : "var(--text3)" }}>{calc.straordinari}h</div><div className="time-lbl">Straord.</div></div>
            </div>
          )}
          {calc.extraMin > 0 && calc.extraMin % 60 !== 0 && (
            <p style={{ fontSize:11, color:"var(--text3)", textAlign:"center", marginBottom:12 }}>
              Nota: {calc.extraMin % 60} min extra non contano (solo blocchi da 60 min)
            </p>
          )}

          {orariOk && (
            <div>
              <div className="section-title">Dettagli lavoro</div>
              <Field label="Nome Cliente" required err={errors.cliente}>
                <input className={"input" + (errors.cliente ? " err" : "")} placeholder="Es. Rossi S.r.l." value={form.cliente} onChange={e => set("cliente", e.target.value)}/>
              </Field>
              <Field label="Cantiere / Luogo" required err={errors.cantiere}>
                <input className={"input" + (errors.cantiere ? " err" : "")} placeholder="Es. Via Roma 10, Milano" value={form.cantiere} onChange={e => set("cantiere", e.target.value)}/>
              </Field>
              <Field label="Numero Ordine" err={errors.ordine}>
                <input className="input" placeholder="Es. ORD-2024-001" value={form.ordine} onChange={e => set("ordine", e.target.value)}/>
              </Field>
              <Field label="Mezzo utilizzato" required err={errors.mezzo}>
                <select className={"input" + (errors.mezzo ? " err" : "")} value={form.mezzo} onChange={e => set("mezzo", e.target.value)}>
                  <option value="">Seleziona mezzo...</option>
                  {MEZZI.map(m => <option key={m.id} value={m.targa + " - " + m.tipo}>{m.targa} - {m.tipo}</option>)}
                </select>
              </Field>
              <Field label="Attivita svolte" required err={errors.descrizione}>
                <textarea className={"input" + (errors.descrizione ? " err" : "")} placeholder="Descrivi le attivita svolte..." value={form.descrizione} onChange={e => set("descrizione", e.target.value)} rows={4}/>
              </Field>
              <div className="section-title">Geolocalizzazione</div>
              <div className="gps-box" style={{ marginBottom:16, flexWrap:"wrap", gap:8 }}>
                <Icon name="pin" size={18} color={gps ? "var(--success)" : "var(--text3)"}/>
                <div style={{ flex:1 }}>
                  {gps ? <span className="gps-coords">Lat {gps.lat}, Lng {gps.lng}{gps.acc ? " (+-" + gps.acc + "m)" : ""}</span> : <span style={{ color:"var(--text2)", fontSize:13 }}>Posizione non acquisita</span>}
                </div>
                <button className="btn btn-sm btn-ghost" onClick={captureGPS} disabled={gpsLoading} style={{ width:"auto" }}>
                  {gpsLoading ? "Attendi..." : gps ? "Aggiorna" : "Acquisisci"}
                </button>
              </div>
              {gpsErr && <div style={{ fontSize:11, color:"var(--danger)", marginBottom:12, padding:"6px 10px", background:"rgba(239,68,68,.08)", borderRadius:6 }}>{gpsErr}</div>}
            </div>
          )}

          <button className="btn btn-primary" onClick={() => goNext(0)} disabled={!orariOk} style={{ opacity: orariOk ? 1 : 0.4, marginTop:8 }}>
            Avanti
          </button>
        </div>
      )}

      {/* STEP 1 — MATERIALI */}
      {step === 1 && (
        <div>
          <div className="section-title">Materiali utilizzati<span className="req">*</span></div>
          {errors.materiali && <div className="field-err" style={{ marginBottom:10 }}>{errors.materiali}</div>}
          {form.materiali.map((m, i) => (
            <div key={i} className="mat-row">
              <input className={"input" + (errors.materiali ? " err" : "")} placeholder={"Materiale " + (i+1)} value={m}
                onChange={e => { const a = form.materiali.slice(); a[i] = e.target.value; set("materiali", a); }}/>
              {form.materiali.length > 1 && (
                <button className="btn btn-sm btn-danger" onClick={() => set("materiali", form.materiali.filter((_,j) => j!==i))} style={{ width:36, padding:"8px" }}>
                  <Icon name="trash" size={13}/>
                </button>
              )}
            </div>
          ))}
          <button className="btn btn-ghost btn-sm" style={{ marginBottom:20 }} onClick={() => set("materiali", form.materiali.concat(""))}>
            + Aggiungi materiale
          </button>
          <div className="row-2">
            <button className="btn btn-ghost" onClick={() => setStep(0)}>Indietro</button>
            <button className="btn btn-primary" onClick={() => goNext(1)}>Avanti</button>
          </div>
        </div>
      )}

      {/* STEP 2 — PAUSE */}
      {step === 2 && (
        <div>
          <div className="section-title">Pausa pranzo</div>
          <p style={{ fontSize:12, color:"var(--text2)", marginBottom:12, lineHeight:1.5 }}>
            Inserisci intervallo pausa: la durata verra sottratta automaticamente dalle ore lavorate.
          </p>
          <div className="row-2">
            <Field label="Inizio pausa" err={errors.inizioPausa}>
              <input type="time" className={"input" + (errors.inizioPausa ? " err" : "")} value={form.inizioPausa} onChange={e => set("inizioPausa", e.target.value)}/>
            </Field>
            <Field label="Fine pausa" err={errors.finePausa}>
              <input type="time" className={"input" + (errors.finePausa ? " err" : "")} value={form.finePausa} onChange={e => set("finePausa", e.target.value)}/>
            </Field>
          </div>
          {pausaPranzoMin > 0 && (
            <div className="pausa-info">
              Pausa pranzo: <strong>{pausaPranzoMin} min</strong> sottratti automaticamente. Ore nette: <strong>{fmt(calc.totaleMin)}</strong>
            </div>
          )}

          <div className="section-title">Altre pause</div>
          <p style={{ fontSize:12, color:"var(--text2)", marginBottom:12 }}>Durata solo a blocchi di 30 minuti.</p>
          <div className="row-2">
            <Field label="Tipo" err={errors.altrePauseTipo}>
              <select className="input" value={form.altrePauseTipo} onChange={e => set("altrePauseTipo", e.target.value)}>
                <option value="">Nessuna</option>
                <option value="ROL">ROL</option>
                <option value="Malattia">Malattia</option>
                <option value="Altro">Altro</option>
              </select>
            </Field>
            <Field label="Durata" err={errors.altrePauseDurata}>
              <select className="input" value={form.altrePauseDurata}
                onChange={e => set("altrePauseDurata", Number(e.target.value))}
                disabled={!form.altrePauseTipo} style={{ opacity: form.altrePauseTipo ? 1 : 0.4 }}>
                <option value={0}>Seleziona...</option>
                {[30,60,90,120,150,180,210,240].map(v => <option key={v} value={v}>{v} min ({Math.floor(v/60)}h{v%60 ? " " + v%60 + "m" : ""})</option>)}
              </select>
            </Field>
          </div>

          <div className="row-2" style={{ marginTop:8 }}>
            <button className="btn btn-ghost" onClick={() => setStep(1)}>Indietro</button>
            <button className="btn btn-primary" onClick={() => goNext(2)}>Avanti</button>
          </div>
        </div>
      )}

      {/* STEP 3 — NOTE E ALLEGATI */}
      {step === 3 && (
        <div>
          <div className="section-title">Note finali <span style={{ fontSize:11, color:"var(--text3)", fontWeight:400, textTransform:"none" }}>(opzionale)</span></div>
          <div className="form-group">
            <textarea className="input" placeholder="Note aggiuntive, osservazioni..." value={form.note} onChange={e => set("note", e.target.value)} rows={3}/>
          </div>
          <div className="section-title">Allegati <span style={{ fontSize:11, color:"var(--text3)", fontWeight:400, textTransform:"none" }}>(opzionale)</span></div>
          <input ref={fileRef} type="file" multiple style={{ display:"none" }}
            onChange={e => { const f = Array.from(e.target.files || []); set("allegati", form.allegati.concat(f.map(x => x.name))); }}/>
          <div className="upload-area" onClick={() => fileRef.current && fileRef.current.click()}>
            <Icon name="camera" size={24} color="var(--text3)"/>
            <p style={{ marginTop:8 }}>Tocca per aggiungere foto o documenti</p>
          </div>
          {form.allegati.length > 0 && (
            <div className="attach-list" style={{ marginTop:12 }}>
              {form.allegati.map((a,i) => (
                <div key={i} className="attach-chip">
                  <Icon name="file" size={12} color="var(--accent)"/>{a}
                  <button style={{ background:"none", border:"none", cursor:"pointer", color:"var(--text3)", padding:0, marginLeft:4 }}
                    onClick={() => set("allegati", form.allegati.filter((_,j) => j!==i))}>
                    <Icon name="x" size={12}/>
                  </button>
                </div>
              ))}
            </div>
          )}
          <div style={{ marginTop:20 }} className="row-2">
            <button className="btn btn-ghost" onClick={() => setStep(2)}>Indietro</button>
            <button className="btn btn-primary" onClick={handleSave} disabled={sheetsStatus === "loading"}>
              {sheetsStatus === "loading" ? "Invio..." : "Salva"}
            </button>
          </div>
        </div>
      )}
      <div className="scroll-pad"/>
    </div>
  );
}

// ─── NOTIFICATIONS ────────────────────────────────────────────────────────────
function NotificationsScreen({ notifications, onConfirm }) {
  return (
    <div className="content">
      <div className="section-title" style={{ marginTop:4 }}>Notifiche ({notifications.filter(n=>!n.read).length} non lette)</div>
      {notifications.map(n => (
        <div key={n.id} className={"notif-card " + n.type + (!n.read ? " unread" : "")}>
          <div style={{ display:"flex", alignItems:"center", justifyContent:"space-between" }}>
            <span className={"notif-type " + n.type}>
              {n.type === "mandatory" ? <><Icon name="alert" size={10}/> Obbligatoria</> : <><Icon name="info" size={10}/> Info</>}
            </span>
            {n.read && <span style={{ fontSize:11, color:"var(--success)" }}><Icon name="check" size={11} color="var(--success)"/> Confermata</span>}
          </div>
          <div className="notif-title">{n.title}</div>
          <div className="notif-body">{n.body}</div>
          <div className="notif-date">{n.date}</div>
          {!n.read && n.type === "mandatory" && (
            <button className="btn btn-success btn-sm" style={{ marginTop:12, width:"100%" }} onClick={() => onConfirm(n.id)}>
              <Icon name="check" size={14}/> Confermo lettura
            </button>
          )}
        </div>
      ))}
      <div className="scroll-pad"/>
    </div>
  );
}

// ─── WHISTLEBLOWING ───────────────────────────────────────────────────────────
function WhistleblowingScreen({ currentUser }) {
  const [anon, setAnon]       = useState(false);
  const [category, setCat]    = useState("");
  const [msg, setMsg]         = useState("");
  const [sent, setSent]       = useState(false);
  const [sheetsStatus, setSS] = useState("idle");

  const handleSend = async () => {
    if (!msg.trim()) { showToast("Inserisci una descrizione", "error"); return; }
    if (!category)   { showToast("Seleziona una categoria", "error"); return; }
    setSS("loading");
    const payload = {
      anonima: anon,
      nomeMittente: anon ? null : (currentUser ? currentUser.name : ""),
      categoria: category, messaggio: msg, riferimenti: "",
    };
    const res = await inviaASheets("whistleblowing", payload);
    if (res.locale)      { setSS("local"); showToast("Salvata in locale", "error"); }
    else if (res.ok)     { setSS("ok");    showToast("Segnalazione inviata in modo sicuro"); }
    else                 { setSS("error"); showToast("Errore invio", "error"); }
    setSent(true);
  };

  if (sent) return (
    <div className="content" style={{ display:"flex", flexDirection:"column", alignItems:"center", justifyContent:"center", minHeight:"60vh" }}>
      <div style={{ background:"rgba(34,197,94,.12)", borderRadius:"50%", padding:24, marginBottom:16 }}>
        <Icon name="check" size={36} color="var(--success)"/>
      </div>
      <h2 style={{ fontSize:20, fontWeight:700, marginBottom:8 }}>Segnalazione inviata</h2>
      <p style={{ color:"var(--text2)", fontSize:14, textAlign:"center", lineHeight:1.6, marginBottom:16 }}>
        Trasmessa in modo {anon ? "completamente anonimo" : "riservato"}.
      </p>
      <SheetsStatus status={sheetsStatus}/>
      <button className="btn btn-ghost" style={{ marginTop:16, maxWidth:220 }} onClick={() => { setSent(false); setMsg(""); setCat(""); setSS("idle"); }}>
        Nuova segnalazione
      </button>
    </div>
  );

  return (
    <div className="content">
      <div className="whistle-header">
        <div className="whistle-icon"><Icon name="shield" size={28} color="var(--accent2)"/></div>
        <div style={{ fontSize:20, fontWeight:700 }}>Whistleblowing</div>
        <div style={{ fontSize:13, color:"var(--text2)", marginTop:4, lineHeight:1.5 }}>Segnala situazioni anomale in modo sicuro.<br/>Protetto ai sensi del D.Lgs 24/2023.</div>
      </div>
      <SheetsStatus status={sheetsStatus}/>
      <div className="anon-toggle">
        <div>
          <div style={{ fontSize:14, fontWeight:600 }}>Segnalazione Anonima</div>
          <div style={{ fontSize:12, color:"var(--text2)", marginTop:2 }}>
            {anon ? "Il tuo nome NON verra salvato" : "Il tuo nome sara visibile al responsabile"}
          </div>
        </div>
        <button className={"toggle " + (anon ? "on" : "")} onClick={() => setAnon(!anon)}/>
      </div>
      <div className="form-group">
        <label>Categoria</label>
        <select className="input" value={category} onChange={e => setCat(e.target.value)}>
          <option value="">Seleziona...</option>
          <option>Sicurezza sul lavoro</option>
          <option>Comportamento scorretto</option>
          <option>Irregolarita amministrative</option>
          <option>Discriminazione / Molestie</option>
          <option>Frode o corruzione</option>
          <option>Altro</option>
        </select>
      </div>
      <div className="form-group">
        <label>Descrizione</label>
        <textarea className="input" rows={6} placeholder="Descrivi la situazione in dettaglio..." value={msg} onChange={e => setMsg(e.target.value)}/>
      </div>
      <div style={{ background:"rgba(9,132,227,.08)", border:"1px solid rgba(9,132,227,.2)", borderRadius:10, padding:12, marginBottom:20, fontSize:12, color:"var(--text2)", lineHeight:1.5 }}>
        {anon ? "Modalita ANONIMA: nessun dato identificativo verra salvato." : "Modalita RISERVATA: nominativo visibile solo al responsabile."}
      </div>
      <button className="btn btn-primary" onClick={handleSend} disabled={sheetsStatus === "loading"}>
        <Icon name="send" size={16}/> Invia segnalazione
      </button>
      <div className="scroll-pad"/>
    </div>
  );
}

// ─── PROFILE ─────────────────────────────────────────────────────────────────
function ProfileScreen({ user, records, onLogout }) {
  const initials = user.name.split(" ").map(w => w[0]).join("");
  const mese = new Date().toISOString().slice(0,7);
  const rMese = records.filter(r => r.data.startsWith(mese));
  const totStraord = rMese.reduce((s,r) => s + calcOre(r.oraInizio,r.oraFine,r.pausa).straordinari, 0);
  return (
    <div className="content">
      <div style={{ paddingTop:20, paddingBottom:8 }}>
        <div className="profile-avatar">{initials}</div>
        <div className="profile-name">{user.name}</div>
        <div className="profile-role">{user.role}</div>
      </div>
      <div className="section-title">Riepilogo mese</div>
      <div className="stats-row">
        <div className="stat-card"><div className="stat-value stat-accent">{rMese.length}</div><div className="stat-label">Lavori</div></div>
        <div className="stat-card"><div className="stat-value stat-warning">{totStraord}h</div><div className="stat-label">Straordinari</div></div>
      </div>
      <div className="section-title">Account</div>
      {[["Username", user.username], ["Ruolo", user.role], ["ID", "#" + user.id]].map(([l,v]) => (
        <div key={l} className="profile-item"><span className="profile-label">{l}</span><span className="profile-value">{v}</span></div>
      ))}
      <div style={{ marginTop:32 }}>
        <button className="btn btn-danger" onClick={onLogout}>
          <Icon name="logout" size={16}/> Esci dall'app
        </button>
      </div>
      <div className="scroll-pad"/>
    </div>
  );
}

// ─── APP ROOT ─────────────────────────────────────────────────────────────────
export default function App() {
  const LOGO = "data:image/png;base64,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";

  const [user, setUser]           = useState(() => store.get("crm_user", null));
  const [records, setRecords]     = useState(() => store.get("crm_records", []));
  const [notifs, setNotifs]       = useState(() => store.get("crm_notifs", null) || INITIAL_NOTIFICATIONS);
  const [mezzoAttivo, setMezzo]   = useState(() => store.get("crm_mezzo", ""));
  const [showMezzoPopup, setSMP]  = useState(false);
  const [screen, setScreen]       = useState("home");
  const [selRecord, setSelRecord] = useState(null);
  const [loginForm, setLF]        = useState({ username: "", password: "" });
  const [loginError, setLE]       = useState("");

  const mandatoryUnread = notifs.find(n => n.type === "mandatory" && !n.read);
  const unreadCount = notifs.filter(n => !n.read).length;

  useEffect(() => { store.set("crm_records", records); }, [records]);
  useEffect(() => { store.set("crm_notifs", notifs); }, [notifs]);
  useEffect(() => { store.set("crm_mezzo", mezzoAttivo); }, [mezzoAttivo]);

  // Mostra popup mezzo appena loggato
  useEffect(() => {
    if (user) setSMP(true);
  }, [user]);

  const handleLogin = () => {
    const found = USERS.find(u => u.username === loginForm.username && u.password === loginForm.password);
    if (!found) { setLE("Credenziali non corrette"); return; }
    store.set("crm_user", found);
    setUser(found);
  };
  const handleLogout = () => {
    store.set("crm_user", null);
    setUser(null); setScreen("home");
  };
  const handleSaveRecord = (r) => { setRecords(rs => [r].concat(rs)); setScreen("home"); };
  const handleConfirm    = (id) => setNotifs(ns => ns.map(n => n.id === id ? Object.assign({}, n, { read: true }) : n));
  const handleCambioMezzo = (m) => { setMezzo(m); showToast("Mezzo: " + m.split(" - ")[0]); };

  const navItems = [
    { id: "home",  icon: "home",  label: "Home" },
    { id: "list",  icon: "list",  label: "Lavori" },
    { id: "new",   icon: "plus",  label: "", fab: true },
    { id: "notifications", icon: "bell", label: "Avvisi" },
    { id: "profile", icon: "user", label: "Profilo" },
  ];
  const titles = { home: "RGR Elettra Hub", list: "Storico Lavori", new: "Nuovo Lavoro", notifications: "Notifiche", profile: "Profilo", whistleblowing: "Segnalazioni" };

  // ── LOGIN ──
  if (!user) return (
    <>
      <style>{css}</style>
      <Toast/>
      <div className="login-screen">
        <div className="login-logo">
          <img src={LOGO} alt="RGR Elettra Hub"/>
          <h1>RGR Elettra Hub</h1>
          <p>Impianti Tecnologici</p>
        </div>
        <div className="login-form">
          {loginError && <div className="error-msg">{loginError}</div>}
          <div className="form-group">
            <label>Username</label>
            <input className="input" placeholder="mario.rossi" value={loginForm.username}
              onChange={e => setLF(f => Object.assign({}, f, { username: e.target.value }))}
              onKeyDown={e => e.key === "Enter" && handleLogin()}/>
          </div>
          <div className="form-group">
            <label>Password</label>
            <input className="input" type="password" placeholder="..." value={loginForm.password}
              onChange={e => setLF(f => Object.assign({}, f, { password: e.target.value }))}
              onKeyDown={e => e.key === "Enter" && handleLogin()}/>
          </div>
          <button className="btn btn-primary" onClick={handleLogin}>Accedi</button>
          <p style={{ fontSize:12, color:"var(--text3)", textAlign:"center", marginTop:16 }}>Demo: mario.rossi / 1234</p>
        </div>
      </div>
    </>
  );

  return (
    <>
      <style>{css}</style>
      <Toast/>

      {/* Popup mezzo obbligatorio */}
      {showMezzoPopup && (
        <MezzoPopup
          user={user}
          ultimoMezzo={mezzoAttivo}
          onConfirm={m => { setMezzo(m); setSMP(false); showToast("Mezzo selezionato: " + m.split(" - ")[0]); }}
        />
      )}

      {/* Notifica obbligatoria */}
      {!showMezzoPopup && mandatoryUnread && screen !== "notifications" && (
        <MandatoryNotifModal notif={mandatoryUnread} onConfirm={() => { handleConfirm(mandatoryUnread.id); showToast("Avviso confermato"); }}/>
      )}

      {/* Record detail modal */}
      {selRecord && <RecordDetailModal r={selRecord} onClose={() => setSelRecord(null)}/>}

      <div className="app">
        {/* Header */}
        <div className="header">
          <div className="header-logo">
            <img src={LOGO} alt="logo"/>
            <div>
              <div className="header-title">{titles[screen]}</div>
              <div className="header-sub">{user.name}</div>
            </div>
          </div>
          <div style={{ display:"flex", gap:8, alignItems:"center" }}>
            <button style={{ background:"none", border:"none", cursor:"pointer", color:"var(--text2)", padding:6 }}
              onClick={() => setScreen("whistleblowing")}>
              <Icon name="shield" size={20}/>
            </button>
            <div className="notif-badge" style={{ cursor:"pointer" }} onClick={() => setScreen("notifications")}>
              <Icon name="bell" size={22} color={unreadCount > 0 ? "var(--accent)" : "var(--text2)"}/>
              {unreadCount > 0 && <div className="badge-dot"/>}
            </div>
          </div>
        </div>

        {/* Screens */}
        {screen === "home"          && <HomeScreen user={user} records={records} mezzoAttivo={mezzoAttivo} onCambioMezzo={handleCambioMezzo}/>}
        {screen === "list"          && <RecordListScreen records={records} onSelect={r => setSelRecord(r)}/>}
        {screen === "new"           && <NewRecordScreen onSave={handleSaveRecord} currentUser={user} mezzoAttivo={mezzoAttivo}/>}
        {screen === "notifications" && <NotificationsScreen notifications={notifs} onConfirm={handleConfirm}/>}
        {screen === "profile"       && <ProfileScreen user={user} records={records} onLogout={handleLogout}/>}
        {screen === "whistleblowing"&& <WhistleblowingScreen currentUser={user}/>}

        {/* Bottom Nav */}
        <div className="bottom-nav">
          {navItems.map(item => (
            <button key={item.id}
              className={"nav-item " + (item.fab ? "nav-fab " : "") + (screen === item.id ? "active" : "")}
              onClick={() => setScreen(item.id)}>
              <div className={item.id === "notifications" ? "notif-badge" : ""}>
                <Icon name={item.icon} size={item.fab ? 22 : 20}/>
                {item.id === "notifications" && unreadCount > 0 && <div className="badge-dot"/>}
              </div>
              {!item.fab && <span>{item.label}</span>}
            </button>
          ))}
        </div>
      </div>
    </>
  );
}
