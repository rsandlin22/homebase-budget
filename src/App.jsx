import { useState, useEffect, useRef, useCallback } from "react";
import { initializeApp, getApps } from "firebase/app";
import {
  getFirestore, doc, collection, onSnapshot,
  setDoc, deleteDoc, getDoc, getDocs
} from "firebase/firestore";

const FIREBASE_CONFIG = {
  apiKey: "AIzaSyAoek6YmZPNeUQp-Sv39RUiqeURVotdGzE",
  authDomain: "budget-tracker-37f19.firebaseapp.com",
  projectId: "budget-tracker-37f19",
  storageBucket: "budget-tracker-37f19.firebasestorage.app",
  messagingSenderId: "146577724370",
  appId: "1:146577724370:web:23f1b8344673938a4aee0b"
};

let _db = null;
const getDB = () => _db;
const initFirebase = (cfg) => {
  try {
    const app = getApps().length ? getApps()[0] : initializeApp(cfg);
    _db = getFirestore(app);
    return true;
  } catch (e) { console.error(e); return false; }
};

const EXP_COL = "expenses";
const fsSet = async (path, data) => { const db = getDB(); if (!db) return; const [col, id] = path.split("/"); await setDoc(doc(db, col, id), data); };
const fsGet = async (path) => { const db = getDB(); if (!db) return null; const [col, id] = path.split("/"); const s = await getDoc(doc(db, col, id)); return s.exists() ? s.data() : null; };

const monthKey   = (d = new Date()) => `${d.getFullYear()}-${String(d.getMonth()+1).padStart(2,"0")}`;
const monthLabel = (key) => { const [y,m] = key.split("-"); return new Date(+y,+m-1,1).toLocaleString("default",{month:"long",year:"numeric"}); };
const fmt        = (n) => n == null ? "$—" : "$"+Number(n).toLocaleString("en-US",{minimumFractionDigits:2,maximumFractionDigits:2});
const today      = () => new Date().toISOString().split("T")[0];

const DEFAULT_CATS = ["Groceries","Dining Out","Housing","Utilities","Transportation","Healthcare","Entertainment","Clothing","Savings","Miscellaneous"];
const CFG_KEY = "hb_firebase_cfg";
const saveCfg = (c) => localStorage.setItem(CFG_KEY, JSON.stringify(c));

// ─── Styles ───────────────────────────────────────────────────────────────────
const styles = `
  @import url('https://fonts.googleapis.com/css2?family=Inter:wght@300;400;500;600;700&family=JetBrains+Mono:wght@400;500&display=swap');
  *,*::before,*::after{box-sizing:border-box;margin:0;padding:0;}
  :root{
    --bg:#0f1117;--surface:#181c27;--surface2:#1f2436;--border:#2a3045;
    --indigo:#6366f1;--indigo-l:#818cf8;--amber:#f59e0b;--red:#ef4444;
    --green:#10b981;--muted:#6b7280;--text:#e5e7eb;--text-dim:#9ca3af;
    --mono:'JetBrains Mono',monospace;--sans:'Inter',sans-serif;
  }
  body{background:var(--bg);color:var(--text);font-family:var(--sans);font-size:14px;line-height:1.5;}
  .app{display:flex;flex-direction:column;min-height:100vh;}

  /* header */
  .header{display:flex;align-items:center;justify-content:space-between;padding:0 16px;height:52px;background:var(--surface);border-bottom:1px solid var(--border);flex-shrink:0;}
  .header-brand{display:flex;align-items:center;gap:8px;}
  .header-brand svg{color:var(--indigo-l);}
  .header-title{font-size:15px;font-weight:600;letter-spacing:-.3px;}
  .header-month{font-family:var(--mono);font-size:12px;color:var(--indigo-l);background:rgba(99,102,241,.12);padding:4px 10px;border-radius:6px;}
  .sync-dot{width:8px;height:8px;border-radius:50%;background:var(--green);display:inline-block;margin-right:4px;}
  .sync-dot.off{background:var(--muted);}
  .sync-label{font-size:11px;color:var(--muted);}

  /* content */
  .content-area{flex:1;overflow-y:auto;padding-bottom:80px;}

  /* bottom nav */
  .bottom-nav{position:fixed;bottom:0;left:0;right:0;height:64px;background:var(--surface);border-top:1px solid var(--border);display:flex;align-items:center;justify-content:space-around;z-index:50;padding:0 8px;}
  .nav-btn{display:flex;flex-direction:column;align-items:center;gap:3px;background:none;border:none;color:var(--text-dim);cursor:pointer;font-size:10px;font-weight:500;padding:6px 10px;border-radius:8px;transition:color .15s;font-family:var(--sans);min-width:52px;}
  .nav-btn:hover{color:var(--text);}
  .nav-btn.active{color:var(--indigo-l);}
  .nav-btn svg{width:20px;height:20px;}
  .fab-btn{width:54px;height:54px;border-radius:50%;background:var(--indigo);color:#fff;border:none;font-size:28px;line-height:1;cursor:pointer;display:flex;align-items:center;justify-content:center;box-shadow:0 4px 20px rgba(99,102,241,.5);transition:all .15s;flex-shrink:0;margin-top:-12px;}
  .fab-btn:hover{background:var(--indigo-l);transform:scale(1.07);}
  .fab-btn:active{transform:scale(.95);}

  /* forms */
  .form-section-label{font-size:10px;font-weight:600;letter-spacing:.08em;text-transform:uppercase;color:var(--muted);margin-bottom:6px;}
  .photo-zone{border:2px dashed var(--border);border-radius:10px;padding:16px;display:flex;flex-direction:column;align-items:center;gap:8px;cursor:pointer;transition:border-color .15s;}
  .photo-zone:hover,.photo-zone.drag{border-color:var(--indigo);}
  .photo-zone-text{font-size:12px;color:var(--muted);text-align:center;}
  .input,.textarea,.select{width:100%;background:var(--surface2);border:1px solid var(--border);border-radius:8px;padding:9px 12px;color:var(--text);font-family:var(--sans);font-size:13px;outline:none;transition:border-color .15s;}
  .input:focus,.textarea:focus,.select:focus{border-color:var(--indigo);}
  .input.amount{font-family:var(--mono);font-size:28px;font-weight:500;letter-spacing:-.5px;text-align:center;padding:14px;}
  .select{cursor:pointer;}
  .select option{background:var(--surface2);}

  /* buttons */
  .btn{border:none;border-radius:8px;padding:10px 16px;font-family:var(--sans);font-size:13px;font-weight:600;cursor:pointer;transition:all .15s;}
  .btn-primary{background:var(--indigo);color:#fff;}
  .btn-primary:hover{background:var(--indigo-l);}
  .btn-primary:disabled{opacity:.45;cursor:not-allowed;}
  .btn-ghost{background:transparent;color:var(--text-dim);border:1px solid var(--border);}
  .btn-ghost:hover{color:var(--text);border-color:var(--text-dim);}
  .btn-danger{background:transparent;color:var(--red);border:1px solid rgba(239,68,68,.3);}
  .btn-danger:hover{background:rgba(239,68,68,.08);}
  .btn-sm{padding:6px 12px;font-size:12px;}
  .btn-full{width:100%;}

  /* toast */
  .toast{position:fixed;bottom:80px;right:16px;background:var(--green);color:#fff;padding:10px 18px;border-radius:8px;font-size:13px;font-weight:500;opacity:0;transform:translateY(8px);transition:all .25s;pointer-events:none;z-index:999;}
  .toast.show{opacity:1;transform:translateY(0);}
  .toast.error{background:var(--red);}

  /* dashboard */
  .dash{padding:16px;display:flex;flex-direction:column;gap:16px;}
  .stat-row{display:grid;grid-template-columns:repeat(3,1fr);gap:10px;}
  .stat-card{background:var(--surface);border:1px solid var(--border);border-radius:10px;padding:12px 14px;}
  .stat-label{font-size:10px;color:var(--muted);font-weight:500;text-transform:uppercase;letter-spacing:.06em;margin-bottom:4px;}
  .stat-value{font-family:var(--mono);font-size:20px;font-weight:500;}
  .stat-value.green{color:var(--green);}
  .stat-value.red{color:var(--red);}
  .stat-value.amber{color:var(--amber);}
  .stat-sub{font-size:10px;color:var(--muted);margin-top:2px;}
  .section-title{font-size:12px;font-weight:600;color:var(--text-dim);letter-spacing:.04em;text-transform:uppercase;margin-bottom:10px;}

  /* pulse bars */
  .cat-grid{display:grid;grid-template-columns:1fr 1fr;gap:8px;}
  .cat-card{background:var(--surface);border:1px solid var(--border);border-radius:10px;padding:12px 14px;}
  .cat-header{display:flex;justify-content:space-between;align-items:baseline;margin-bottom:6px;}
  .cat-name{font-size:13px;font-weight:500;}
  .cat-amounts{font-family:var(--mono);font-size:12px;color:var(--muted);}
  .cat-amounts span{color:var(--text);font-weight:500;}
  .pulse-track{height:5px;background:var(--border);border-radius:99px;overflow:hidden;}
  .pulse-bar{height:100%;border-radius:99px;transition:width .4s ease;}
  .pulse-bar.safe{background:var(--green);}
  .pulse-bar.warn{background:var(--amber);}
  .pulse-bar.danger{background:var(--red);}
  .cat-status{font-size:11px;margin-top:4px;}
  .cat-status.safe{color:var(--green);}
  .cat-status.warn{color:var(--amber);}
  .cat-status.danger{color:var(--red);}
  .cat-status.under{color:var(--muted);}

  /* expense list */
  .expense-list{display:flex;flex-direction:column;gap:6px;}
  .expense-item{background:var(--surface);border:1px solid var(--border);border-radius:8px;padding:10px 14px;display:flex;align-items:flex-start;gap:10px;}
  .expense-thumb{width:36px;height:36px;border-radius:6px;flex-shrink:0;background:var(--surface2);display:flex;align-items:center;justify-content:center;color:var(--muted);font-size:16px;overflow:hidden;}
  .expense-thumb img{width:100%;height:100%;object-fit:cover;}
  .expense-body{flex:1;min-width:0;}
  .expense-amount{font-family:var(--mono);font-size:14px;font-weight:500;}
  .expense-note{font-size:12px;color:var(--muted);white-space:nowrap;overflow:hidden;text-overflow:ellipsis;}
  .expense-tags{display:flex;gap:4px;flex-wrap:wrap;margin-top:3px;}
  .expense-tag{font-size:10px;padding:2px 7px;border-radius:99px;background:rgba(99,102,241,.15);color:var(--indigo-l);font-weight:500;}
  .expense-date{font-size:11px;color:var(--muted);flex-shrink:0;}
  .delete-btn{background:none;border:none;color:var(--muted);cursor:pointer;padding:2px 4px;font-size:14px;border-radius:4px;transition:color .15s;}
  .delete-btn:hover{color:var(--red);}

  /* insights */
  .insight-list{display:flex;flex-direction:column;gap:8px;}
  .insight{background:var(--surface);border-left:3px solid var(--amber);border-radius:0 8px 8px 0;padding:10px 14px;}
  .insight.positive{border-left-color:var(--green);}
  .insight.danger{border-left-color:var(--red);}
  .insight-title{font-size:13px;font-weight:500;}
  .insight-desc{font-size:12px;color:var(--muted);margin-top:2px;}

  /* budget panel */
  .budget-panel{padding:16px;display:flex;flex-direction:column;gap:14px;}
  .budget-row{display:flex;gap:8px;align-items:center;}
  .budget-row .cat-label{flex:1;font-size:13px;}
  .budget-row .input{width:110px;font-family:var(--mono);}

  /* history */
  .history-month{background:var(--surface);border:1px solid var(--border);border-radius:10px;margin-bottom:8px;overflow:hidden;}
  .history-month-header{display:flex;justify-content:space-between;align-items:center;padding:12px 14px;cursor:pointer;user-select:none;}
  .history-month-header:hover{background:var(--surface2);}
  .history-month-title{font-size:14px;font-weight:600;}
  .history-month-body{border-top:1px solid var(--border);padding:12px 14px;}

  /* settings */
  .settings-panel{padding:16px;display:flex;flex-direction:column;gap:14px;}
  .cat-manage-row{display:flex;gap:8px;align-items:center;}
  .cat-chip{display:flex;align-items:center;gap:6px;background:var(--surface2);border:1px solid var(--border);border-radius:6px;padding:5px 10px;font-size:12px;}
  .cat-chips{display:flex;flex-wrap:wrap;gap:6px;}
  .cat-remove{background:none;border:none;color:var(--muted);cursor:pointer;font-size:12px;}
  .cat-remove:hover{color:var(--red);}
  .divider{height:1px;background:var(--border);margin:2px 0;}

  /* modal */
  .modal-overlay{position:fixed;inset:0;background:rgba(0,0,0,.65);display:flex;align-items:center;justify-content:center;z-index:100;padding:16px;}
  .modal{background:var(--surface);border:1px solid var(--border);border-radius:16px;padding:24px;width:100%;max-width:400px;}
  .modal-title{font-size:18px;font-weight:700;margin-bottom:16px;}
  .modal-actions{display:flex;gap:10px;justify-content:flex-end;margin-top:16px;}
  .cfg-field{display:flex;flex-direction:column;gap:4px;margin-bottom:12px;}
  .cfg-label{font-size:11px;font-weight:600;color:var(--muted);text-transform:uppercase;letter-spacing:.06em;}
  .cfg-note{font-size:11px;color:var(--muted);margin-top:16px;line-height:1.6;}
  .cfg-note a{color:var(--indigo-l);}
  .cfg-note code{font-family:var(--mono);background:var(--surface2);padding:1px 5px;border-radius:4px;font-size:11px;}

  .empty{text-align:center;color:var(--muted);padding:32px;font-size:13px;}

  @media(max-width:480px){
    .stat-row{grid-template-columns:1fr 1fr;}
    .stat-value{font-size:17px;}
  }
`;

// ─── Firebase Setup Screen ─────────────────────────────────────────────────────
function FirebaseSetup({ onConnect }) {
  const [cfg, setCfg] = useState({ apiKey:"",authDomain:"",projectId:"",storageBucket:"",messagingSenderId:"",appId:"" });
  const [error, setError] = useState("");
  const update = (k, v) => setCfg(p => ({ ...p, [k]: v }));
  const connect = () => {
    if (!cfg.apiKey || !cfg.projectId) { setError("API Key and Project ID are required."); return; }
    const ok = initFirebase(cfg);
    if (ok) { saveCfg(cfg); onConnect(); }
    else setError("Could not connect. Check your credentials and try again.");
  };
  return (
    <>
      <style>{styles}</style>
      <div style={{ display:"flex",alignItems:"center",justifyContent:"center",minHeight:"100vh",background:"var(--bg)",padding:24 }}>
        <div style={{ width:480,maxWidth:"100%" }}>
          <div style={{ marginBottom:24 }}>
            <div style={{ display:"flex",alignItems:"center",gap:10,marginBottom:8 }}>
              <svg width="24" height="24" fill="none" stroke="var(--indigo-l)" strokeWidth="2" viewBox="0 0 24 24">
                <path d="M12 2C6.48 2 2 6.48 2 12s4.48 10 10 10 10-4.48 10-10S17.52 2 12 2z"/><path d="M12 6v6l4 2"/>
              </svg>
              <span style={{ fontSize:20,fontWeight:700 }}>HomeBase Budget</span>
            </div>
            <p style={{ fontSize:13,color:"var(--muted)",lineHeight:1.6 }}>Connect your Firebase project for real-time sync across your devices.</p>
          </div>
          <div style={{ background:"var(--surface)",border:"1px solid var(--border)",borderRadius:12,padding:20 }}>
            <div style={{ fontSize:12,fontWeight:600,color:"var(--indigo-l)",marginBottom:14,textTransform:"uppercase",letterSpacing:".06em" }}>Firebase Credentials</div>
            {[["apiKey","API Key","AIzaSy..."],["authDomain","Auth Domain","your-project.firebaseapp.com"],["projectId","Project ID","your-project-id"],["storageBucket","Storage Bucket","your-project.appspot.com"],["messagingSenderId","Messaging Sender ID","123456789"],["appId","App ID","1:123:web:abc"]].map(([k,label,ph]) => (
              <div className="cfg-field" key={k}>
                <label className="cfg-label">{label}</label>
                <input className="input" placeholder={ph} value={cfg[k]} onChange={e => update(k, e.target.value)} />
              </div>
            ))}
            {error && <div style={{ color:"var(--red)",fontSize:12,marginBottom:12 }}>{error}</div>}
            <button className="btn btn-primary btn-full" onClick={connect}>Connect to Firebase</button>
            <div className="cfg-note">
              <strong style={{ color:"var(--text)" }}>How to get these:</strong><br/>
              1. Go to <a href="https://console.firebase.google.com" target="_blank" rel="noreferrer">console.firebase.google.com</a> → Project Settings → Your apps.<br/>
              2. Add a Web app and copy the <code>firebaseConfig</code> values.<br/>
              3. Enable Firestore Database in test mode.
            </div>
          </div>
        </div>
      </div>
    </>
  );
}

// ─── Root ──────────────────────────────────────────────────────────────────────
export default function App() {
  const [connected, setConnected] = useState(false);
  const [ready, setReady]         = useState(false);
  useEffect(() => {
    const ok = initFirebase(FIREBASE_CONFIG);
    if (ok) setConnected(true);
    setReady(true);
  }, []);
  if (!ready) return <><style>{styles}</style><div style={{ display:"flex",alignItems:"center",justifyContent:"center",height:"100vh",color:"var(--muted)" }}>Loading…</div></>;
  if (!connected) return <FirebaseSetup onConnect={() => setConnected(true)} />;
  return <BudgetApp onDisconnect={() => { localStorage.removeItem(CFG_KEY); setConnected(false); }} />;
}

// ─── Budget App ────────────────────────────────────────────────────────────────
function BudgetApp({ onDisconnect }) {
  const [categories, setCategories] = useState(DEFAULT_CATS);
  const [budgets, setBudgets]       = useState({});
  const [expenses, setExpenses]     = useState([]);
  const [history, setHistory]       = useState({});
  const [synced, setSynced]         = useState(false);

  const [activeMonth, setActiveMonth]   = useState(monthKey());
  const [activeTab, setActiveTab]       = useState("overview");
  const [quickAddOpen, setQuickAddOpen] = useState(false);
  const [newCat, setNewCat]             = useState("");
  const [rolloverModal, setRolloverModal] = useState(false);

  const [toast, setToast] = useState({ msg:"",type:"ok",show:false });
  const toastTimer = useRef(null);
  const showToast = useCallback((msg, type="ok") => {
    clearTimeout(toastTimer.current);
    setToast({ msg, type, show:true });
    toastTimer.current = setTimeout(() => setToast(t => ({ ...t, show:false })), 2800);
  }, []);

  useEffect(() => {
    const db = getDB(); if (!db) return;
    const unsubs = [];
    unsubs.push(onSnapshot(doc(db,"homebase","meta"), snap => { if (snap.exists()) setCategories(snap.data().categories || DEFAULT_CATS); setSynced(true); }, () => setSynced(false)));
    unsubs.push(onSnapshot(doc(db,"homebase","budgets"), snap => { if (snap.exists()) setBudgets(snap.data()); }));
    unsubs.push(onSnapshot(doc(db,"homebase","history"), snap => { if (snap.exists()) setHistory(snap.data()); }));
    unsubs.push(onSnapshot(collection(db, EXP_COL), snap => { setExpenses(snap.docs.map(d => ({ id:d.id, ...d.data() }))); }));
    return () => unsubs.forEach(u => u());
  }, []);

  const monthBudget   = budgets[activeMonth] || {};
  const monthExpenses = expenses.filter(e => e.monthKey === activeMonth);
  const totalBudget   = Object.values(monthBudget).reduce((a,b) => a+(+b||0), 0);
  const totalSpent    = monthExpenses.reduce((a,e) => a+(+e.amount||0), 0);
  const remaining     = totalBudget - totalSpent;

  const spentByCat = {};
  categories.forEach(c => { spentByCat[c] = 0; });
  monthExpenses.forEach(e => { (e.splits||[]).forEach(s => { spentByCat[s.cat] = (spentByCat[s.cat]||0) + (e.amount*s.pct)/100; }); });

  const saveCategories = async (cats) => { setCategories(cats); await fsSet("homebase/meta", { categories:cats }); };
  const updateBudgetCat = async (cat, val) => {
    const updated = { ...budgets, [activeMonth]: { ...(budgets[activeMonth]||{}), [cat]: +val||0 } };
    setBudgets(updated); await fsSet("homebase/budgets", updated);
  };
  const addExpense = async (exp) => {
    const db = getDB(); if (!db) return;
    const id = Date.now().toString();
    await setDoc(doc(db, EXP_COL, id), { ...exp, id, monthKey: activeMonth });
    showToast("Expense saved!");
  };
  const addExpensesBulk = async (rows) => {
    const db = getDB(); if (!db) return;
    await Promise.all(rows.map((row,i) => {
      const id = (Date.now()+i).toString();
      const mk = row.date.slice(0,7);
      return setDoc(doc(db, EXP_COL, id), { id, amount:row.amount, notes:row.notes, date:row.date, photo:null, splits:[{cat:row.category,pct:100}], monthKey:mk });
    }));
    showToast(`${rows.length} expense${rows.length!==1?"s":""} imported!`);
  };
  const deleteExpense = async (id) => { const db = getDB(); if (!db) return; await deleteDoc(doc(db, EXP_COL, id)); showToast("Expense removed."); };
  const addCategory   = async () => { const t = newCat.trim(); if (!t||categories.includes(t)) return; await saveCategories([...categories,t]); setNewCat(""); };
  const removeCategory = async (cat) => { await saveCategories(categories.filter(x => x!==cat)); };
  const doRollover = async () => {
    const newMk = monthKey(new Date());
    await fsSet("homebase/history", { ...history, [activeMonth]: { budget:monthBudget, expenses:monthExpenses } });
    await fsSet("homebase/budgets", { ...budgets, [newMk]: { ...monthBudget } });
    setActiveMonth(newMk); setRolloverModal(false);
    showToast("Month rolled over.");
  };

  const insights = [];
  categories.forEach(cat => {
    const budget = monthBudget[cat]||0, spent = spentByCat[cat]||0;
    if (!budget) return;
    const pct = spent/budget;
    if (pct>=1)         insights.push({ type:"danger",   title:`${cat} over budget`,   desc:`Spent ${fmt(spent)} of ${fmt(budget)} (${Math.round(pct*100)}%).` });
    else if (pct>=0.85) insights.push({ type:"warn",     title:`${cat} nearing limit`, desc:`${Math.round(pct*100)}% used — ${fmt(budget-spent)} left.` });
    else if (pct<0.3&&monthExpenses.length>3) insights.push({ type:"positive", title:`${cat} well under budget`, desc:`Only ${Math.round(pct*100)}% used.` });
  });
  if (remaining<0) insights.unshift({ type:"danger", title:"Over total budget", desc:`Exceeds budget by ${fmt(Math.abs(remaining))}.` });

  return (
    <>
      <style>{styles}</style>
      <div className="app">
        <header className="header">
          <div className="header-brand">
            <svg width="20" height="20" fill="none" stroke="currentColor" strokeWidth="2" viewBox="0 0 24 24">
              <path d="M12 2C6.48 2 2 6.48 2 12s4.48 10 10 10 10-4.48 10-10S17.52 2 12 2z"/><path d="M12 6v6l4 2"/>
            </svg>
            <span className="header-title">HomeBase Budget</span>
          </div>
          <span className="header-month">{monthLabel(activeMonth)}</span>
          <span className="sync-label"><span className={`sync-dot ${synced?"":"off"}`}/>{synced?"Live":"Offline"}</span>
        </header>

        <div className="content-area">

          {/* ── Overview ── */}
          {activeTab==="overview" && (
            <div className="dash">
              <div className="stat-row">
                <div className="stat-card">
                  <div className="stat-label">Budget</div>
                  <div className="stat-value">{fmt(totalBudget)}</div>
                  <div className="stat-sub">{monthLabel(activeMonth)}</div>
                </div>
                <div className="stat-card">
                  <div className="stat-label">Spent</div>
                  <div className={`stat-value ${totalSpent>totalBudget?"red":totalSpent/totalBudget>.85?"amber":"green"}`}>{fmt(totalSpent)}</div>
                  <div className="stat-sub">{totalBudget>0?`${Math.round(totalSpent/totalBudget*100)}% used`:"—"}</div>
                </div>
                <div className="stat-card">
                  <div className="stat-label">Left</div>
                  <div className={`stat-value ${remaining<0?"red":"green"}`}>{fmt(Math.abs(remaining))}</div>
                  <div className="stat-sub">{remaining<0?"over":"remaining"}</div>
                </div>
              </div>

              {insights.length>0 && (
                <div>
                  <div className="section-title">Alerts</div>
                  <div className="insight-list">
                    {insights.slice(0,3).map((ins,i) => (
                      <div key={i} className={`insight ${ins.type}`}>
                        <div className="insight-title">{ins.title}</div>
                        <div className="insight-desc">{ins.desc}</div>
                      </div>
                    ))}
                  </div>
                </div>
              )}

              <div>
                <div className="section-title">Budget Pulse</div>
                <div className="cat-grid">
                  {categories.filter(c=>monthBudget[c]>0).map(cat => {
                    const budget=monthBudget[cat]||0, spent=spentByCat[cat]||0;
                    const pct=budget>0?Math.min((spent/budget)*100,100):0;
                    const cls=pct>=100?"danger":pct>=85?"warn":"safe";
                    return (
                      <div className="cat-card" key={cat}>
                        <div className="cat-header">
                          <span className="cat-name">{cat}</span>
                          <span className="cat-amounts"><span>{fmt(spent)}</span> / {fmt(budget)}</span>
                        </div>
                        <div className="pulse-track"><div className={`pulse-bar ${cls}`} style={{ width:`${pct}%` }}/></div>
                        <div className={`cat-status ${pct<5&&spent===0?"under":cls}`}>
                          {pct>=100?`⚠ Over by ${fmt(Math.abs(budget-spent))}`:pct>=85?`⚡ ${fmt(budget-spent)} left`:spent===0?"No expenses yet":`${fmt(budget-spent)} left`}
                        </div>
                      </div>
                    );
                  })}
                  {categories.filter(c=>monthBudget[c]>0).length===0 && (
                    <div className="empty">
                      No budget set yet.<br/>
                      <button className="btn btn-ghost btn-sm" style={{ marginTop:10 }} onClick={()=>setActiveTab("budget")}>Set up budget →</button>
                    </div>
                  )}
                </div>
              </div>
            </div>
          )}

          {/* ── Expenses ── */}
          {activeTab==="expenses" && (
            <div className="dash">
              <div style={{ display:"flex",justifyContent:"space-between",alignItems:"center" }}>
                <div className="section-title" style={{ marginBottom:0 }}>Expenses — {monthLabel(activeMonth)}</div>
                <span style={{ fontFamily:"var(--mono)",fontSize:12,color:"var(--muted)" }}>{monthExpenses.length} · {fmt(totalSpent)}</span>
              </div>
              <div>
                <div className="form-section-label">Import from CSV</div>
                <ExpenseUpload categories={categories} onUpload={addExpensesBulk} onError={msg=>showToast(msg,"error")} />
              </div>
              <div className="divider"/>
              <div className="expense-list">
                {[...monthExpenses].sort((a,b)=>b.date.localeCompare(a.date)).map(e => (
                  <ExpenseItem key={e.id} expense={e} onDelete={deleteExpense} />
                ))}
                {monthExpenses.length===0 && <div className="empty">No expenses yet.<br/>Tap + to add one.</div>}
              </div>
            </div>
          )}

          {/* ── Budget ── */}
          {activeTab==="budget" && (
            <div className="budget-panel">
              <div>
                <div className="form-section-label">Upload Budget CSV</div>
                <BudgetUpload
                  onUpload={async (rows) => {
                    const newCats = rows.map(r=>r.category).filter(c=>!categories.includes(c));
                    if (newCats.length) await saveCategories([...categories,...newCats]);
                    const updated = { ...budgets, [activeMonth]: { ...(budgets[activeMonth]||{}) } };
                    rows.forEach(r => { updated[activeMonth][r.category]=r.amount; });
                    setBudgets(updated); await fsSet("homebase/budgets", updated);
                    showToast(`Loaded ${rows.length} budget line${rows.length!==1?"s":""}.`);
                  }}
                  onError={msg=>showToast(msg,"error")}
                />
              </div>
              <div className="divider"/>
              <p style={{ fontSize:12,color:"var(--muted)" }}>Or edit manually:</p>
              {categories.map(cat => (
                <div className="budget-row" key={cat}>
                  <span className="cat-label">{cat}</span>
                  <input className="input" type="number" min="0" step="50" placeholder="0"
                    value={monthBudget[cat]||""}
                    onChange={e=>updateBudgetCat(cat,e.target.value)} />
                </div>
              ))}
              <div className="divider"/>
              <div style={{ display:"flex",justifyContent:"space-between",fontSize:13,fontFamily:"var(--mono)" }}>
                <span style={{ color:"var(--muted)" }}>Total</span>
                <span style={{ fontWeight:600 }}>{fmt(totalBudget)}</span>
              </div>
            </div>
          )}

          {/* ── Settings ── */}
          {activeTab==="settings" && (
            <div className="settings-panel">
              <div>
                <div className="form-section-label">Categories</div>
                <div className="cat-chips" style={{ marginBottom:10 }}>
                  {categories.map(c => (
                    <div className="cat-chip" key={c}>{c}
                      <button className="cat-remove" onClick={()=>removeCategory(c)}>✕</button>
                    </div>
                  ))}
                </div>
                <div className="cat-manage-row">
                  <input className="input" placeholder="New category…" value={newCat}
                    onChange={e=>setNewCat(e.target.value)} onKeyDown={e=>e.key==="Enter"&&addCategory()} />
                  <button className="btn btn-primary btn-sm" onClick={addCategory}>Add</button>
                </div>
              </div>
              <div className="divider"/>
              <div>
                <div className="form-section-label">Month</div>
                <p style={{ fontSize:12,color:"var(--muted)",marginBottom:8 }}>Viewing: <strong style={{ color:"var(--text)" }}>{monthLabel(activeMonth)}</strong></p>
                <button className="btn btn-danger btn-sm" onClick={()=>setRolloverModal(true)}>Roll Over to New Month</button>
              </div>
              <div className="divider"/>
              <div>
                <div className="form-section-label">History</div>
                {Object.keys(history).length===0 && <div style={{ fontSize:12,color:"var(--muted)" }}>No archived months yet.</div>}
                {Object.entries(history).reverse().map(([mk,data]) => (
                  <HistoryMonth key={mk} mk={mk} data={data} categories={categories} />
                ))}
              </div>
              <div className="divider"/>
              <div>
                <div className="form-section-label">Connection</div>
                <button className="btn btn-ghost btn-sm" onClick={onDisconnect}>Disconnect Firebase</button>
              </div>
            </div>
          )}
        </div>

        {/* ── Bottom Nav ── */}
        <nav className="bottom-nav">
          <button className={`nav-btn ${activeTab==="overview"?"active":""}`} onClick={()=>setActiveTab("overview")}>
            <svg fill="none" stroke="currentColor" strokeWidth="2" viewBox="0 0 24 24"><rect x="3" y="3" width="7" height="7" rx="1"/><rect x="14" y="3" width="7" height="7" rx="1"/><rect x="3" y="14" width="7" height="7" rx="1"/><rect x="14" y="14" width="7" height="7" rx="1"/></svg>
            Overview
          </button>
          <button className={`nav-btn ${activeTab==="expenses"?"active":""}`} onClick={()=>setActiveTab("expenses")}>
            <svg fill="none" stroke="currentColor" strokeWidth="2" viewBox="0 0 24 24"><path d="M9 5H7a2 2 0 0 0-2 2v12a2 2 0 0 0 2 2h10a2 2 0 0 0 2-2V7a2 2 0 0 0-2-2h-2"/><rect x="9" y="3" width="6" height="4" rx="1"/><line x1="9" y1="12" x2="15" y2="12"/><line x1="9" y1="16" x2="12" y2="16"/></svg>
            Expenses
          </button>
          <button className="fab-btn" onClick={()=>setQuickAddOpen(true)}>+</button>
          <button className={`nav-btn ${activeTab==="budget"?"active":""}`} onClick={()=>setActiveTab("budget")}>
            <svg fill="none" stroke="currentColor" strokeWidth="2" viewBox="0 0 24 24"><line x1="12" y1="1" x2="12" y2="23"/><path d="M17 5H9.5a3.5 3.5 0 0 0 0 7h5a3.5 3.5 0 0 1 0 7H6"/></svg>
            Budget
          </button>
          <button className={`nav-btn ${activeTab==="settings"?"active":""}`} onClick={()=>setActiveTab("settings")}>
            <svg fill="none" stroke="currentColor" strokeWidth="2" viewBox="0 0 24 24"><circle cx="12" cy="12" r="3"/><path d="M19.4 15a1.65 1.65 0 0 0 .33 1.82l.06.06a2 2 0 0 1-2.83 2.83l-.06-.06a1.65 1.65 0 0 0-1.82-.33 1.65 1.65 0 0 0-1 1.51V21a2 2 0 0 1-4 0v-.09A1.65 1.65 0 0 0 9 19.4a1.65 1.65 0 0 0-1.82.33l-.06.06a2 2 0 0 1-2.83-2.83l.06-.06A1.65 1.65 0 0 0 4.68 15a1.65 1.65 0 0 0-1.51-1H3a2 2 0 0 1 0-4h.09A1.65 1.65 0 0 0 4.6 9a1.65 1.65 0 0 0-.33-1.82l-.06-.06a2 2 0 0 1 2.83-2.83l.06.06A1.65 1.65 0 0 0 9 4.68a1.65 1.65 0 0 0 1-1.51V3a2 2 0 0 1 4 0v.09a1.65 1.65 0 0 0 1 1.51 1.65 1.65 0 0 0 1.82-.33l.06-.06a2 2 0 0 1 2.83 2.83l-.06.06A1.65 1.65 0 0 0 19.4 9a1.65 1.65 0 0 0 1.51 1H21a2 2 0 0 1 0 4h-.09a1.65 1.65 0 0 0-1.51 1z"/></svg>
            Settings
          </button>
        </nav>
      </div>

      {quickAddOpen && (
        <QuickAddModal
          categories={categories}
          onAdd={async (exp) => { await addExpense(exp); setQuickAddOpen(false); }}
          onClose={() => setQuickAddOpen(false)}
          showToast={showToast}
        />
      )}

      {rolloverModal && (
        <div className="modal-overlay">
          <div className="modal">
            <div className="modal-title">Start New Month</div>
            <p style={{ fontSize:13,color:"var(--muted)",lineHeight:1.6 }}>
              This archives {monthLabel(activeMonth)}'s expenses and clears the ledger. Budget carries forward. Cannot be undone.
            </p>
            <div className="modal-actions">
              <button className="btn btn-ghost" onClick={()=>setRolloverModal(false)}>Cancel</button>
              <button className="btn btn-primary" onClick={doRollover}>Archive & Start Fresh</button>
            </div>
          </div>
        </div>
      )}

      <div className={`toast ${toast.show?"show":""} ${toast.type==="error"?"error":""}`}>{toast.msg}</div>
    </>
  );
}

// ─── Quick Add Modal ───────────────────────────────────────────────────────────
function QuickAddModal({ categories, onAdd, onClose, showToast }) {
  const [amount, setAmount] = useState("");
  const [cat, setCat]       = useState(categories[0]||"");
  const [date, setDate]     = useState(today());
  const [notes, setNotes]   = useState("");

  const submit = async () => {
    if (!amount||+amount<=0) { showToast("Enter a valid amount.","error"); return; }
    if (!cat) { showToast("Select a category.","error"); return; }
    await onAdd({ amount:+amount, notes, date, photo:null, splits:[{cat,pct:100}] });
  };

  return (
    <div className="modal-overlay" onClick={e=>e.target===e.currentTarget&&onClose()}>
      <div className="modal">
        <div className="modal-title">Add Expense</div>
        <div style={{ display:"flex",flexDirection:"column",gap:14 }}>
          <div>
            <div className="form-section-label">Amount</div>
            <div style={{ position:"relative" }}>
              <span style={{ position:"absolute",left:14,top:"50%",transform:"translateY(-50%)",color:"var(--muted)",fontFamily:"var(--mono)",fontSize:22,pointerEvents:"none" }}>$</span>
              <input className="input amount" type="number" min="0" step="0.01" placeholder="0.00"
                value={amount} onChange={e=>setAmount(e.target.value)}
                style={{ paddingLeft:32 }} autoFocus />
            </div>
          </div>
          <div>
            <div className="form-section-label">Category</div>
            <select className="select" value={cat} onChange={e=>setCat(e.target.value)}>
              {categories.map(c=><option key={c} value={c}>{c}</option>)}
            </select>
          </div>
          <div style={{ display:"flex",gap:10 }}>
            <div style={{ flex:1 }}>
              <div className="form-section-label">Date</div>
              <input className="input" type="date" value={date} onChange={e=>setDate(e.target.value)} />
            </div>
          </div>
          <div>
            <div className="form-section-label">Notes (optional)</div>
            <input className="input" placeholder="What was this for?" value={notes} onChange={e=>setNotes(e.target.value)}
              onKeyDown={e=>e.key==="Enter"&&submit()} />
          </div>
          <div className="modal-actions" style={{ marginTop:0 }}>
            <button className="btn btn-ghost" onClick={onClose}>Cancel</button>
            <button className="btn btn-primary" onClick={submit} disabled={!amount||+amount<=0}>Save</button>
          </div>
        </div>
      </div>
    </div>
  );
}

// ─── Expense Item ──────────────────────────────────────────────────────────────
function ExpenseItem({ expense:e, onDelete }) {
  return (
    <div className="expense-item">
      <div className="expense-thumb">{e.photo?<img src={e.photo} alt="receipt"/>:"🧾"}</div>
      <div className="expense-body">
        <div className="expense-amount">{fmt(e.amount)}</div>
        {e.notes&&<div className="expense-note">{e.notes}</div>}
        <div className="expense-tags">
          {(e.splits||[]).filter(s=>s.cat).map((s,i)=><span className="expense-tag" key={i}>{s.cat}{s.pct<100?` ${s.pct}%`:""}</span>)}
        </div>
      </div>
      <span className="expense-date">{e.date}</span>
      <button className="delete-btn" onClick={()=>onDelete(e.id)}>✕</button>
    </div>
  );
}

// ─── History Month ─────────────────────────────────────────────────────────────
function HistoryMonth({ mk, data, categories }) {
  const [open, setOpen] = useState(false);
  const totalSpent  = (data.expenses||[]).reduce((a,e)=>a+(+e.amount||0),0);
  const totalBudget = Object.values(data.budget||{}).reduce((a,b)=>a+(+b||0),0);
  return (
    <div className="history-month">
      <div className="history-month-header" onClick={()=>setOpen(o=>!o)}>
        <span className="history-month-title">{monthLabel(mk)}</span>
        <span style={{ fontFamily:"var(--mono)",fontSize:13 }}>{fmt(totalSpent)} / {fmt(totalBudget)} {open?"▲":"▼"}</span>
      </div>
      {open&&(
        <div className="history-month-body">
          <div className="cat-grid">
            {categories.filter(c=>data.budget?.[c]>0).map(cat => {
              const budget=data.budget?.[cat]||0;
              const spent=(data.expenses||[]).reduce((a,e)=>a+(e.splits||[]).filter(s=>s.cat===cat).reduce((b,s)=>b+(e.amount*s.pct)/100,0),0);
              const pct=budget>0?Math.min((spent/budget)*100,100):0;
              const cls=pct>=100?"danger":pct>=85?"warn":"safe";
              return (
                <div className="cat-card" key={cat}>
                  <div className="cat-header">
                    <span className="cat-name">{cat}</span>
                    <span className="cat-amounts"><span>{fmt(spent)}</span> / {fmt(budget)}</span>
                  </div>
                  <div className="pulse-track"><div className={`pulse-bar ${cls}`} style={{ width:`${pct}%` }}/></div>
                </div>
              );
            })}
          </div>
        </div>
      )}
    </div>
  );
}

// ─── Budget CSV Upload ─────────────────────────────────────────────────────────
function BudgetUpload({ onUpload, onError }) {
  const fileRef = useRef();
  const [preview, setPreview] = useState(null);
  const [dragging, setDragging] = useState(false);

  const parseCSV = (text) => {
    const lines = text.trim().split(/\r?\n/).filter(Boolean);
    if (lines.length<2) { onError("CSV must have a header row and at least one data row."); return null; }
    const header = lines[0].split(",").map(h=>h.trim().toLowerCase().replace(/['"]/g,""));
    const catIdx = header.findIndex(h=>["category","cat","name","description"].includes(h));
    const amtIdx = header.findIndex(h=>["amount","budget","amt","total","monthly budget"].includes(h));
    if (catIdx===-1||amtIdx===-1) { onError('CSV needs "Category" and "Amount" columns.'); return null; }
    const rows = [];
    for (let i=1;i<lines.length;i++) {
      const cols = lines[i].split(",").map(c=>c.trim().replace(/^["']|["']$/g,""));
      const category = cols[catIdx];
      const amount   = parseFloat((cols[amtIdx]||"").replace(/[$,]/g,""));
      if (!category||isNaN(amount)||amount<0) continue;
      rows.push({ category, amount });
    }
    if (!rows.length) { onError("No valid rows found."); return null; }
    return rows;
  };

  const handleFile = (file) => {
    if (!file||!file.name.endsWith(".csv")) { onError("Please upload a .csv file."); return; }
    const reader = new FileReader();
    reader.onload = e => { const rows=parseCSV(e.target.result); if (rows) setPreview(rows); };
    reader.readAsText(file);
  };

  const downloadTemplate = () => {
    const csv = "Category,Amount\nGroceries,600\nDining Out,300\nHousing,1800\nUtilities,200\nTransportation,400\nHealthcare,150\nEntertainment,200\nClothing,100\nSavings,500\nMiscellaneous,150\n";
    const blob = new Blob([csv],{type:"text/csv"});
    const url  = URL.createObjectURL(blob);
    const a    = document.createElement("a");
    a.href=url; a.download="budget-template.csv"; a.click();
    URL.revokeObjectURL(url);
  };

  if (preview) {
    const total = preview.reduce((a,r)=>a+r.amount,0);
    return (
      <div style={{ display:"flex",flexDirection:"column",gap:10 }}>
        <div style={{ background:"var(--surface2)",border:"1px solid var(--border)",borderRadius:8,overflow:"hidden" }}>
          <div style={{ padding:"8px 12px",borderBottom:"1px solid var(--border)",fontSize:11,color:"var(--muted)",display:"flex",justifyContent:"space-between" }}>
            <span>{preview.length} categories</span><span style={{ fontFamily:"var(--mono)" }}>{fmt(total)}</span>
          </div>
          <div style={{ maxHeight:160,overflowY:"auto" }}>
            {preview.map((r,i)=>(
              <div key={i} style={{ display:"flex",justifyContent:"space-between",padding:"6px 12px",borderBottom:i<preview.length-1?"1px solid var(--border)":"none",fontSize:12 }}>
                <span>{r.category}</span>
                <span style={{ fontFamily:"var(--mono)",color:"var(--indigo-l)" }}>{fmt(r.amount)}</span>
              </div>
            ))}
          </div>
        </div>
        <div style={{ display:"flex",gap:8 }}>
          <button className="btn btn-ghost btn-sm" style={{ flex:1 }} onClick={()=>setPreview(null)}>Cancel</button>
          <button className="btn btn-primary btn-sm" style={{ flex:1 }} onClick={()=>{ onUpload(preview); setPreview(null); }}>Apply Budget</button>
        </div>
      </div>
    );
  }

  return (
    <div style={{ display:"flex",flexDirection:"column",gap:8 }}>
      <div className={`photo-zone ${dragging?"drag":""}`} style={{ padding:"14px 12px" }}
        onClick={()=>fileRef.current.click()}
        onDragOver={e=>{e.preventDefault();setDragging(true);}}
        onDragLeave={()=>setDragging(false)}
        onDrop={e=>{e.preventDefault();setDragging(false);handleFile(e.dataTransfer.files[0]);}}>
        <svg width="20" height="20" fill="none" stroke="var(--muted)" strokeWidth="1.5" viewBox="0 0 24 24">
          <path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4"/><polyline points="17 8 12 3 7 8"/><line x1="12" y1="3" x2="12" y2="15"/>
        </svg>
        <span className="photo-zone-text">Drop CSV or tap to browse</span>
      </div>
      <input ref={fileRef} type="file" accept=".csv" style={{ display:"none" }} onChange={e=>handleFile(e.target.files[0])}/>
      <button className="btn btn-ghost btn-sm btn-full" onClick={downloadTemplate}>↓ Download Template</button>
    </div>
  );
}

// ─── Expense CSV Upload ────────────────────────────────────────────────────────
function ExpenseUpload({ categories, onUpload, onError }) {
  const fileRef = useRef();
  const [preview, setPreview] = useState(null);
  const [dragging, setDragging] = useState(false);

  const parseCSV = (text) => {
    const lines = text.trim().split(/\r?\n/).filter(Boolean);
    if (lines.length<2) { onError("CSV must have a header row and at least one data row."); return null; }
    const header = lines[0].split(",").map(h=>h.trim().toLowerCase().replace(/['"]/g,""));
    const dateIdx = header.findIndex(h=>["date","day"].includes(h));
    const amtIdx  = header.findIndex(h=>["amount","amt","total","cost","price"].includes(h));
    const catIdx  = header.findIndex(h=>["category","cat","type"].includes(h));
    const noteIdx = header.findIndex(h=>["notes","note","description","desc","memo"].includes(h));
    if (amtIdx===-1||catIdx===-1) { onError('CSV needs "Amount" and "Category" columns.'); return null; }
    const rows = [];
    for (let i=1;i<lines.length;i++) {
      const cols = lines[i].split(",").map(c=>c.trim().replace(/^["']|["']$/g,""));
      const amount   = parseFloat((cols[amtIdx]||"").replace(/[$,]/g,""));
      const category = cols[catIdx]||"";
      const notes    = noteIdx>=0?(cols[noteIdx]||""):"";
      let date = dateIdx>=0?(cols[dateIdx]||today()):today();
      if (date&&!date.match(/^\d{4}-\d{2}-\d{2}$/)) { const d=new Date(date); date=isNaN(d)?today():d.toISOString().split("T")[0]; }
      if (!category||isNaN(amount)||amount<=0) continue;
      rows.push({ date, amount, category, notes });
    }
    if (!rows.length) { onError("No valid rows found."); return null; }
    return rows;
  };

  const handleFile = (file) => {
    if (!file||!file.name.endsWith(".csv")) { onError("Please upload a .csv file."); return; }
    const reader = new FileReader();
    reader.onload = e => { const rows=parseCSV(e.target.result); if (rows) setPreview(rows); };
    reader.readAsText(file);
  };

  const downloadTemplate = () => {
    const d = today();
    const csv = `Date,Amount,Category,Notes\n${d},45.00,Groceries,Weekly shopping\n${d},12.50,Dining Out,Lunch\n`;
    const blob = new Blob([csv],{type:"text/csv"});
    const url  = URL.createObjectURL(blob);
    const a    = document.createElement("a");
    a.href=url; a.download="expenses-template.csv"; a.click();
    URL.revokeObjectURL(url);
  };

  if (preview) {
    const total = preview.reduce((a,r)=>a+r.amount,0);
    return (
      <div style={{ display:"flex",flexDirection:"column",gap:10 }}>
        <div style={{ background:"var(--surface2)",border:"1px solid var(--border)",borderRadius:8,overflow:"hidden" }}>
          <div style={{ padding:"8px 12px",borderBottom:"1px solid var(--border)",fontSize:11,color:"var(--muted)",display:"flex",justifyContent:"space-between" }}>
            <span>{preview.length} expenses</span><span style={{ fontFamily:"var(--mono)" }}>{fmt(total)}</span>
          </div>
          <div style={{ maxHeight:160,overflowY:"auto" }}>
            {preview.map((r,i)=>(
              <div key={i} style={{ display:"flex",justifyContent:"space-between",alignItems:"center",padding:"6px 12px",borderBottom:i<preview.length-1?"1px solid var(--border)":"none",fontSize:12,gap:8 }}>
                <span style={{ color:"var(--text-dim)",fontFamily:"var(--mono)",fontSize:11,flexShrink:0 }}>{r.date}</span>
                <span style={{ flex:1,overflow:"hidden",textOverflow:"ellipsis",whiteSpace:"nowrap" }}>{r.category}{r.notes?` · ${r.notes}`:""}</span>
                <span style={{ fontFamily:"var(--mono)",color:"var(--indigo-l)",flexShrink:0 }}>{fmt(r.amount)}</span>
              </div>
            ))}
          </div>
        </div>
        <div style={{ display:"flex",gap:8 }}>
          <button className="btn btn-ghost btn-sm" style={{ flex:1 }} onClick={()=>setPreview(null)}>Cancel</button>
          <button className="btn btn-primary btn-sm" style={{ flex:1 }} onClick={()=>{ onUpload(preview); setPreview(null); }}>
            Import {preview.length} Expense{preview.length!==1?"s":""}
          </button>
        </div>
      </div>
    );
  }

  return (
    <div style={{ display:"flex",flexDirection:"column",gap:8 }}>
      <div className={`photo-zone ${dragging?"drag":""}`} style={{ padding:"14px 12px" }}
        onClick={()=>fileRef.current.click()}
        onDragOver={e=>{e.preventDefault();setDragging(true);}}
        onDragLeave={()=>setDragging(false)}
        onDrop={e=>{e.preventDefault();setDragging(false);handleFile(e.dataTransfer.files[0]);}}>
        <svg width="20" height="20" fill="none" stroke="var(--muted)" strokeWidth="1.5" viewBox="0 0 24 24">
          <path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4"/><polyline points="17 8 12 3 7 8"/><line x1="12" y1="3" x2="12" y2="15"/>
        </svg>
        <span className="photo-zone-text">Drop CSV or tap to browse</span>
      </div>
      <input ref={fileRef} type="file" accept=".csv" style={{ display:"none" }} onChange={e=>handleFile(e.target.files[0])}/>
      <button className="btn btn-ghost btn-sm btn-full" onClick={downloadTemplate}>↓ Download Template</button>
      <p style={{ fontSize:11,color:"var(--muted)",textAlign:"center" }}>
        Columns: <code style={{ fontFamily:"var(--mono)",color:"var(--indigo-l)" }}>Date, Amount, Category, Notes</code>
      </p>
    </div>
  );
}
