import {
  collection, doc, getDoc, getDocs, setDoc, deleteDoc,
  writeBatch, onSnapshot, serverTimestamp,
} from "firebase/firestore";
import { db } from "./firebase";

// Firestore layout:
//   users/{uid}/trades/{tradeId}      — one document per trade (matches the
//                                        "users/{userId}/trades" collection
//                                        you asked for), each tagged with userId.
//   users/{uid}/settings/{key}        — everything else (accounts list,
//                                        goals, checklists, per-account
//                                        settings, screenshots, etc.) as one
//                                        document per key, also tagged with
//                                        userId. This mirrors how the app
//                                        already partitioned its data by key
//                                        under localStorage, just as real
//                                        Firestore docs instead of one blob.
//
// This object implements the same get/set/delete interface the app already
// calls everywhere (window.storage.get/set/delete), so nothing else in
// App.jsx has to change to become Firestore-backed. It also wires up
// onSnapshot listeners and dispatches a "ledger:sync" window event whenever
// data changes remotely (e.g. from another device), which App.jsx listens
// for to reload without a manual refresh.

export function createFirestoreStorage(uid) {
  const tradesCol = collection(db, "users", uid, "trades");
  const settingsCol = collection(db, "users", uid, "settings");

  const notifySync = (key) => {
    window.dispatchEvent(new CustomEvent("ledger:sync", { detail: { key } }));
  };

  async function getTrades() {
    const snap = await getDocs(tradesCol);
    if (snap.empty) return null;
    const trades = snap.docs.map((d) => d.data());
    return { key: "trades", value: JSON.stringify(trades), shared: false };
  }

  async function setTrades(tradesArray) {
    const snap = await getDocs(tradesCol);
    const existingIds = new Set(snap.docs.map((d) => d.id));
    const incomingIds = new Set(tradesArray.map((t) => t.id));

    const batch = writeBatch(db);
    tradesArray.forEach((t) => {
      batch.set(doc(tradesCol, String(t.id)), { ...t, userId: uid, updatedAt: serverTimestamp() });
    });
    existingIds.forEach((id) => {
      if (!incomingIds.has(id)) batch.delete(doc(tradesCol, id));
    });
    await batch.commit();
    return { key: "trades", value: JSON.stringify(tradesArray), shared: false };
  }

  async function getSetting(key) {
    const ref = doc(settingsCol, key);
    const snap = await getDoc(ref);
    if (!snap.exists()) return null;
    const data = snap.data();
    return { key, value: data.value, shared: false };
  }

  async function setSetting(key, value) {
    const ref = doc(settingsCol, key);
    await setDoc(ref, { value, userId: uid, updatedAt: serverTimestamp() });
    return { key, value, shared: false };
  }

  async function deleteSetting(key) {
    const ref = doc(settingsCol, key);
    let existed = false;
    try {
      const snap = await getDoc(ref);
      existed = snap.exists();
    } catch (e) {}
    await deleteDoc(ref);
    return { key, deleted: existed, shared: false };
  }

  const storage = {
    async get(key) {
      if (key === "trades") return getTrades();
      return getSetting(key);
    },
    async set(key, value) {
      if (key === "trades") return setTrades(JSON.parse(value));
      return setSetting(key, value);
    },
    async delete(key) {
      if (key === "trades") return { key, deleted: false, shared: false }; // trades are never bulk-deleted via this path
      return deleteSetting(key);
    },
    async list(prefix) {
      const snap = await getDocs(settingsCol);
      const keys = snap.docs.map((d) => d.id).filter((k) => !prefix || k.startsWith(prefix));
      return { keys, prefix, shared: false };
    },
  };

  // Live sync: whenever trades or settings change in Firestore — including
  // from a write made on a different device — notify the app to reload.
  const unsubTrades = onSnapshot(tradesCol, { includeMetadataChanges: false }, () => {
    notifySync("trades");
  });
  const unsubSettings = onSnapshot(settingsCol, { includeMetadataChanges: false }, (snap) => {
    snap.docChanges().forEach((change) => notifySync(change.doc.id));
  });

  storage.teardown = () => {
    unsubTrades();
    unsubSettings();
  };

  return storage;
}
