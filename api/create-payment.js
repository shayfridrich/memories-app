// api/create-payment.js
// Vercel Serverless Function — יוצר בקשת סליקה מול Invoice4U ומחזיר קישור לדף תשלום מתארח (Hosted Payment Page)
//
// חשוב: קובץ זה רץ בצד השרת בלבד (Vercel), לא בדפדפן — לכן בטוח לשמור בו מפתחות סודיים
// דרך משתני סביבה (Environment Variables), ולא בקוד הגלוי בדפדפן כמו EmailJS.
//
// משתני סביבה נדרשים ב-Vercel (Project Settings → Environment Variables):
//   INVOICE4U_API_KEY   - המפתח/טוקן שקיבלת מ-Invoice4U (Invoice4UUserApiKey)
//   INVOICE4U_API_BASE  - כתובת הבסיס. בזמן טסטים: https://apiqa.invoice4u.co.il/Services/ApiService.svc
//                          כשעוברים ל-production: https://api.invoice4u.co.il/Services/ApiService.svc
//   SITE_URL            - כתובת האתר החי, למשל https://momentsoflife.co.il
//   FIREBASE_SERVICE_ACCOUNT_KEY - לצורך שמירת מזהי המעקב ב-Firestore
//
// ⚠️ גילינו ש-Invoice4U/Cardcom "דורסים" את ה-query params שהגדרנו ב-ReturnUrl ומחזירים
// את הלקוח עם פרמטרים משלהם בלבד (orgId, success, terminalnumber, lowprofilecode...).
// לכן אי אפשר להסתמך על ReturnUrl כדי לדעת לאיזו הזמנה זה שייך.
// הפתרון: שומרים כאן ב-Firestore מיפוי lowProfileCode -> orderId, וכש-הלקוח חוזר
// (api/check-payment-status.js) מאתרים לפי ה-lowprofilecode שכן חוזר תמיד.

import { db, FieldValue } from "./_firebaseAdmin.js";

export default async function handler(req, res) {
  if (req.method !== "POST") {
    return res.status(405).json({ error: "Method not allowed" });
  }

  try {
    const { orderId, firstName, lastName, phone, email, packageName, packagePrice } = req.body || {};

    if (!orderId || !packagePrice || !email || !phone) {
      return res.status(400).json({ error: "חסרים פרטים נדרשים ליצירת תשלום" });
    }

    const baseUrl = process.env.SITE_URL || "https://momentsoflife.co.il";
    const apiBase = process.env.INVOICE4U_API_BASE || "https://apiqa.invoice4u.co.il/Services/ApiService.svc";
    const apiKey = process.env.INVOICE4U_API_KEY;

    if (!apiKey) {
      console.error("INVOICE4U_API_KEY לא מוגדר ב-Environment Variables");
      return res.status(500).json({ error: "תצורת שרת חסרה" });
    }

    const fullName = `${firstName || ""} ${lastName || ""}`.trim() || "לקוח";

    const payload = {
      request: {
        Invoice4UUserApiKey: apiKey,
        Type: "1",
        CreditCardCompanyType: "1",
        FullName: fullName,
        Phone: phone,
        Email: email,
        Sum: String(packagePrice),
        Description: `רגעים של החיים - ${packageName || "הזמנה"}`,
        PaymentsNum: "1",
        Currency: "ILS",
        OrderIdClientUsage: orderId,
        IsDocCreate: "true",
        DocHeadline: `חשבונית - ${packageName || "הזמנה"}`,
        DocComments: `הזמנה מספר ${orderId}`,
        DocItemQuantity: "1",
        DocItemPrice: String(packagePrice),
        DocItemTaxRate: "18",
        DocItemName: packageName || "סרטון זיכרון",
        IsGeneralClient: "true",
        IsAutoCreateCustomer: "true",
        CallBackUrl: `${baseUrl}/api/payment-callback`,
        ReturnUrl: `${baseUrl}/?payment=complete&orderId=${encodeURIComponent(orderId)}`,
        AddToken: "false",
        AddTokenAndCharge: "false",
        ChargeWithToken: "false",
        Refund: "false",
        IsStandingOrderClearance: "false",
        StandingOrderDuration: "0",
      },
    };

    const response = await fetch(`${apiBase}/ProcessApiRequestV2`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(payload),
    });

    const data = await response.json();
    const redirectUrl = data?.d?.ClearingRedirectUrl;

    if (!redirectUrl) {
      console.error("תשובת Invoice4U ללא קישור תשלום:", JSON.stringify(data));
      return res.status(502).json({ error: "לא התקבל קישור תשלום מהספק", details: data?.d?.Errors || null });
    }

    const openInfo = data?.d?.OpenInfo || [];
    const paymentId = openInfo.find((i) => i.Key === "PaymentId")?.Value || null;
    const clearingLogId = openInfo.find((i) => i.Key === "I4UClearingLogId")?.Value || null;

    // ה-lowProfileCode הוא המקטע האחרון בכתובת ה-redirectUrl (ה-GUID שבסוף)
    const lowProfileCode = redirectUrl.split("/").filter(Boolean).pop()?.split("?")[0] || null;

    // שמירת מזהי המעקב על ההזמנה, כדי שנוכל לאתר אותה כשהלקוח חוזר מהתשלום
    try {
      const ordersRef = db.collection("orders");
      const snapshot = await ordersRef.where("orderId", "==", orderId).limit(1).get();
      if (!snapshot.empty) {
        await snapshot.docs[0].ref.update({
          clearingLogId,
          paymentId,
          lowProfileCode,
          paymentStatus: "ממתין לתשלום",
          paymentInitiatedAt: FieldValue.serverTimestamp(),
        });
      } else {
        console.error("לא נמצאה הזמנה לעדכון מזהי תשלום:", orderId);
      }
    } catch (dbErr) {
      // לא חוסמים את יצירת התשלום אם שמירת המעקב נכשלה - רק מתעדים
      console.error("שגיאה בשמירת מזהי מעקב ל-Firestore:", dbErr);
    }

    return res.status(200).json({ redirectUrl, paymentId, lowProfileCode });
  } catch (err) {
    console.error("create-payment error:", err);
    return res.status(500).json({ error: "שגיאת שרת ביצירת בקשת תשלום" });
  }
}
