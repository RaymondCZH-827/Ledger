import React, { useState, useEffect, useMemo, useCallback } from "react";
import {
  AreaChart, Area, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, ReferenceLine,
} from "recharts";
import {
  LayoutDashboard, Plus, X, Pencil, Trash2, ChevronLeft, ChevronRight,
  TrendingUp, TrendingDown, Target, Percent, Flame, Image as ImageIcon,
  ImagePlus, Camera, Wallet, ChevronDown, Check, NotebookText, ListChecks, BarChart3,
  Calculator, Minus, ArrowDownCircle, ArrowUpCircle, Info, Sparkles, Menu, AlertTriangle, CheckCircle2,
} from "lucide-react";
import { SignOutButton } from "./Auth.jsx";

const FONT_IMPORT = `@import url('https://fonts.googleapis.com/css2?family=Space+Grotesk:wght@500;600;700&family=Inter:wght@400;500;600&family=IBM+Plex+Mono:wght@400;500;600&display=swap');`;

const COLORS = {
  bg: "#060c18",
  sidebar: "#08111f",
  surface: "#0c1525",
  surfaceAlt: "#0e1929",
  surfaceHover: "#101e35",
  border: "rgba(255, 255, 255, 0.07)",
  borderSoft: "rgba(255, 255, 255, 0.045)",
  inputBg: "rgba(255, 255, 255, 0.05)",
  text: "#dde4f0",
  textDim: "#94aac4",
  textFaint: "#5a7290",
  gold: "#00c896",
  goldDim: "#00694f",
  primaryForeground: "#001a12",
  amber: "#f5a623",
  amberDim: "#7a531a",
  profit: "#00c896",
  profitDim: "#0d3329",
  loss: "#ef4444",
  lossDim: "#3a1414",
  series3: "#3b82f6",
  series5: "#a78bfa",
};

const uid = () => Math.random().toString(36).slice(2, 10) + Date.now().toString(36);
const todayStr = () => new Date().toISOString().slice(0, 10);

// USC ("cent account") support — a fixed 100:1 unit conversion (not a
// floating exchange rate), so its raw values are automatically divided by
// 100 to show the USD equivalent everywhere money is displayed.
const CURRENCY_META = {
  USD: { symbol: "$", factor: 1 },
  USC: { symbol: "$", factor: 0.01 },
};
// Set once per render from the active account's currency (see TradingJournal),
// so every fmtMoney/fmtMoneyShort call during that render reflects it without
// having to thread a currency prop through every component that formats money.
let CURRENT_CURRENCY = "USD";

const fmtMoney = (n) => {
  const meta = CURRENCY_META[CURRENT_CURRENCY] || CURRENCY_META.USD;
  const converted = (n || 0) * meta.factor;
  const sign = converted < 0 ? "-" : "";
  return sign + meta.symbol + Math.abs(converted).toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 });
};
const fmtMoneyShort = (n) => {
  const meta = CURRENCY_META[CURRENT_CURRENCY] || CURRENCY_META.USD;
  const converted = (n || 0) * meta.factor;
  const sign = converted < 0 ? "-" : "";
  const abs = Math.abs(converted);
  if (abs >= 1000) return sign + meta.symbol + (abs / 1000).toFixed(1) + "k";
  return sign + meta.symbol + abs.toFixed(0);
};

function computePnl(t) {
  const entry = parseFloat(t.entry) || 0;
  const exit = parseFloat(t.exit) || 0;
  const size = parseFloat(t.size) || 0;
  const contractSize = parseFloat(t.contractSize) || 1;
  const effectiveSize = size * contractSize;
  return t.direction === "short" ? (entry - exit) * effectiveSize : (exit - entry) * effectiveSize;
}

function computeRiskAmount(t) {
  const entry = parseFloat(t.entry);
  const stop = parseFloat(t.stopLoss);
  const size = parseFloat(t.size) || 0;
  const contractSize = parseFloat(t.contractSize) || 1;
  if (isNaN(entry) || isNaN(stop) || !size) return null;
  const perUnit = Math.abs(entry - stop);
  if (!perUnit) return null;
  return perUnit * size * contractSize;
}

function computeRMultiple(t, pnl) {
  const risk = computeRiskAmount(t);
  if (!risk) return null;
  return pnl / risk;
}

function fmtR(r) {
  if (r === null || r === undefined || isNaN(r)) return "—";
  const sign = r >= 0 ? "+" : "";
  return `${sign}${r.toFixed(2)}R`;
}

function checklistScore(checklist) {
  if (!checklist || typeof checklist !== "object") return null;
  const keys = Object.keys(checklist);
  if (!keys.length) return null;
  const checked = keys.filter((k) => checklist[k]).length;
  return checked / keys.length;
}

const MOODS = ["Disciplined", "Confident", "Neutral", "FOMO", "Revenge", "Impulsive", "Fearful", "Greedy", "Tilted"];
const SESSIONS = ["Asian", "London", "New York"];

const FOREX_CURRENCY_CODES = ["USD", "EUR", "GBP", "JPY", "AUD", "NZD", "CAD", "CHF", "CNH", "SGD", "HKD", "SEK", "NOK", "MXN", "ZAR", "TRY", "PLN", "DKK"];

// Guesses which "what does your size represent?" preset fits a typed symbol.
// Returns "gold", "forex", "units", or null if the symbol is empty/too short to tell yet.
function detectContractPreset(symbolRaw) {
  const symbol = (symbolRaw || "").toUpperCase().replace(/[^A-Z]/g, "");
  if (!symbol) return null;
  if (symbol.includes("XAU") || symbol.includes("XAG")) return "gold";
  if (symbol.length === 6) {
    const base = symbol.slice(0, 3);
    const quote = symbol.slice(3, 6);
    if (FOREX_CURRENCY_CODES.includes(base) && FOREX_CURRENCY_CODES.includes(quote)) return "forex";
  }
  return "units";
}

function resizeImage(file, maxWidth = 900, quality = 0.75) {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = (e) => {
      const img = new Image();
      img.onload = () => {
        const scale = Math.min(1, maxWidth / img.width);
        const canvas = document.createElement("canvas");
        canvas.width = img.width * scale;
        canvas.height = img.height * scale;
        const ctx = canvas.getContext("2d");
        ctx.drawImage(img, 0, 0, canvas.width, canvas.height);
        resolve(canvas.toDataURL("image/jpeg", quality));
      };
      img.onerror = reject;
      img.src = e.target.result;
    };
    reader.onerror = reject;
    reader.readAsDataURL(file);
  });
}

const MONTHS = ["January","February","March","April","May","June","July","August","September","October","November","December"];
const DOW = ["S","M","T","W","T","F","S"];

function weekKeyFor(dateStr) {
  const d = new Date(dateStr + "T00:00:00");
  const day = d.getDay();
  const sunday = new Date(d);
  sunday.setDate(d.getDate() - day);
  return sunday.toISOString().slice(0, 10);
}

export default function TradingJournal() {
  const [trades, setTrades] = useState([]);
  const [loaded, setLoaded] = useState(false);
  const [view, setView] = useState("dashboard");
  const [modalOpen, setModalOpen] = useState(false);
  const [editingId, setEditingId] = useState(null);
  const [calMonth, setCalMonth] = useState(() => {
    const d = new Date();
    return new Date(d.getFullYear(), d.getMonth(), 1);
  });
  const [confirmDelete, setConfirmDelete] = useState(null);
  const [sortKey, setSortKey] = useState("date");
  const [sortDir, setSortDir] = useState("desc");
  const [saveError, setSaveError] = useState(false);
  const [viewingShotId, setViewingShotId] = useState(null);

  const [accounts, setAccounts] = useState(["Main"]);
  const [activeAccount, setActiveAccount] = useState("Main");
  const [accountModalOpen, setAccountModalOpen] = useState(false);
  const [confirmDeleteAccount, setConfirmDeleteAccount] = useState(null);
  const [accountCurrencies, setAccountCurrencies] = useState({});

  const [dailyNotes, setDailyNotes] = useState([]);
  const [viewingDate, setViewingDate] = useState(null);

  const [checklists, setChecklists] = useState({});
  const [confluenceOptions, setConfluenceOptions] = useState({});
  const [goals, setGoals] = useState({});
  const [settingsOpen, setSettingsOpen] = useState(false);
  const [sidebarOpen, setSidebarOpen] = useState(false);
  const [calcOpen, setCalcOpen] = useState(false);

  const [transactions, setTransactions] = useState([]);
  const [balanceModalOpen, setBalanceModalOpen] = useState(false);
  const [balanceModalType, setBalanceModalType] = useState("deposit");
  const [balanceModalLocked, setBalanceModalLocked] = useState(false);

  const loadAllData = useCallback(async () => {
    const safeGet = async (key) => {
      try {
        const res = await window.storage.get(key, false);
        return res ? res.value : null;
      } catch (e) {
        return null;
      }
    };
    try {
      const [tradesRaw, accountsRaw, activeRaw, dailyNotesRaw, checklistsRaw, goalsRaw, transactionsRaw, confluencesRaw, currenciesRaw] = await Promise.all([
        safeGet("trades"), safeGet("accounts"), safeGet("activeAccount"), safeGet("dailyNotes"),
        safeGet("checklists"), safeGet("goals"), safeGet("transactions"), safeGet("confluenceOptions"), safeGet("accountCurrencies"),
      ]);

      let accs = ["Main"];
      if (accountsRaw) {
        try { const p = JSON.parse(accountsRaw); if (Array.isArray(p) && p.length) accs = p; } catch (e) {}
      }
      setAccounts(accs);
      setActiveAccount((prev) => (prev && accs.includes(prev) ? prev : (activeRaw && accs.includes(activeRaw) ? activeRaw : accs[0])));

      if (currenciesRaw) {
        try { setAccountCurrencies(JSON.parse(currenciesRaw)); } catch (e) {}
      }

      let parsedTrades = null;
      if (tradesRaw) {
        try {
          parsedTrades = JSON.parse(tradesRaw).map((t) => ({
            ...t,
            confluences: t.confluences ?? t.tags ?? "",
            account: t.account || accs[0],
          }));
          setTrades(parsedTrades);
        } catch (e) {}
      }

      if (dailyNotesRaw) {
        try { setDailyNotes(JSON.parse(dailyNotesRaw)); } catch (e) {}
      }
      if (checklistsRaw) {
        try { setChecklists(JSON.parse(checklistsRaw)); } catch (e) {}
      }
      if (goalsRaw) {
        try { setGoals(JSON.parse(goalsRaw)); } catch (e) {}
      }
      if (transactionsRaw) {
        try { setTransactions(JSON.parse(transactionsRaw)); } catch (e) {}
      }

      if (confluencesRaw) {
        try { setConfluenceOptions(JSON.parse(confluencesRaw)); } catch (e) {}
      } else if (parsedTrades && parsedTrades.length) {
        // Migrate: seed confluence options from any free-text confluences already logged.
        const seeded = {};
        parsedTrades.forEach((t) => {
          const acc = t.account || accs[0];
          if (!seeded[acc]) seeded[acc] = [];
          (t.confluences || "").split(",").map((s) => s.trim()).filter(Boolean).forEach((text) => {
            if (!seeded[acc].some((o) => o.text.toLowerCase() === text.toLowerCase())) {
              seeded[acc].push({ id: uid(), text });
            }
          });
        });
        if (Object.keys(seeded).length) {
          setConfluenceOptions(seeded);
          (async () => { try { await window.storage.set("confluenceOptions", JSON.stringify(seeded), false); } catch (e) {} })();
        }
      }
    } finally {
      setLoaded(true);
    }
  }, []);

  useEffect(() => {
    loadAllData();
  }, [loadAllData]);

  // Real-time cross-device sync: firestoreStorage.js dispatches this event
  // whenever your Firestore data changes remotely (e.g. you logged a trade
  // on your phone) — reload here so this tab/device picks it up live,
  // without needing a manual refresh. Debounced slightly since a single
  // save can touch several keys and each fires its own event.
  useEffect(() => {
    let timer = null;
    const handleSync = () => {
      clearTimeout(timer);
      timer = setTimeout(() => { loadAllData(); }, 400);
    };
    window.addEventListener("ledger:sync", handleSync);
    return () => {
      window.removeEventListener("ledger:sync", handleSync);
      clearTimeout(timer);
    };
  }, [loadAllData]);

  const persist = useCallback(async (next) => {
    try {
      const res = await window.storage.set("trades", JSON.stringify(next), false);
      if (!res) setSaveError(true);
      else setSaveError(false);
    } catch (e) {
      setSaveError(true);
    }
  }, []);

  const saveTrades = useCallback((next) => {
    setTrades(next);
    persist(next);
  }, [persist]);

  const upsertTrade = async (fields, screenshot) => {
    const id = editingId || uid();
    const prevTrade = editingId ? trades.find((t) => t.id === editingId) : null;
    // screenshot === undefined means "user didn't touch it" — keep whatever was there before.
    // screenshot === null means "user explicitly removed it". A string means "user set/replaced it".
    const hasShot = screenshot === undefined ? !!(prevTrade && prevTrade.hasShot) : !!screenshot;
    const record = { ...fields, id, hasShot, account: editingId ? fields.account || activeAccount : activeAccount };
    let next;
    if (editingId) {
      next = trades.map((t) => (t.id === editingId ? record : t));
    } else {
      next = [...trades, record];
    }
    setTrades(next);
    await persist(next);
    if (screenshot !== undefined) {
      try {
        if (screenshot) {
          await window.storage.set(`shot:${id}`, screenshot, false);
        } else {
          try { await window.storage.delete(`shot:${id}`, false); } catch (e) { /* no existing shot */ }
        }
      } catch (e) { /* screenshot save best-effort */ }
    }
    setModalOpen(false);
    setEditingId(null);
  };

  const deleteTrade = (id) => {
    saveTrades(trades.filter((t) => t.id !== id));
    (async () => { try { await window.storage.delete(`shot:${id}`, false); } catch (e) {} })();
    setConfirmDelete(null);
  };

  const persistAccounts = useCallback(async (next) => {
    try { await window.storage.set("accounts", JSON.stringify(next), false); } catch (e) {}
  }, []);
  const persistActiveAccount = useCallback(async (acc) => {
    try { await window.storage.set("activeAccount", acc, false); } catch (e) {}
  }, []);
  const persistAccountCurrencies = useCallback(async (next) => {
    try { await window.storage.set("accountCurrencies", JSON.stringify(next), false); } catch (e) {}
  }, []);

  const switchAccount = (acc) => {
    setActiveAccount(acc);
    persistActiveAccount(acc);
  };

  const addAccount = (name, initialDeposit, currency) => {
    const trimmed = name.trim();
    if (!trimmed || accounts.includes(trimmed)) return;
    const next = [...accounts, trimmed];
    setAccounts(next);
    persistAccounts(next);
    if (currency && currency !== "USD") {
      const nextCurrencies = { ...accountCurrencies, [trimmed]: currency };
      setAccountCurrencies(nextCurrencies);
      persistAccountCurrencies(nextCurrencies);
    }
    switchAccount(trimmed);
    if (initialDeposit && initialDeposit > 0) {
      addTransaction("deposit", initialDeposit, todayStr(), "Initial deposit", trimmed);
    }
    setAccountModalOpen(false);
  };

  const deleteAccount = (acc) => {
    if (accounts.length <= 1) { setConfirmDeleteAccount(null); return; }
    const nextAccounts = accounts.filter((a) => a !== acc);
    setAccounts(nextAccounts);
    persistAccounts(nextAccounts);

    const removedTradeIds = trades.filter((t) => (t.account || accounts[0]) === acc).map((t) => t.id);
    const nextTrades = trades.filter((t) => (t.account || accounts[0]) !== acc);
    saveTrades(nextTrades);
    removedTradeIds.forEach((id) => { (async () => { try { await window.storage.delete(`shot:${id}`, false); } catch (e) {} })(); });

    const nextDailyNotes = dailyNotes.filter((n) => n.account !== acc);
    setDailyNotes(nextDailyNotes);
    persistDailyNotes(nextDailyNotes);

    const nextChecklists = { ...checklists };
    delete nextChecklists[acc];
    setChecklists(nextChecklists);
    persistChecklists(nextChecklists);

    const nextConfluenceOptions = { ...confluenceOptions };
    delete nextConfluenceOptions[acc];
    setConfluenceOptions(nextConfluenceOptions);
    persistConfluenceOptions(nextConfluenceOptions);

    const nextGoals = { ...goals };
    delete nextGoals[acc];
    setGoals(nextGoals);
    persistGoals(nextGoals);

    const nextTransactions = transactions.filter((t) => t.account !== acc);
    setTransactions(nextTransactions);
    persistTransactions(nextTransactions);

    if (accountCurrencies[acc]) {
      const nextCurrencies = { ...accountCurrencies };
      delete nextCurrencies[acc];
      setAccountCurrencies(nextCurrencies);
      persistAccountCurrencies(nextCurrencies);
    }

    if (activeAccount === acc) switchAccount(nextAccounts[0]);
    setConfirmDeleteAccount(null);
  };

  const persistDailyNotes = useCallback(async (next) => {
    try { await window.storage.set("dailyNotes", JSON.stringify(next), false); } catch (e) {}
  }, []);

  const persistChecklists = useCallback(async (next) => {
    try { await window.storage.set("checklists", JSON.stringify(next), false); } catch (e) {}
  }, []);

  const persistGoals = useCallback(async (next) => {
    try { await window.storage.set("goals", JSON.stringify(next), false); } catch (e) {}
  }, []);

  const addChecklistItem = (text) => {
    const trimmed = text.trim();
    if (!trimmed) return;
    const items = checklists[activeAccount] || [];
    const next = { ...checklists, [activeAccount]: [...items, { id: uid(), text: trimmed }] };
    setChecklists(next);
    persistChecklists(next);
  };

  const removeChecklistItem = (id) => {
    const items = checklists[activeAccount] || [];
    const next = { ...checklists, [activeAccount]: items.filter((i) => i.id !== id) };
    setChecklists(next);
    persistChecklists(next);
  };

  const persistConfluenceOptions = useCallback(async (next) => {
    try { await window.storage.set("confluenceOptions", JSON.stringify(next), false); } catch (e) {}
  }, []);

  const addConfluenceOption = (text) => {
    const trimmed = text.trim();
    if (!trimmed) return;
    const items = confluenceOptions[activeAccount] || [];
    if (items.some((i) => i.text.toLowerCase() === trimmed.toLowerCase())) return;
    const next = { ...confluenceOptions, [activeAccount]: [...items, { id: uid(), text: trimmed }] };
    setConfluenceOptions(next);
    persistConfluenceOptions(next);
  };

  const removeConfluenceOption = (id) => {
    const items = confluenceOptions[activeAccount] || [];
    const next = { ...confluenceOptions, [activeAccount]: items.filter((i) => i.id !== id) };
    setConfluenceOptions(next);
    persistConfluenceOptions(next);
  };

  const saveGoals = (updates) => {
    const next = { ...goals, [activeAccount]: { ...(goals[activeAccount] || {}), ...updates } };
    setGoals(next);
    persistGoals(next);
  };

  const persistTransactions = useCallback(async (next) => {
    try { await window.storage.set("transactions", JSON.stringify(next), false); } catch (e) {}
  }, []);

  const addTransaction = (type, amount, date, note, account) => {
    const amt = parseFloat(amount);
    if (!amt || amt <= 0) return;
    const next = [...transactions, { id: uid(), account: account || activeAccount, type, amount: amt, date: date || todayStr(), note: note || "" }];
    setTransactions(next);
    persistTransactions(next);
  };

  const deleteTransaction = (id) => {
    const next = transactions.filter((t) => t.id !== id);
    setTransactions(next);
    persistTransactions(next);
  };

  const getDailyNote = (date) =>
    dailyNotes.find((n) => n.account === activeAccount && n.date === date);

  const upsertDailyNote = (date, note) => {
    const existing = getDailyNote(date);
    let next;
    if (existing) {
      next = note.trim()
        ? dailyNotes.map((n) => (n.id === existing.id ? { ...n, note } : n))
        : dailyNotes.filter((n) => n.id !== existing.id);
    } else if (note.trim()) {
      next = [...dailyNotes, { id: uid(), account: activeAccount, date, note }];
    } else {
      next = dailyNotes;
    }
    setDailyNotes(next);
    persistDailyNotes(next);
  };

  const accountTrades = useMemo(
    () => trades.filter((t) => (t.account || accounts[0]) === activeAccount),
    [trades, activeAccount, accounts]
  );

  const accountDailyNotes = useMemo(
    () => dailyNotes.filter((n) => n.account === activeAccount),
    [dailyNotes, activeAccount]
  );

  const enriched = useMemo(() => {
    return accountTrades.map((t) => {
      const pnl = computePnl(t);
      return { ...t, pnl, rMultiple: computeRMultiple(t, pnl) };
    }).sort((a, b) => {
      if (a.date !== b.date) return a.date < b.date ? -1 : 1;
      return a.id < b.id ? -1 : 1;
    });
  }, [accountTrades]);

  const accountChecklist = useMemo(() => checklists[activeAccount] || [], [checklists, activeAccount]);
  const accountConfluenceOptions = useMemo(() => confluenceOptions[activeAccount] || [], [confluenceOptions, activeAccount]);
  const accountGoals = useMemo(() => goals[activeAccount] || {}, [goals, activeAccount]);

  const accountTransactions = useMemo(
    () => transactions.filter((t) => t.account === activeAccount).sort((a, b) => (a.date < b.date ? 1 : a.date > b.date ? -1 : 0)),
    [transactions, activeAccount]
  );

  const accountBalance = useMemo(() => {
    const deposits = accountTransactions.filter((t) => t.type === "deposit").reduce((s, t) => s + t.amount, 0);
    const withdrawals = accountTransactions.filter((t) => t.type === "withdraw").reduce((s, t) => s + t.amount, 0);
    const realizedPnl = enriched.reduce((s, t) => s + t.pnl, 0);
    return deposits - withdrawals + realizedPnl;
  }, [accountTransactions, enriched]);

  const stats = useMemo(() => {
    const n = enriched.length;
    const totalPnl = enriched.reduce((s, t) => s + t.pnl, 0);
    const wins = enriched.filter((t) => t.pnl > 0);
    const losses = enriched.filter((t) => t.pnl < 0);
    const winRate = n ? (wins.length / n) * 100 : 0;
    const grossWin = wins.reduce((s, t) => s + t.pnl, 0);
    const grossLoss = Math.abs(losses.reduce((s, t) => s + t.pnl, 0));
    const profitFactor = grossLoss > 0 ? grossWin / grossLoss : (grossWin > 0 ? Infinity : 0);
    const best = n ? enriched.reduce((a, b) => (b.pnl > a.pnl ? b : a)) : null;

    let streak = 0, streakType = null;
    for (let i = enriched.length - 1; i >= 0; i--) {
      const p = enriched[i].pnl;
      if (p === 0) break;
      const type = p > 0 ? "win" : "loss";
      if (streakType === null) { streakType = type; streak = 1; }
      else if (type === streakType) streak++;
      else break;
    }

    const rValues = enriched.map((t) => t.rMultiple).filter((r) => r !== null && r !== undefined && !isNaN(r));
    const avgR = rValues.length ? rValues.reduce((s, r) => s + r, 0) / rValues.length : null;

    const todayKey = todayStr();
    const todayTrades = enriched.filter((t) => t.date === todayKey);
    const todayPnl = todayTrades.reduce((s, t) => s + t.pnl, 0);
    const todayCount = todayTrades.length;

    const currentWeekKey = weekKeyFor(todayKey);
    const weekTrades = enriched.filter((t) => weekKeyFor(t.date) === currentWeekKey);
    const weekPnl = weekTrades.reduce((s, t) => s + t.pnl, 0);

    const currentMonthKey = todayKey.slice(0, 7); // YYYY-MM
    const monthTrades = enriched.filter((t) => t.date.slice(0, 7) === currentMonthKey);
    const monthPnl = monthTrades.reduce((s, t) => s + t.pnl, 0);

    return {
      n, totalPnl, winRate, profitFactor, best, winsCount: wins.length, lossesCount: losses.length,
      streak, streakType, avgR, todayPnl, todayCount, weekPnl, monthPnl,
    };
  }, [enriched]);

  const equityCurve = useMemo(() => {
    let cum = 0;
    return enriched.map((t, i) => {
      cum += t.pnl;
      return { idx: i + 1, date: t.date, equity: Math.round(cum * 100) / 100 };
    });
  }, [enriched]);

  const dayStats = useMemo(() => {
    const m = {};
    enriched.forEach((t) => {
      if (!m[t.date]) m[t.date] = { pnl: 0, count: 0 };
      m[t.date].pnl += t.pnl;
      m[t.date].count += 1;
    });
    return m;
  }, [enriched]);

  const maxAbsDay = useMemo(() => {
    const vals = Object.values(dayStats).map((d) => Math.abs(d.pnl));
    return vals.length ? Math.max(...vals) : 1;
  }, [dayStats]);

  const sortedTrades = useMemo(() => {
    const arr = [...enriched];
    arr.sort((a, b) => {
      let av = a[sortKey], bv = b[sortKey];
      if (sortKey === "pnl") { av = a.pnl; bv = b.pnl; }
      if (typeof av === "string") {
        return sortDir === "asc" ? av.localeCompare(bv) : bv.localeCompare(av);
      }
      return sortDir === "asc" ? av - bv : bv - av;
    });
    return arr;
  }, [enriched, sortKey, sortDir]);

  const toggleSort = (key) => {
    if (sortKey === key) setSortDir((d) => (d === "asc" ? "desc" : "asc"));
    else { setSortKey(key); setSortDir("desc"); }
  };

  if (!loaded) {
    return (
      <div style={{ background: COLORS.bg, minHeight: 500, display: "flex", alignItems: "center", justifyContent: "center", color: COLORS.textDim, fontFamily: "Inter, sans-serif" }}>
        <style>{FONT_IMPORT}</style>
        Loading ledger…
      </div>
    );
  }

  // Every fmtMoney/fmtMoneyShort call anywhere in this render (including in
  // child components rendered below) reads this — set it before the JSX tree
  // that uses it so the active account's currency applies consistently.
  CURRENT_CURRENCY = accountCurrencies[activeAccount] || "USD";

  return (
    <div style={{
      background: COLORS.bg, minHeight: "100vh", color: COLORS.text,
      fontFamily: "'Inter', sans-serif", display: "flex",
    }}>
      <style>{`
        ${FONT_IMPORT}
        * { box-sizing: border-box; }
        ::selection { background: ${COLORS.gold}44; }
        .lj-nav-btn {
          display: flex; align-items: center; gap: 10px; width: 100%; padding: 10px 14px;
          border-radius: 8px; border: none; background: transparent; color: ${COLORS.textDim};
          font-family: 'Inter', sans-serif; font-size: 13.5px; font-weight: 500; cursor: pointer;
          transition: background .15s, color .15s; text-align: left;
        }
        .lj-nav-btn:hover { background: ${COLORS.surfaceHover}; color: ${COLORS.text}; }
        .lj-nav-btn.active { background: ${COLORS.surfaceAlt}; color: ${COLORS.gold}; }
        .lj-btn-primary {
          display: inline-flex; align-items: center; gap: 8px; background: ${COLORS.gold};
          color: ${COLORS.primaryForeground}; border: none; padding: 9px 16px; border-radius: 8px; font-weight: 600;
          font-size: 13px; cursor: pointer; font-family: 'Inter', sans-serif; transition: filter .15s;
        }
        .lj-btn-primary:hover { filter: brightness(1.08); }
        .lj-btn-ghost {
          display: inline-flex; align-items: center; gap: 6px; background: transparent;
          color: ${COLORS.textDim}; border: 1px solid ${COLORS.border}; padding: 8px 14px;
          border-radius: 8px; font-weight: 500; font-size: 13px; cursor: pointer; font-family: 'Inter', sans-serif;
        }
        .lj-btn-ghost:hover { color: ${COLORS.text}; border-color: ${COLORS.textFaint}; }
        .lj-input, .lj-select, .lj-textarea {
          width: 100%; background: ${COLORS.inputBg}; border: 1px solid ${COLORS.border}; color: ${COLORS.text};
          padding: 9px 11px; border-radius: 7px; font-family: 'IBM Plex Mono', monospace; font-size: 13px;
          outline: none; transition: border-color .15s;
        }
        .lj-textarea { font-family: 'Inter', sans-serif; resize: vertical; min-height: 80px; }
        .lj-input:focus, .lj-select:focus, .lj-textarea:focus { border-color: ${COLORS.gold}; }
        .lj-label { display: block; font-size: 11.5px; color: ${COLORS.textFaint}; margin-bottom: 6px; font-weight: 500; letter-spacing: .02em; }
        table.lj-table { width: 100%; border-collapse: collapse; font-family: 'IBM Plex Mono', monospace; font-size: 12.5px; }
        table.lj-table th { text-align: left; padding: 10px 12px; color: ${COLORS.textFaint}; font-weight: 500; font-size: 11px;
          text-transform: uppercase; letter-spacing: .05em; border-bottom: 1px solid ${COLORS.border}; cursor: pointer; user-select: none; font-family: 'Inter', sans-serif; }
        table.lj-table th:hover { color: ${COLORS.textDim}; }
        table.lj-table td { padding: 11px 12px; border-bottom: 1px solid ${COLORS.borderSoft}; color: ${COLORS.text}; }
        table.lj-table tr:hover td { background: ${COLORS.surfaceHover}; }
        .lj-tag { display: inline-block; background: ${COLORS.surfaceAlt}; border: 1px solid ${COLORS.border}; color: ${COLORS.textDim};
          font-size: 10.5px; padding: 2px 7px; border-radius: 5px; margin: 1px 3px 1px 0; font-family: 'Inter', sans-serif; }
        .lj-icon-btn { background: transparent; border: none; color: ${COLORS.textFaint}; cursor: pointer; padding: 5px; border-radius: 5px; }
        .lj-icon-btn:hover { color: ${COLORS.text}; background: ${COLORS.surfaceHover}; }
        .lj-scroll::-webkit-scrollbar { height: 6px; width: 6px; }
        .lj-scroll::-webkit-scrollbar-thumb { background: ${COLORS.border}; border-radius: 3px; }

        .lj-sidebar {
          width: 222px; border-right: 1px solid ${COLORS.border}; padding: 20px 14px;
          display: flex; flex-direction: column; gap: 4px; flex-shrink: 0;
          background: ${COLORS.sidebar};
        }
        .lj-main { flex: 1; padding: 28px 32px; min-width: 0; }
        .lj-mobile-topbar { display: none; }
        .lj-menu-btn { display: none; }
        .lj-sidebar-overlay { display: none; }
        .lj-dash-grid { display: grid; grid-template-columns: 7fr 3fr; gap: 12px; }
        .lj-breakdown-grid { display: grid; grid-template-columns: 1fr 1fr; gap: 16px; }
        .lj-price-grid { display: grid; grid-template-columns: 1fr 1fr 1fr 1fr; gap: 14px; }
        .lj-two-col { display: grid; grid-template-columns: 1fr 1fr; gap: 14px; }

        @media (max-width: 860px) {
          .lj-sidebar {
            position: fixed; top: 0; left: 0; bottom: 0; z-index: 100; width: 240px;
            transform: translateX(-100%); transition: transform .25s ease; box-shadow: 4px 0 28px rgba(0,0,0,.5);
          }
          .lj-sidebar.open { transform: translateX(0); }
          .lj-main { padding: 16px; padding-top: 8px; }
          .lj-mobile-topbar {
            display: flex; align-items: center; gap: 12px; padding: 8px 2px 18px;
          }
          .lj-menu-btn {
            display: flex; align-items: center; justify-content: center; width: 36px; height: 36px;
            border-radius: 8px; border: 1px solid ${COLORS.border}; background: ${COLORS.surface}; color: ${COLORS.text}; cursor: pointer; flex-shrink: 0;
          }
          .lj-sidebar-overlay.open {
            display: block; position: fixed; inset: 0; background: rgba(0,0,0,.55); z-index: 90;
          }
          .lj-dash-grid { grid-template-columns: 1fr; }
          .lj-breakdown-grid { grid-template-columns: 1fr; }
          .lj-price-grid { grid-template-columns: 1fr 1fr; }
          .lj-two-col { grid-template-columns: 1fr; }
        }
        @media (max-width: 480px) {
          .lj-price-grid { grid-template-columns: 1fr 1fr; }
          table.lj-table th, table.lj-table td { padding: 9px 8px; font-size: 11.5px; }
        }
      `}</style>

      <div className={`lj-sidebar-overlay ${sidebarOpen ? "open" : ""}`} onClick={() => setSidebarOpen(false)} />

      {/* Sidebar */}
      <div className={`lj-sidebar ${sidebarOpen ? "open" : ""}`}>
        <div style={{ padding: "0 10px", marginBottom: 16, display: "flex", alignItems: "center", justifyContent: "space-between" }}>
          <div>
            <div style={{ fontFamily: "'Space Grotesk', sans-serif", fontWeight: 700, fontSize: 17, letterSpacing: "-0.01em" }}>
              Ledger<span style={{ color: COLORS.gold }}>.</span>
            </div>
            <div style={{ fontSize: 10.5, color: COLORS.textFaint, marginTop: 2, letterSpacing: ".03em" }}>TRADE JOURNAL</div>
          </div>
          <button className="lj-menu-btn" onClick={() => setSidebarOpen(false)}>
            <X size={17} />
          </button>
        </div>

        <AccountSwitcher
          accounts={accounts}
          activeAccount={activeAccount}
          currencies={accountCurrencies}
          onSwitch={switchAccount}
          onAdd={() => setAccountModalOpen(true)}
          onDelete={(acc) => setConfirmDeleteAccount(acc)}
        />

        <button
          onClick={() => { setBalanceModalLocked(false); setBalanceModalOpen(true); }}
          style={{
            display: "flex", alignItems: "center", justifyContent: "space-between", width: "100%",
            background: COLORS.surface, border: `1px solid ${COLORS.border}`, borderRadius: 8,
            padding: "9px 10px", cursor: "pointer", marginTop: 6, fontFamily: "'Inter', sans-serif",
          }}
        >
          <span style={{ fontSize: 11, color: COLORS.textFaint, textTransform: "uppercase", letterSpacing: ".04em", fontWeight: 500 }}>Balance</span>
          <span style={{ fontFamily: "'IBM Plex Mono', monospace", fontSize: 12.5, fontWeight: 700, color: accountBalance >= 0 ? COLORS.text : COLORS.loss }}>{fmtMoney(accountBalance)}</span>
        </button>

        <div style={{ height: 10 }} />

        <button className={`lj-nav-btn ${view === "dashboard" ? "active" : ""}`} onClick={() => { setView("dashboard"); setSidebarOpen(false); }}>
          <LayoutDashboard size={16} /> Dashboard
        </button>
        <button className={`lj-nav-btn ${view === "stats" ? "active" : ""}`} onClick={() => { setView("stats"); setSidebarOpen(false); }}>
          <ListChecks size={16} /> Stats
        </button>
        <button className="lj-nav-btn" onClick={() => { setCalcOpen(true); setSidebarOpen(false); }}>
          <Calculator size={16} /> Lot size calculator
        </button>
        <button className={`lj-nav-btn ${view === "breakdown" ? "active" : ""}`} onClick={() => { setView("breakdown"); setSidebarOpen(false); }}>
          <BarChart3 size={16} /> Breakdown
        </button>
        <button className={`lj-nav-btn ${view === "analysis" ? "active" : ""}`} onClick={() => { setView("analysis"); setSidebarOpen(false); }}>
          <Sparkles size={16} /> Analysis
        </button>
        <div style={{ marginTop: "auto", paddingTop: 16 }}>
          <SignOutButton style={{ marginBottom: 8 }} />
          {saveError && (
            <div style={{ fontSize: 10.5, color: COLORS.loss, marginTop: 8, lineHeight: 1.4 }}>
              Couldn't save — changes may not persist.{" "}
              <button
                onClick={() => persist(trades)}
                style={{ background: "none", border: "none", color: COLORS.gold, textDecoration: "underline", cursor: "pointer", fontSize: 10.5, padding: 0, fontFamily: "'Inter', sans-serif" }}
              >
                Retry
              </button>
            </div>
          )}
        </div>
      </div>

      {/* Main */}
      <div className="lj-main">
        <div className="lj-mobile-topbar">
          <button className="lj-menu-btn" onClick={() => setSidebarOpen(true)}>
            <Menu size={17} />
          </button>
          <div style={{ fontFamily: "'Space Grotesk', sans-serif", fontWeight: 700, fontSize: 15 }}>
            Ledger<span style={{ color: COLORS.gold }}>.</span>
          </div>
        </div>
        {view === "dashboard" ? (
          <Dashboard
            stats={stats}
            equityCurve={equityCurve}
            calMonth={calMonth}
            setCalMonth={setCalMonth}
            dayStats={dayStats}
            maxAbsDay={maxAbsDay}
            onDayClick={(date) => setViewingDate(date)}
            accountBalance={accountBalance}
            onAdd={() => { setEditingId(null); setModalOpen(true); }}
            onOpenBalance={(type) => { setBalanceModalType(type); setBalanceModalLocked(true); setBalanceModalOpen(true); }}
          />
        ) : view === "stats" ? (
          <StatsView
            goals={accountGoals}
            todayPnl={stats.todayPnl}
            todayCount={stats.todayCount}
            weekPnl={stats.weekPnl}
            monthPnl={stats.monthPnl}
            onOpenSettings={() => setSettingsOpen(true)}
            enriched={enriched}
            onAdd={() => { setEditingId(null); setModalOpen(true); }}
            onViewShot={(id) => setViewingShotId(id)}
            trades={sortedTrades}
            sortKey={sortKey}
            sortDir={sortDir}
            toggleSort={toggleSort}
            onEdit={(t) => { setEditingId(t.id); setModalOpen(true); }}
            onDelete={(id) => setConfirmDelete(id)}
          />
        ) : view === "trades" ? (
          <TradesView
            trades={sortedTrades}
            sortKey={sortKey}
            sortDir={sortDir}
            toggleSort={toggleSort}
            onEdit={(t) => { setEditingId(t.id); setModalOpen(true); }}
            onDelete={(id) => setConfirmDelete(id)}
            onAdd={() => { setEditingId(null); setModalOpen(true); }}
            onViewShot={(id) => setViewingShotId(id)}
          />
        ) : view === "breakdown" ? (
          <BreakdownView enriched={enriched} />
        ) : (
          <AnalysisView
            enriched={enriched}
            accountName={activeAccount}
            dailyNotes={accountDailyNotes}
            onSaveDailyNote={upsertDailyNote}
          />
        )}
      </div>

      {modalOpen && (
        <TradeModal
          initial={editingId ? trades.find((t) => t.id === editingId) : null}
          onClose={() => { setModalOpen(false); setEditingId(null); }}
          onSave={upsertTrade}
          checklistItems={accountChecklist}
          onAddChecklistItem={addChecklistItem}
          onRemoveChecklistItem={removeChecklistItem}
          confluenceOptions={accountConfluenceOptions}
          onAddConfluenceOption={addConfluenceOption}
          onRemoveConfluenceOption={removeConfluenceOption}
        />
      )}

      {confirmDelete && (
        <ConfirmDialog
          title="Delete this trade?"
          onCancel={() => setConfirmDelete(null)}
          onConfirm={() => deleteTrade(confirmDelete)}
        />
      )}

      {viewingShotId && (
        <ScreenshotLightbox id={viewingShotId} onClose={() => setViewingShotId(null)} />
      )}

      {accountModalOpen && (
        <AccountModal onClose={() => setAccountModalOpen(false)} onSave={addAccount} />
      )}

      {confirmDeleteAccount && (
        <ConfirmDialog
          title={`Delete "${confirmDeleteAccount}" account?`}
          message="This permanently deletes the account along with all its trades and weekly notes. This can't be undone."
          onCancel={() => setConfirmDeleteAccount(null)}
          onConfirm={() => deleteAccount(confirmDeleteAccount)}
        />
      )}

      {viewingDate && (
        <DayTradesModal
          date={viewingDate}
          trades={enriched.filter((t) => t.date === viewingDate)}
          onClose={() => setViewingDate(null)}
          onEditTrade={(t) => { setViewingDate(null); setEditingId(t.id); setModalOpen(true); }}
          onViewShot={(id) => setViewingShotId(id)}
        />
      )}

      {settingsOpen && (
        <SettingsModal
          account={activeAccount}
          goals={accountGoals}
          onSaveGoals={saveGoals}
          onClose={() => setSettingsOpen(false)}
        />
      )}

      {balanceModalOpen && (
        <BalanceModal
          account={activeAccount}
          balance={accountBalance}
          transactions={accountTransactions}
          onAdd={addTransaction}
          onDelete={deleteTransaction}
          onClose={() => setBalanceModalOpen(false)}
          initialType={balanceModalType}
          lockType={balanceModalLocked}
        />
      )}

      {calcOpen && (
        <RiskCalculatorModal
          accountBalance={accountBalance}
          onClose={() => setCalcOpen(false)}
        />
      )}
    </div>
  );
}

function StatCard({ icon: Icon, label, value, valueColor, sub }) {
  return (
    <div style={{ background: COLORS.surface, border: `1px solid ${COLORS.border}`, borderRadius: 10, padding: "16px 18px", flex: 1, minWidth: 140 }}>
      <div style={{ display: "flex", alignItems: "center", gap: 7, marginBottom: 10 }}>
        <Icon size={13} color={COLORS.textFaint} />
        <span style={{ fontSize: 11, color: COLORS.textFaint, textTransform: "uppercase", letterSpacing: ".05em", fontWeight: 500 }}>{label}</span>
      </div>
      <div style={{ fontFamily: "'IBM Plex Mono', monospace", fontSize: 22, fontWeight: 600, color: valueColor || COLORS.text }}>{value}</div>
      {sub && <div style={{ fontSize: 11, color: COLORS.textFaint, marginTop: 4 }}>{sub}</div>}
    </div>
  );
}

function PillProgressRow({ label, current, limit, isLoss, isCount, isProfitGoal }) {
  const progressValue = isProfitGoal ? Math.max(0, current) : Math.abs(current);
  const ratio = limit ? Math.min(progressValue / limit, 1) : 0;
  const pct = Math.round(ratio * 100);
  const breached = isLoss ? current <= -Math.abs(limit) : isProfitGoal ? current >= limit : isCount ? current >= limit : false;
  const valueColor = breached ? (isProfitGoal ? COLORS.profit : COLORS.loss) : COLORS.text;

  let barColor = COLORS.series3;
  if (isProfitGoal) barColor = COLORS.profit;
  else if (isLoss) barColor = breached ? COLORS.loss : COLORS.amber;

  const glowStrength = ratio >= 0.4 ? (ratio - 0.4) / 0.6 : 0; // 0 -> 1 as ratio goes 0.4 -> 1
  const glow = glowStrength > 0
    ? `0 0 ${(4 + glowStrength * 12).toFixed(0)}px ${barColor}${Math.round(70 + glowStrength * 90).toString(16)}`
    : "none";

  const currentDisplay = isCount ? current : fmtMoney(current);
  const limitDisplay = isCount ? limit : fmtMoney(isLoss ? -Math.abs(limit) : limit);

  let statusText = "";
  let statusColor = COLORS.textFaint;
  if (isCount) {
    statusText = `${Math.max(limit - current, 0)} remaining`;
  } else if (isLoss && breached) {
    statusText = "Limit breached";
    statusColor = COLORS.loss;
  } else if (isProfitGoal && breached) {
    statusText = "Goal reached!";
    statusColor = COLORS.profit;
  }

  return (
    <div style={{ marginBottom: 20 }}>
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start", marginBottom: 9, gap: 10 }}>
        <div style={{ display: "flex", alignItems: "center", gap: 6, minWidth: 0 }}>
          {isLoss && breached && <AlertTriangle size={13} color={COLORS.loss} style={{ flexShrink: 0 }} />}
          {isProfitGoal && breached && <CheckCircle2 size={13} color={COLORS.profit} style={{ flexShrink: 0 }} />}
          <span style={{ fontSize: 13, color: COLORS.text, fontWeight: 500 }}>{label}</span>
        </div>
        <span style={{ fontSize: 13, fontWeight: 700, color: valueColor, whiteSpace: "nowrap", fontFamily: "'IBM Plex Mono', monospace" }}>
          {currentDisplay} / {limitDisplay}
        </span>
      </div>
      <div style={{ height: 7, borderRadius: 999, background: COLORS.surfaceAlt, overflow: "hidden" }}>
        <div style={{ height: "100%", width: `${pct}%`, borderRadius: 999, background: barColor, boxShadow: glow, transition: "width .35s ease, box-shadow .35s ease" }} />
      </div>
      <div style={{ display: "flex", justifyContent: "space-between", marginTop: 6, fontSize: 11 }}>
        <span style={{ color: COLORS.textFaint }}>{pct}% used</span>
        <span style={{ color: statusColor, fontWeight: statusText ? 600 : 400 }}>{statusText}</span>
      </div>
    </div>
  );
}

function GoalsPanel({ goals, todayPnl, todayCount, weekPnl, monthPnl, onOpenSettings }) {
  const g = goals || {};
  const hasDaily = !!(g.maxTradesDay || g.maxLossDay || g.dailyProfitGoal);
  const hasWeekly = !!(g.maxLossWeek || g.weeklyProfitGoal);
  const hasMonthly = !!g.monthlyProfitGoal;
  const hasAny = hasDaily || hasWeekly || hasMonthly;

  return (
    <div style={{ background: COLORS.surface, border: `1px solid ${COLORS.border}`, borderRadius: 12 }}>
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start", padding: "20px 22px", borderBottom: `1px solid ${COLORS.border}` }}>
        <div>
          <div style={{ fontSize: 16, fontWeight: 700, color: COLORS.text, marginBottom: 4, fontFamily: "'Space Grotesk', sans-serif" }}>Stats &amp; Limits</div>
          <div style={{ fontSize: 12, color: COLORS.textFaint }}>Track your trading discipline and thresholds</div>
        </div>
        <button
          onClick={onOpenSettings}
          title="Edit goals"
          style={{
            width: 34, height: 34, borderRadius: 8, border: `1px solid ${COLORS.border}`, background: "transparent",
            display: "flex", alignItems: "center", justifyContent: "center", color: COLORS.textDim, cursor: "pointer", flexShrink: 0,
          }}
        >
          <Pencil size={14} />
        </button>
      </div>

      <div style={{ padding: "20px 22px" }}>
        {!hasAny ? (
          <div style={{ fontSize: 12.5, color: COLORS.textDim, lineHeight: 1.6 }}>
            No limits or goals set yet. Click the pencil above to set daily, weekly, and monthly targets.
          </div>
        ) : (
          <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(230px, 1fr))", gap: 24 }}>
            {hasDaily && (
              <div>
                <div style={{ display: "flex", alignItems: "center", gap: 8, marginBottom: 18 }}>
                  <span style={{ width: 7, height: 7, borderRadius: "50%", background: COLORS.series3, flexShrink: 0 }} />
                  <span style={{ fontSize: 11, fontWeight: 700, color: COLORS.textDim, letterSpacing: ".06em" }}>DAILY PERFORMANCE</span>
                </div>
                {g.maxTradesDay ? <PillProgressRow label="Trades Today" current={todayCount} limit={g.maxTradesDay} isCount /> : null}
                {g.maxLossDay ? <PillProgressRow label="Daily Loss" current={todayPnl} limit={g.maxLossDay} isLoss /> : null}
                {g.dailyProfitGoal ? <PillProgressRow label="Profit Goal" current={todayPnl} limit={g.dailyProfitGoal} isProfitGoal /> : null}
              </div>
            )}
            {hasWeekly && (
              <div>
                <div style={{ display: "flex", alignItems: "center", gap: 8, marginBottom: 18 }}>
                  <span style={{ width: 7, height: 7, borderRadius: "50%", background: COLORS.amber, flexShrink: 0 }} />
                  <span style={{ fontSize: 11, fontWeight: 700, color: COLORS.textDim, letterSpacing: ".06em" }}>WEEKLY PERFORMANCE</span>
                </div>
                {g.maxLossWeek ? <PillProgressRow label="Loss Limit" current={weekPnl} limit={g.maxLossWeek} isLoss /> : null}
                {g.weeklyProfitGoal ? <PillProgressRow label="Profit Goal" current={weekPnl} limit={g.weeklyProfitGoal} isProfitGoal /> : null}
              </div>
            )}
            {hasMonthly && (
              <div>
                <div style={{ display: "flex", alignItems: "center", gap: 8, marginBottom: 18 }}>
                  <span style={{ width: 7, height: 7, borderRadius: "50%", background: COLORS.series5, flexShrink: 0 }} />
                  <span style={{ fontSize: 11, fontWeight: 700, color: COLORS.textDim, letterSpacing: ".06em" }}>MONTHLY PERFORMANCE</span>
                </div>
                <PillProgressRow label="Profit Goal" current={monthPnl} limit={g.monthlyProfitGoal} isProfitGoal />
              </div>
            )}
          </div>
        )}
      </div>
    </div>
  );
}

function AccountSwitcher({ accounts, activeAccount, currencies, onSwitch, onAdd, onDelete }) {
  const [open, setOpen] = useState(false);
  return (
    <div style={{ position: "relative" }}>
      <button
        onClick={() => setOpen((o) => !o)}
        style={{
          display: "flex", alignItems: "center", justifyContent: "space-between", width: "100%",
          background: COLORS.surface, border: `1px solid ${COLORS.border}`, borderRadius: 8,
          padding: "9px 10px", cursor: "pointer", color: COLORS.text, fontFamily: "'Inter', sans-serif",
        }}
      >
        <span style={{ display: "flex", alignItems: "center", gap: 8, fontSize: 12.5, fontWeight: 600, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>
          <Wallet size={14} color={COLORS.gold} />
          {activeAccount}
          {currencies && currencies[activeAccount] === "USC" && (
            <span style={{ fontSize: 9.5, fontWeight: 700, color: COLORS.textFaint, border: `1px solid ${COLORS.border}`, borderRadius: 4, padding: "1px 4px", flexShrink: 0 }}>USC</span>
          )}
        </span>
        <ChevronDown size={14} color={COLORS.textFaint} />
      </button>
      {open && (
        <>
          <div style={{ position: "fixed", inset: 0, zIndex: 10 }} onClick={() => setOpen(false)} />
          <div style={{
            position: "absolute", top: "calc(100% + 6px)", left: 0, right: 0, zIndex: 20,
            background: COLORS.surfaceAlt, border: `1px solid ${COLORS.border}`, borderRadius: 8,
            padding: 6, boxShadow: "0 8px 24px rgba(0,0,0,0.4)",
          }}>
            {accounts.map((acc) => (
              <div key={acc} style={{ display: "flex", alignItems: "center", gap: 2 }}>
                <button
                  onClick={() => { onSwitch(acc); setOpen(false); }}
                  style={{
                    flex: 1, display: "flex", alignItems: "center", gap: 8, textAlign: "left",
                    background: "transparent", border: "none", color: acc === activeAccount ? COLORS.gold : COLORS.text,
                    padding: "7px 8px", borderRadius: 6, cursor: "pointer", fontSize: 12.5, fontFamily: "'Inter', sans-serif",
                  }}
                >
                  {acc === activeAccount ? <Check size={13} /> : <span style={{ width: 13, display: "inline-block" }} />}
                  {acc}
                  {currencies && currencies[acc] === "USC" && (
                    <span style={{ fontSize: 9.5, fontWeight: 700, color: COLORS.textFaint, border: `1px solid ${COLORS.border}`, borderRadius: 4, padding: "1px 4px" }}>USC</span>
                  )}
                </button>
                {accounts.length > 1 && (
                  <button className="lj-icon-btn" onClick={() => { onDelete(acc); setOpen(false); }} title="Delete account">
                    <Trash2 size={12} />
                  </button>
                )}
              </div>
            ))}
            <div style={{ borderTop: `1px solid ${COLORS.border}`, marginTop: 4, paddingTop: 4 }}>
              <button
                onClick={() => { onAdd(); setOpen(false); }}
                style={{
                  display: "flex", alignItems: "center", gap: 8, width: "100%", textAlign: "left",
                  background: "transparent", border: "none", color: COLORS.gold, padding: "7px 8px",
                  borderRadius: 6, cursor: "pointer", fontSize: 12.5, fontWeight: 600, fontFamily: "'Inter', sans-serif",
                }}
              >
                <Plus size={13} /> Add account
              </button>
            </div>
          </div>
        </>
      )}
    </div>
  );
}

function AccountModal({ onClose, onSave }) {
  const [name, setName] = useState("");
  const [initialDeposit, setInitialDeposit] = useState("");
  const [isCentAccount, setIsCentAccount] = useState(false);

  const submit = () => {
    if (!name.trim()) return;
    onSave(name, parseFloat(initialDeposit) || 0, isCentAccount ? "USC" : "USD");
  };

  return (
    <div style={{
      position: "fixed", inset: 0, background: "rgba(0,0,0,0.6)", display: "flex",
      alignItems: "center", justifyContent: "center", zIndex: 65, padding: 20,
    }} onClick={(e) => { if (e.target === e.currentTarget) onClose(); }}>
      <div style={{ background: COLORS.surface, border: `1px solid ${COLORS.border}`, borderRadius: 12, padding: 22, width: 340, fontFamily: "'Inter', sans-serif" }}>
        <div style={{ fontWeight: 600, fontSize: 15, marginBottom: 14 }}>New account</div>
        <label className="lj-label">Account name</label>
        <input
          type="text" className="lj-input" autoFocus placeholder="e.g. Prop Firm, Futures, IRA"
          value={name} onChange={(e) => setName(e.target.value)}
          onKeyDown={(e) => { if (e.key === "Enter") submit(); }}
          style={{ fontFamily: "'Inter', sans-serif", marginBottom: 14 }}
        />
        <label className="lj-label">Initial deposit ($) — optional</label>
        <input
          type="number" step="any" className="lj-input" placeholder="0.00"
          value={initialDeposit} onChange={(e) => setInitialDeposit(e.target.value)}
          onKeyDown={(e) => { if (e.key === "Enter") submit(); }}
          style={{ marginBottom: 14 }}
        />
        <label style={{ display: "flex", alignItems: "flex-start", gap: 8, cursor: "pointer", marginBottom: 16 }}>
          <input
            type="checkbox" checked={isCentAccount} onChange={(e) => setIsCentAccount(e.target.checked)}
            style={{ accentColor: COLORS.gold, width: 14, height: 14, marginTop: 2, flexShrink: 0 }}
          />
          <span style={{ fontSize: 12.5, color: COLORS.textDim, lineHeight: 1.4 }}>
            This is a cent account (USC) — all figures you enter will be treated as cents and shown converted to USD automatically.
          </span>
        </label>
        <div style={{ display: "flex", gap: 8, justifyContent: "flex-end" }}>
          <button className="lj-btn-ghost" onClick={onClose}>Cancel</button>
          <button className="lj-btn-primary" onClick={submit}>Create</button>
        </div>
      </div>
    </div>
  );
}

function BalanceModal({ account, balance, transactions, onAdd, onDelete, onClose, initialType, lockType }) {
  const [type, setType] = useState(initialType || "deposit");
  const [amount, setAmount] = useState("");
  const [date, setDate] = useState(todayStr());
  const [note, setNote] = useState("");

  const submit = () => {
    const amt = parseFloat(amount);
    if (!amt || amt <= 0) return;
    onAdd(type, amt, date, note);
    setAmount("");
    setNote("");
  };

  return (
    <div style={{
      position: "fixed", inset: 0, background: "rgba(0,0,0,0.6)", display: "flex",
      alignItems: "center", justifyContent: "center", zIndex: 65, padding: 20,
    }} onClick={(e) => { if (e.target === e.currentTarget) onClose(); }}>
      <div style={{
        background: COLORS.surface, border: `1px solid ${COLORS.border}`, borderRadius: 12,
        width: 460, maxWidth: "100%", maxHeight: "86vh", overflowY: "auto", padding: 24,
        fontFamily: "'Inter', sans-serif",
      }} className="lj-scroll">
        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 4 }}>
          <div style={{ fontFamily: "'Space Grotesk', sans-serif", fontSize: 17, fontWeight: 600 }}>Account balance</div>
          <button className="lj-icon-btn" onClick={onClose}><X size={18} /></button>
        </div>
        <div style={{ fontSize: 11.5, color: COLORS.textFaint, marginBottom: 16, fontFamily: "'IBM Plex Mono', monospace" }}>{account}</div>

        <div style={{ background: COLORS.surfaceAlt, border: `1px solid ${COLORS.border}`, borderRadius: 10, padding: "16px 18px", marginBottom: 18, textAlign: "center" }}>
          <div style={{ fontSize: 11, color: COLORS.textFaint, textTransform: "uppercase", letterSpacing: ".05em", marginBottom: 6 }}>Current balance</div>
          <div style={{ fontFamily: "'IBM Plex Mono', monospace", fontSize: 26, fontWeight: 700, color: balance >= 0 ? COLORS.text : COLORS.loss }}>{fmtMoney(balance)}</div>
          <div style={{ fontSize: 10.5, color: COLORS.textFaint, marginTop: 4 }}>Deposits − withdrawals + realized P&amp;L</div>
        </div>

        <div style={{ marginBottom: 18 }}>
          {!lockType && (
            <>
              <div style={{ fontSize: 13, fontWeight: 600, marginBottom: 10 }}>Add deposit or withdrawal</div>
              <div style={{ display: "flex", gap: 8, marginBottom: 10 }}>
                {["deposit", "withdraw"].map((tp) => (
                  <button
                    key={tp}
                    onClick={() => setType(tp)}
                    style={{
                      flex: 1, padding: "9px 0", borderRadius: 7, cursor: "pointer",
                      border: `1px solid ${type === tp ? (tp === "deposit" ? COLORS.profit : COLORS.loss) : COLORS.border}`,
                      background: type === tp ? (tp === "deposit" ? COLORS.profitDim : COLORS.lossDim) : "transparent",
                      color: type === tp ? (tp === "deposit" ? COLORS.profit : COLORS.loss) : COLORS.textDim,
                      fontFamily: "'Inter', sans-serif", fontWeight: 600, fontSize: 12.5, textTransform: "capitalize",
                    }}
                  >
                    {tp === "deposit" ? <ArrowDownCircle size={13} style={{ verticalAlign: -2, marginRight: 5 }} /> : <ArrowUpCircle size={13} style={{ verticalAlign: -2, marginRight: 5 }} />}
                    {tp}
                  </button>
                ))}
              </div>
            </>
          )}
          <div className="lj-two-col" style={{ marginBottom: 10 }}>
            <div>
              <label className="lj-label">Amount ($)</label>
              <input type="number" step="any" className="lj-input" placeholder="0.00" value={amount} onChange={(e) => setAmount(e.target.value)} />
            </div>
            <div>
              <label className="lj-label">Date</label>
              <input type="date" className="lj-input" value={date} onChange={(e) => setDate(e.target.value)} />
            </div>
          </div>
          <div style={{ display: "flex", gap: 8 }}>
            <input type="text" className="lj-input" placeholder="Note (optional)" value={note} onChange={(e) => setNote(e.target.value)} style={{ fontFamily: "'Inter', sans-serif" }} />
            <button className="lj-btn-primary" onClick={submit}><Plus size={14} /> Add</button>
          </div>
        </div>

        <div>
          <div style={{ fontSize: 13, fontWeight: 600, marginBottom: 10 }}>History</div>
          {transactions.length === 0 ? (
            <div style={{ fontSize: 12, color: COLORS.textFaint }}>No deposits or withdrawals logged yet.</div>
          ) : (
            <div style={{ display: "flex", flexDirection: "column", gap: 6 }}>
              {transactions.map((t) => (
                <div key={t.id} style={{ display: "flex", alignItems: "center", justifyContent: "space-between", background: COLORS.surfaceAlt, border: `1px solid ${COLORS.borderSoft}`, borderRadius: 7, padding: "8px 10px" }}>
                  <div style={{ display: "flex", alignItems: "center", gap: 8, fontSize: 12.5 }}>
                    {t.type === "deposit" ? <ArrowDownCircle size={13} color={COLORS.profit} /> : <ArrowUpCircle size={13} color={COLORS.loss} />}
                    <span style={{ color: COLORS.textFaint, fontFamily: "'IBM Plex Mono', monospace", fontSize: 11 }}>{t.date}</span>
                    {t.note && <span style={{ color: COLORS.textDim }}>{t.note}</span>}
                  </div>
                  <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
                    <span style={{ fontFamily: "'IBM Plex Mono', monospace", fontWeight: 600, fontSize: 12.5, color: t.type === "deposit" ? COLORS.profit : COLORS.loss }}>
                      {t.type === "deposit" ? "+" : "-"}{fmtMoney(t.amount)}
                    </span>
                    <button className="lj-icon-btn" onClick={() => onDelete(t.id)}><Trash2 size={12} /></button>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}

function RiskCalculatorModal({ accountBalance, onUseSize, onClose }) {
  const [balance, setBalance] = useState(accountBalance > 0 ? accountBalance.toFixed(2) : "");
  const [riskPct, setRiskPct] = useState("1");
  const [stopValue, setStopValue] = useState("");
  const [contractPreset, setContractPreset] = useState("forex");
  const [contractSize, setContractSize] = useState("100000");
  const [presetSettingsOpen, setPresetSettingsOpen] = useState(false);

  const handlePresetChange = (val) => {
    setContractPreset(val);
    if (val === "units") setContractSize("1");
    else if (val === "gold") setContractSize("100");
    else if (val === "forex") setContractSize("100000");
  };

  const bal = parseFloat(balance) || 0;
  const pct = parseFloat(riskPct) || 0;
  const stopVal = parseFloat(stopValue);
  const cs = parseFloat(contractSize) || 0;
  const riskAmount = bal * (pct / 100);
  // Forex is entered in pips — convert to raw price distance (standard pip = 0.0001) before applying contract size.
  const stopDistance = contractPreset === "forex" ? stopVal * 0.0001 : stopVal;
  const lotSize = stopDistance > 0 && cs > 0 ? riskAmount / (stopDistance * cs) : null;

  const presetLabel = contractPreset === "units" ? "Units (×1)" : contractPreset === "gold" ? "Gold/Silver lots (100 oz)" : contractPreset === "forex" ? "Forex lots (100,000)" : "Custom";

  const bigBoxStyle = {
    background: COLORS.bg, border: `1px solid ${COLORS.border}`, borderRadius: 9,
    padding: "10px 12px", display: "flex", alignItems: "center", justifyContent: "space-between", height: 46,
  };
  const bigInputStyle = {
    background: "transparent", border: "none", outline: "none", color: COLORS.text,
    fontFamily: "'IBM Plex Mono', monospace", fontSize: 21, fontWeight: 700, width: "100%", minWidth: 0,
  };

  return (
    <div style={{
      position: "fixed", inset: 0, background: "rgba(0,0,0,0.6)", display: "flex",
      alignItems: "center", justifyContent: "center", zIndex: 75, padding: 20,
    }} onClick={(e) => { if (e.target === e.currentTarget) onClose(); }}>
      <div style={{
        background: COLORS.surface, border: `1px solid ${COLORS.border}`, borderRadius: 12,
        width: 420, maxWidth: "100%", maxHeight: "88vh", overflowY: "auto", padding: 24, fontFamily: "'Inter', sans-serif",
      }} className="lj-scroll">
        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 4 }}>
          <div style={{ fontFamily: "'Space Grotesk', sans-serif", fontSize: 16, fontWeight: 600 }}>Lot size calculator</div>
          <button className="lj-icon-btn" onClick={onClose}><X size={18} /></button>
        </div>
        <div style={{ fontSize: 11, color: COLORS.textFaint, marginBottom: 18 }}>Updates live as you type.</div>

        <div className="lj-two-col" style={{ marginBottom: 14 }}>
          <div>
            <label className="lj-label">Stop loss</label>
            <div style={bigBoxStyle}>
              <input type="number" step="any" placeholder="0" value={stopValue} onChange={(e) => setStopValue(e.target.value)} style={bigInputStyle} />
              <span style={{ color: COLORS.textFaint, fontSize: 12, whiteSpace: "nowrap", marginLeft: 6 }}>{contractPreset === "forex" ? "pips" : "price"}</span>
            </div>
          </div>
          <div>
            <label className="lj-label">Account balance</label>
            <div style={bigBoxStyle}>
              <span style={{ color: COLORS.textFaint, fontSize: 13, marginRight: 4 }}>$</span>
              <input type="number" step="any" placeholder="0.00" value={balance} onChange={(e) => setBalance(e.target.value)} style={{ ...bigInputStyle, fontSize: 16 }} />
            </div>
          </div>
        </div>

        <div className="lj-two-col" style={{ marginBottom: 14 }}>
          <div>
            <label className="lj-label">Risk per trade</label>
            <div style={{ background: COLORS.bg, border: `1px solid ${COLORS.border}`, borderRadius: 9, padding: "8px 12px" }}>
              <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between" }}>
                <input type="number" step="any" placeholder="1" value={riskPct} onChange={(e) => setRiskPct(e.target.value)} style={{ ...bigInputStyle, fontSize: 21 }} />
                <span style={{ color: COLORS.textFaint, fontSize: 13 }}>%</span>
              </div>
              <div style={{ fontSize: 10.5, color: COLORS.textFaint, marginTop: 1 }}>≈ {fmtMoney(riskAmount)}</div>
            </div>
          </div>
          <div>
            <label className="lj-label">Lots</label>
            <div style={{ background: COLORS.surfaceAlt, border: `1px solid ${COLORS.goldDim}`, borderRadius: 9, padding: "8px 12px", height: 46, display: "flex", alignItems: "center" }}>
              <span style={{ fontFamily: "'IBM Plex Mono', monospace", fontSize: 22, fontWeight: 800, color: COLORS.gold }}>
                {lotSize !== null ? lotSize.toFixed(2) : "—"}
              </span>
            </div>
          </div>
        </div>

        {!presetSettingsOpen ? (
          <button
            onClick={() => setPresetSettingsOpen(true)}
            style={{ background: "none", border: "none", color: COLORS.textFaint, fontSize: 11, cursor: "pointer", padding: 0, marginBottom: 16, textDecoration: "underline", fontFamily: "'Inter', sans-serif" }}
          >
            What size represents: {presetLabel} · Edit
          </button>
        ) : (
          <div style={{ marginBottom: 16 }}>
            <div style={{ marginBottom: 8 }}>
              <label className="lj-label">What does your size represent?</label>
              <select className="lj-select" value={contractPreset} onChange={(e) => handlePresetChange(e.target.value)} style={{ fontFamily: "'Inter', sans-serif" }}>
                <option value="forex">Standard forex lot (100,000 units per 1.0 lot)</option>
                <option value="gold">Gold / Silver lots (100 oz per 1.0 lot)</option>
                <option value="units">Shares, contracts, or raw units (×1)</option>
                <option value="custom">Something else / not sure</option>
              </select>
            </div>

            {contractPreset === "custom" ? (
              <div style={{ fontSize: 11.5, color: COLORS.textDim, marginBottom: 10, lineHeight: 1.5, background: COLORS.surfaceAlt, border: `1px solid ${COLORS.borderSoft}`, borderRadius: 8, padding: "10px 12px" }}>
                In MT5: right-click the symbol in Market Watch → <strong style={{ color: COLORS.text }}>Specification</strong> → look for "Contract size." Enter that number below.
              </div>
            ) : (
              <div style={{ fontSize: 11.5, color: COLORS.textDim, marginBottom: 10, lineHeight: 1.5, background: COLORS.surfaceAlt, border: `1px solid ${COLORS.borderSoft}`, borderRadius: 8, padding: "10px 12px" }}>
                We've filled in the standard contract size below — adjust it if your broker quotes something different.
              </div>
            )}

            <div>
              <label className="lj-label">Contract size (units per 1.0 lot)</label>
              <input type="number" step="any" className="lj-input" placeholder="100000" value={contractSize} onChange={(e) => { setContractSize(e.target.value); setContractPreset("custom"); }} />
            </div>
            <button
              onClick={() => setPresetSettingsOpen(false)}
              style={{ background: "none", border: "none", color: COLORS.gold, fontSize: 11, cursor: "pointer", padding: 0, marginTop: 8, fontFamily: "'Inter', sans-serif" }}
            >
              Done
            </button>
          </div>
        )}

        {lotSize === null && (
          <div style={{ fontSize: 11, color: COLORS.textFaint, marginBottom: 16, marginTop: -8 }}>Enter a stop loss and an account balance to calculate lot size.</div>
        )}

        <div style={{ display: "flex", gap: 8, justifyContent: "flex-end" }}>
          <button className="lj-btn-ghost" onClick={onClose}>Close</button>
          {onUseSize && (
            <button
              className="lj-btn-primary"
              disabled={lotSize === null}
              style={{ opacity: lotSize === null ? 0.5 : 1, cursor: lotSize === null ? "not-allowed" : "pointer" }}
              onClick={() => { if (lotSize !== null) onUseSize(lotSize.toFixed(2)); }}
            >
              Use this lot size
            </button>
          )}
        </div>
      </div>
    </div>
  );
}

function Dashboard({ stats, equityCurve, calMonth, setCalMonth, dayStats, maxAbsDay, onDayClick, onAdd, accountBalance, onOpenBalance }) {
  const pnlColor = stats.totalPnl > 0 ? COLORS.profit : stats.totalPnl < 0 ? COLORS.loss : COLORS.text;
  const streakColor = stats.streakType === "win" ? COLORS.profit : stats.streakType === "loss" ? COLORS.loss : COLORS.text;
  const streakLabel = stats.streak ? `${stats.streak} ${stats.streakType === "win" ? "win" : "loss"}${stats.streak > 1 ? "s" : ""} in a row` : "No active streak";

  return (
    <div>
      <div style={{ display: "flex", alignItems: "baseline", justifyContent: "space-between", marginBottom: 22 }}>
        <div>
          <div style={{ fontFamily: "'Space Grotesk', sans-serif", fontSize: 22, fontWeight: 600 }}>Dashboard</div>
          <div style={{ fontSize: 12.5, color: COLORS.textFaint, marginTop: 2 }}>{stats.n} trade{stats.n === 1 ? "" : "s"} logged</div>
        </div>
        <button className="lj-btn-primary" onClick={onAdd}>
          <Plus size={14} /> Log trade
        </button>
      </div>

      <div className="lj-dash-grid" style={{ marginBottom: 18, alignItems: "stretch" }}>
        <div style={{ display: "flex", flexDirection: "column", gap: 12 }}>
          <div style={{ background: COLORS.surface, border: `1px solid ${COLORS.border}`, borderRadius: 12, padding: "20px 24px", display: "flex", alignItems: "center", justifyContent: "space-between", gap: 16, flex: 1 }}>
            <div>
              <div style={{ display: "flex", alignItems: "center", gap: 8, marginBottom: 12 }}>
                <Wallet size={15} color={COLORS.gold} />
                <span style={{ fontSize: 12, color: COLORS.textFaint, textTransform: "uppercase", letterSpacing: ".05em", fontWeight: 500 }}>Account balance</span>
              </div>
              <div style={{ fontFamily: "'IBM Plex Mono', monospace", fontSize: 40, fontWeight: 700, lineHeight: 1, color: accountBalance >= 0 ? COLORS.text : COLORS.loss }}>
                {fmtMoney(accountBalance)}
              </div>
            </div>
            <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
              <button
                onClick={() => onOpenBalance("deposit")}
                style={{
                  display: "flex", alignItems: "center", gap: 6, background: COLORS.profitDim, border: `1px solid ${COLORS.profit}`,
                  color: COLORS.profit, borderRadius: 7, padding: "6px 12px", fontSize: 12, fontWeight: 600, cursor: "pointer", fontFamily: "'Inter', sans-serif", whiteSpace: "nowrap",
                }}
              >
                <ArrowDownCircle size={13} /> Deposit
              </button>
              <button
                onClick={() => onOpenBalance("withdraw")}
                style={{
                  display: "flex", alignItems: "center", gap: 6, background: COLORS.lossDim, border: `1px solid ${COLORS.loss}`,
                  color: COLORS.loss, borderRadius: 7, padding: "6px 12px", fontSize: 12, fontWeight: 600, cursor: "pointer", fontFamily: "'Inter', sans-serif", whiteSpace: "nowrap",
                }}
              >
                <ArrowUpCircle size={13} /> Withdraw
              </button>
            </div>
          </div>

          <div style={{ background: COLORS.surface, border: `1px solid ${COLORS.border}`, borderRadius: 10, display: "flex", overflow: "hidden", flex: 1 }}>
            <div style={{ flex: 1, padding: "16px 18px", display: "flex", flexDirection: "column", justifyContent: "center" }}>
              <div style={{ display: "flex", alignItems: "center", gap: 7, marginBottom: 10 }}>
                <TrendingUp size={13} color={COLORS.textFaint} />
                <span style={{ fontSize: 11, color: COLORS.textFaint, textTransform: "uppercase", letterSpacing: ".05em", fontWeight: 500 }}>Total P&L</span>
              </div>
              <div style={{ fontFamily: "'IBM Plex Mono', monospace", fontSize: 22, fontWeight: 600, color: pnlColor }}>{fmtMoney(stats.totalPnl)}</div>
            </div>
            <div style={{ width: 1, background: COLORS.border }} />
            <div style={{ flex: 1, padding: "16px 18px", display: "flex", flexDirection: "column", justifyContent: "center" }}>
              <div style={{ display: "flex", alignItems: "center", gap: 7, marginBottom: 10 }}>
                <Percent size={13} color={COLORS.textFaint} />
                <span style={{ fontSize: 11, color: COLORS.textFaint, textTransform: "uppercase", letterSpacing: ".05em", fontWeight: 500 }}>Win rate</span>
              </div>
              <div style={{ fontFamily: "'IBM Plex Mono', monospace", fontSize: 22, fontWeight: 600, color: COLORS.text }}>{stats.winRate.toFixed(1)}%</div>
              <div style={{ fontSize: 11, color: COLORS.textFaint, marginTop: 4 }}>{stats.winsCount}W / {stats.lossesCount}L</div>
            </div>
          </div>
        </div>

        <div style={{ background: COLORS.surface, border: `1px solid ${COLORS.border}`, borderRadius: 10, display: "flex", flexDirection: "column", overflow: "hidden" }}>
          <div style={{ flex: 1, padding: "16px 18px" }}>
            <div style={{ display: "flex", alignItems: "center", gap: 7, marginBottom: 10 }}>
              <Target size={13} color={COLORS.textFaint} />
              <span style={{ fontSize: 11, color: COLORS.textFaint, textTransform: "uppercase", letterSpacing: ".05em", fontWeight: 500 }}>Profit factor</span>
            </div>
            <div style={{ fontFamily: "'IBM Plex Mono', monospace", fontSize: 22, fontWeight: 600, color: COLORS.text }}>
              {stats.profitFactor === Infinity ? "∞" : stats.profitFactor.toFixed(2)}
            </div>
          </div>
          <div style={{ height: 1, background: COLORS.border }} />
          <div style={{ flex: 1, padding: "16px 18px" }}>
            <div style={{ display: "flex", alignItems: "center", gap: 7, marginBottom: 10 }}>
              <Flame size={13} color={COLORS.textFaint} />
              <span style={{ fontSize: 11, color: COLORS.textFaint, textTransform: "uppercase", letterSpacing: ".05em", fontWeight: 500 }}>Streak</span>
            </div>
            <div style={{ fontFamily: "'IBM Plex Mono', monospace", fontSize: 22, fontWeight: 600, color: streakColor }}>{stats.streak || "—"}</div>
            <div style={{ fontSize: 11, color: COLORS.textFaint, marginTop: 4 }}>{streakLabel}</div>
          </div>
          <div style={{ height: 1, background: COLORS.border }} />
          <div style={{ flex: 1, padding: "16px 18px" }}>
            <div style={{ display: "flex", alignItems: "center", gap: 7, marginBottom: 10 }}>
              <ListChecks size={13} color={COLORS.textFaint} />
              <span style={{ fontSize: 11, color: COLORS.textFaint, textTransform: "uppercase", letterSpacing: ".05em", fontWeight: 500 }}>Avg R</span>
            </div>
            <div style={{ fontFamily: "'IBM Plex Mono', monospace", fontSize: 22, fontWeight: 600, color: stats.avgR !== null ? (stats.avgR >= 0 ? COLORS.profit : COLORS.loss) : COLORS.text }}>
              {stats.avgR !== null ? fmtR(stats.avgR) : "—"}
            </div>
            <div style={{ fontSize: 11, color: COLORS.textFaint, marginTop: 4 }}>Avg reward:risk</div>
          </div>
        </div>
      </div>

      <div style={{ background: COLORS.surface, border: `1px solid ${COLORS.border}`, borderRadius: 10, padding: "18px 18px 8px", marginBottom: 16 }}>
        <div style={{ fontSize: 12.5, fontWeight: 600, color: COLORS.textDim, marginBottom: 4 }}>Equity curve</div>
        <div style={{ height: 240 }}>
          <ResponsiveContainer width="100%" height="100%">
            <AreaChart data={equityCurve} margin={{ top: 10, right: 10, left: -10, bottom: 0 }}>
              <defs>
                <linearGradient id="eqGrad" x1="0" y1="0" x2="0" y2="1">
                  <stop offset="0%" stopColor={COLORS.profit} stopOpacity={0.25} />
                  <stop offset="100%" stopColor={COLORS.gold} stopOpacity={0} />
                </linearGradient>
              </defs>
              <CartesianGrid stroke={COLORS.borderSoft} vertical={false} />
              <XAxis dataKey="idx" tick={{ fill: COLORS.textFaint, fontSize: 10.5, fontFamily: "IBM Plex Mono" }} axisLine={{ stroke: COLORS.border }} tickLine={false} />
              <YAxis tick={{ fill: COLORS.textFaint, fontSize: 10.5, fontFamily: "IBM Plex Mono" }} axisLine={false} tickLine={false} tickFormatter={fmtMoneyShort} width={56} />
              <ReferenceLine y={0} stroke={COLORS.textFaint} strokeDasharray="3 3" />
              <Tooltip
                contentStyle={{ background: COLORS.surfaceAlt, border: `1px solid ${COLORS.border}`, borderRadius: 8, fontSize: 12, fontFamily: "IBM Plex Mono" }}
                labelStyle={{ color: COLORS.textDim }}
                formatter={(v) => [fmtMoney(v), "Equity"]}
                labelFormatter={(l, p) => (p && p[0] ? p[0].payload.date : l)}
              />
              <Area type="monotone" dataKey="equity" stroke={COLORS.gold} strokeWidth={2} fill="url(#eqGrad)" />
            </AreaChart>
          </ResponsiveContainer>
        </div>
      </div>

      <div>
        <CalendarHeatmap
          calMonth={calMonth}
          setCalMonth={setCalMonth}
          dayStats={dayStats}
          maxAbsDay={maxAbsDay}
          onDayClick={onDayClick}
        />
      </div>
    </div>
  );
}

function StatsView({ goals, todayPnl, todayCount, weekPnl, monthPnl, onOpenSettings, enriched, onAdd, onViewShot, trades, sortKey, sortDir, toggleSort, onEdit, onDelete }) {
  return (
    <div>
      <div style={{ fontFamily: "'Space Grotesk', sans-serif", fontSize: 22, fontWeight: 600, marginBottom: 4 }}>Stats</div>
      <div style={{ fontSize: 12.5, color: COLORS.textFaint, marginBottom: 18 }}>Your limits, goals, and trade log.</div>

      <div style={{ marginBottom: 16 }}>
        <GoalsPanel goals={goals} todayPnl={todayPnl} todayCount={todayCount} weekPnl={weekPnl} monthPnl={monthPnl} onOpenSettings={onOpenSettings} />
      </div>

      <TradesView
        trades={trades}
        sortKey={sortKey}
        sortDir={sortDir}
        toggleSort={toggleSort}
        onEdit={onEdit}
        onDelete={onDelete}
        onAdd={onAdd}
        onViewShot={onViewShot}
      />
    </div>
  );
}

function CalendarHeatmap({ calMonth, setCalMonth, dayStats, maxAbsDay, onDayClick }) {
  const year = calMonth.getFullYear();
  const month = calMonth.getMonth();
  const firstDow = new Date(year, month, 1).getDay();
  const daysInMonth = new Date(year, month + 1, 0).getDate();
  const totalCells = firstDow + daysInMonth;
  const totalRows = Math.ceil(totalCells / 7);

  const weeks = [];
  for (let w = 0; w < totalRows; w++) {
    const days = [];
    for (let i = 0; i < 7; i++) {
      const dayNum = w * 7 + i - firstDow + 1;
      days.push(dayNum >= 1 && dayNum <= daysInMonth ? dayNum : null);
    }
    weeks.push({ days });
  }

  const cellStyle = (pnl) => {
    if (pnl === undefined) return { background: COLORS.surfaceAlt, border: `1px solid ${COLORS.borderSoft}` };
    const intensity = Math.min(Math.abs(pnl) / maxAbsDay, 1);
    if (pnl > 0) {
      return {
        background: `rgba(0, 200, 150, ${0.14 + intensity * 0.28})`,
        border: `1px solid rgba(0, 200, 150, ${0.35 + intensity * 0.45})`,
      };
    }
    if (pnl < 0) {
      return {
        background: `rgba(239, 68, 68, ${0.14 + intensity * 0.28})`,
        border: `1px solid rgba(239, 68, 68, ${0.35 + intensity * 0.45})`,
      };
    }
    return { background: COLORS.surfaceAlt, border: `1px solid ${COLORS.borderSoft}` };
  };

  let monthPnl = 0, monthTrades = 0;
  Object.keys(dayStats).forEach((k) => {
    const [y, m] = k.split("-").map(Number);
    if (y === year && m - 1 === month) { monthPnl += dayStats[k].pnl; monthTrades += dayStats[k].count; }
  });

  return (
    <div style={{ background: COLORS.surface, border: `1px solid ${COLORS.border}`, borderRadius: 10, padding: "18px 20px" }}>
      <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: 14 }}>
        <div>
          <div style={{ fontSize: 14, fontWeight: 600 }}>{MONTHS[month]} {year}</div>
          <div style={{ fontSize: 11.5, color: monthPnl >= 0 ? COLORS.profit : COLORS.loss, fontFamily: "'IBM Plex Mono', monospace" }}>
            {fmtMoney(monthPnl)} · {monthTrades} trade{monthTrades === 1 ? "" : "s"}
          </div>
        </div>
        <div style={{ display: "flex", gap: 4 }}>
          <button className="lj-icon-btn" onClick={() => setCalMonth(new Date(year, month - 1, 1))}><ChevronLeft size={16} /></button>
          <button className="lj-icon-btn" onClick={() => setCalMonth(new Date(year, month + 1, 1))}><ChevronRight size={16} /></button>
        </div>
      </div>

      <div style={{ display: "grid", gridTemplateColumns: "repeat(7, 1fr)", gap: 6, marginBottom: 6 }}>
        {DOW.map((d, i) => (
          <div key={i} style={{ fontSize: 10.5, color: COLORS.textFaint, textAlign: "center", fontWeight: 500 }}>{d}</div>
        ))}
      </div>

      {weeks.map((week, wi) => (
        <div key={wi} style={{ display: "grid", gridTemplateColumns: "repeat(7, 1fr)", gap: 6, marginBottom: 6 }}>
          {week.days.map((d, i) => {
            if (d === null) return <div key={i} />;
            const key = `${year}-${String(month + 1).padStart(2, "0")}-${String(d).padStart(2, "0")}`;
            const day = dayStats[key];
            const style = cellStyle(day ? day.pnl : undefined);
            return (
              <div
                key={i}
                onClick={() => onDayClick(key)}
                style={{
                  minHeight: 76, borderRadius: 8, ...style, padding: "8px 9px", cursor: "pointer",
                  display: "flex", flexDirection: "column", justifyContent: "space-between",
                  transition: "filter .1s",
                }}
                onMouseEnter={(e) => { e.currentTarget.style.filter = "brightness(1.15)"; }}
                onMouseLeave={(e) => { e.currentTarget.style.filter = "none"; }}
              >
                <div style={{ fontSize: 11, color: day ? COLORS.textDim : COLORS.textFaint, fontFamily: "'IBM Plex Mono', monospace" }}>{d}</div>
                {day ? (
                  <div>
                    <div style={{ fontSize: 13.5, fontWeight: 700, color: day.pnl >= 0 ? COLORS.profit : COLORS.loss, fontFamily: "'IBM Plex Mono', monospace", lineHeight: 1.2 }}>
                      {fmtMoney(day.pnl)}
                    </div>
                    <div style={{ fontSize: 10, color: COLORS.textFaint, marginTop: 1 }}>
                      {day.count} trade{day.count === 1 ? "" : "s"}
                    </div>
                  </div>
                ) : null}
              </div>
            );
          })}
        </div>
      ))}
    </div>
  );
}

function EmptyState({ onAdd }) {
  return (
    <div style={{ background: COLORS.surface, border: `1px dashed ${COLORS.border}`, borderRadius: 12, padding: "60px 20px", textAlign: "center" }}>
      <div style={{ fontFamily: "'Space Grotesk', sans-serif", fontSize: 16, fontWeight: 600, marginBottom: 6 }}>Your ledger is empty</div>
      <div style={{ fontSize: 13, color: COLORS.textDim, marginBottom: 18 }}>Log your first trade to start tracking your edge.</div>
      <button className="lj-btn-primary" onClick={onAdd}><Plus size={15} /> Log trade</button>
    </div>
  );
}

function TradesView({ trades, sortKey, sortDir, toggleSort, onEdit, onDelete, onAdd, onViewShot }) {
  const cols = [
    { key: "date", label: "Date" },
    { key: "symbol", label: "Symbol" },
    { key: "direction", label: "Side" },
    { key: "entry", label: "Entry" },
    { key: "exit", label: "Exit" },
    { key: "stopLoss", label: "Stop" },
    { key: "size", label: "Size" },
    { key: "pnl", label: "P&L" },
    { key: "rMultiple", label: "R" },
  ];
  return (
    <div>
      <div style={{ marginBottom: 18 }}>
        <div style={{ fontFamily: "'Space Grotesk', sans-serif", fontSize: 22, fontWeight: 600 }}>Trade log</div>
        <div style={{ fontSize: 12.5, color: COLORS.textFaint, marginTop: 2 }}>{trades.length} trade{trades.length === 1 ? "" : "s"}</div>
      </div>

      {trades.length === 0 ? (
        <EmptyState onAdd={onAdd} />
      ) : (
        <div style={{ background: COLORS.surface, border: `1px solid ${COLORS.border}`, borderRadius: 10, overflow: "hidden" }}>
          <div className="lj-scroll" style={{ overflowX: "auto" }}>
            <table className="lj-table">
              <thead>
                <tr>
                  {cols.map((c) => (
                    <th key={c.key} onClick={() => toggleSort(c.key)}>
                      {c.label}{sortKey === c.key ? (sortDir === "asc" ? " ↑" : " ↓") : ""}
                    </th>
                  ))}
                  <th>Mood</th>
                  <th>Confluences</th>
                  <th></th>
                  <th></th>
                </tr>
              </thead>
              <tbody>
                {trades.map((t) => (
                  <tr key={t.id}>
                    <td style={{ color: COLORS.textDim }}>{t.date}</td>
                    <td style={{ fontWeight: 600 }}>{t.symbol}</td>
                    <td style={{ color: t.direction === "long" ? COLORS.profit : COLORS.loss, textTransform: "uppercase", fontSize: 11 }}>{t.direction}</td>
                    <td>{t.entry}</td>
                    <td>{t.exit}</td>
                    <td style={{ color: COLORS.textDim }}>{t.stopLoss || "—"}</td>
                    <td>{t.size}</td>
                    <td style={{ color: t.pnl >= 0 ? COLORS.profit : COLORS.loss, fontWeight: 600 }}>{fmtMoney(t.pnl)}</td>
                    <td style={{ color: t.rMultiple === null || t.rMultiple === undefined ? COLORS.textFaint : t.rMultiple >= 0 ? COLORS.profit : COLORS.loss }}>{fmtR(t.rMultiple)}</td>
                    <td>{t.mood ? <span className="lj-tag">{t.mood}</span> : <span style={{ color: COLORS.textFaint }}>—</span>}</td>
                    <td>
                      {(t.confluences || "").split(",").filter(Boolean).map((tag, i) => (
                        <span key={i} className="lj-tag">{tag.trim()}</span>
                      ))}
                    </td>
                    <td>
                      {t.hasShot && (
                        <button className="lj-icon-btn" onClick={() => onViewShot(t.id)} title="View screenshot"><Camera size={13} /></button>
                      )}
                    </td>
                    <td>
                      <div style={{ display: "flex", gap: 2 }}>
                        <button className="lj-icon-btn" onClick={() => onEdit(t)}><Pencil size={13} /></button>
                        <button className="lj-icon-btn" onClick={() => onDelete(t.id)}><Trash2 size={13} /></button>
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}
    </div>
  );
}

function DayTradesModal({ date, trades, onClose, onEditTrade, onViewShot }) {
  const dayPnl = trades.reduce((s, t) => s + t.pnl, 0);
  return (
    <div style={{
      position: "fixed", inset: 0, background: "rgba(0,0,0,0.6)", display: "flex",
      alignItems: "center", justifyContent: "center", zIndex: 55, padding: 20,
    }} onClick={(e) => { if (e.target === e.currentTarget) onClose(); }}>
      <div style={{
        background: COLORS.surface, border: `1px solid ${COLORS.border}`, borderRadius: 12,
        width: 480, maxWidth: "100%", maxHeight: "82vh", overflowY: "auto", padding: 22,
        fontFamily: "'Inter', sans-serif",
      }} className="lj-scroll">
        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start", marginBottom: 16 }}>
          <div>
            <div style={{ fontFamily: "'Space Grotesk', sans-serif", fontSize: 16, fontWeight: 600 }}>{date}</div>
            <div style={{ fontSize: 12, color: trades.length ? (dayPnl >= 0 ? COLORS.profit : COLORS.loss) : COLORS.textFaint, fontFamily: "'IBM Plex Mono', monospace", marginTop: 3 }}>
              {trades.length ? `${fmtMoney(dayPnl)} · ${trades.length} trade${trades.length === 1 ? "" : "s"}` : "No trades logged"}
            </div>
          </div>
          <button className="lj-icon-btn" onClick={onClose}><X size={18} /></button>
        </div>

        {trades.length === 0 ? (
          <div style={{ fontSize: 13, color: COLORS.textDim, textAlign: "center", padding: "24px 0" }}>Nothing logged on this day.</div>
        ) : (
          <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
            {trades.map((t) => (
              <div
                key={t.id}
                onClick={() => onEditTrade(t)}
                style={{
                  background: COLORS.surfaceAlt, border: `1px solid ${COLORS.border}`, borderRadius: 8,
                  padding: "12px 14px", cursor: "pointer",
                }}
              >
                <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between" }}>
                  <div style={{ display: "flex", alignItems: "center", gap: 9, fontFamily: "'IBM Plex Mono', monospace", fontSize: 13 }}>
                    <span style={{ fontWeight: 700 }}>{t.symbol}</span>
                    <span style={{ color: t.direction === "long" ? COLORS.profit : COLORS.loss, fontSize: 10.5, textTransform: "uppercase" }}>{t.direction}</span>
                    <span style={{ color: COLORS.textFaint, fontSize: 11.5 }}>{t.entry} → {t.exit} × {t.size}</span>
                  </div>
                  <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
                    {t.hasShot && (
                      <button className="lj-icon-btn" onClick={(e) => { e.stopPropagation(); onViewShot(t.id); }} title="View screenshot"><Camera size={13} /></button>
                    )}
                    <span style={{ fontFamily: "'IBM Plex Mono', monospace", fontWeight: 700, fontSize: 13, color: t.pnl >= 0 ? COLORS.profit : COLORS.loss }}>{fmtMoney(t.pnl)}</span>
                  </div>
                </div>
                {t.confluences && (
                  <div style={{ marginTop: 6 }}>
                    {t.confluences.split(",").filter(Boolean).map((tag, i) => (
                      <span key={i} className="lj-tag">{tag.trim()}</span>
                    ))}
                  </div>
                )}
                {t.notes && (
                  <div style={{ fontSize: 12, color: COLORS.textDim, marginTop: 6, lineHeight: 1.5 }}>{t.notes}</div>
                )}
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}

function TradeModal({ initial, onClose, onSave, checklistItems, onAddChecklistItem, onRemoveChecklistItem, confluenceOptions, onAddConfluenceOption, onRemoveConfluenceOption }) {
  const [form, setForm] = useState(() => initial || {
    date: todayStr(), symbol: "", direction: "long", entry: "", exit: "", stopLoss: "", size: "", contractSize: "",
    mood: "", session: "", confluences: "", notes: "", checklist: {},
  });
  const [error, setError] = useState("");
  const [screenshot, setScreenshot] = useState(null);
  const [shotLoading, setShotLoading] = useState(!!(initial && initial.hasShot));
  const [shotLoadFailed, setShotLoadFailed] = useState(false);
  const [screenshotTouched, setScreenshotTouched] = useState(false);
  const [uploading, setUploading] = useState(false);
  const [enlarged, setEnlarged] = useState(false);
  const [newChecklistItem, setNewChecklistItem] = useState("");
  const [newConfluence, setNewConfluence] = useState("");
  const [sizeInfoOpen, setSizeInfoOpen] = useState(false);
  const [contractPreset, setContractPreset] = useState(() => {
    const cs = initial && initial.contractSize;
    if (!cs || cs === "1") return "units";
    if (cs === "100") return "gold";
    if (cs === "100000") return "forex";
    return cs ? "custom" : "units";
  });

  const handleContractPresetChange = (val) => {
    setContractPreset(val);
    if (val === "units") set("contractSize", "1");
    else if (val === "gold") set("contractSize", "100");
    else if (val === "forex") set("contractSize", "100000");
  };

  useEffect(() => {
    let cancelled = false;
    if (initial && initial.hasShot) {
      (async () => {
        try {
          const res = await window.storage.get(`shot:${initial.id}`, false);
          if (!cancelled) {
            if (res && res.value) setScreenshot(res.value);
            else setShotLoadFailed(true);
          }
        } catch (e) {
          if (!cancelled) setShotLoadFailed(true);
        } finally {
          if (!cancelled) setShotLoading(false);
        }
      })();
    }
    return () => { cancelled = true; };
  }, [initial]);

  const set = (k, v) => setForm((f) => ({ ...f, [k]: v }));

  const toggleChecklistItem = (text) => {
    setForm((f) => ({ ...f, checklist: { ...(f.checklist || {}), [text]: !(f.checklist || {})[text] } }));
  };

  const selectedConfluences = (form.confluences || "").split(",").map((s) => s.trim()).filter(Boolean);

  const toggleConfluence = (text) => {
    setForm((f) => {
      const current = (f.confluences || "").split(",").map((s) => s.trim()).filter(Boolean);
      const next = current.includes(text) ? current.filter((c) => c !== text) : [...current, text];
      return { ...f, confluences: next.join(", ") };
    });
  };

  const handleFile = async (e) => {
    const file = e.target.files && e.target.files[0];
    if (!file) return;
    setUploading(true);
    try {
      const dataUrl = await resizeImage(file);
      setScreenshot(dataUrl);
      setScreenshotTouched(true);
      setShotLoadFailed(false);
    } catch (err) {
      setError("Couldn't process that image.");
    } finally {
      setUploading(false);
      e.target.value = "";
    }
  };

  const removeScreenshot = () => {
    setScreenshot(null);
    setScreenshotTouched(true);
    setShotLoadFailed(false);
  };

  const submit = () => {
    if (!form.date || !form.symbol || form.entry === "" || form.exit === "" || form.size === "") {
      setError("Fill in date, symbol, entry, exit, and size.");
      return;
    }
    // Only pass a screenshot value when the user actually added or removed one —
    // otherwise pass undefined so an existing screenshot that failed to preload isn't wiped out.
    onSave({ ...form, symbol: form.symbol.toUpperCase().trim() }, screenshotTouched ? screenshot : undefined);
  };

  const previewPnl = computePnl(form);
  const previewRisk = computeRiskAmount(form);
  const previewR = computeRMultiple(form, previewPnl);

  return (
    <div style={{
      position: "fixed", inset: 0, background: "rgba(0,0,0,0.6)", display: "flex",
      alignItems: "center", justifyContent: "center", zIndex: 50, padding: 20,
    }} onClick={(e) => { if (e.target === e.currentTarget) onClose(); }}>
      <div style={{
        background: COLORS.surface, border: `1px solid ${COLORS.border}`, borderRadius: 12,
        width: 560, maxWidth: "100%", maxHeight: "88vh", overflowY: "auto", padding: 24,
        fontFamily: "'Inter', sans-serif",
      }} className="lj-scroll">
        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 18 }}>
          <div style={{ fontFamily: "'Space Grotesk', sans-serif", fontSize: 17, fontWeight: 600 }}>
            {initial ? "Edit trade" : "Log a trade"}
          </div>
          <button className="lj-icon-btn" onClick={onClose}><X size={18} /></button>
        </div>

        <div className="lj-two-col" style={{ marginBottom: 14 }}>
          <div>
            <label className="lj-label">Date</label>
            <input type="date" className="lj-input" value={form.date} onChange={(e) => set("date", e.target.value)} />
          </div>
          <div>
            <label className="lj-label">Symbol</label>
            <input
              type="text" className="lj-input" placeholder="AAPL" value={form.symbol}
              onChange={(e) => {
                const val = e.target.value;
                set("symbol", val);
                const detected = detectContractPreset(val);
                if (detected) handleContractPresetChange(detected);
              }}
              style={{ textTransform: "uppercase" }}
            />
          </div>
        </div>

        <div style={{ marginBottom: 14 }}>
          <label className="lj-label">Direction</label>
          <div style={{ display: "flex", gap: 8 }}>
            {["long", "short"].map((d) => (
              <button
                key={d}
                onClick={() => set("direction", d)}
                style={{
                  flex: 1, padding: "9px 0", borderRadius: 7, cursor: "pointer",
                  border: `1px solid ${form.direction === d ? (d === "long" ? COLORS.profit : COLORS.loss) : COLORS.border}`,
                  background: form.direction === d ? (d === "long" ? COLORS.profitDim : COLORS.lossDim) : "transparent",
                  color: form.direction === d ? (d === "long" ? COLORS.profit : COLORS.loss) : COLORS.textDim,
                  fontFamily: "'Inter', sans-serif", fontWeight: 600, fontSize: 12.5, textTransform: "capitalize",
                }}
              >
                {d === "long" ? <TrendingUp size={13} style={{ verticalAlign: -2, marginRight: 5 }} /> : <TrendingDown size={13} style={{ verticalAlign: -2, marginRight: 5 }} />}
                {d}
              </button>
            ))}
          </div>
        </div>

        <div className="lj-price-grid" style={{ marginBottom: 6 }}>
          <div>
            <label className="lj-label">Entry price</label>
            <input type="number" step="any" className="lj-input" placeholder="0.00" value={form.entry} onChange={(e) => set("entry", e.target.value)} />
          </div>
          <div>
            <label className="lj-label">Exit price</label>
            <input type="number" step="any" className="lj-input" placeholder="0.00" value={form.exit} onChange={(e) => set("exit", e.target.value)} />
          </div>
          <div>
            <label className="lj-label">Stop loss</label>
            <input type="number" step="any" className="lj-input" placeholder="0.00" value={form.stopLoss} onChange={(e) => set("stopLoss", e.target.value)} />
          </div>
          <div>
            <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: 6 }}>
              <label className="lj-label" style={{ marginBottom: 0 }}>Size</label>
              <button
                type="button"
                onClick={() => setSizeInfoOpen((o) => !o)}
                style={{ background: "none", border: "none", color: COLORS.textFaint, cursor: "pointer", padding: 0, display: "flex", alignItems: "center" }}
                title="How is size counted?"
              >
                <Info size={13} />
              </button>
            </div>
            <input type="number" step="any" className="lj-input" placeholder="100" value={form.size} onChange={(e) => set("size", e.target.value)} />
          </div>
        </div>

        {sizeInfoOpen && (
          <div style={{ background: COLORS.surfaceAlt, border: `1px solid ${COLORS.borderSoft}`, borderRadius: 8, padding: "12px 14px", marginBottom: 14 }}>
            <div style={{ fontSize: 11.5, color: COLORS.textDim, lineHeight: 1.5, marginBottom: 10 }}>
              Your size is multiplied by a contract size based on the instrument — <strong style={{ color: COLORS.text }}>forex pairs ×100,000</strong> per lot, <strong style={{ color: COLORS.text }}>gold/silver ×100</strong> per lot, <strong style={{ color: COLORS.text }}>stocks/crypto/futures ×1</strong>. We auto-detect this from your symbol — adjust it below if it guessed wrong.
            </div>
            <div style={{ marginBottom: 8 }}>
              <label className="lj-label">What does your size represent?</label>
              <select className="lj-select" value={contractPreset} onChange={(e) => handleContractPresetChange(e.target.value)} style={{ fontFamily: "'Inter', sans-serif" }}>
                <option value="units">Shares, contracts, or raw units (×1) — most stocks, crypto, futures</option>
                <option value="gold">Gold / Silver lots (100 oz per 1.0 lot)</option>
                <option value="forex">Standard forex lot (100,000 units per 1.0 lot)</option>
                <option value="custom">Something else / not sure</option>
              </select>
            </div>
            {contractPreset === "custom" && (
              <div style={{ fontSize: 11.5, color: COLORS.textDim, marginBottom: 10, lineHeight: 1.5 }}>
                In MT5: right-click the symbol in Market Watch → <strong style={{ color: COLORS.text }}>Specification</strong> → look for "Contract size." Enter that number below.
              </div>
            )}
            <label className="lj-label">Contract size (units per 1.0 of size)</label>
            <input type="number" step="any" className="lj-input" placeholder="1" value={form.contractSize} onChange={(e) => { set("contractSize", e.target.value); setContractPreset("custom"); }} />
          </div>
        )}

        {previewRisk !== null && (
          <div style={{ fontSize: 11.5, color: COLORS.textFaint, marginBottom: 14, fontFamily: "'IBM Plex Mono', monospace" }}>
            Risk: {fmtMoney(previewRisk)} · R-multiple: <span style={{ color: previewR >= 0 ? COLORS.profit : COLORS.loss, fontWeight: 600 }}>{fmtR(previewR)}</span>
          </div>
        )}
        {previewRisk === null && <div style={{ marginBottom: 14 }} />}

        <div className="lj-two-col" style={{ marginBottom: 14 }}>
          <div>
            <label className="lj-label">Mood / psychology</label>
            <select className="lj-select" value={form.mood} onChange={(e) => set("mood", e.target.value)} style={{ fontFamily: "'Inter', sans-serif" }}>
              <option value="">No mood set</option>
              {MOODS.map((m) => (
                <option key={m} value={m}>{m}</option>
              ))}
            </select>
          </div>
          <div>
            <label className="lj-label">Trading session</label>
            <select className="lj-select" value={form.session} onChange={(e) => set("session", e.target.value)} style={{ fontFamily: "'Inter', sans-serif" }}>
              <option value="">No session set</option>
              {SESSIONS.map((s) => (
                <option key={s} value={s}>{s}</option>
              ))}
            </select>
          </div>
        </div>

        <div style={{ marginBottom: 14 }}>
          <label className="lj-label">Confluences</label>
          {(confluenceOptions || []).length === 0 ? (
            <div style={{ fontSize: 12, color: COLORS.textFaint, marginBottom: 8 }}>No confluences added yet for this account — add the ones you use below.</div>
          ) : (
            <div style={{ display: "flex", flexWrap: "wrap", gap: 7, marginBottom: 10 }}>
              {confluenceOptions.map((opt) => {
                const active = selectedConfluences.includes(opt.text);
                return (
                  <button
                    key={opt.id}
                    type="button"
                    onClick={() => toggleConfluence(opt.text)}
                    style={{
                      display: "flex", alignItems: "center", gap: 6, padding: "6px 11px", borderRadius: 999,
                      border: `1px solid ${active ? COLORS.gold : COLORS.border}`,
                      background: active ? `${COLORS.gold}1F` : "transparent",
                      color: active ? COLORS.gold : COLORS.textDim,
                      fontSize: 12, fontWeight: 500, cursor: "pointer", fontFamily: "'Inter', sans-serif",
                    }}
                  >
                    {active && <Check size={11} />}
                    {opt.text}
                    <span
                      onClick={(e) => { e.stopPropagation(); onRemoveConfluenceOption(opt.id); }}
                      style={{ display: "flex", color: COLORS.textFaint, marginLeft: 2 }}
                      title="Remove from list"
                    >
                      <X size={11} />
                    </span>
                  </button>
                );
              })}
            </div>
          )}
          <div style={{ display: "flex", gap: 8 }}>
            <input
              type="text" className="lj-input" placeholder="Add a confluence (e.g. breakout, support bounce)…" value={newConfluence}
              onChange={(e) => setNewConfluence(e.target.value)}
              onKeyDown={(e) => { if (e.key === "Enter" && newConfluence.trim()) { onAddConfluenceOption(newConfluence); toggleConfluence(newConfluence.trim()); setNewConfluence(""); } }}
              style={{ fontFamily: "'Inter', sans-serif" }}
            />
            <button
              className="lj-btn-ghost"
              onClick={() => { if (newConfluence.trim()) { onAddConfluenceOption(newConfluence); toggleConfluence(newConfluence.trim()); setNewConfluence(""); } }}
            >
              <Plus size={13} />
            </button>
          </div>
        </div>

        <div style={{ marginBottom: 14 }}>
          <label className="lj-label">Pre-trade checklist</label>
          {(checklistItems || []).length === 0 ? (
            <div style={{ fontSize: 12, color: COLORS.textFaint, marginBottom: 8 }}>No checklist items yet for this account — add one below.</div>
          ) : (
            <div style={{ display: "flex", flexDirection: "column", gap: 6, marginBottom: 8 }}>
              {checklistItems.map((item) => {
                const checked = !!(form.checklist && form.checklist[item.text]);
                return (
                  <label key={item.id} style={{ display: "flex", alignItems: "center", gap: 8, fontSize: 12.5, color: checked ? COLORS.text : COLORS.textDim, cursor: "pointer" }}>
                    <input type="checkbox" checked={checked} onChange={() => toggleChecklistItem(item.text)} style={{ accentColor: COLORS.gold, width: 14, height: 14 }} />
                    {item.text}
                  </label>
                );
              })}
            </div>
          )}
          <div style={{ display: "flex", gap: 8 }}>
            <input
              type="text" className="lj-input" placeholder="Add a checklist item…" value={newChecklistItem}
              onChange={(e) => setNewChecklistItem(e.target.value)}
              onKeyDown={(e) => { if (e.key === "Enter" && newChecklistItem.trim()) { onAddChecklistItem(newChecklistItem); setNewChecklistItem(""); } }}
              style={{ fontFamily: "'Inter', sans-serif" }}
            />
            <button
              className="lj-btn-ghost"
              onClick={() => { if (newChecklistItem.trim()) { onAddChecklistItem(newChecklistItem); setNewChecklistItem(""); } }}
            >
              <Plus size={13} />
            </button>
          </div>
        </div>

        <div style={{ marginBottom: 14 }}>
          <label className="lj-label">Journal notes</label>
          <textarea className="lj-textarea" placeholder="What was your thesis? What did you learn?" value={form.notes} onChange={(e) => set("notes", e.target.value)} />
        </div>

        <div style={{ marginBottom: 14 }}>
          <label className="lj-label">Screenshot (optional)</label>
          {shotLoading ? (
            <div style={{ fontSize: 12, color: COLORS.textFaint }}>Loading screenshot…</div>
          ) : screenshot ? (
            <div style={{ position: "relative", display: "inline-block" }}>
              <img
                src={screenshot}
                alt="Trade screenshot"
                onClick={() => setEnlarged(true)}
                style={{ maxWidth: "100%", maxHeight: 220, borderRadius: 8, border: `1px solid ${COLORS.border}`, display: "block", cursor: "zoom-in" }}
              />
              <button
                onClick={removeScreenshot}
                style={{ position: "absolute", top: 6, right: 6, background: "rgba(11,14,20,0.85)", border: `1px solid ${COLORS.border}`, borderRadius: 6, color: COLORS.text, padding: 4, cursor: "pointer", display: "flex" }}
                title="Remove screenshot"
              >
                <X size={13} />
              </button>
            </div>
          ) : (
            <label style={{
              display: "flex", alignItems: "center", justifyContent: "center", gap: 8, border: `1px dashed ${COLORS.border}`,
              borderRadius: 8, padding: "18px 0", cursor: "pointer", color: COLORS.textDim, fontSize: 12.5,
            }}>
              <ImagePlus size={16} />
              {uploading ? "Processing…" : "Click to upload a chart screenshot"}
              <input type="file" accept="image/*" onChange={handleFile} style={{ display: "none" }} disabled={uploading} />
            </label>
          )}
          {shotLoadFailed && (
            <div style={{ fontSize: 11, color: COLORS.textFaint, marginTop: 6, lineHeight: 1.4 }}>
              Couldn't preload the existing screenshot for preview, but it's still saved and won't be touched unless you upload or remove one here.
            </div>
          )}
        </div>


        <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", paddingTop: 6, borderTop: `1px solid ${COLORS.borderSoft}` }}>
          <div style={{ fontSize: 12.5, color: COLORS.textDim }}>
            Est. P&L: <span style={{ fontFamily: "'IBM Plex Mono', monospace", fontWeight: 600, color: previewPnl >= 0 ? COLORS.profit : COLORS.loss }}>{fmtMoney(isNaN(previewPnl) ? 0 : previewPnl)}</span>
          </div>
          <div style={{ display: "flex", gap: 8 }}>
            <button className="lj-btn-ghost" onClick={onClose}>Cancel</button>
            <button className="lj-btn-primary" onClick={submit}>{initial ? "Save changes" : "Log trade"}</button>
          </div>
        </div>
        {error && <div style={{ color: COLORS.loss, fontSize: 12, marginTop: 10 }}>{error}</div>}
      </div>

      {enlarged && screenshot && (
        <div
          style={{ position: "fixed", inset: 0, background: "rgba(0,0,0,0.85)", display: "flex", alignItems: "center", justifyContent: "center", zIndex: 80, padding: 24 }}
          onClick={() => setEnlarged(false)}
        >
          <button className="lj-icon-btn" onClick={() => setEnlarged(false)} style={{ position: "absolute", top: 20, right: 20, color: COLORS.text }}>
            <X size={20} />
          </button>
          <img src={screenshot} alt="Trade screenshot" style={{ maxWidth: "90vw", maxHeight: "88vh", borderRadius: 10, border: `1px solid ${COLORS.border}` }} onClick={(e) => e.stopPropagation()} />
        </div>
      )}
    </div>
  );
}

function ScreenshotLightbox({ id, onClose }) {
  const [src, setSrc] = useState(null);
  const [error, setError] = useState(false);

  useEffect(() => {
    let cancelled = false;
    (async () => {
      try {
        const res = await window.storage.get(`shot:${id}`, false);
        if (!cancelled) {
          if (res && res.value) setSrc(res.value);
          else setError(true);
        }
      } catch (e) {
        if (!cancelled) setError(true);
      }
    })();
    return () => { cancelled = true; };
  }, [id]);

  return (
    <div style={{
      position: "fixed", inset: 0, background: "rgba(0,0,0,0.82)", display: "flex",
      alignItems: "center", justifyContent: "center", zIndex: 70, padding: 24,
    }} onClick={onClose}>
      <button className="lj-icon-btn" onClick={onClose} style={{ position: "absolute", top: 20, right: 20, color: COLORS.text }}>
        <X size={20} />
      </button>
      {error ? (
        <div style={{ color: COLORS.textDim, fontFamily: "'Inter', sans-serif" }}>Couldn't load this screenshot.</div>
      ) : src ? (
        <img src={src} alt="Trade screenshot" style={{ maxWidth: "90vw", maxHeight: "88vh", borderRadius: 10, border: `1px solid ${COLORS.border}` }} onClick={(e) => e.stopPropagation()} />
      ) : (
        <div style={{ color: COLORS.textDim, fontFamily: "'Inter', sans-serif" }}>Loading…</div>
      )}
    </div>
  );
}

function addToGroup(obj, key, pnl, isWin) {
  if (!obj[key]) obj[key] = { pnl: 0, count: 0, wins: 0 };
  obj[key].pnl += pnl;
  obj[key].count += 1;
  if (isWin) obj[key].wins += 1;
}

function groupToArray(obj) {
  return Object.entries(obj).map(([label, v]) => ({
    label, count: v.count, winRate: v.count ? (v.wins / v.count) * 100 : 0, pnl: v.pnl,
  })).sort((a, b) => b.pnl - a.pnl);
}

// Deterministic, rule-based insights computed straight from trade data —
// no AI/network call needed, so this always works regardless of API keys.
function generateInsights(enriched) {
  const insights = [];
  if (enriched.length < 3) return insights;

  const MIN_N = 3;
  const dowNames = ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"];
  const bySession = {}, byMood = {}, byConfluence = {}, byDow = {};

  enriched.forEach((t) => {
    const isWin = t.pnl > 0;
    if (t.session) addToGroup(bySession, t.session, t.pnl, isWin);
    if (t.mood) addToGroup(byMood, t.mood, t.pnl, isWin);
    (t.confluences || "").split(",").map((s) => s.trim()).filter(Boolean).forEach((c) => addToGroup(byConfluence, c, t.pnl, isWin));
    addToGroup(byDow, dowNames[new Date(t.date + "T00:00:00").getDay()], t.pnl, isWin);
  });

  const bestWorst = (map, label) => {
    const arr = Object.entries(map)
      .filter(([, v]) => v.count >= MIN_N)
      .map(([k, v]) => ({ label: k, ...v, winRate: v.count ? (v.wins / v.count) * 100 : 0 }))
      .sort((a, b) => b.pnl - a.pnl);
    if (!arr.length) return;
    const best = arr[0], worst = arr[arr.length - 1];
    if (best.pnl > 0) {
      insights.push({ type: "good", text: `Best ${label}: ${best.label} — ${fmtMoney(best.pnl)} over ${best.count} trades (${best.winRate.toFixed(0)}% win rate).` });
    }
    if (worst.pnl < 0 && worst.label !== best.label) {
      insights.push({ type: "bad", text: `Worst ${label}: ${worst.label} — ${fmtMoney(worst.pnl)} over ${worst.count} trades (${worst.winRate.toFixed(0)}% win rate).` });
    }
  };

  bestWorst(bySession, "session");
  bestWorst(byMood, "mood");
  bestWorst(byConfluence, "confluence");
  bestWorst(byDow, "day of week");

  const withChecklist = enriched.filter((t) => checklistScore(t.checklist) !== null);
  const high = withChecklist.filter((t) => checklistScore(t.checklist) >= 0.75);
  const low = withChecklist.filter((t) => checklistScore(t.checklist) < 0.5);
  if (high.length >= 3 && low.length >= 3) {
    const highWinRate = (high.filter((t) => t.pnl > 0).length / high.length) * 100;
    const lowWinRate = (low.filter((t) => t.pnl > 0).length / low.length) * 100;
    if (Math.abs(highWinRate - lowWinRate) >= 8) {
      insights.push({
        type: highWinRate > lowWinRate ? "good" : "neutral",
        text: `Trades where you followed 75%+ of your checklist win ${highWinRate.toFixed(0)}% of the time, vs ${lowWinRate.toFixed(0)}% when you followed under half of it.`,
      });
    }
  }

  const rValues = enriched.map((t) => t.rMultiple).filter((r) => r !== null && r !== undefined && !isNaN(r));
  if (rValues.length >= 5) {
    const avgR = rValues.reduce((s, r) => s + r, 0) / rValues.length;
    insights.push({ type: avgR >= 0 ? "good" : "bad", text: `Average R-multiple across ${rValues.length} trades with a stop loss set: ${fmtR(avgR)}.` });
  }

  const wins = enriched.filter((t) => t.pnl > 0).length;
  const winRate = (wins / enriched.length) * 100;
  const avgWin = wins ? enriched.filter((t) => t.pnl > 0).reduce((s, t) => s + t.pnl, 0) / wins : 0;
  const lossesN = enriched.length - wins;
  const avgLoss = lossesN ? enriched.filter((t) => t.pnl <= 0).reduce((s, t) => s + t.pnl, 0) / lossesN : 0;
  if (wins > 0 && lossesN > 0) {
    const ratio = Math.abs(avgWin / avgLoss);
    insights.push({
      type: ratio >= 1.3 ? "good" : ratio < 0.8 ? "bad" : "neutral",
      text: `Average win is ${fmtMoney(avgWin)}, average loss is ${fmtMoney(avgLoss)} (${ratio.toFixed(2)}:1) at a ${winRate.toFixed(0)}% win rate.`,
    });
  }

  return insights;
}

// Deterministic weekly report: week totals, best/worst trade, a day-by-day
// summary, and what-worked / what-didn't-work findings (plus recommendations
// derived from them) scoped to just that week's trades. No AI/network call.
function generateWeeklyReport(enriched, weekKey) {
  const weekTrades = enriched.filter((t) => weekKeyFor(t.date) === weekKey).sort((a, b) => (a.date < b.date ? -1 : 1));
  const weekPnl = weekTrades.reduce((s, t) => s + t.pnl, 0);
  const tradeCount = weekTrades.length;

  let bestTrade = null, worstTrade = null;
  weekTrades.forEach((t) => {
    if (!bestTrade || t.pnl > bestTrade.pnl) bestTrade = t;
    if (!worstTrade || t.pnl < worstTrade.pnl) worstTrade = t;
  });

  const dowNames = ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"];
  const sunday = new Date(weekKey + "T00:00:00");
  const dailySummary = [];
  for (let i = 0; i < 7; i++) {
    const d = new Date(sunday);
    d.setDate(sunday.getDate() + i);
    const dateStr = d.toISOString().slice(0, 10);
    const dayTrades = weekTrades.filter((t) => t.date === dateStr);
    dailySummary.push({
      date: dateStr, dayLabel: dowNames[i],
      pnl: dayTrades.reduce((s, t) => s + t.pnl, 0), count: dayTrades.length,
    });
  }

  const bySession = {}, byMood = {}, byConfluence = {};
  weekTrades.forEach((t) => {
    const isWin = t.pnl > 0;
    if (t.session) addToGroup(bySession, t.session, t.pnl, isWin);
    if (t.mood) addToGroup(byMood, t.mood, t.pnl, isWin);
    (t.confluences || "").split(",").map((s) => s.trim()).filter(Boolean).forEach((c) => addToGroup(byConfluence, c, t.pnl, isWin));
  });

  const findings = [];
  const scan = (map, kind) => {
    groupToArray(map).forEach((item) => {
      if (item.pnl > 0) findings.push({ kind, label: item.label, pnl: item.pnl, count: item.count, winRate: item.winRate, sentiment: "good" });
      else if (item.pnl < 0) findings.push({ kind, label: item.label, pnl: item.pnl, count: item.count, winRate: item.winRate, sentiment: "bad" });
    });
  };
  scan(bySession, "session");
  scan(byMood, "mood");
  scan(byConfluence, "confluence");

  const kindLabel = (k) => (k === "session" ? "Session" : k === "mood" ? "Mood" : "Confluence");
  const findingText = (f) => `${kindLabel(f.kind)} "${f.label}" — ${fmtMoney(f.pnl)} over ${f.count} trade${f.count === 1 ? "" : "s"} (${f.winRate.toFixed(0)}% win rate).`;
  const findingRecommendation = (f) => {
    if (f.kind === "mood") return `You lost money while in a "${f.label}" state this week (${fmtMoney(f.pnl)} over ${f.count} trade${f.count === 1 ? "" : "s"}). Consider pausing or stepping away when you notice this mood before entering a trade.`;
    if (f.kind === "session") return `Your ${f.label} session trades lost money this week (${fmtMoney(f.pnl)}, ${f.winRate.toFixed(0)}% win rate). Consider reducing size or avoiding this session until you find the cause.`;
    return `Trades tagged "${f.label}" lost money this week (${fmtMoney(f.pnl)} over ${f.count} trade${f.count === 1 ? "" : "s"}). Revisit whether this setup is actually giving you an edge.`;
  };

  const worked = findings.filter((f) => f.sentiment === "good").sort((a, b) => b.pnl - a.pnl).slice(0, 4);
  const didntWork = findings.filter((f) => f.sentiment === "bad").sort((a, b) => a.pnl - b.pnl).slice(0, 4);

  const recommendations = didntWork.map(findingRecommendation);

  const withChecklist = weekTrades.filter((t) => checklistScore(t.checklist) !== null);
  const lowAdherence = withChecklist.filter((t) => checklistScore(t.checklist) < 0.5);
  if (lowAdherence.length >= 2) {
    const lowLosses = lowAdherence.filter((t) => t.pnl < 0).length;
    if (lowLosses / lowAdherence.length >= 0.5) {
      didntWork.push({ kind: "checklist", label: "Low checklist adherence", pnl: lowAdherence.reduce((s, t) => s + t.pnl, 0), count: lowAdherence.length, winRate: ((lowAdherence.length - lowLosses) / lowAdherence.length) * 100 });
      recommendations.push(`${lowAdherence.length} trade${lowAdherence.length === 1 ? "" : "s"} this week followed less than half your checklist, and most were losers. Stick to your full pre-trade checklist before entering.`);
    }
  }

  if (weekPnl < 0 && recommendations.length === 0) {
    recommendations.push("This was a losing week overall, but no single category stands out as the cause yet — keep tagging mood, session, and confluences to get a clearer signal.");
  }

  return {
    weekKey, trades: weekTrades, weekPnl, tradeCount, bestTrade, worstTrade, dailySummary,
    worked: worked.map((f) => ({ text: findingText(f) })),
    didntWork: didntWork.map((f) => ({ text: f.kind === "checklist" ? `Low checklist adherence — ${fmtMoney(f.pnl)} over ${f.count} trade${f.count === 1 ? "" : "s"} (${f.winRate.toFixed(0)}% win rate).` : findingText(f) })),
    recommendations,
  };
}

function BreakdownView({ enriched }) {
  const groups = useMemo(() => {
    const dowNames = ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"];
    const byDow = {};
    const bySymbol = {};
    const byConfluence = {};
    const byMood = {};
    const bySession = {};
    const byChecklist = {};

    enriched.forEach((t) => {
      const isWin = t.pnl > 0;
      const dow = dowNames[new Date(t.date + "T00:00:00").getDay()];
      addToGroup(byDow, dow, t.pnl, isWin);
      addToGroup(bySymbol, t.symbol, t.pnl, isWin);
      (t.confluences || "").split(",").map((s) => s.trim()).filter(Boolean).forEach((tag) => addToGroup(byConfluence, tag, t.pnl, isWin));
      if (t.mood) addToGroup(byMood, t.mood, t.pnl, isWin);
      if (t.session) addToGroup(bySession, t.session, t.pnl, isWin);

      const score = checklistScore(t.checklist);
      let bucket = "No checklist";
      if (score !== null) {
        bucket = score === 1 ? "100%" : score >= 0.75 ? "75–99%" : score >= 0.5 ? "50–74%" : "Under 50%";
      }
      addToGroup(byChecklist, bucket, t.pnl, isWin);
    });

    const dowOrdered = dowNames
      .map((d) => ({ label: d, ...(byDow[d] || { pnl: 0, count: 0, wins: 0 }) }))
      .map((d) => ({ label: d.label, count: d.count, winRate: d.count ? (d.wins / d.count) * 100 : 0, pnl: d.pnl }));

    const sessionOrdered = SESSIONS
      .filter((s) => bySession[s])
      .map((s) => ({ label: s, count: bySession[s].count, winRate: bySession[s].count ? (bySession[s].wins / bySession[s].count) * 100 : 0, pnl: bySession[s].pnl }));

    return {
      dow: dowOrdered,
      symbol: groupToArray(bySymbol),
      confluence: groupToArray(byConfluence),
      mood: groupToArray(byMood),
      session: sessionOrdered,
      checklist: groupToArray(byChecklist),
    };
  }, [enriched]);

  if (enriched.length === 0) {
    return (
      <div>
        <div style={{ fontFamily: "'Space Grotesk', sans-serif", fontSize: 22, fontWeight: 600, marginBottom: 22 }}>Breakdown</div>
        <div style={{ background: COLORS.surface, border: `1px dashed ${COLORS.border}`, borderRadius: 12, padding: "60px 20px", textAlign: "center", color: COLORS.textDim, fontSize: 13 }}>
          Log some trades to see how your edge breaks down by day, symbol, confluence, mood, and checklist adherence.
        </div>
      </div>
    );
  }

  return (
    <div>
      <div style={{ fontFamily: "'Space Grotesk', sans-serif", fontSize: 22, fontWeight: 600, marginBottom: 4 }}>Breakdown</div>
      <div style={{ fontSize: 12.5, color: COLORS.textFaint, marginBottom: 18 }}>Where your edge actually comes from.</div>

      <div className="lj-breakdown-grid">
        <BreakdownGroup title="By day of week" items={groups.dow} />
        <BreakdownGroup title="By symbol" items={groups.symbol} />
        <BreakdownGroup title="By confluence" items={groups.confluence} />
        <BreakdownGroup title="By mood" items={groups.mood} />
        <BreakdownGroup title="By trading session" items={groups.session} />
      </div>
      <div style={{ marginTop: 16 }}>
        <BreakdownGroup title="By checklist adherence" items={groups.checklist} />
      </div>
    </div>
  );
}

function BreakdownGroup({ title, items }) {
  const maxAbs = Math.max(1, ...items.map((i) => Math.abs(i.pnl)));
  return (
    <div style={{ background: COLORS.surface, border: `1px solid ${COLORS.border}`, borderRadius: 10, padding: "16px 18px" }}>
      <div style={{ fontSize: 13, fontWeight: 600, marginBottom: 12 }}>{title}</div>
      {items.length === 0 ? (
        <div style={{ fontSize: 12, color: COLORS.textFaint }}>Not enough data yet.</div>
      ) : (
        items.map((it) => (
          <div key={it.label} style={{ marginBottom: 10 }}>
            <div style={{ display: "flex", justifyContent: "space-between", alignItems: "baseline", fontSize: 12, marginBottom: 4 }}>
              <span style={{ color: COLORS.text, fontFamily: "'IBM Plex Mono', monospace" }}>
                {it.label} <span style={{ color: COLORS.textFaint, fontSize: 10.5 }}>({it.count})</span>
              </span>
              <span style={{ color: it.pnl >= 0 ? COLORS.profit : COLORS.loss, fontWeight: 600, fontFamily: "'IBM Plex Mono', monospace", fontSize: 11.5 }}>
                {fmtMoney(it.pnl)} · {it.winRate.toFixed(0)}%
              </span>
            </div>
            <div style={{ height: 6, borderRadius: 3, background: COLORS.surfaceAlt, overflow: "hidden" }}>
              <div style={{ height: "100%", width: `${(Math.abs(it.pnl) / maxAbs) * 100}%`, background: it.pnl >= 0 ? COLORS.profit : COLORS.loss, borderRadius: 3 }} />
            </div>
          </div>
        ))
      )}
    </div>
  );
}

function DailyNoteCell({ date, initialNote, onSave }) {
  const [value, setValue] = useState(initialNote || "");

  useEffect(() => { setValue(initialNote || ""); }, [initialNote, date]);

  return (
    <input
      type="text"
      value={value}
      onChange={(e) => setValue(e.target.value)}
      onBlur={() => { if (value !== (initialNote || "")) onSave(date, value); }}
      onKeyDown={(e) => { if (e.key === "Enter") e.target.blur(); }}
      placeholder="Add a note…"
      style={{
        width: "100%", background: "transparent", border: "none", outline: "none",
        color: COLORS.textDim, fontSize: 12, fontFamily: "'Inter', sans-serif", padding: "2px 0",
      }}
    />
  );
}

function AnalysisView({ enriched, accountName, dailyNotes, onSaveDailyNote }) {
  const insights = useMemo(() => generateInsights(enriched), [enriched]);

  const [reportWeekKey, setReportWeekKey] = useState(() => weekKeyFor(todayStr()));
  const report = useMemo(() => generateWeeklyReport(enriched, reportWeekKey), [enriched, reportWeekKey]);

  const shiftWeek = (delta) => {
    const d = new Date(reportWeekKey + "T00:00:00");
    d.setDate(d.getDate() + delta * 7);
    setReportWeekKey(d.toISOString().slice(0, 10));
  };

  const weekLabel = useMemo(() => {
    const start = new Date(reportWeekKey + "T00:00:00");
    const end = new Date(start);
    end.setDate(end.getDate() + 6);
    const fmt = (d) => `${MONTHS[d.getMonth()].slice(0, 3)} ${d.getDate()}`;
    return `${fmt(start)} – ${fmt(end)}, ${end.getFullYear()}`;
  }, [reportWeekKey]);

  const fmtMonthDay = (dateStr) => {
    const d = new Date(dateStr + "T00:00:00");
    return `${MONTHS[d.getMonth()].slice(0, 3)}-${String(d.getDate()).padStart(2, "0")}`;
  };

  const noteForDate = (date) => {
    const n = (dailyNotes || []).find((n) => n.date === date);
    return n ? n.note : "";
  };

  return (
    <div>
      <div style={{ fontFamily: "'Space Grotesk', sans-serif", fontSize: 22, fontWeight: 600, marginBottom: 4 }}>Analysis</div>
      <div style={{ fontSize: 12.5, color: COLORS.textFaint, marginBottom: 18 }}>Automatic insights from your trades — {accountName}.</div>

      <div style={{ background: COLORS.surface, border: `1px solid ${COLORS.border}`, borderRadius: 10, padding: "18px 20px", marginBottom: 18 }}>
        <div style={{ fontSize: 12.5, fontWeight: 600, color: COLORS.textDim, marginBottom: 4 }}>Automatic insights</div>
        <div style={{ fontSize: 11, color: COLORS.textFaint, marginBottom: 16 }}>Computed instantly from your trade data.</div>
        {insights.length === 0 ? (
          <div style={{ fontSize: 12.5, color: COLORS.textDim }}>
            {enriched.length === 0 ? "Log a few trades to see patterns here." : "Not enough data yet in any single category (need at least 3 trades tagged the same way) — keep logging and check back."}
          </div>
        ) : (
          <div style={{ display: "flex", flexDirection: "column", gap: 10 }}>
            {insights.map((ins, i) => (
              <div key={i} style={{ display: "flex", gap: 8, alignItems: "flex-start", fontSize: 13, lineHeight: 1.55 }}>
                <span style={{ color: ins.type === "good" ? COLORS.profit : ins.type === "bad" ? COLORS.loss : COLORS.amber, flexShrink: 0, marginTop: 1 }}>
                  {ins.type === "good" ? "▲" : ins.type === "bad" ? "▼" : "●"}
                </span>
                <span style={{ color: COLORS.textDim }}>{ins.text}</span>
              </div>
            ))}
          </div>
        )}
      </div>

      <div style={{ background: COLORS.surface, border: `1px solid ${COLORS.border}`, borderRadius: 10, padding: "18px 20px" }}>
        <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: 4 }}>
          <div style={{ fontSize: 12.5, fontWeight: 600, color: COLORS.textDim }}>Weekly report</div>
          <div style={{ display: "flex", alignItems: "center", gap: 4 }}>
            <span style={{ fontSize: 11.5, color: COLORS.textFaint, fontFamily: "'IBM Plex Mono', monospace", marginRight: 6 }}>{weekLabel}</span>
            <button className="lj-icon-btn" onClick={() => shiftWeek(-1)}><ChevronLeft size={15} /></button>
            <button className="lj-icon-btn" onClick={() => shiftWeek(1)}><ChevronRight size={15} /></button>
          </div>
        </div>
        <div style={{ fontSize: 11, color: COLORS.textFaint, marginBottom: 18 }}>What worked, what didn't, and how to fix it — for this week only.</div>

        <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(140px, 1fr))", gap: 12, marginBottom: 20 }}>
          <StatCard icon={TrendingUp} label="Week P&L" value={fmtMoney(report.weekPnl)} valueColor={report.weekPnl >= 0 ? COLORS.profit : COLORS.loss} />
          <StatCard icon={NotebookText} label="Total trades" value={report.tradeCount} />
          <StatCard
            icon={TrendingUp}
            label="Best trade"
            value={report.bestTrade ? fmtMoneyShort(report.bestTrade.pnl) : "—"}
            valueColor={report.bestTrade && report.bestTrade.pnl > 0 ? COLORS.profit : COLORS.text}
            sub={report.bestTrade ? `${report.bestTrade.symbol} · ${report.bestTrade.date}` : ""}
          />
          <StatCard
            icon={TrendingDown}
            label="Worst trade"
            value={report.worstTrade ? fmtMoneyShort(report.worstTrade.pnl) : "—"}
            valueColor={report.worstTrade && report.worstTrade.pnl < 0 ? COLORS.loss : COLORS.text}
            sub={report.worstTrade ? `${report.worstTrade.symbol} · ${report.worstTrade.date}` : ""}
          />
        </div>

        <div style={{ fontSize: 12, fontWeight: 600, color: COLORS.textDim, marginBottom: 10 }}>Daily summary</div>
        <div style={{ marginBottom: 22, border: "1px solid transparent", borderRadius: 8, overflow: "hidden" }}>
          <table style={{ width: "100%", borderCollapse: "collapse", fontSize: 12.5 }}>
            <thead>
              <tr style={{ background: COLORS.surfaceAlt }}>
                <th style={{ textAlign: "left", padding: "8px 12px", fontSize: 10.5, fontWeight: 600, color: COLORS.textFaint, textTransform: "uppercase", letterSpacing: ".04em" }}>Date</th>
                <th style={{ textAlign: "right", padding: "8px 12px", fontSize: 10.5, fontWeight: 600, color: COLORS.textFaint, textTransform: "uppercase", letterSpacing: ".04em" }}>Total Trades</th>
                <th style={{ textAlign: "right", padding: "8px 12px", fontSize: 10.5, fontWeight: 600, color: COLORS.textFaint, textTransform: "uppercase", letterSpacing: ".04em" }}>Net P&amp;L</th>
                <th style={{ textAlign: "left", padding: "8px 12px", fontSize: 10.5, fontWeight: 600, color: COLORS.textFaint, textTransform: "uppercase", letterSpacing: ".04em" }}>Note</th>
              </tr>
            </thead>
            <tbody>
              {report.dailySummary.map((d) => (
                <tr key={d.date} style={{ borderTop: "1px solid transparent" }}>
                  <td style={{ padding: "8px 12px", fontFamily: "'IBM Plex Mono', monospace", color: COLORS.textDim, whiteSpace: "nowrap" }}>{fmtMonthDay(d.date)}</td>
                  <td style={{ padding: "8px 12px", textAlign: "right", fontFamily: "'IBM Plex Mono', monospace", color: d.count > 0 ? COLORS.textDim : COLORS.textFaint }}>{d.count}</td>
                  <td style={{ padding: "8px 12px", textAlign: "right", fontFamily: "'IBM Plex Mono', monospace", fontWeight: 600, color: d.count > 0 ? (d.pnl >= 0 ? COLORS.profit : COLORS.loss) : COLORS.textFaint }}>
                    {d.count > 0 ? fmtMoney(d.pnl) : "—"}
                  </td>
                  <td style={{ padding: "4px 12px" }}>
                    <DailyNoteCell date={d.date} initialNote={noteForDate(d.date)} onSave={onSaveDailyNote} />
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>

        {report.tradeCount === 0 ? (
          <div style={{ fontSize: 12.5, color: COLORS.textDim }}>No trades logged this week.</div>
        ) : (
          <>
            <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(240px, 1fr))", gap: 20, marginBottom: 20 }}>
              <div>
                <div style={{ fontSize: 12, fontWeight: 600, color: COLORS.textDim, marginBottom: 10 }}>What worked</div>
                {report.worked.length === 0 ? (
                  <div style={{ fontSize: 12, color: COLORS.textFaint }}>Nothing stood out as clearly positive this week.</div>
                ) : (
                  <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
                    {report.worked.map((w, i) => (
                      <div key={i} style={{ display: "flex", gap: 8, alignItems: "flex-start", fontSize: 12.5, lineHeight: 1.5 }}>
                        <span style={{ color: COLORS.profit, flexShrink: 0, marginTop: 1 }}>▲</span>
                        <span style={{ color: COLORS.textDim }}>{w.text}</span>
                      </div>
                    ))}
                  </div>
                )}
              </div>
              <div>
                <div style={{ fontSize: 12, fontWeight: 600, color: COLORS.textDim, marginBottom: 10 }}>What didn't work</div>
                {report.didntWork.length === 0 ? (
                  <div style={{ fontSize: 12, color: COLORS.textFaint }}>Nothing stood out as clearly negative this week.</div>
                ) : (
                  <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
                    {report.didntWork.map((w, i) => (
                      <div key={i} style={{ display: "flex", gap: 8, alignItems: "flex-start", fontSize: 12.5, lineHeight: 1.5 }}>
                        <span style={{ color: COLORS.loss, flexShrink: 0, marginTop: 1 }}>▼</span>
                        <span style={{ color: COLORS.textDim }}>{w.text}</span>
                      </div>
                    ))}
                  </div>
                )}
              </div>
            </div>

            {report.recommendations.length > 0 && (
              <div style={{ background: COLORS.surfaceAlt, border: `1px solid ${COLORS.borderSoft}`, borderRadius: 8, padding: "14px 16px" }}>
                <div style={{ fontSize: 12, fontWeight: 600, color: COLORS.text, marginBottom: 10 }}>Recommendations</div>
                <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
                  {report.recommendations.map((r, i) => (
                    <div key={i} style={{ display: "flex", gap: 8, alignItems: "flex-start", fontSize: 12.5, lineHeight: 1.55 }}>
                      <span style={{ color: COLORS.amber, flexShrink: 0, marginTop: 1 }}>→</span>
                      <span style={{ color: COLORS.textDim }}>{r}</span>
                    </div>
                  ))}
                </div>
              </div>
            )}
          </>
        )}
      </div>
    </div>
  );
}

function SettingsModal({ account, goals, onSaveGoals, onClose }) {
  const [maxLossDay, setMaxLossDay] = useState(goals.maxLossDay || "");
  const [maxTradesDay, setMaxTradesDay] = useState(goals.maxTradesDay || "");
  const [maxLossWeek, setMaxLossWeek] = useState(goals.maxLossWeek || "");
  const [dailyProfitGoal, setDailyProfitGoal] = useState(goals.dailyProfitGoal || "");
  const [weeklyProfitGoal, setWeeklyProfitGoal] = useState(goals.weeklyProfitGoal || "");
  const [monthlyProfitGoal, setMonthlyProfitGoal] = useState(goals.monthlyProfitGoal || "");

  const saveAndClose = () => {
    onSaveGoals({
      maxLossDay: parseFloat(maxLossDay) || null,
      maxTradesDay: parseInt(maxTradesDay, 10) || null,
      maxLossWeek: parseFloat(maxLossWeek) || null,
      dailyProfitGoal: parseFloat(dailyProfitGoal) || null,
      weeklyProfitGoal: parseFloat(weeklyProfitGoal) || null,
      monthlyProfitGoal: parseFloat(monthlyProfitGoal) || null,
    });
    onClose();
  };

  return (
    <div style={{
      position: "fixed", inset: 0, background: "rgba(0,0,0,0.6)", display: "flex",
      alignItems: "center", justifyContent: "center", zIndex: 65, padding: 20,
    }} onClick={(e) => { if (e.target === e.currentTarget) onClose(); }}>
      <div style={{
        background: COLORS.surface, border: `1px solid ${COLORS.border}`, borderRadius: 12,
        width: 500, maxWidth: "100%", maxHeight: "86vh", overflowY: "auto", padding: 24,
        fontFamily: "'Inter', sans-serif",
      }} className="lj-scroll">
        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 4 }}>
          <div style={{ fontFamily: "'Space Grotesk', sans-serif", fontSize: 17, fontWeight: 600 }}>Goals &amp; limits</div>
          <button className="lj-icon-btn" onClick={onClose}><X size={18} /></button>
        </div>
        <div style={{ fontSize: 11.5, color: COLORS.textFaint, marginBottom: 18, fontFamily: "'IBM Plex Mono', monospace" }}>{account}</div>

        <div style={{ marginBottom: 22 }}>
          <div style={{ fontSize: 13, fontWeight: 600, marginBottom: 4 }}>Daily &amp; weekly limits</div>
          <div style={{ fontSize: 11.5, color: COLORS.textFaint, marginBottom: 10 }}>Leave blank for no limit. Shown as guardrails on your dashboard.</div>
          <div className="lj-two-col" style={{ marginBottom: 12 }}>
            <div>
              <label className="lj-label">Max loss per day ($)</label>
              <input type="number" step="any" className="lj-input" placeholder="e.g. 200" value={maxLossDay} onChange={(e) => setMaxLossDay(e.target.value)} />
            </div>
            <div>
              <label className="lj-label">Max trades per day</label>
              <input type="number" step="1" className="lj-input" placeholder="e.g. 5" value={maxTradesDay} onChange={(e) => setMaxTradesDay(e.target.value)} />
            </div>
          </div>
          <div>
            <label className="lj-label">Max loss per week ($)</label>
            <input type="number" step="any" className="lj-input" placeholder="e.g. 600" value={maxLossWeek} onChange={(e) => setMaxLossWeek(e.target.value)} />
          </div>
        </div>

        <div>
          <div style={{ fontSize: 13, fontWeight: 600, marginBottom: 4 }}>Daily, weekly &amp; monthly goals (profit)</div>
          <div style={{ fontSize: 11.5, color: COLORS.textFaint, marginBottom: 10 }}>Leave blank for no target. Shown as progress bars on your dashboard.</div>
          <div className="lj-two-col" style={{ marginBottom: 12 }}>
            <div>
              <label className="lj-label">Daily profit goal ($)</label>
              <input type="number" step="any" className="lj-input" placeholder="e.g. 150" value={dailyProfitGoal} onChange={(e) => setDailyProfitGoal(e.target.value)} />
            </div>
            <div>
              <label className="lj-label">Weekly profit goal ($)</label>
              <input type="number" step="any" className="lj-input" placeholder="e.g. 600" value={weeklyProfitGoal} onChange={(e) => setWeeklyProfitGoal(e.target.value)} />
            </div>
          </div>
          <div>
            <label className="lj-label">Monthly profit goal ($)</label>
            <input type="number" step="any" className="lj-input" placeholder="e.g. 2500" value={monthlyProfitGoal} onChange={(e) => setMonthlyProfitGoal(e.target.value)} />
          </div>
        </div>

        <div style={{ display: "flex", gap: 8, justifyContent: "flex-end", marginTop: 20, paddingTop: 14, borderTop: `1px solid ${COLORS.borderSoft}` }}>
          <button className="lj-btn-ghost" onClick={onClose}>Cancel</button>
          <button className="lj-btn-primary" onClick={saveAndClose}>Save</button>
        </div>
      </div>
    </div>
  );
}

function ConfirmDialog({ title = "Delete this?", message = "This can't be undone.", onCancel, onConfirm }) {
  return (
    <div style={{
      position: "fixed", inset: 0, background: "rgba(0,0,0,0.6)", display: "flex",
      alignItems: "center", justifyContent: "center", zIndex: 60,
    }} onClick={(e) => { if (e.target === e.currentTarget) onCancel(); }}>
      <div style={{ background: COLORS.surface, border: `1px solid ${COLORS.border}`, borderRadius: 12, padding: 22, width: 340, fontFamily: "'Inter', sans-serif" }}>
        <div style={{ fontWeight: 600, fontSize: 14.5, marginBottom: 6 }}>{title}</div>
        <div style={{ fontSize: 12.5, color: COLORS.textDim, marginBottom: 18, lineHeight: 1.5 }}>{message}</div>
        <div style={{ display: "flex", gap: 8, justifyContent: "flex-end" }}>
          <button className="lj-btn-ghost" onClick={onCancel}>Cancel</button>
          <button className="lj-btn-primary" style={{ background: COLORS.loss, color: "#fff" }} onClick={onConfirm}>Delete</button>
        </div>
      </div>
    </div>
  );
}
