// api/payment-callback.js
// Vercel Serverless Function — מקבלת Webhook מ-Invoice4U (CallBackUrl) לאחר ניסיון תשלום,
// ומעדכנת את ההזמנה המתאימה ב-Firestore.
//
// ⚠️ שים לב: המבנה המדויק של הנתונים שה-Webhook שולח לא תועד בקובץ ה-Postman שקיבלנו,
// ולכן הקוד כאן כתוב באופן "מגן" - הוא מתעד (console.log) את כל מה שמתקבל, ומנסה כמה
// שמות שדה סבירים. יש לבצע בדיקה אמיתית (למשל דרך webhook.site) ולוודא/לתקן את שמות
// השדות בהתאם למה שבאמת מתקבל, לפני הפעלה בסביבת הפרודקשן.
//
// משתני סביבה נדרשים ב-Vercel:
//   FIREBASE_SERVICE_ACCOUNT_KEY - תוכן קובץ ה-JSON של Firebase Service Account (כמחרוזת אחת)

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

export default async function handler(req, res) {
  if (req.method !== "POST") {
    return res.status(405).send("Method not allowed");
  }

  try {
    // תיעוד מלא של כל מה שהתקבל - חיוני לצורך אבחון בפעם הראשונה שמתקבל webhook אמיתי
    console.log("=== Invoice4U payment callback received ===");
    console.log(JSON.stringify(req.body));

    const body = req.body || {};

    // ניסיון למצוא את מזהה ההזמנה תחת כמה שמות שדה אפשריים
    const orderId =
      body.OrderIdClientUsage ||
      body.orderIdClientUsage ||
      body.OrderId ||
      body?.d?.OrderIdClientUsage;

    // ניסיון לזהות הצלחה/כישלון תחת כמה שמות שדה אפשריים
    const rawSuccess =
      body.IsSuccess ?? body.Success ?? body.isSuccess ?? body?.d?.IsSuccess;
    const isSuccess = rawSuccess === true || rawSuccess === "true";

    if (!orderId) {
      console.error("לא נמצא מזהה הזמנה בתוך ה-callback - יש לבדוק את מבנה הנתונים בלוג למעלה");
      return res.status(400).json({ error: "Missing order id", received: body });
    }

    const db = admin.firestore();
    const ordersRef = db.collection("orders");
    const snapshot = await ordersRef.where("orderId", "==", orderId).limit(1).get();

    if (snapshot.empty) {
      console.error("לא נמצאה הזמנה תואמת ל-orderId:", orderId);
      return res.status(404).json({ error: "Order not found" });
    }

    const doc = snapshot.docs[0];
    await doc.ref.update({
      paymentStatus: isSuccess ? "שולם" : "נכשל",
      paymentCallbackRaw: body,
      paymentUpdatedAt: admin.firestore.FieldValue.serverTimestamp(),
    });

    console.log(`הזמנה ${orderId} עודכנה לסטטוס: ${isSuccess ? "שולם" : "נכשל"}`);

    return res.status(200).json({ received: true });
  } catch (err) {
    console.error("payment-callback error:", err);
    return res.status(500).json({ error: "Server error" });
  }
}
