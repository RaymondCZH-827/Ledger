import React, { useEffect, useState } from "react";
import { onAuthStateChanged } from "firebase/auth";
import { auth } from "./firebase";
import { createFirestoreStorage } from "./firestoreStorage";
import Auth from "./Auth";
import App from "./App.jsx";

const C = { bg: "#060c18", textDim: "#94aac4" };

export default function RootGate() {
  const [authChecked, setAuthChecked] = useState(false);
  const [user, setUser] = useState(null);
  // Bumped every time we swap in a fresh storage adapter (new user), so
  // <App/> gets a new key and fully remounts — this guarantees it re-runs
  // its own load-on-mount logic against the new user's data instead of
  // holding onto the previous user's state in memory.
  const [storageVersion, setStorageVersion] = useState(0);

  useEffect(() => {
    let currentStorage = null;

    const unsubAuth = onAuthStateChanged(auth, (firebaseUser) => {
      if (currentStorage) {
        currentStorage.teardown();
        currentStorage = null;
      }
      if (firebaseUser) {
        currentStorage = createFirestoreStorage(firebaseUser.uid);
        window.storage = currentStorage;
      } else {
        window.storage = null;
      }
      setUser(firebaseUser);
      setStorageVersion((v) => v + 1);
      setAuthChecked(true);
    });

    return () => {
      unsubAuth();
      if (currentStorage) currentStorage.teardown();
    };
  }, []);

  if (!authChecked) {
    return (
      <div style={{ minHeight: "100vh", background: C.bg, display: "flex", alignItems: "center", justifyContent: "center", color: C.textDim, fontFamily: "Inter, sans-serif", fontSize: 13 }}>
        Loading…
      </div>
    );
  }

  if (!user) {
    return <Auth />;
  }

  return <App key={storageVersion} />;
}
