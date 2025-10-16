// Import the functions you need from the SDKs you need
import { initializeApp } from "firebase/app";
//import { getAnalytics } from "firebase/analytics";
import { getFirestore } from "firebase/firestore";
// TODO: Add SDKs for Firebase products that you want to use
// https://firebase.google.com/docs/web/setup#available-libraries

// Your web app's Firebase configuration
// For Firebase JS SDK v7.20.0 and later, measurementId is optional
const firebaseConfig = {
  apiKey: "AIzaSyBAdK4p7oxWmNL0Mzc0eIMax7A9dSKZsrY",
  authDomain: "studentphonecomp.firebaseapp.com",
  projectId: "studentphonecomp",
  storageBucket: "studentphonecomp.firebasestorage.app",
  messagingSenderId: "939501448762",
  appId: "1:939501448762:web:fcca7bea0b3f006470cf03",
  measurementId: "G-9BVJ4RRWNV"
};

// Initialize Firebase
const app = initializeApp(firebaseConfig);
//const analytics = getAnalytics(app);

const db = getFirestore(app);

export { db };