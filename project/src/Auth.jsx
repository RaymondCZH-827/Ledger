import React, { useState } from "react";
import {
  createUserWithEmailAndPassword,
  signInWithEmailAndPassword,
  signInWithPopup,
  GoogleAuthProvider,
  signOut,
} from "firebase/auth";
import { auth } from "./firebase";

// Local palette matching the main app's look — kept self-contained here
// since this screen renders before the app (and its color constants) exist.
const C = {
  bg: "#060c18",
  surface: "#0c1525",
  surfaceAlt: "#0e1929",
  border: "rgba(255, 255, 255, 0.07)",
  text: "#dde4f0",
  textDim: "#94aac4",
  textFaint: "#5a7290",
  gold: "#00c896",
  primaryForeground: "#001a12",
  loss: "#ef4444",
};

function friendlyError(err) {
  const code = err && err.code ? err.code : "";
  const map = {
    "auth/invalid-email": "That email address doesn't look right.",
    "auth/user-not-found": "No account found with that email.",
    "auth/wrong-password": "Incorrect password.",
    "auth/invalid-credential": "Incorrect email or password.",
    "auth/email-already-in-use": "An account already exists with that email — try signing in instead.",
    "auth/weak-password": "Password should be at least 6 characters.",
    "auth/popup-closed-by-user": "Google sign-in was closed before finishing.",
    "auth/network-request-failed": "Network error — check your connection and try again.",
  };
  return map[code] || (err && err.message) || "Something went wrong. Please try again.";
}

export default function Auth() {
  const [mode, setMode] = useState("signin"); // "signin" | "signup"
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);

  const inputStyle = {
    width: "100%", background: C.surfaceAlt, border: `1px solid ${C.border}`, color: C.text,
    padding: "10px 12px", borderRadius: 8, fontSize: 14, outline: "none", fontFamily: "inherit",
  };
  const labelStyle = { display: "block", fontSize: 12, color: C.textFaint, marginBottom: 6, fontWeight: 500 };

  const handleEmailSubmit = async (e) => {
    e.preventDefault();
    setError("");

    if (mode === "signup" && password !== confirmPassword) {
      setError("Passwords don't match.");
      return;
    }
    if (password.length < 6) {
      setError("Password should be at least 6 characters.");
      return;
    }

    setLoading(true);
    try {
      if (mode === "signup") {
        await createUserWithEmailAndPassword(auth, email.trim(), password);
      } else {
        await signInWithEmailAndPassword(auth, email.trim(), password);
      }
      // onAuthStateChanged (in RootGate) picks up the signed-in user from here.
    } catch (err) {
      setError(friendlyError(err));
    } finally {
      setLoading(false);
    }
  };

  const handleGoogleSignIn = async () => {
    setError("");
    setLoading(true);
    try {
      await signInWithPopup(auth, new GoogleAuthProvider());
    } catch (err) {
      setError(friendlyError(err));
    } finally {
      setLoading(false);
    }
  };

  return (
    <div style={{
      minHeight: "100vh", background: C.bg, display: "flex", alignItems: "center", justifyContent: "center",
      padding: 20, fontFamily: "'Inter', system-ui, sans-serif", color: C.text,
    }}>
      <div style={{ width: 380, maxWidth: "100%" }}>
        <div style={{ textAlign: "center", marginBottom: 28 }}>
          <div style={{ fontSize: 22, fontWeight: 700, letterSpacing: "-0.01em" }}>
            Ledger<span style={{ color: C.gold }}>.</span>
          </div>
          <div style={{ fontSize: 12, color: C.textFaint, marginTop: 4, letterSpacing: ".03em" }}>TRADE JOURNAL</div>
        </div>

        <div style={{ background: C.surface, border: `1px solid ${C.border}`, borderRadius: 12, padding: 26 }}>
          <div style={{ display: "flex", gap: 4, background: C.surfaceAlt, borderRadius: 8, padding: 4, marginBottom: 22 }}>
            <button
              type="button"
              onClick={() => { setMode("signin"); setError(""); }}
              style={{
                flex: 1, padding: "8px 0", borderRadius: 6, border: "none", cursor: "pointer",
                background: mode === "signin" ? C.gold : "transparent",
                color: mode === "signin" ? C.primaryForeground : C.textDim,
                fontWeight: 600, fontSize: 13, fontFamily: "inherit",
              }}
            >
              Sign in
            </button>
            <button
              type="button"
              onClick={() => { setMode("signup"); setError(""); }}
              style={{
                flex: 1, padding: "8px 0", borderRadius: 6, border: "none", cursor: "pointer",
                background: mode === "signup" ? C.gold : "transparent",
                color: mode === "signup" ? C.primaryForeground : C.textDim,
                fontWeight: 600, fontSize: 13, fontFamily: "inherit",
              }}
            >
              Sign up
            </button>
          </div>

          <form onSubmit={handleEmailSubmit}>
            <div style={{ marginBottom: 14 }}>
              <label style={labelStyle}>Email</label>
              <input
                type="email" required value={email} onChange={(e) => setEmail(e.target.value)}
                placeholder="you@example.com" style={inputStyle} autoComplete="email"
              />
            </div>
            <div style={{ marginBottom: mode === "signup" ? 14 : 18 }}>
              <label style={labelStyle}>Password</label>
              <input
                type="password" required value={password} onChange={(e) => setPassword(e.target.value)}
                placeholder="••••••••" style={inputStyle}
                autoComplete={mode === "signup" ? "new-password" : "current-password"}
              />
            </div>
            {mode === "signup" && (
              <div style={{ marginBottom: 18 }}>
                <label style={labelStyle}>Confirm password</label>
                <input
                  type="password" required value={confirmPassword} onChange={(e) => setConfirmPassword(e.target.value)}
                  placeholder="••••••••" style={inputStyle} autoComplete="new-password"
                />
              </div>
            )}

            {error && (
              <div style={{ background: "rgba(239,68,68,0.1)", border: `1px solid ${C.loss}55`, color: C.loss, fontSize: 12.5, padding: "8px 10px", borderRadius: 7, marginBottom: 14, lineHeight: 1.4 }}>
                {error}
              </div>
            )}

            <button
              type="submit" disabled={loading}
              style={{
                width: "100%", background: C.gold, color: C.primaryForeground, border: "none",
                borderRadius: 8, padding: "11px 0", fontWeight: 700, fontSize: 14, cursor: loading ? "default" : "pointer",
                opacity: loading ? 0.6 : 1, fontFamily: "inherit",
              }}
            >
              {loading ? "Please wait…" : mode === "signup" ? "Create account" : "Sign in"}
            </button>
          </form>

          <div style={{ display: "flex", alignItems: "center", gap: 10, margin: "20px 0" }}>
            <div style={{ flex: 1, height: 1, background: C.border }} />
            <span style={{ fontSize: 11, color: C.textFaint }}>OR</span>
            <div style={{ flex: 1, height: 1, background: C.border }} />
          </div>

          <button
            type="button" onClick={handleGoogleSignIn} disabled={loading}
            style={{
              width: "100%", display: "flex", alignItems: "center", justifyContent: "center", gap: 10,
              background: C.surfaceAlt, color: C.text, border: `1px solid ${C.border}`, borderRadius: 8,
              padding: "10px 0", fontWeight: 600, fontSize: 13.5, cursor: loading ? "default" : "pointer",
              opacity: loading ? 0.6 : 1, fontFamily: "inherit",
            }}
          >
            <svg width="16" height="16" viewBox="0 0 48 48">
              <path fill="#FFC107" d="M43.6 20.5H42V20H24v8h11.3c-1.6 4.7-6.1 8-11.3 8-6.6 0-12-5.4-12-12s5.4-12 12-12c3.1 0 5.8 1.1 8 3l6-6C34 5.1 29.3 3 24 3 12.4 3 3 12.4 3 24s9.4 21 21 21 21-9.4 21-21c0-1.4-.1-2.7-.4-3.5z" />
              <path fill="#FF3D00" d="M6.3 14.7l6.6 4.8C14.6 15.9 18.9 13 24 13c3.1 0 5.8 1.1 8 3l6-6C34 5.1 29.3 3 24 3 16.3 3 9.7 7.3 6.3 14.7z" />
              <path fill="#4CAF50" d="M24 45c5.2 0 9.9-2 13.4-5.2l-6.2-5.2C29.2 36.2 26.7 37 24 37c-5.2 0-9.6-3.3-11.3-8l-6.6 5.1C9.6 40.5 16.3 45 24 45z" />
              <path fill="#1976D2" d="M43.6 20.5H42V20H24v8h11.3c-.8 2.3-2.2 4.2-4.1 5.6l6.2 5.2C40.9 36 44 30.5 44 24c0-1.4-.1-2.7-.4-3.5z" />
            </svg>
            Continue with Google
          </button>
        </div>

        <div style={{ textAlign: "center", fontSize: 11.5, color: C.textFaint, marginTop: 18, lineHeight: 1.5 }}>
          Your trades sync to your account and stay available across devices.
        </div>
      </div>
    </div>
  );
}

export function SignOutButton({ style }) {
  const handleSignOut = async () => {
    try { await signOut(auth); } catch (e) {}
  };
  return (
    <button
      onClick={handleSignOut}
      style={{
        display: "flex", alignItems: "center", justifyContent: "center", gap: 8, width: "100%",
        background: C.gold, border: "none", color: C.primaryForeground, borderRadius: 8, padding: "9px 12px",
        fontSize: 13, fontWeight: 600, cursor: "pointer", fontFamily: "inherit",
        ...style,
      }}
    >
      Sign out
    </button>
  );
}
