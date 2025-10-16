// src/firebaseConfig.js
import { initializeApp } from "firebase/app";
import { getFirestore } from "firebase/firestore";
import { getAuth, signInAnonymously } from "firebase/auth";

const firebaseConfig = {
  apiKey: "AIzaSyBAdK4p7oxWmNL0Mzc0eIMax7A9dSKZsrY",
  authDomain: "studentphonecomp.firebaseapp.com",
  projectId: "studentphonecomp",
  storageBucket: "studentphonecomp.firebasestorage.app",
  messagingSenderId: "939501448762",
  appId: "1:939501448762:web:fcca7bea0b3f006470cf03",
  measurementId: "G-9BVJ4RRWNV"
};

const app = initializeApp(firebaseConfig);
const db = getFirestore(app);

// Sign in anonymously so Firestore rules can require auth
const auth = getAuth(app);
signInAnonymously(auth).catch(console.error);

export { db, auth };
