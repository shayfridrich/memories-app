// api/_firebaseAdmin.js
// מודול משותף - מאתחל את Firebase Admin פעם אחת ומספק גישה ל-Firestore
// לכל שאר קבצי ה-api (מונע אתחול כפול בכל פונקציה בנפרד)

import admin from "firebase-admin";

if (!admin.apps.length) {
  try {
    const serviceAccount = JSON.parse(process.env.FIREBASE_SERVICE_ACCOUNT_KEY || "{}");
    admin.initializeApp({
      credential: admin.credential.cert(serviceAccount),
    });
  } catch (e) {
    console.error("שגיאה באתחול Firebase Admin:", e);
  }
}

export const db = admin.firestore();
export const FieldValue = admin.firestore.FieldValue;
