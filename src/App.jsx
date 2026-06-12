import { useState, useEffect, useRef, useCallback } from "react";
import { initializeApp, getApps } from "firebase/app";
import {
  getFirestore, doc, collection, onSnapshot,
  setDoc, deleteDoc, getDoc, getDocs
} from "firebase/firestore";

// ─── Firebase config (Ron's project) ───────────────────────────────────────────
const FIREBASE_CONFIG = {
  apiKey: "AIzaSyAoek6YmZPNeUQp-Sv39RUiqeURVotdGzE",
  authDomain: "budget-tracker-37f19.firebaseapp.com",
  projectId: "budget-tracker-37f19",
  storageBucket: "budget-tracker-37f19.firebasestorage.app",
  messagingSenderId: "146577724370",
  appId: "1:146577724370:web:23f1b8344673938a4aee0b"
};

// ─── Firebase singleton ────────────────────────────────────────────────────────
let _db = null;
const getDB = () => _db;

const initFirebase = (cfg) => {
  try {
    const app = getApps().length ? getApps()[0] : initializeApp(cfg);
    _db = getFirestore(app);
    return true;
  } catch (e) {
    console.error(e);
    return false;
  }
};

// ─── Firestore helpers ─────────────────────────────────────────────────────────
// Structure:
//   /homebase/meta           → { categories: [] }
//   /homebase/budgets        → { [monthKey]: { [cat]: amount } }
//   /homebase/history        → { [monthKey]: { budget, expenses: [] } }
//   /homebase/expenses/{id}  → Expense (with monthKey field)

const META_DOC   = "homebase/meta";
const BUDGET_DOC = "homebase/budgets";
const HIST_DOC   = "homebase/history";
const EXP_COL    = "expenses";

const fsSet  = async (path, data) => { const db = getDB(); if (!db) return; const [col, id] = path.split("/"); await setDoc(doc(db, col, id), data); };
const fsGet  = async (path)       => { const db = getDB(); if (!db) return null; const [col, id] = path.split("/"); const s = await getDoc(doc(db, col, id)); return s.exists() ? s.data() : null; };

// ─── Helpers ──────────────────────────────────────────────────────────────────
const monthKey = (d = new Date()) =>
  `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}`;

const monthLabel = (key) => {
  const [y, m] = key.split("-");
  return new Date(+y, +m - 1, 1).toLocaleString("default", { month: "long", year: "numeric" });
};

const fmt = (n) =>
  n == null ? "$—" : "$" + Number(n).toLocaleString("en-US", { minimumFractionDigits: 2, maximumFractionDigits: 2 });

const today = () => new Date().toISOString().split("T")[0];

const DEFAULT_CATS = [
  "Groceries", "Dining Out", "Housing", "Utilities", "Transportation",
  "Healthcare", "Entertainment", "Clothing", "Savings", "Miscellaneous",
];

const CFG_KEY = "hb_firebase_cfg";
const loadCfg = () => { try { return JSON.parse(localStorage.getItem(CFG_KEY) || "null"); } catch { return null; } };
const saveCfg = (c) => localStorage.setItem(CFG_KEY, JSON.stringify(c));

// ─── Styles ───────────────────────────────────────────────────────────────────
const styles = `
  @import url('https://fonts.googleapis.com/css2?family=Inter:wght@300;400;500;600;700&family=JetBrains+Mono:wght@400;500&display=swap');
  *, *::before, *::after { box-sizing: border-box; margin: 0; padding: 0; }
  :root {
    --bg:#0f1117; --surface:#181c27; --surface2:#1f2436; --border:#2a3045;
    --indigo:#6366f1; --indigo-l:#818cf8; --amber:#f59e0b; --red:#ef4444;
    --green:#10b981; --muted:#6b7280; --text:#e5e7eb; --text-dim:#9ca3af;
    --mono:'JetBrains Mono',monospace; --sans:'Inter',sans-serif;
  }
  body { background:var(--bg); color:var(--text); font-family:var(--sans); font-size:14px; line-height:1.5; }
  .app { display:flex; flex-direction:column; min-height:100vh; }

  /* header */
  .header { display:flex; align-items:center; justify-content:space-between; padding:0 24px; height:56px; background:var(--surface); border-bottom:1px solid var(--border); }
  .header-brand { display:flex; align-items:center; gap:10px; }
  .header-brand svg { color:var(--indigo-l); }
  .header-title { font-size:15px; font-weight:600; letter-spacing:-.3px; }
  .header-month { font-family:var(--mono); font-size:12px; color:var(--indigo-l); background:rgba(99,102,241,.12); padding:4px 10px; border-radius:6px; }
  .header-actions { display:flex; gap:8px; align-items:center; }
  .sync-dot { width:8px; height:8px; border-radius:50%; background:var(--green); display:inline-block; margin-right:4px; }
  .sync-dot.off { background:var(--muted); }
  .sync-label { font-size:11px; color:var(--muted); }

  /* layout */
  .main { display:flex; flex:1; }
  .sidebar { width:340px; min-width:340px; border-right:1px solid var(--border); display:flex; flex-direction:column; }
  .content { flex:1; overflow-x:hidden; }

  /* tabs */
  .tabs { display:flex; border-bottom:1px solid var(--border); background:var(--surface); }
  .tab { padding:10px 16px; font-size:13px; font-weight:500; cursor:pointer; border-bottom:2px solid transparent; color:var(--text-dim); transition:all .15s; background:none; border-top:none; border-left:none; border-right:none; }
  .tab:hover { color:var(--text); }
  .tab.active { color:var(--indigo-l); border-bottom-color:var(--indigo); }

  /* forms */
  .add-form { padding:20px; display:flex; flex-direction:column; gap:14px; overflow-y:auto; }
  .form-section-label { font-size:10px; font-weight:600; letter-spacing:.08em; text-transform:uppercase; color:var(--muted); margin-bottom:4px; }
  .photo-zone { border:2px dashed var(--border); border-radius:10px; padding:20px; display:flex; flex-direction:column; align-items:center; gap:8px; cursor:pointer; transition:border-color .15s; }
  .photo-zone:hover, .photo-zone.drag { border-color:var(--indigo); }
  .photo-zone.has-photo { border-style:solid; border-color:var(--indigo); padding:8px; }
  .photo-zone img { width:100%; border-radius:6px; max-height:140px; object-fit:cover; }
  .photo-zone-text { font-size:12px; color:var(--muted); text-align:center; }
  .input,.textarea,.select { width:100%; background:var(--surface2); border:1px solid var(--border); border-radius:8px; padding:9px 12px; color:var(--text); font-family:var(--sans); font-size:13px; outline:none; transition:border-color .15s; }
  .input:focus,.textarea:focus,.select:focus { border-color:var(--indigo); }
  .input.amount { font-family:var(--mono); font-size:20px; font-weight:500; letter-spacing:-.5px; }
  .textarea { resize:vertical; min-height:64px; }
  .select { cursor:pointer; }
  .select option { background:var(--surface2); }
  .split-row { display:flex; gap:8px; align-items:center; margin-bottom:8px; }
  .split-row .select { flex:1; }
  .split-pct { width:68px; background:var(--surface2); border:1px solid var(--border); border-radius:8px; padding:9px 8px; color:var(--indigo-l); font-family:var(--mono); font-size:13px; font-weight:500; outline:none; text-align:right; transition:border-color .15s; }
  .split-pct:focus { border-color:var(--indigo); }
  .split-badge { width:22px; height:22px; border-radius:50%; background:var(--indigo); color:#fff; font-size:11px; font-weight:700; display:flex; align-items:center; justify-content:center; flex-shrink:0; }
  .pct-total { font-family:var(--mono); font-size:12px; color:var(--muted); text-align:right; }
  .pct-total.ok { color:var(--green); }
  .pct-total.over { color:var(--red); }

  /* buttons */
  .btn { border:none; border-radius:8px; padding:10px 16px; font-family:var(--sans); font-size:13px; font-weight:600; cursor:pointer; transition:all .15s; }
  .btn-primary { background:var(--indigo); color:#fff; }
  .btn-primary:hover { background:var(--indigo-l); }
  .btn-primary:disabled { opacity:.45; cursor:not-allowed; }
  .btn-ghost { background:transparent; color:var(--text-dim); border:1px solid var(--border); }
  .btn-ghost:hover { color:var(--text); border-color:var(--text-dim); }
  .btn-danger { background:transparent; color:var(--red); border:1px solid rgba(239,68,68,.3); }
  .btn-danger:hover { background:rgba(239,68,68,.08); }
  .btn-sm { padding:6px 12px; font-size:12px; }
  .btn-full { width:100%; }

  /* toast */
  .toast { position:fixed; bottom:24px; right:24px; background:var(--green); color:#fff; padding:10px 18px; border-radius:8px; font-size:13px; font-weight:500; opacity:0; transform:translateY(8px); transition:all .25s; pointer-events:none; z-index:999; }
  .toast.show { opacity:1; transform:translateY(0); }
  .toast.error { background:var(--red); }

  /* dashboard */
  .dash { padding:20px; display:flex; flex-direction:column; gap:20px; overflow-y:auto; }
  .stat-row { display:grid; grid-template-columns:repeat(3,1fr); gap:12px; }
  .stat-card { background:var(--surface); border:1px solid var(--border); border-radius:10px; padding:14px 16px; }
  .stat-label { font-size:11px; color:var(--muted); font-weight:500; text-transform:uppercase; letter-spacing:.06em; margin-bottom:6px; }
  .stat-value { font-family:var(--mono); font-size:22px; font-weight:500; }
  .stat-value.green { color:var(--green); }
  .stat-value.red { color:var(--red); }
  .stat-value.amber { color:var(--amber); }
  .stat-sub { font-size:11px; color:var(--muted); margin-top:2px; }
  .section-title { font-size:13px; font-weight:600; color:var(--text-dim); letter-spacing:.04em; text-transform:uppercase; margin-bottom:12px; }

  /* pulse bars */
  .cat-grid { display:flex; flex-direction:column; gap:10px; }
  .cat-card { background:var(--surface); border:1px solid var(--border); border-radius:10px; padding:14px 16px; }
  .cat-header { display:flex; justify-content:space-between; align-items:baseline; margin-bottom:8px; }
  .cat-name { font-size:13px; font-weight:500; }
  .cat-amounts { font-family:var(--mono); font-size:12px; color:var(--muted); }
  .cat-amounts span { color:var(--text); font-weight:500; }
  .pulse-track { height:6px; background:var(--border); border-radius:99px; overflow:hidden; }
  .pulse-bar { height:100%; border-radius:99px; transition:width .4s ease; }
  .pulse-bar.safe { background:var(--green); }
  .pulse-bar.warn { background:var(--amber); }
  .pulse-bar.danger { background:var(--red); }
  .cat-status { font-size:11px; margin-top:5px; }
  .cat-status.safe { color:var(--green); }
  .cat-status.warn { color:var(--amber); }
  .cat-status.danger { color:var(--red); }
  .cat-status.under { color:var(--muted); }

  /* expense list */
  .expense-list { display:flex; flex-direction:column; gap:6px; }
  .expense-item { background:var(--surface); border:1px solid var(--border); border-radius:8px; padding:10px 14px; display:flex; align-items:flex-start; gap:12px; }
  .expense-thumb { width:40px; height:40px; border-radius:6px; object-fit:cover; flex-shrink:0; background:var(--surface2); display:flex; align-items:center; justify-content:center; color:var(--muted); font-size:18px; overflow:hidden; }
  .expense-thumb img { width:100%; height:100%; object-fit:cover; }
  .expense-body { flex:1; min-width:0; }
  .expense-amount { font-family:var(--mono); font-size:15px; font-weight:500; }
  .expense-note { font-size:12px; color:var(--muted); white-space:nowrap; overflow:hidden; text-overflow:ellipsis; }
  .expense-tags { display:flex; gap:4px; flex-wrap:wrap; margin-top:4px; }
  .expense-tag { font-size:10px; padding:2px 7px; border-radius:99px; background:rgba(99,102,241,.15); color:var(--indigo-l); font-weight:500; }
  .expense-date { font-size:11px; color:var(--muted); flex-shrink:0; }
  .delete-btn { background:none; border:none; color:var(--muted); cursor:pointer; padding:2px 4px; font-size:14px; border-radius:4px; transition:color .15s; }
  .delete-btn:hover { color:var(--red); }

  /* insights */
  .insight-list { display:flex; flex-direction:column; gap:8px; }
  .insight { background:var(--surface); border-left:3px solid var(--amber); border-radius:0 8px 8px 0; padding:10px 14px; }
  .insight.positive { border-left-color:var(--green); }
  .insight.danger { border-left-color:var(--red); }
  .insight-title { font-size:13px; font-weight:500; }
  .insight-desc { font-size:12px; color:var(--muted); margin-top:2px; }

  /* budget panel */
  .budget-panel { padding:20px; display:flex; flex-direction:column; gap:16px; overflow-y:auto; }
  .budget-row { display:flex; gap:8px; align-items:center; }
  .budget-row .cat-label { flex:1; font-size:13px; }
  .budget-row .input { width:120px; font-family:var(--mono); }

  /* history */
  .history-panel { padding:20px; }
  .history-month { background:var(--surface); border:1px solid var(--border); border-radius:10px; margin-bottom:10px; overflow:hidden; }
  .history-month-header { display:flex; justify-content:space-between; align-items:center; padding:12px 16px; cursor:pointer; user-select:none; }
  .history-month-header:hover { background:var(--surface2); }
  .history-month-title { font-size:14px; font-weight:600; }
  .history-month-body { border-top:1px solid var(--border); padding:14px 16px; }

  /* settings */
  .settings-panel { padding:20px; display:flex; flex-direction:column; gap:14px; overflow-y:auto; }
  .cat-manage-row { display:flex; gap:8px; align-items:center; }
  .cat-chip { display:flex; align-items:center; gap:6px; background:var(--surface2); border:1px solid var(--border); border-radius:6px; padding:5px 10px; font-size:12px; }
  .cat-chips { display:flex; flex-wrap:wrap; gap:6px; }
  .cat-remove { background:none; border:none; color:var(--muted); cursor:pointer; font-size:12px; }
  .cat-remove:hover { color:var(--red); }

  .divider { height:1px; background:var(--border); margin:4px 0; }

  /* modal */
  .modal-overlay { position:fixed; inset:0; background:rgba(0,0,0,.6); display:flex; align-items:center; justify-content:center; z-index:100; }
  .modal { background:var(--surface); border:1px solid var(--border); border-radius:14px; padding:28px; width:480px; max-width:90vw; }
  .modal-title { font-size:18px; font-weight:700; margin-bottom:6px; }
  .modal-desc { font-size:13px; color:var(--muted); margin-bottom:20px; line-height:1.6; }
  .modal-actions { display:flex; gap:10px; justify-content:flex-end; margin-top:20px; }
  .cfg-field { display:flex; flex-direction:column; gap:4px; margin-bottom:12px; }
  .cfg-label { font-size:11px; font-weight:600; color:var(--muted); text-transform:uppercase; letter-spacing:.06em; }
  .cfg-note { font-size:11px; color:var(--muted); margin-top:16px; line-height:1.6; }
  .cfg-note a { color:var(--indigo-l); }
  .cfg-note code { font-family:var(--mono); background:var(--surface2); padding:1px 5px; border-radius:4px; font-size:11px; }

  .empty { text-align:center; color:var(--muted); padding:32px; font-size:13px; }

  @media (max-width:700px) {
    .main { flex-direction:column; }
    .sidebar { width:100%; min-width:unset; border-right:none; border-bottom:1px solid var(--border); }
    .stat-row { grid-template-columns:1fr 1fr; }
  }
`;

// ─── Firebase Config Modal ─────────────────────────────────────────────────────
function FirebaseSetup({ onConnect }) {
  const [cfg, setCfg] = useState({
    apiKey: "", authDomain: "", projectId: "", storageBucket: "",
    messagingSenderId: "", appId: "",
  });
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
      <div style={{ display:"flex", alignItems:"center", justifyContent:"center", minHeight:"100vh", background:"var(--bg)", padding:24 }}>
        <div style={{ width:480, maxWidth:"100%" }}>
          <div style={{ marginBottom:24 }}>
            <div style={{ display:"flex", alignItems:"center", gap:10, marginBottom:8 }}>
              <svg width="24" height="24" fill="none" stroke="var(--indigo-l)" strokeWidth="2" viewBox="0 0 24 24">
                <path d="M12 2C6.48 2 2 6.48 2 12s4.48 10 10 10 10-4.48 10-10S17.52 2 12 2z"/>
                <path d="M12 6v6l4 2"/>
              </svg>
              <span style={{ fontSize:20, fontWeight:700, fontFamily:"var(--sans)" }}>HomeBase Budget</span>
            </div>
            <p style={{ fontSize:13, color:"var(--muted)", lineHeight:1.6 }}>
              Connect your Firebase project for real-time sync across both your phones. This only takes a few minutes.
            </p>
          </div>

          <div style={{ background:"var(--surface)", border:"1px solid var(--border)", borderRadius:12, padding:20 }}>
            <div style={{ fontSize:12, fontWeight:600, color:"var(--indigo-l)", marginBottom:14, textTransform:"uppercase", letterSpacing:".06em" }}>Firebase Credentials</div>

            {[
              ["apiKey",            "API Key",             "AIzaSy..."],
              ["authDomain",        "Auth Domain",         "your-project.firebaseapp.com"],
              ["projectId",         "Project ID",          "your-project-id"],
              ["storageBucket",     "Storage Bucket",      "your-project.appspot.com"],
              ["messagingSenderId", "Messaging Sender ID", "123456789"],
              ["appId",             "App ID",              "1:123:web:abc"],
            ].map(([k, label, ph]) => (
              <div className="cfg-field" key={k}>
                <label className="cfg-label">{label}</label>
                <input className="input" placeholder={ph} value={cfg[k]} onChange={e => update(k, e.target.value)} />
              </div>
            ))}

            {error && <div style={{ color:"var(--red)", fontSize:12, marginBottom:12 }}>{error}</div>}

            <button className="btn btn-primary btn-full" onClick={connect}>Connect to Firebase</button>

            <div className="cfg-note">
              <strong style={{ color:"var(--text)" }}>How to get these credentials:</strong><br/>
              1. Go to <a href="https://console.firebase.google.com" target="_blank" rel="noreferrer">console.firebase.google.com</a> and create a project (free Spark plan).<br/>
              2. Click <strong>Project Settings</strong> (gear icon) → <strong>General</strong> → scroll to <strong>Your apps</strong>.<br/>
              3. Click <strong>Add app</strong> → Web (<code>&lt;/&gt;</code>), register it, and copy the <code>firebaseConfig</code> object values here.<br/>
              4. In the Firebase console, go to <strong>Firestore Database</strong> → <strong>Create database</strong> → Start in <strong>test mode</strong>.
            </div>
          </div>
        </div>
      </div>
    </>
  );
}

// ─── Main App ─────────────────────────────────────────────────────────────────
export default function App() {
  const [connected, setConnected] = useState(false);
  const [ready, setReady] = useState(false);

  // Auto-connect with the built-in config
  useEffect(() => {
    const ok = initFirebase(FIREBASE_CONFIG);
    if (ok) setConnected(true);
    setReady(true);
  }, []);

  if (!ready) return <><style>{styles}</style><div style={{ display:"flex", alignItems:"center", justifyContent:"center", height:"100vh", color:"var(--muted)" }}>Loading…</div></>;
  if (!connected) return <FirebaseSetup onConnect={() => setConnected(true)} />;
  return <BudgetApp onDisconnect={() => { localStorage.removeItem(CFG_KEY); setConnected(false); }} />;
}

// ─── Budget App (Firebase-connected) ──────────────────────────────────────────
function BudgetApp({ onDisconnect }) {
  const [categories, setCategories]   = useState(DEFAULT_CATS);
  const [budgets, setBudgets]         = useState({});
  const [expenses, setExpenses]       = useState([]);   // flat array, all months
  const [history, setHistory]         = useState({});
  const [synced, setSynced]           = useState(false);

  const [activeMonth, setActiveMonth] = useState(monthKey());
  const [dashTab, setDashTab]         = useState("overview");
  const [sideTab, setSideTab]         = useState("add");
  const [newCat, setNewCat]           = useState("");
  const [rolloverModal, setRolloverModal] = useState(false);

  const [toast, setToast] = useState({ msg:"", type:"ok", show:false });
  const toastTimer = useRef(null);
  const showToast = useCallback((msg, type="ok") => {
    clearTimeout(toastTimer.current);
    setToast({ msg, type, show:true });
    toastTimer.current = setTimeout(() => setToast(t => ({ ...t, show:false })), 2800);
  }, []);

  // ── Firestore real-time listeners ──
  useEffect(() => {
    const db = getDB();
    if (!db) return;

    const unsubs = [];

    // meta (categories)
    unsubs.push(onSnapshot(doc(db, "homebase", "meta"), snap => {
      if (snap.exists()) setCategories(snap.data().categories || DEFAULT_CATS);
      setSynced(true);
    }, () => setSynced(false)));

    // budgets
    unsubs.push(onSnapshot(doc(db, "homebase", "budgets"), snap => {
      if (snap.exists()) setBudgets(snap.data());
    }));

    // history
    unsubs.push(onSnapshot(doc(db, "homebase", "history"), snap => {
      if (snap.exists()) setHistory(snap.data());
    }));

    // expenses collection
    unsubs.push(onSnapshot(collection(db, EXP_COL), snap => {
      setExpenses(snap.docs.map(d => ({ id: d.id, ...d.data() })));
    }));

    return () => unsubs.forEach(u => u());
  }, []);

  // ── Computed ──
  const monthBudget   = budgets[activeMonth] || {};
  const monthExpenses = expenses.filter(e => e.monthKey === activeMonth);
  const totalBudget   = Object.values(monthBudget).reduce((a, b) => a + (+b || 0), 0);
  const totalSpent    = monthExpenses.reduce((a, e) => a + (+e.amount || 0), 0);
  const remaining     = totalBudget - totalSpent;

  const spentByCat = {};
  categories.forEach(c => { spentByCat[c] = 0; });
  monthExpenses.forEach(e => {
    (e.splits || []).forEach(s => {
      spentByCat[s.cat] = (spentByCat[s.cat] || 0) + (e.amount * s.pct) / 100;
    });
  });

  // ── Write helpers ──
  const saveCategories = async (cats) => {
    setCategories(cats);
    await fsSet("homebase/meta", { categories: cats });
  };

  const updateBudgetCat = async (cat, val) => {
    const updated = { ...budgets, [activeMonth]: { ...(budgets[activeMonth] || {}), [cat]: +val || 0 } };
    setBudgets(updated);
    await fsSet("homebase/budgets", updated);
  };

  const addExpense = async (exp) => {
    const db = getDB(); if (!db) return;
    const id = Date.now().toString();
    await setDoc(doc(db, EXP_COL, id), { ...exp, id, monthKey: activeMonth });
    showToast("Expense saved!");
  };

  const deleteExpense = async (id) => {
    const db = getDB(); if (!db) return;
    await deleteDoc(doc(db, EXP_COL, id));
    showToast("Expense removed.");
  };

  const addCategory = async () => {
    const t = newCat.trim();
    if (!t || categories.includes(t)) return;
    const updated = [...categories, t];
    await saveCategories(updated);
    setNewCat("");
  };

  const removeCategory = async (cat) => {
    await saveCategories(categories.filter(x => x !== cat));
  };

  const doRollover = async () => {
    const mk = activeMonth;
    const newMk = monthKey(new Date());
    // Archive
    const histUpdated = { ...history, [mk]: { budget: monthBudget, expenses: monthExpenses } };
    await fsSet("homebase/history", histUpdated);
    // Carry forward budget, reset month
    const budgetsUpdated = { ...budgets, [newMk]: { ...monthBudget } };
    await fsSet("homebase/budgets", budgetsUpdated);
    setActiveMonth(newMk);
    setRolloverModal(false);
    showToast("Month rolled over. Expenses cleared, budget carried forward.");
  };

  // ── Insights ──
  const insights = [];
  categories.forEach(cat => {
    const budget = monthBudget[cat] || 0;
    const spent  = spentByCat[cat]  || 0;
    if (!budget) return;
    const pct = spent / budget;
    if (pct >= 1)         insights.push({ type:"danger",   title:`${cat} over budget`,    desc:`Spent ${fmt(spent)} of ${fmt(budget)} budget (${Math.round(pct*100)}%).` });
    else if (pct >= 0.85) insights.push({ type:"warn",     title:`${cat} nearing limit`,  desc:`${Math.round(pct*100)}% used — ${fmt(budget-spent)} remaining.` });
    else if (pct < 0.3 && monthExpenses.length > 3) insights.push({ type:"positive", title:`${cat} well under budget`, desc:`Only ${Math.round(pct*100)}% used. Consider reallocating surplus.` });
  });
  if (remaining < 0) insights.unshift({ type:"danger", title:"Over total budget", desc:`Total spending exceeds budget by ${fmt(Math.abs(remaining))}.` });
  if (insights.length === 0 && monthExpenses.length > 0) insights.push({ type:"positive", title:"On track!", desc:"All categories are within budget. Great work." });

  return (
    <>
      <style>{styles}</style>
      <div className="app">
        <header className="header">
          <div className="header-brand">
            <svg width="22" height="22" fill="none" stroke="currentColor" strokeWidth="2" viewBox="0 0 24 24">
              <path d="M12 2C6.48 2 2 6.48 2 12s4.48 10 10 10 10-4.48 10-10S17.52 2 12 2z"/>
              <path d="M12 6v6l4 2"/>
            </svg>
            <span className="header-title">HomeBase Budget</span>
          </div>
          <span className="header-month">{monthLabel(activeMonth)}</span>
          <div className="header-actions">
            <span className="sync-label"><span className={`sync-dot ${synced ? "" : "off"}`}/>{synced ? "Live" : "Offline"}</span>
            <button className="btn btn-ghost btn-sm" onClick={() => setRolloverModal(true)}>↩ New Month</button>
            <button className="btn btn-ghost btn-sm" onClick={onDisconnect} title="Disconnect Firebase" style={{ color:"var(--muted)" }}>⚙</button>
          </div>
        </header>

        <div className="main">
          <aside className="sidebar">
            <div className="tabs">
              {[["add","Add Expense"],["budget","Monthly Budget"],["settings","Categories"]].map(([k,l]) => (
                <button key={k} className={`tab ${sideTab===k?"active":""}`} onClick={() => setSideTab(k)}>{l}</button>
              ))}
            </div>

            {sideTab === "add" && <AddForm categories={categories} onAdd={addExpense} showToast={showToast} />}

            {sideTab === "budget" && (
              <div className="budget-panel">
                <div>
                  <div className="form-section-label">Upload Budget CSV</div>
                  <BudgetUpload
                    onUpload={async (rows) => {
                      const newCats = rows.map(r => r.category).filter(c => !categories.includes(c));
                      const updatedCats = newCats.length ? [...categories, ...newCats] : categories;
                      if (newCats.length) await saveCategories(updatedCats);
                      const updated = { ...budgets, [activeMonth]: { ...(budgets[activeMonth] || {}) } };
                      rows.forEach(r => { updated[activeMonth][r.category] = r.amount; });
                      setBudgets(updated);
                      await fsSet("homebase/budgets", updated);
                      showToast(`Loaded ${rows.length} budget line${rows.length !== 1 ? "s" : ""}.`);
                    }}
                    onError={msg => showToast(msg, "error")}
                  />
                </div>
                <div className="divider" />
                <p style={{ fontSize:12, color:"var(--muted)" }}>Or edit amounts manually below.</p>
                {categories.map(cat => (
                  <div className="budget-row" key={cat}>
                    <span className="cat-label">{cat}</span>
                    <input className="input" type="number" min="0" step="50" placeholder="0"
                      value={monthBudget[cat] || ""}
                      onChange={e => updateBudgetCat(cat, e.target.value)} />
                  </div>
                ))}
                <div className="divider" />
                <div style={{ display:"flex", justifyContent:"space-between", fontSize:13, fontFamily:"var(--mono)" }}>
                  <span style={{ color:"var(--muted)" }}>Total Budget</span>
                  <span style={{ fontWeight:600 }}>{fmt(totalBudget)}</span>
                </div>
              </div>
            )}

            {sideTab === "settings" && (
              <div className="settings-panel">
                <div>
                  <div className="form-section-label">Manage Categories</div>
                  <div className="cat-chips" style={{ marginBottom:10 }}>
                    {categories.map(c => (
                      <div className="cat-chip" key={c}>{c}
                        <button className="cat-remove" onClick={() => removeCategory(c)}>✕</button>
                      </div>
                    ))}
                  </div>
                  <div className="cat-manage-row">
                    <input className="input" placeholder="New category name…" value={newCat}
                      onChange={e => setNewCat(e.target.value)} onKeyDown={e => e.key==="Enter" && addCategory()} />
                    <button className="btn btn-primary btn-sm" onClick={addCategory}>Add</button>
                  </div>
                </div>
                <div className="divider" />
                <div>
                  <div className="form-section-label">Month</div>
                  <p style={{ fontSize:12, color:"var(--muted)", marginBottom:8 }}>
                    Viewing: <strong style={{ color:"var(--text)" }}>{monthLabel(activeMonth)}</strong>
                  </p>
                  <button className="btn btn-danger btn-sm" onClick={() => setRolloverModal(true)}>Roll Over to New Month</button>
                </div>
                <div className="divider" />
                <div>
                  <div className="form-section-label">Connection</div>
                  <p style={{ fontSize:12, color:"var(--muted)", marginBottom:8 }}>Change or reset your Firebase connection.</p>
                  <button className="btn btn-ghost btn-sm" onClick={onDisconnect}>Disconnect Firebase</button>
                </div>
              </div>
            )}
          </aside>

          <main className="content">
            <div className="tabs">
              {[["overview","Overview"],["expenses","Expenses"],["insights","Insights"],["history","History"]].map(([k,l]) => (
                <button key={k} className={`tab ${dashTab===k?"active":""}`} onClick={() => setDashTab(k)}>
                  {l}{k==="insights" && insights.length>0 && (
                    <span style={{ background:insights.some(i=>i.type==="danger")?"var(--red)":"var(--amber)", color:"#fff", borderRadius:"99px", padding:"0 5px", fontSize:10, marginLeft:4 }}>{insights.length}</span>
                  )}
                </button>
              ))}
            </div>

            {dashTab === "overview" && (
              <div className="dash">
                <div className="stat-row">
                  <div className="stat-card">
                    <div className="stat-label">Total Budget</div>
                    <div className="stat-value">{fmt(totalBudget)}</div>
                    <div className="stat-sub">{monthLabel(activeMonth)}</div>
                  </div>
                  <div className="stat-card">
                    <div className="stat-label">Spent</div>
                    <div className={`stat-value ${totalSpent>totalBudget?"red":totalSpent/totalBudget>.85?"amber":"green"}`}>{fmt(totalSpent)}</div>
                    <div className="stat-sub">{totalBudget>0?`${Math.round(totalSpent/totalBudget*100)}% of budget`:"—"}</div>
                  </div>
                  <div className="stat-card">
                    <div className="stat-label">Remaining</div>
                    <div className={`stat-value ${remaining<0?"red":"green"}`}>{fmt(Math.abs(remaining))}</div>
                    <div className="stat-sub">{remaining<0?"over budget":"left to spend"}</div>
                  </div>
                </div>
                <div>
                  <div className="section-title">Budget Pulse by Category</div>
                  <div className="cat-grid">
                    {categories.filter(c => monthBudget[c]>0).map(cat => {
                      const budget = monthBudget[cat]||0;
                      const spent  = spentByCat[cat]||0;
                      const pct    = budget>0?Math.min((spent/budget)*100,100):0;
                      const cls    = pct>=100?"danger":pct>=85?"warn":"safe";
                      return (
                        <div className="cat-card" key={cat}>
                          <div className="cat-header">
                            <span className="cat-name">{cat}</span>
                            <span className="cat-amounts"><span>{fmt(spent)}</span> / {fmt(budget)}</span>
                          </div>
                          <div className="pulse-track"><div className={`pulse-bar ${cls}`} style={{ width:`${pct}%` }}/></div>
                          <div className={`cat-status ${pct<5&&spent===0?"under":cls}`}>
                            {pct>=100?`⚠ Over by ${fmt(Math.abs(budget-spent))}`:pct>=85?`⚡ ${fmt(budget-spent)} remaining`:spent===0?"No expenses yet":`${fmt(budget-spent)} remaining (${Math.round(100-pct)}% left)`}
                          </div>
                        </div>
                      );
                    })}
                    {categories.filter(c=>monthBudget[c]>0).length===0 && <div className="empty">Set a budget in the Monthly Budget tab to see pulse bars.</div>}
                  </div>
                </div>
              </div>
            )}

            {dashTab === "expenses" && (
              <div className="dash">
                <div style={{ display:"flex", justifyContent:"space-between", alignItems:"center" }}>
                  <div className="section-title">All Expenses — {monthLabel(activeMonth)}</div>
                  <span style={{ fontFamily:"var(--mono)", fontSize:12, color:"var(--muted)" }}>{monthExpenses.length} items · {fmt(totalSpent)}</span>
                </div>
                <div className="expense-list">
                  {[...monthExpenses].sort((a,b)=>b.date.localeCompare(a.date)).map(e => (
                    <ExpenseItem key={e.id} expense={e} onDelete={deleteExpense} />
                  ))}
                  {monthExpenses.length===0 && <div className="empty">No expenses this month yet.</div>}
                </div>
              </div>
            )}

            {dashTab === "insights" && (
              <div className="dash">
                <div className="section-title">Spending Insights</div>
                <div className="insight-list">
                  {insights.map((ins,i) => (
                    <div key={i} className={`insight ${ins.type}`}>
                      <div className="insight-title">{ins.title}</div>
                      <div className="insight-desc">{ins.desc}</div>
                    </div>
                  ))}
                  {insights.length===0 && <div className="empty">Add expenses and set a budget to generate insights.</div>}
                </div>
                {Object.keys(history).length>0 && (
                  <>
                    <div className="section-title" style={{ marginTop:8 }}>Historical Comparison</div>
                    {categories.filter(c=>monthBudget[c]>0).map(cat => {
                      const prevMonths = Object.entries(history).slice(-3).map(([mk,data]) => ({
                        label: monthLabel(mk).split(" ")[0],
                        spent: (data.expenses||[]).reduce((a,e)=>a+(e.splits||[]).filter(s=>s.cat===cat).reduce((b,s)=>b+(e.amount*s.pct)/100,0),0)
                      }));
                      const current = spentByCat[cat]||0;
                      const avgPrev = prevMonths.length ? prevMonths.reduce((a,m)=>a+m.spent,0)/prevMonths.length : null;
                      if (!avgPrev) return null;
                      const delta = current-avgPrev;
                      return (
                        <div className="insight" key={cat} style={{ borderLeftColor:delta>avgPrev*0.2?"var(--amber)":"var(--border)" }}>
                          <div className="insight-title">{cat}</div>
                          <div className="insight-desc">This month: {fmt(current)} · 3-month avg: {fmt(avgPrev)}{delta>0?` · ↑ ${fmt(delta)} above average`:` · ↓ ${fmt(Math.abs(delta))} below average`}</div>
                        </div>
                      );
                    }).filter(Boolean)}
                  </>
                )}
              </div>
            )}

            {dashTab === "history" && (
              <div className="history-panel">
                <div className="section-title" style={{ marginBottom:14 }}>Previous Months</div>
                {Object.keys(history).length===0 && <div className="empty">No archived months yet. Use "New Month" to roll over.</div>}
                {Object.entries(history).reverse().map(([mk,data]) => (
                  <HistoryMonth key={mk} mk={mk} data={data} categories={categories} />
                ))}
              </div>
            )}
          </main>
        </div>
      </div>

      {rolloverModal && (
        <div className="modal-overlay">
          <div className="modal">
            <div className="modal-title">Start New Month</div>
            <div className="modal-desc">
              This will archive {monthLabel(activeMonth)}'s expenses and clear the ledger for a fresh start.
              Your budget amounts carry forward automatically. This cannot be undone.
            </div>
            <div className="modal-actions">
              <button className="btn btn-ghost" onClick={() => setRolloverModal(false)}>Cancel</button>
              <button className="btn btn-primary" onClick={doRollover}>Archive & Start Fresh</button>
            </div>
          </div>
        </div>
      )}

      <div className={`toast ${toast.show?"show":""} ${toast.type==="error"?"error":""}`}>{toast.msg}</div>
    </>
  );
}

// ─── Add Expense Form ─────────────────────────────────────────────────────────
function AddForm({ categories, onAdd, showToast }) {
  const [photo, setPhoto]   = useState(null);
  const [amount, setAmount] = useState("");
  const [notes, setNotes]   = useState("");
  const [date, setDate]     = useState(today());
  const [splits, setSplits] = useState([
    { cat: categories[0]||"", pct:100 },
    { cat:"", pct:0 },
    { cat:"", pct:0 },
  ]);
  const fileRef = useRef();

  const totalPct = splits.filter(s=>s.cat).reduce((a,s)=>a+(+s.pct||0),0);
  const pctOk    = totalPct===100;

  const handlePhoto = (e) => {
    const file = e.target.files[0]; if (!file) return;
    const reader = new FileReader();
    reader.onload = () => setPhoto(reader.result);
    reader.readAsDataURL(file);
  };

  const updateSplit = (i, field, val) =>
    setSplits(prev => prev.map((s,idx) => idx===i ? { ...s, [field]: field==="pct"?+val:val } : s));

  const submit = async () => {
    if (!amount||+amount<=0) { showToast("Enter a valid amount.","error"); return; }
    if (!pctOk)              { showToast("Percentages must add up to 100%.","error"); return; }
    const activeSplits = splits.filter(s=>s.cat&&s.pct>0);
    if (!activeSplits.length) { showToast("Assign at least one category.","error"); return; }
    await onAdd({ amount:+amount, notes, date, photo, splits:activeSplits });
    setAmount(""); setNotes(""); setPhoto(null); setDate(today());
    setSplits([{ cat:categories[0]||"", pct:100 },{ cat:"", pct:0 },{ cat:"", pct:0 }]);
  };

  return (
    <div className="add-form">
      <div>
        <div className="form-section-label">Receipt Photo (optional)</div>
        <div className={`photo-zone ${photo?"has-photo":""}`} onClick={() => fileRef.current.click()}>
          {photo ? <img src={photo} alt="receipt"/> : <>
            <svg width="24" height="24" fill="none" stroke="var(--muted)" strokeWidth="1.5" viewBox="0 0 24 24">
              <rect x="2" y="2" width="20" height="20" rx="4"/><circle cx="8.5" cy="8.5" r="1.5"/>
              <path d="m21 15-5-5L5 21"/>
            </svg>
            <span className="photo-zone-text">Tap to take or upload a photo</span>
          </>}
        </div>
        <input ref={fileRef} type="file" accept="image/*" capture="environment" style={{ display:"none" }} onChange={handlePhoto}/>
      </div>
      <div>
        <div className="form-section-label">Total Amount</div>
        <div style={{ position:"relative" }}>
          <span style={{ position:"absolute", left:12, top:"50%", transform:"translateY(-50%)", color:"var(--muted)", fontFamily:"var(--mono)", fontSize:20 }}>$</span>
          <input className="input amount" type="number" min="0" step="0.01" placeholder="0.00"
            value={amount} onChange={e=>setAmount(e.target.value)} style={{ paddingLeft:26 }}/>
        </div>
      </div>
      <div>
        <div className="form-section-label">Date</div>
        <input className="input" type="date" value={date} onChange={e=>setDate(e.target.value)}/>
      </div>
      <div>
        <div className="form-section-label">Notes</div>
        <textarea className="textarea" placeholder="What was this for?" value={notes} onChange={e=>setNotes(e.target.value)}/>
      </div>
      <div>
        <div className="form-section-label">Assign to Categories</div>
        {splits.map((s,i) => (
          <div className="split-row" key={i}>
            <div className="split-badge">{i+1}</div>
            <select className="select" value={s.cat} onChange={e=>updateSplit(i,"cat",e.target.value)}>
              <option value="">— none —</option>
              {categories.map(c=><option key={c} value={c}>{c}</option>)}
            </select>
            <input className="split-pct" type="number" min="0" max="100" placeholder="0"
              value={s.pct||""} onChange={e=>updateSplit(i,"pct",e.target.value)}/>
            <span style={{ fontSize:12, color:"var(--muted)", width:14 }}>%</span>
          </div>
        ))}
        <div className={`pct-total ${pctOk?"ok":totalPct>0?"over":""}`}>
          {totalPct}% assigned {pctOk?"✓":totalPct>100?"(over 100%)":""}
        </div>
      </div>
      <button className="btn btn-primary btn-full" onClick={submit} disabled={!amount||!pctOk}>
        Save Expense
      </button>
    </div>
  );
}

// ─── Expense Item ─────────────────────────────────────────────────────────────
function ExpenseItem({ expense:e, onDelete }) {
  return (
    <div className="expense-item">
      <div className="expense-thumb">
        {e.photo ? <img src={e.photo} alt="receipt"/> : "🧾"}
      </div>
      <div className="expense-body">
        <div className="expense-amount">{fmt(e.amount)}</div>
        {e.notes && <div className="expense-note">{e.notes}</div>}
        <div className="expense-tags">
          {(e.splits||[]).filter(s=>s.cat).map((s,i)=>(
            <span className="expense-tag" key={i}>{s.cat} {s.pct}%</span>
          ))}
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
        <span style={{ fontFamily:"var(--mono)", fontSize:13 }}>{fmt(totalSpent)} / {fmt(totalBudget)} {open?"▲":"▼"}</span>
      </div>
      {open && (
        <div className="history-month-body">
          <div className="cat-grid">
            {categories.filter(c=>data.budget?.[c]>0).map(cat => {
              const budget = data.budget?.[cat]||0;
              const spent  = (data.expenses||[]).reduce((a,e)=>a+(e.splits||[]).filter(s=>s.cat===cat).reduce((b,s)=>b+(e.amount*s.pct)/100,0),0);
              const pct    = budget>0?Math.min((spent/budget)*100,100):0;
              const cls    = pct>=100?"danger":pct>=85?"warn":"safe";
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
    if (catIdx===-1||amtIdx===-1) { onError('CSV needs a "Category" column and an "Amount" column.'); return null; }
    const rows = [];
    for (let i=1;i<lines.length;i++) {
      const cols = lines[i].split(",").map(c=>c.trim().replace(/^["']|["']$/g,""));
      const category = cols[catIdx];
      const amount   = parseFloat((cols[amtIdx]||"").replace(/[$,]/g,""));
      if (!category||isNaN(amount)||amount<0) continue;
      rows.push({ category, amount });
    }
    if (!rows.length) { onError("No valid rows found in the CSV."); return null; }
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
      <div style={{ display:"flex", flexDirection:"column", gap:10 }}>
        <div style={{ background:"var(--surface2)", border:"1px solid var(--border)", borderRadius:8, overflow:"hidden" }}>
          <div style={{ padding:"8px 12px", borderBottom:"1px solid var(--border)", fontSize:11, color:"var(--muted)", display:"flex", justifyContent:"space-between" }}>
            <span>{preview.length} categories</span>
            <span style={{ fontFamily:"var(--mono)" }}>{fmt(total)} total</span>
          </div>
          <div style={{ maxHeight:180, overflowY:"auto" }}>
            {preview.map((r,i)=>(
              <div key={i} style={{ display:"flex", justifyContent:"space-between", padding:"6px 12px", borderBottom:i<preview.length-1?"1px solid var(--border)":"none", fontSize:12 }}>
                <span>{r.category}</span>
                <span style={{ fontFamily:"var(--mono)", color:"var(--indigo-l)" }}>{fmt(r.amount)}</span>
              </div>
            ))}
          </div>
        </div>
        <div style={{ display:"flex", gap:8 }}>
          <button className="btn btn-ghost btn-sm" style={{ flex:1 }} onClick={()=>setPreview(null)}>Cancel</button>
          <button className="btn btn-primary btn-sm" style={{ flex:1 }} onClick={()=>{ onUpload(preview); setPreview(null); }}>Apply Budget</button>
        </div>
      </div>
    );
  }

  return (
    <div style={{ display:"flex", flexDirection:"column", gap:8 }}>
      <div className={`photo-zone ${dragging?"drag":""}`} style={{ padding:"16px 12px" }}
        onClick={()=>fileRef.current.click()}
        onDragOver={e=>{e.preventDefault();setDragging(true);}}
        onDragLeave={()=>setDragging(false)}
        onDrop={e=>{e.preventDefault();setDragging(false);handleFile(e.dataTransfer.files[0]);}}>
        <svg width="20" height="20" fill="none" stroke="var(--muted)" strokeWidth="1.5" viewBox="0 0 24 24">
          <path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4"/>
          <polyline points="17 8 12 3 7 8"/><line x1="12" y1="3" x2="12" y2="15"/>
        </svg>
        <span className="photo-zone-text">Drop a CSV here or tap to browse</span>
      </div>
      <input ref={fileRef} type="file" accept=".csv" style={{ display:"none" }} onChange={e=>handleFile(e.target.files[0])}/>
      <button className="btn btn-ghost btn-sm btn-full" onClick={downloadTemplate}>↓ Download Template CSV</button>
      <p style={{ fontSize:11, color:"var(--muted)", textAlign:"center" }}>
        Two columns: <code style={{ fontFamily:"var(--mono)", color:"var(--indigo-l)" }}>Category</code> and <code style={{ fontFamily:"var(--mono)", color:"var(--indigo-l)" }}>Amount</code>
      </p>
    </div>
  );
}
