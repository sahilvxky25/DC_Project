// Firebase client setup for BitSecure.
// This file contains browser-safe Firebase web configuration, not server credentials.
import { initializeApp } from "https://www.gstatic.com/firebasejs/13.1.0/firebase-app.js";
import { getAuth } from "https://www.gstatic.com/firebasejs/13.1.0/firebase-auth.js";
import { getFirestore } from "https://www.gstatic.com/firebasejs/13.1.0/firebase-firestore.js";

const firebaseConfig = {
  apiKey: "AIzaSyC4tdelvqnYiWfnxawwgXzJxNBrbP6oxSI",
  authDomain: "bit-7ce8a.firebaseapp.com",
  projectId: "bit-7ce8a",
  storageBucket: "bit-7ce8a.firebasestorage.app",
  messagingSenderId: "1013450108699",
  appId: "1:1013450108699:web:2efd05455f5456bfd4adbe",
  measurementId: "G-W5CHHVYJWF"
};

const app = initializeApp(firebaseConfig);

export const auth = getAuth(app);
export const db = getFirestore(app);
