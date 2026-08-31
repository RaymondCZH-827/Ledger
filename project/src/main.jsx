import React from "react";
import ReactDOM from "react-dom/client";
import RootGate from "./RootGate.jsx";
import "./index.css";

// window.storage is now set up per signed-in user by RootGate, backed by
// Firestore (see src/firestoreStorage.js) — there's no more localStorage
// fallback here, since the app now requires being signed in to load or
// save any data.

ReactDOM.createRoot(document.getElementById("root")).render(
  <React.StrictMode>
    <RootGate />
  </React.StrictMode>
);
