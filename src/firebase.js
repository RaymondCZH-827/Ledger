import { initializeApp } from "firebase/app";
import { getAuth } from "firebase/auth";
import { getFirestore } from "firebase/firestore";

// Replace these with your actual values from the Firebase console
// (Project settings → General → Your apps → SDK setup and configuration).
const firebaseConfig = {
  apiKey: "AIzaSyAmRJZO3G2w_FGMMlboFhRRrQOb4P-Sxto",
  authDomain: "ledger---trading-journal.firebaseapp.com",
  databaseURL: "https://ledger---trading-journal-default-rtdb.firebaseio.com",
  projectId: "ledger---trading-journal",
  storageBucket: "ledger---trading-journal.firebasestorage.app",
  messagingSenderId: "936229743667",
  appId: "1:936229743667:web:1e3764624669ea529d4746",
  measurementId: "G-0DG6VBPXNQ"
};

const app = initializeApp(firebaseConfig);

export const auth = getAuth(app);
export const db = getFirestore(app);

export default app;
