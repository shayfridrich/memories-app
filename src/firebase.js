import { initializeApp } from "firebase/app";
import { getFirestore } from "firebase/firestore";
import { getStorage } from "firebase/storage";

const firebaseConfig = {
  apiKey: "AIzaSyABjevxt7mH3LNpcDPi2ikX2QFrDn1-6JU",
  authDomain: "moments-of-life-dd5d8.firebaseapp.com",
  projectId: "moments-of-life-dd5d8",
  storageBucket: "moments-of-life-dd5d8.firebasestorage.app",
  messagingSenderId: "573117666200",
  appId: "1:573117666200:web:a84d38626891ae235e11ed",
};

const app = initializeApp(firebaseConfig);
export const db = getFirestore(app);
export const storage = getStorage(app);