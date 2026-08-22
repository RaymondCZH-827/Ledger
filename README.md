# Ledger — Trade Journal

## Running it in VS Code

1. Open this folder in VS Code.
2. Open a terminal (`` Ctrl+` ``) and run:
   ```
   npm install
   npm run dev
   ```
3. Open the URL it prints (usually `http://localhost:5173`).

To check it on your phone: run `npm run dev`, then on your phone (same wifi
network) open `http://<your-computer's-local-ip>:5173` — VS Code's terminal
or `vite`'s startup log will show a "Network:" URL you can use directly.

## Publishing it

Any static host works since this is a plain Vite app:

```
npm run build
```

This produces a `dist/` folder — deploy that to Vercel, Netlify, GitHub
Pages, Cloudflare Pages, or your own server. `npm run preview` lets you
test the production build locally first.

## Firebase setup (required)

This app now stores your data in **Firestore** and requires signing in
(Email/Password or Google) — there's no more local-only mode.

1. **Create a Firebase project** at [console.firebase.google.com](https://console.firebase.google.com)
   if you don't have one already.
2. **Enable sign-in providers**: Build → Authentication → Sign-in method →
   enable **Email/Password** and **Google**.
3. **Create a Firestore database**: Build → Firestore Database → Create
   database (any region; start in production mode).
4. **Get your config**: Project settings → General → Your apps → add a Web
   app if you haven't → copy the `firebaseConfig` object → paste it into
   `src/firebase.js`, replacing the placeholder values.
5. **Set Firestore security rules** — this is important, don't skip it.
   Go to Firestore Database → Rules and use:

   ```
   rules_version = '2';
   service cloud.firestore {
     match /databases/{database}/documents {
       match /users/{userId}/{document=**} {
         allow read, write: if request.auth != null && request.auth.uid == userId;
       }
     }
   }
   ```

   Without this, Firestore's default rules either block everyone (safe but
   the app won't work) or — if you started in "test mode" — allow **anyone**
   to read and write **anyone's** data. The rule above restricts each
   signed-in user to only their own `users/{their-uid}/...` data, matching
   how this app is structured.

### How the data is organized

- `users/{uid}/trades/{tradeId}` — one Firestore document per trade.
- `users/{uid}/settings/{key}` — everything else (accounts, goals,
  checklists, per-account settings, screenshots, etc.), one document per
  key — same partitioning the app always used, just as real Firestore docs.

### Real-time sync across devices

Log a trade on your phone, and it shows up on your laptop without
refreshing — `src/firestoreStorage.js` sets up Firestore's `onSnapshot`
listeners and notifies the app to reload whenever your data changes
remotely. This is genuinely live: no polling, no manual refresh needed.

### The Analysis tab

Still fully local — it's rule-based insights computed directly from your
(now Firestore-loaded) trade data in the browser, with no separate API
calls. Works the same as before.

## App icon

Your icon (`public/icon.svg`) is wired up as the browser favicon, and PNG
versions were generated for `apple-touch-icon.png` (iOS home screen) and
the PWA manifest (`manifest.json`, used by Android/Chrome "Install app").
To actually see it: open the site on your phone, then use your browser's
"Add to Home Screen" / "Install app" option — your icon should show up on
the home screen from there. If you ever swap the icon, just replace
`public/icon.svg` and re-run the PNGs through any SVG-to-PNG tool at
512×512, 192×192, and 180×180.

## Mobile

The layout is responsive — the sidebar collapses into a hamburger-menu
drawer below ~860px width, grids stack into single columns, and the trade
table/calendar scroll horizontally where they're naturally wide. Make sure
`index.html`'s viewport meta tag stays intact if you edit it; without it
mobile browsers won't apply the responsive breakpoints correctly.
