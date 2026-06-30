import React, { useState, useRef, useCallback } from "react";

// ── DESIGN TOKENS ──────────────────────────────────────────────
const STYLES = `
  @import url('https://fonts.googleapis.com/css2?family=Playfair+Display:ital,wght@0,400;0,600;1,400&family=Inter:wght@300;400;500;600&display=swap');

  * { box-sizing: border-box; margin: 0; padding: 0; }
  body { background: #0d0e14; color: #e8e2d9; font-family: 'Inter', sans-serif; min-height: 100vh; }
  .serif { font-family: 'Playfair Display', Georgia, serif; }

  /* Progress bar */
  .progress-wrap { display: flex; align-items: center; padding: 0 8px; margin-bottom: 40px; }
  .progress-step { display: flex; flex-direction: column; align-items: center; gap: 6px; flex: 1; }
  .step-circle { width: 34px; height: 34px; border-radius: 50%; border: 2px solid #3a3b4a; display: flex; align-items: center; justify-content: center; font-size: 12px; font-weight: 600; color: #6b6c7e; background: #15161f; transition: all 0.4s ease; position: relative; z-index: 2; }
  .step-circle.active { border-color: #c9a84c; color: #c9a84c; background: #1a1b27; box-shadow: 0 0 16px rgba(201,168,76,0.3); }
  .step-circle.done { border-color: #c9a84c; background: #c9a84c; color: #0d0e14; }
  .step-label { font-size: 10px; color: #6b6c7e; text-align: center; letter-spacing: 0.04em; text-transform: uppercase; white-space: nowrap; }
  .step-label.active { color: #c9a84c; }
  .progress-line { flex: 1; height: 1px; background: #3a3b4a; margin-bottom: 20px; position: relative; }
  .progress-line-fill { position: absolute; left: 0; top: 0; height: 100%; background: #c9a84c; transition: width 0.5s ease; }

  /* Cards */
  .card { background: #15161f; border: 1px solid #2a2b38; border-radius: 16px; padding: 28px; }

  /* Package cards */
  .package-grid { display: grid; grid-template-columns: repeat(3, 1fr); gap: 16px; margin-top: 32px; }
  @media (max-width: 700px) { .package-grid { grid-template-columns: 1fr; } }
  .package-card {
    border: 2px solid #2a2b38; border-radius: 16px; padding: 24px 20px 20px;
    cursor: pointer; transition: all 0.3s ease; background: #0f1018;
    display: flex; flex-direction: column; align-items: center; text-align: center; position: relative;
  }
  .package-card:hover { border-color: #4a4b5e; transform: translateY(-4px); box-shadow: 0 12px 40px rgba(0,0,0,0.4); }
  .package-card.selected, .package-card.premium { border-color: #c9a84c; }
  .package-card.premium { background: linear-gradient(160deg, #12111a, #1a1610); }
  .package-badge { position: absolute; top: -12px; left: 50%; transform: translateX(-50%); background: linear-gradient(135deg,#c9a84c,#e8c96a); color: #0d0e14; font-size: 11px; font-weight: 700; padding: 4px 14px; border-radius: 20px; white-space: nowrap; letter-spacing: 0.05em; }

  /* Frame mockup */
  .frame-mockup { width: 130px; height: 100px; background: #1a1b27; border: 3px solid #3a3b4a; border-radius: 8px; position: relative; margin-bottom: 16px; display: flex; align-items: center; justify-content: center; overflow: hidden; }
  .frame-mockup.gold-frame { border-color: #c9a84c; box-shadow: 0 0 20px rgba(201,168,76,0.2); }
  .frame-mockup.large { width: 150px; height: 115px; }
  .frame-screen { position: absolute; inset: 6px; background: linear-gradient(135deg, #1e1f2e, #2a2b3e); border-radius: 4px; display: flex; align-items: center; justify-content: center; overflow: hidden; }
  .frame-photo-strip { position: absolute; inset: 0; display: flex; }
  .frame-photo { flex: 1; background: linear-gradient(135deg, #2a1f3a, #1a2a3a); }
  .frame-photo:nth-child(2) { background: linear-gradient(135deg, #1a2a2a, #2a1a2a); }
  .frame-photo:nth-child(3) { background: linear-gradient(135deg, #2a2a1a, #1a1a2a); }
  .frame-play-btn { position: absolute; width: 28px; height: 28px; background: rgba(201,168,76,0.9); border-radius: 50%; display: flex; align-items: center; justify-content: center; font-size: 11px; color: #0d0e14; z-index: 2; animation: pulse-play 2s ease infinite; }
  @keyframes pulse-play { 0%,100% { box-shadow: 0 0 0 0 rgba(201,168,76,0.5); } 50% { box-shadow: 0 0 0 8px rgba(201,168,76,0); } }
  .frame-stand { width: 20px; height: 8px; background: #3a3b4a; border-radius: 0 0 4px 4px; margin: 0 auto; }
  .frame-stand-base { width: 50px; height: 4px; background: #2a2b38; border-radius: 2px; margin: 0 auto; }
  .no-frame-icon { font-size: 40px; margin-bottom: 8px; }

  /* Package details */
  .package-name { font-size: 18px; font-weight: 700; margin-bottom: 4px; color: #e8e2d9; }
  .package-price { font-size: 28px; font-weight: 800; color: #c9a84c; margin-bottom: 4px; }
  .package-price span { font-size: 14px; font-weight: 400; color: #6b6c7e; }
  .package-features { list-style: none; margin-top: 14px; width: 100%; text-align: right; }
  .package-features li { font-size: 12px; color: #8a8b9e; padding: 4px 0; border-bottom: 1px solid #1e1f2e; display: flex; justify-content: space-between; align-items: center; }
  .package-features li:last-child { border-bottom: none; }
  .package-features li .val { color: #c9a84c; font-weight: 600; }
  .btn-select { margin-top: 16px; width: 100%; padding: 11px; border-radius: 40px; font-size: 13px; font-weight: 700; cursor: pointer; transition: all 0.3s; border: none; font-family: 'Inter', sans-serif; }
  .btn-select-gold { background: linear-gradient(135deg,#c9a84c,#e8c96a); color: #0d0e14; }
  .btn-select-gold:hover { box-shadow: 0 6px 24px rgba(201,168,76,0.4); transform: translateY(-1px); }
  .btn-select-outline { background: transparent; color: #c9a84c; border: 1px solid #c9a84c !important; }
  .btn-select-outline:hover { background: rgba(201,168,76,0.08); }

  /* Upload zone */
  .upload-zone { border: 2px dashed #3a3b4a; border-radius: 12px; padding: 36px 20px; text-align: center; cursor: pointer; transition: all 0.3s ease; background: #0d0e14; }
  .upload-zone:hover, .upload-zone.drag-over { border-color: #c9a84c; background: rgba(201,168,76,0.04); }

  /* Timeline gallery */
  .timeline-wrap { margin-top: 20px; }
  .timeline-photo-row { display: flex; align-items: center; gap: 10px; margin-bottom: 6px; }
  .timeline-photo-box { position: relative; width: 80px; height: 80px; border-radius: 8px; overflow: hidden; flex-shrink: 0; cursor: grab; border: 2px solid transparent; transition: all 0.2s; }
  .timeline-photo-box.drag-target { border-color: #c9a84c; transform: scale(1.05); }
  .timeline-photo-box.dragging { opacity: 0.35; }
  .timeline-photo-box img { width: 100%; height: 100%; object-fit: cover; display: block; }
  .photo-num { position: absolute; top: 4px; left: 4px; background: #c9a84c; color: #0d0e14; font-size: 10px; font-weight: 700; width: 20px; height: 20px; border-radius: 50%; display: flex; align-items: center; justify-content: center; box-shadow: 0 2px 6px rgba(0,0,0,0.5); }
  .photo-remove { position: absolute; top: 4px; right: 4px; background: rgba(0,0,0,0.75); color: #fff; border: none; width: 18px; height: 18px; border-radius: 50%; cursor: pointer; font-size: 11px; display: flex; align-items: center; justify-content: center; opacity: 0; transition: opacity 0.2s; }
  .timeline-photo-box:hover .photo-remove { opacity: 1; }
  .timeline-connector { display: flex; flex-direction: column; align-items: center; gap: 4px; flex-shrink: 0; }
  .connector-line { width: 1px; height: 12px; background: #3a3b4a; }
  .scene-label-wrap { flex: 1; }
  .scene-input { width: 100%; background: #0d0e14; border: 1px solid #2a2b38; border-radius: 8px; padding: 8px 12px; color: #e8e2d9; font-size: 12px; font-family: 'Inter', sans-serif; outline: none; transition: border-color 0.2s; }
  .scene-input:focus { border-color: #c9a84c; }
  .scene-input::placeholder { color: #4a4b5e; }

  /* Style cards */
  .style-grid { display: grid; grid-template-columns: repeat(3, 1fr); gap: 10px; }
  .style-card { border: 2px solid #2a2b38; border-radius: 12px; padding: 16px 12px; cursor: pointer; transition: all 0.3s ease; background: #0d0e14; text-align: center; position: relative; }
  .style-card:hover { border-color: #4a4b5e; transform: translateY(-2px); }
  .style-card.selected { border-color: #c9a84c; background: rgba(201,168,76,0.06); }
  .style-emoji { font-size: 28px; margin-bottom: 8px; display: block; }
  .style-name { font-weight: 600; font-size: 13px; margin-bottom: 4px; color: #e8e2d9; }
  .style-desc { font-size: 11px; color: #6b6c7e; line-height: 1.4; }
  .style-preview { margin-top: 8px; height: 3px; border-radius: 2px; width: 100%; }

  /* Music */
  .music-item { display: flex; align-items: center; gap: 10px; padding: 12px 14px; border: 1px solid #2a2b38; border-radius: 10px; cursor: pointer; transition: all 0.25s; background: #0d0e14; margin-bottom: 8px; }
  .music-item:hover { border-color: #4a4b5e; background: #13141d; }
  .music-item.selected { border-color: #c9a84c; background: rgba(201,168,76,0.06); }
  .music-play-btn { width: 34px; height: 34px; border-radius: 50%; border: 1px solid #3a3b4a; background: #1a1b27; color: #e8e2d9; display: flex; align-items: center; justify-content: center; cursor: pointer; flex-shrink: 0; transition: all 0.2s; font-size: 13px; }
  .music-play-btn:hover { border-color: #c9a84c; color: #c9a84c; }
  .music-play-btn.playing { background: #c9a84c; color: #0d0e14; border-color: #c9a84c; }
  .music-bar { display: flex; gap: 2px; align-items: flex-end; height: 18px; }
  .music-bar span { width: 3px; background: #c9a84c; border-radius: 2px; animation: eq 0.8s ease-in-out infinite alternate; }
  .music-bar span:nth-child(2) { animation-delay: 0.15s; }
  .music-bar span:nth-child(3) { animation-delay: 0.3s; }
  @keyframes eq { from { height: 4px; } to { height: 16px; } }
  .cat-tabs { display: flex; gap: 6px; flex-wrap: wrap; margin-bottom: 14px; }
  .cat-tab { padding: 5px 14px; border-radius: 20px; border: 1px solid #3a3b4a; font-size: 12px; cursor: pointer; color: #6b6c7e; background: transparent; transition: all 0.2s; font-family: 'Inter', sans-serif; }
  .cat-tab:hover { border-color: #c9a84c; color: #c9a84c; }
  .cat-tab.active { background: #c9a84c; color: #0d0e14; border-color: #c9a84c; font-weight: 600; }

  /* Summary */
  .summary-row { display: flex; justify-content: space-between; padding: 12px 0; border-bottom: 1px solid #2a2b38; font-size: 13px; }
  .summary-row:last-child { border-bottom: none; }
  .summary-key { color: #6b6c7e; }
  .summary-val { color: #e8e2d9; font-weight: 500; }

  /* Buttons */
  .btn-gold { background: linear-gradient(135deg, #c9a84c, #e8c96a); color: #0d0e14; border: none; padding: 12px 30px; border-radius: 40px; font-size: 14px; font-weight: 700; cursor: pointer; transition: all 0.3s; letter-spacing: 0.03em; font-family: 'Inter', sans-serif; }
  .btn-gold:hover { transform: translateY(-1px); box-shadow: 0 6px 24px rgba(201,168,76,0.4); }
  .btn-gold:disabled { opacity: 0.4; cursor: not-allowed; transform: none; box-shadow: none; }
  .btn-ghost { background: transparent; color: #6b6c7e; border: 1px solid #3a3b4a; padding: 12px 24px; border-radius: 40px; font-size: 13px; cursor: pointer; transition: all 0.25s; font-family: 'Inter', sans-serif; }
  .btn-ghost:hover { color: #e8e2d9; border-color: #6b6c7e; }

  /* Success */
  .success-ring { width: 90px; height: 90px; border-radius: 50%; border: 3px solid #c9a84c; display: flex; align-items: center; justify-content: center; font-size: 38px; margin: 0 auto 20px; animation: pulse-ring 2s ease infinite; }
  @keyframes pulse-ring { 0%,100% { box-shadow: 0 0 0 0 rgba(201,168,76,0.3); } 50% { box-shadow: 0 0 0 16px rgba(201,168,76,0); } }

  /* Option pills */
  .option-group { margin-bottom: 24px; }
  .option-label { font-size: 11px; text-transform: uppercase; letter-spacing: 0.08em; color: #6b6c7e; margin-bottom: 10px; font-weight: 500; }
  .option-pills { display: flex; gap: 8px; flex-wrap: wrap; }
  .pill { padding: 10px 20px; border: 1px solid #3a3b4a; border-radius: 40px; cursor: pointer; font-size: 13px; transition: all 0.25s; color: #a0a1b5; background: #0d0e14; display: flex; flex-direction: column; align-items: center; gap: 2px; font-family: 'Inter', sans-serif; }
  .pill:hover { border-color: #c9a84c; color: #e8e2d9; }
  .pill.selected { border-color: #c9a84c; background: rgba(201,168,76,0.12); color: #c9a84c; font-weight: 600; }

  input, textarea, button { font-family: 'Inter', sans-serif; }
  .input-field { width: 100%; background: #0d0e14; border: 1px solid #3a3b4a; border-radius: 8px; padding: 11px 14px; color: #e8e2d9; font-size: 13px; font-family: 'Inter', sans-serif; outline: none; margin-top: 5px; transition: border-color 0.2s; display: block; }
  .input-field:focus { border-color: #c9a84c; }
  .occ-tag { font-size: 10px; padding: 2px 7px; border-radius: 20px; white-space: nowrap; line-height: 1.4; }
`;

// ── DATA ──────────────────────────────────────────────────────
const PACKAGES = [
  {
    id: "basic",
    name: "בסיסי",
    price: "₪499",
    photos: 30,
    clips: 15,
    duration: "3 דקות",
    hasFrame: false,
    frameSize: null,
    highlight: false,
    badge: null,
    features: [
      { label: "תמונות", val: "30" },
      { label: "אורך סרטון", val: "3 דקות" },
      { label: "מסגרת דיגיטלית", val: "ללא" },
      { label: "עלות", val: "₪499" },
    ]
  },
  {
    id: "premium",
    name: "פרימיום",
    price: "₪699",
    photos: 40,
    clips: 20,
    duration: "4 דקות",
    hasFrame: true,
    frameSize: '10"',
    highlight: true,
    badge: "הכי פופולרי ⭐",
    features: [
      { label: "תמונות", val: "40" },
      { label: "אורך סרטון", val: "4 דקות" },
      { label: "מסגרת דיגיטלית", val: '10"' },
      { label: "עלות", val: "₪699" },
    ]
  },
  {
    id: "vip",
    name: "VIP 👑",
    price: "₪1,500",
    photos: 50,
    clips: 25,
    duration: "5 דקות",
    hasFrame: true,
    frameSize: '15"',
    highlight: false,
    badge: null,
    features: [
      { label: "תמונות", val: "50" },
      { label: "אורך סרטון", val: "5 דקות" },
      { label: "מסגרת דיגיטלית", val: '15"' },
      { label: "אריזה מיוחדת", val: "✓" },
      { label: "עלות", val: "₪1,500" },
    ]
  }
];

const STYLES_DATA = [
  { id:"romantic",  emoji:"🌹", name:"רומנטי",   desc:"אור זהוב חם, מעברים עדינים, תחושת אהבה", occasions:["בת מצווה","חתונה","גיוס","לידה","יובל"], preview:"linear-gradient(90deg,#d4a5b5,#f7d6e0)" },
  { id:"happy",     emoji:"✨", name:"שמח וחי",  desc:"צבעים עזים, אנרגיה חגיגית, שמחה גדולה",  occasions:["יום הולדת","סיום גן","טיול","לימודים"], preview:"linear-gradient(90deg,#e8c94c,#f7a500)" },
  { id:"modern",    emoji:"🎬", name:"קולנועי",  desc:"סגנון סרט, ניגודים חדים, יוקרתי ומרשים", occasions:["בר מצווה","גיוס","השקת עסק","הישג"], preview:"linear-gradient(90deg,#7a9fff,#4a6fff)" },
  { id:"nostalgic", emoji:"📷", name:"נוסטלגי",  desc:"גוונים וינטג׳, אלבום ישן, זיכרון חם",     occasions:["גיל 70+","גמלאות","יובל יהלום"],       preview:"linear-gradient(90deg,#c4a882,#a07850)" },
  { id:"dramatic",  emoji:"🌙", name:"דרמטי",    desc:"מעברים עוצמתיים, אור מהחושך, עוצר נשימה", occasions:["גיוס","בר מצווה","ניצחון"],            preview:"linear-gradient(90deg,#9b7fff,#6a3fff)" },
  { id:"playful",   emoji:"🎈", name:"ילדותי",   desc:"קסם ושובבות, צבעים חמים, ספר ילדים חי",  occasions:["יום הולדת 1–5","כיתה א'","פורים"],    preview:"linear-gradient(90deg,#7fd4a0,#4aaa6a)" },
];

const MUSIC_LIBRARY = {
  "רגשי":    [{id:1,name:"River Flows In You",artist:"Yiruma",duration:"3:42",mood:"רגשי"},{id:2,name:"Experience",artist:"Ludovico Einaudi",duration:"5:13",mood:"רגשי"},{id:3,name:"Comptine d'un autre été",artist:"Yann Tiersen",duration:"2:58",mood:"רגשי"}],
  "שמח":     [{id:4,name:"Happy",artist:"Pharrell Williams",duration:"3:53",mood:"שמח"},{id:5,name:"Best Day Of My Life",artist:"American Authors",duration:"3:14",mood:"שמח"},{id:6,name:"Can't Stop The Feeling",artist:"Justin Timberlake",duration:"3:56",mood:"שמח"}],
  "קולנועי": [{id:7,name:"Time",artist:"Hans Zimmer",duration:"4:35",mood:"קולנועי"},{id:8,name:"Arrival of the Birds",artist:"The Cinematic Orchestra",duration:"4:46",mood:"קולנועי"},{id:9,name:"Watermark",artist:"Enya",duration:"2:30",mood:"קולנועי"}],
  "נוסטלגי": [{id:10,name:"The Way We Were",artist:"Barbra Streisand",duration:"3:32",mood:"נוסטלגי"},{id:11,name:"Yesterday",artist:"The Beatles",duration:"2:03",mood:"נוסטלגי"},{id:12,name:"Somewhere Over The Rainbow",artist:"Israel Kamakawiwoʻole",duration:"3:31",mood:"נוסטלגי"}],
};
const ALL_TRACKS = Object.values(MUSIC_LIBRARY).flat();

// ── FRAME MOCKUP COMPONENT ────────────────────────────────────
function FrameMockup({ pkg }) {
  const IMAGE_BASIC = "/products/product-basic.png";
  const IMAGE_10 = "/products/product-10inch.png";
  const IMAGE_15 = "/products/product-15inch.png";

  const imgSrc = !pkg.hasFrame ? IMAGE_BASIC : pkg.frameSize === '15"' ? IMAGE_15 : IMAGE_10;
  const imgHeight = !pkg.hasFrame ? 220 : pkg.frameSize === '15"' ? 200 : 190;

  return (
    <div style={{ marginBottom: 12, width: "100%", display: "flex", justifyContent: "center" }}>
      <img
        src={imgSrc}
        alt={pkg.name}
        style={{ height: imgHeight, width: "auto", maxWidth: "100%", objectFit: "contain", borderRadius: 8 }}
        onError={e => { e.target.style.display = "none"; }}
      />
    </div>
  );
}

// ── STEP 0: Package selection ─────────────────────────────────
function StepPackage({ onSelect }) {
  return (
    <div>
      <div style={{ textAlign: "center", marginBottom: 40 }}>
        <h1 className="serif" style={{ fontSize: 40, lineHeight: 1.2, marginBottom: 14, letterSpacing: "-0.02em", color: "#e8e2d9" }}>
          הפכו את הרגעים שלכם<br />
          <span style={{ color: "#c9a84c" }}>לסרטון שלא תשכחו</span>
        </h1>
        <p style={{ color: "#6b6c7e", fontSize: 15, lineHeight: 1.7, maxWidth: 480, margin: "0 auto" }}>
          בחרו את החבילה המתאימה לכם — העלו תמונות, בחרו סגנון ומוזיקה, ואנחנו נייצר סרטון זיכרון מקצועי עם AI.
        </p>
      </div>

      <div className="package-grid">
        {PACKAGES.map((pkg) => (
          <div key={pkg.id} className={`package-card ${pkg.highlight ? "premium" : ""}`} onClick={() => onSelect(pkg)}>
            {pkg.badge && <div className="package-badge">{pkg.badge}</div>}

            <FrameMockup pkg={pkg} />

            <div className="package-name">{pkg.name}</div>
            <div className="package-price">{pkg.price}</div>

            <ul className="package-features">
              {pkg.features.map((f, i) => (
                <li key={i}>
                  <span>{f.label}</span>
                  <span className="val">{f.val}</span>
                </li>
              ))}
            </ul>

            <button className={`btn-select ${pkg.highlight ? "btn-select-gold" : "btn-select-outline"}`}>
              בחר חבילה זו
            </button>
          </div>
        ))}
      </div>
    </div>
  );
}

// ── PROGRESS BAR ──────────────────────────────────────────────
function ProgressBar({ step }) {
  const steps = ["תמונות", "סגנון", "פסקול", "סיכום"];
  const items = [];
  steps.forEach((label, i) => {
    items.push(
      <div key={"s" + i} className="progress-step">
        <div className={`step-circle ${i < step ? "done" : i === step ? "active" : ""}`}>
          {i < step ? "✓" : i + 1}
        </div>
        <span className={`step-label ${i === step ? "active" : ""}`}>{label}</span>
      </div>
    );
    if (i < steps.length - 1) {
      items.push(
        <div key={"l" + i} className="progress-line">
          <div className="progress-line-fill" style={{ width: i < step ? "100%" : "0%" }} />
        </div>
      );
    }
  });
  return <div className="progress-wrap">{items}</div>;
}


// ── STEP 1: Upload with timeline ───────────────────────────────
function StepUpload({ pkg, photos, setPhotos, sceneNotes, setSceneNotes, onNext }) {
  const [dropZoneOver, setDropZoneOver] = useState(false);
  const [draggedId, setDraggedId] = useState(null);
  const [dragOverId, setDragOverId] = useState(null);
  const inputRef = useRef();

  const maxPhotos = pkg.photos;

  const handleFiles = useCallback((files) => {
    const imgs = Array.from(files).filter(f => f.type.startsWith("image/"));
    const readers = imgs.map(file => new Promise(res => {
      const r = new FileReader();
      r.onload = e => res({ id: Date.now() + Math.random(), url: e.target.result, name: file.name });
      r.readAsDataURL(file);
    }));
    Promise.all(readers).then(newPhotos => setPhotos(prev => {
      const combined = [...prev, ...newPhotos];
      return combined.slice(0, maxPhotos);
    }));
  }, [setPhotos, maxPhotos]);

  const onZoneDrop = (e) => { e.preventDefault(); setDropZoneOver(false); handleFiles(e.dataTransfer.files); };
  const removePhoto = (id) => setPhotos(prev => prev.filter(p => p.id !== id));

  const onItemDragStart = (e, id) => {
    setDraggedId(id);
    e.dataTransfer.effectAllowed = "move";
  };
  const onItemDragOver = (e, id) => { e.preventDefault(); if (id !== draggedId) setDragOverId(id); };
  const onItemDrop = (e, targetId) => {
    e.preventDefault();
    if (!draggedId || draggedId === targetId) return;
    setPhotos(prev => {
      const arr = [...prev];
      const fi = arr.findIndex(p => p.id === draggedId);
      const ti = arr.findIndex(p => p.id === targetId);
      const [item] = arr.splice(fi, 1);
      arr.splice(ti, 0, item);
      return arr;
    });
    setDraggedId(null); setDragOverId(null);
  };
  const onItemDragEnd = () => { setDraggedId(null); setDragOverId(null); };

  const updateNote = (index, val) => {
    setSceneNotes(prev => {
      const next = [...prev];
      next[index] = val;
      return next;
    });
  };

  return (
    <div className="card">
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start", marginBottom: 8 }}>
        <h2 className="serif" style={{ fontSize: 24, color: "#e8e2d9" }}>העלו את התמונות שלכם</h2>
        <div style={{ background: "rgba(201,168,76,0.12)", border: "1px solid rgba(201,168,76,0.3)", borderRadius: 8, padding: "6px 14px", fontSize: 13, color: "#c9a84c", fontWeight: 700, flexShrink: 0 }}>
          {photos.length} / {maxPhotos} תמונות
        </div>
      </div>
      <p style={{ color: "#6b6c7e", fontSize: 13, marginBottom: 20, lineHeight: 1.6 }}>
        חבילת <strong style={{ color: "#c9a84c" }}>{pkg.name}</strong> כוללת עד <strong style={{ color: "#c9a84c" }}>{maxPhotos} תמונות</strong>.
        לאחר ההעלאה — גררו לסדר כרונולוגי, ובין כל שתי תמונות רשמו 3 מילים לתיאור הרגע.
      </p>

      {photos.length < maxPhotos && (
        <div
          className={`upload-zone ${dropZoneOver ? "drag-over" : ""}`}
          onClick={() => inputRef.current.click()}
          onDragOver={(e) => { e.preventDefault(); setDropZoneOver(true); }}
          onDragLeave={() => setDropZoneOver(false)}
          onDrop={onZoneDrop}
        >
          <div style={{ fontSize: 32, marginBottom: 8 }}>📁</div>
          <p style={{ fontWeight: 600, marginBottom: 4, color: "#e8e2d9" }}>גרור תמונות לכאן</p>
          <p style={{ color: "#6b6c7e", fontSize: 12 }}>או לחץ לבחירת קבצים · JPG, PNG, HEIC</p>
          <p style={{ color: "#4a4b5e", fontSize: 11, marginTop: 6 }}>נותרו {maxPhotos - photos.length} מקומות</p>
          <input ref={inputRef} type="file" multiple accept="image/*" style={{ display: "none" }} onChange={e => handleFiles(e.target.files)} />
        </div>
      )}

      {photos.length > 0 && (
        <div className="timeline-wrap">
          <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 14, marginTop: 18 }}>
            <span style={{ fontSize: 12, color: "#6b6c7e" }}>↕️ גרור כדי לשנות סדר כרונולוגי</span>
            <button className="btn-ghost" style={{ padding: "4px 12px", fontSize: 11 }} onClick={() => setPhotos([])}>נקה הכל</button>
          </div>

          {photos.map((photo, idx) => {
            const isDragging = draggedId === photo.id;
            const isTarget = dragOverId === photo.id;
            const showConnector = idx < photos.length - 1;

            return (
              <div key={photo.id}>
                {/* Photo row */}
                <div className="timeline-photo-row">
                  <div
                    className={`timeline-photo-box ${isTarget ? "drag-target" : ""} ${isDragging ? "dragging" : ""}`}
                    draggable
                    onDragStart={e => onItemDragStart(e, photo.id)}
                    onDragOver={e => onItemDragOver(e, photo.id)}
                    onDrop={e => onItemDrop(e, photo.id)}
                    onDragEnd={onItemDragEnd}
                  >
                    <img src={photo.url} alt="" draggable={false} />
                    <div className="photo-num">{idx + 1}</div>
                    <button className="photo-remove" onClick={e => { e.stopPropagation(); removePhoto(photo.id); }}>✕</button>
                  </div>
                  <div style={{ flex: 1, fontSize: 12, color: "#6b6c7e" }}>
                    תמונה {idx + 1}
                    {idx === 0 && <span style={{ color: "#4a4b5e", marginRight: 6 }}>· ראשונה</span>}
                    {idx === photos.length - 1 && <span style={{ color: "#4a4b5e", marginRight: 6 }}>· אחרונה</span>}
                  </div>
                </div>

                {/* Connector + scene note between photos */}
                {showConnector && (
                  <div style={{ display: "flex", alignItems: "center", gap: 10, marginBottom: 4, paddingRight: 4 }}>
                    <div style={{ display: "flex", flexDirection: "column", alignItems: "center", width: 80, flexShrink: 0 }}>
                      <div style={{ width: 1, height: 8, background: "#3a3b4a" }} />
                      <div style={{ fontSize: 14, color: "#3a3b4a" }}>↕</div>
                      <div style={{ width: 1, height: 8, background: "#3a3b4a" }} />
                    </div>
                    <input
                      className="scene-input"
                      placeholder={`3 מילים על המעבר (למשל: יום הולדת ראשון)`}
                      value={sceneNotes[idx] || ""}
                      onChange={e => updateNote(idx, e.target.value)}
                      maxLength={40}
                    />
                  </div>
                )}
              </div>
            );
          })}
        </div>
      )}

      <div style={{ display: "flex", justifyContent: "flex-end", marginTop: 24 }}>
        <button className="btn-gold" onClick={onNext} disabled={photos.length === 0}>
          המשך לבחירת סגנון →
        </button>
      </div>
    </div>
  );
}

// ── STEP 2: Style ──────────────────────────────────────────────
function StepStyle({ selected, setSelected, onNext, onBack }) {
  return (
    <div className="card">
      <h2 className="serif" style={{ fontSize: 24, marginBottom: 8, color: "#e8e2d9" }}>בחרו את הסגנון</h2>
      <p style={{ color: "#6b6c7e", fontSize: 13, marginBottom: 24 }}>כל סגנון מתאים לאירועים שונים — בחרו את זה שמרגיש נכון.</p>
      <div className="style-grid">
        {STYLES_DATA.map(s => (
          <div key={s.id} className={`style-card ${selected === s.id ? "selected" : ""}`} onClick={() => setSelected(s.id)}>
            {selected === s.id && <div style={{ position: "absolute", top: 8, right: 8, background: "#c9a84c", color: "#0d0e14", width: 20, height: 20, borderRadius: "50%", display: "flex", alignItems: "center", justifyContent: "center", fontSize: 11, fontWeight: 700, zIndex: 2 }}>✓</div>}
            <span className="style-emoji">{s.emoji}</span>
            <div className="style-name">{s.name}</div>
            <div className="style-desc">{s.desc}</div>
            <div style={{ marginTop: 8, display: "flex", flexWrap: "wrap", gap: 3, justifyContent: "center" }}>
              {s.occasions.map((occ, i) => (
                <span key={i} className="occ-tag" style={{ background: selected === s.id ? "rgba(201,168,76,0.2)" : "rgba(255,255,255,0.06)", color: selected === s.id ? "#c9a84c" : "#8a8b9e", border: `1px solid ${selected === s.id ? "rgba(201,168,76,0.4)" : "rgba(255,255,255,0.08)"}` }}>{occ}</span>
              ))}
            </div>
            <div className="style-preview" style={{ background: s.preview, marginTop: 8 }} />
          </div>
        ))}
      </div>
      <div style={{ marginTop: 16, padding: "10px 14px", background: "rgba(201,168,76,0.06)", border: "1px solid rgba(201,168,76,0.15)", borderRadius: 10, fontSize: 12, color: "#8a8b9e", textAlign: "center" }}>
        💡 לא בטוחים? לסרטוני גדילה ואירועים משפחתיים — <span style={{ color: "#c9a84c", fontWeight: 600 }}>רומנטי</span> כמעט תמיד עובד מושלם
      </div>
      <div style={{ display: "flex", justifyContent: "space-between", marginTop: 22 }}>
        <button className="btn-ghost" onClick={onBack}>← חזרה</button>
        <button className="btn-gold" onClick={onNext} disabled={!selected}>המשך לבחירת מוזיקה →</button>
      </div>
    </div>
  );
}

// ── STEP 3: Music ──────────────────────────────────────────────
function StepMusic({ selected, setSelected, onNext, onBack }) {
  const [activeCategory, setActiveCategory] = useState("כולם");
  const [playing, setPlaying] = useState(null);
  const categories = ["כולם", ...Object.keys(MUSIC_LIBRARY)];
  const tracks = activeCategory === "כולם" ? ALL_TRACKS : (MUSIC_LIBRARY[activeCategory] || []);

  return (
    <div className="card">
      <h2 className="serif" style={{ fontSize: 24, marginBottom: 8, color: "#e8e2d9" }}>בחרו פסקול</h2>
      <p style={{ color: "#6b6c7e", fontSize: 13, marginBottom: 20 }}>לחצו על ▶ להאזנה, ובחרו את המוזיקה שמרגישה נכון.</p>
      <div className="cat-tabs">
        {categories.map(cat => <button key={cat} className={`cat-tab ${activeCategory === cat ? "active" : ""}`} onClick={() => setActiveCategory(cat)}>{cat}</button>)}
      </div>
      <div style={{ maxHeight: 340, overflowY: "auto" }}>
        {tracks.map(track => (
          <div key={track.id} className={`music-item ${selected === track.id ? "selected" : ""}`} onClick={() => setSelected(track.id)}>
            <button className={`music-play-btn ${playing === track.id ? "playing" : ""}`} onClick={e => { e.stopPropagation(); setPlaying(prev => prev === track.id ? null : track.id); }}>
              {playing === track.id ? "⏹" : "▶"}
            </button>
            <div style={{ flex: 1, minWidth: 0 }}>
              <div style={{ fontWeight: 600, fontSize: 13, marginBottom: 2, whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis", color: "#e8e2d9" }}>{track.name}</div>
              <div style={{ fontSize: 11, color: "#6b6c7e" }}>{track.artist}</div>
            </div>
            {playing === track.id && <div className="music-bar"><span style={{height:8}}/><span style={{height:14}}/><span style={{height:6}}/><span style={{height:16}}/><span style={{height:10}}/></div>}
            <div style={{ fontSize: 11, color: "#6b6c7e", flexShrink: 0 }}>{track.duration}</div>
            <div style={{ padding: "2px 8px", borderRadius: 20, background: "#1a1b27", fontSize: 10, color: "#6b6c7e", flexShrink: 0 }}>{track.mood}</div>
            {selected === track.id && <div style={{ color: "#c9a84c", fontWeight: 700, fontSize: 15, flexShrink: 0 }}>✓</div>}
          </div>
        ))}
      </div>
      <div style={{ display: "flex", justifyContent: "space-between", marginTop: 28 }}>
        <button className="btn-ghost" onClick={onBack}>← חזרה</button>
        <button className="btn-gold" onClick={onNext} disabled={!selected}>לסיכום וסיום →</button>
      </div>
    </div>
  );
}

// ── STEP 4: Summary ────────────────────────────────────────────
function StepSummary({ pkg, photos, style, music, onBack }) {
  const [name, setName] = useState("");
  const [phone, setPhone] = useState("");
  const [notes, setNotes] = useState("");
  const [submitted, setSubmitted] = useState(false);
  const [orderId] = useState(() => Math.random().toString(36).substr(2, 8).toUpperCase());

  const styleObj = STYLES_DATA.find(s => s.id === style);
  const trackObj = ALL_TRACKS.find(t => t.id === music);

  const inputSt = { width: "100%", background: "#0d0e14", border: "1px solid #3a3b4a", borderRadius: 8, padding: "11px 14px", color: "#e8e2d9", fontSize: 13, fontFamily: "'Inter',sans-serif", outline: "none", marginTop: 5, display: "block", transition: "border-color 0.2s" };

  if (submitted) {
    return (
      <div className="card" style={{ textAlign: "center", padding: "56px 28px" }}>
        <div className="success-ring">🎬</div>
        <h2 className="serif" style={{ fontSize: 28, marginBottom: 10, color: "#e8e2d9" }}>ההזמנה התקבלה!</h2>
        <p style={{ color: "#6b6c7e", fontSize: 14, lineHeight: 1.7, maxWidth: 380, margin: "0 auto 20px" }}>
          תודה {name}! קיבלנו את ההזמנה שלך עם {photos.length} תמונות. ניצור איתך קשר ב-{phone} תוך 24 שעות.
        </p>
        <div style={{ background: "rgba(201,168,76,0.08)", border: "1px solid rgba(201,168,76,0.2)", borderRadius: 12, padding: "14px 22px", display: "inline-block" }}>
          <div style={{ fontSize: 12, color: "#6b6c7e", marginBottom: 4 }}>מספר הזמנה</div>
          <div style={{ fontSize: 20, fontWeight: 700, color: "#c9a84c", fontFamily: "monospace" }}>#{orderId}</div>
        </div>
      </div>
    );
  }

  return (
    <div className="card">
      <h2 className="serif" style={{ fontSize: 24, marginBottom: 8, color: "#e8e2d9" }}>סיכום ופרטים אישיים</h2>
      <p style={{ color: "#6b6c7e", fontSize: 13, marginBottom: 24 }}>בדקו שהכל נכון וסיימו את ההזמנה.</p>
      <div style={{ background: "#0d0e14", borderRadius: 10, padding: "2px 14px", marginBottom: 24 }}>
        {[
          ["חבילה", pkg.name],
          ["תמונות שהועלו", `${photos.length} תמונות`],
          ["סגנון", `${styleObj?.emoji} ${styleObj?.name}`],
          ["פסקול", `${trackObj?.name} — ${trackObj?.artist}`],
          ["אורך סרטון", pkg.duration],
          pkg.hasFrame ? ["מסגרת דיגיטלית", pkg.frameSize] : null,
          ["מחיר", pkg.price],
        ].filter(Boolean).map(([key, val]) => (
          <div key={key} className="summary-row">
            <span className="summary-key">{key}</span>
            <span className="summary-val">{val}</span>
          </div>
        ))}
      </div>
      <div style={{ display: "flex", flexDirection: "column", gap: 14 }}>
        <div>
          <label style={{ fontSize: 12, color: "#6b6c7e" }}>שם מלא *</label>
          <input style={inputSt} value={name} onChange={e => setName(e.target.value)} placeholder="ישראל ישראלי" />
        </div>
        <div>
          <label style={{ fontSize: 12, color: "#6b6c7e" }}>טלפון *</label>
          <input style={inputSt} value={phone} onChange={e => setPhone(e.target.value)} placeholder="050-0000000" />
        </div>
        <div>
          <label style={{ fontSize: 12, color: "#6b6c7e" }}>הערות (אופציונלי)</label>
          <textarea style={{ ...inputSt, resize: "vertical", minHeight: 70 }} value={notes} onChange={e => setNotes(e.target.value)} placeholder="לדוגמא: מתנה ליום הולדת, שם הילד הוא..." />
        </div>
      </div>
      <div style={{ display: "flex", justifyContent: "space-between", marginTop: 28 }}>
        <button className="btn-ghost" onClick={onBack}>← חזרה</button>
        <button className="btn-gold" onClick={() => { if (name && phone) setSubmitted(true); }} disabled={!name || !phone}>🎬 שלח הזמנה</button>
      </div>
    </div>
  );
}

// ── MAIN APP ──────────────────────────────────────────────────
export default function App() {
  const [pkg, setPkg] = useState(null);
  const [step, setStep] = useState(0); // 0=upload 1=style 2=music 3=summary
  const [photos, setPhotos] = useState([]);
  const [sceneNotes, setSceneNotes] = useState([]);
  const [selectedStyle, setSelectedStyle] = useState(null);
  const [selectedMusic, setSelectedMusic] = useState(null);

  const handleSelectPackage = (p) => {
    setPkg(p);
    setStep(0);
    setPhotos([]);
    setSceneNotes([]);
    setSelectedStyle(null);
    setSelectedMusic(null);
  };

  return (
    <>
      <style>{STYLES}</style>
      <div dir="rtl" style={{ minHeight: "100vh", background: "#0d0e14", color: "#e8e2d9", fontFamily: "'Inter',sans-serif" }}>

        {/* Header */}
        <div style={{ borderBottom: "1px solid #1e1f2e", padding: "18px 24px", display: "flex", alignItems: "center", justifyContent: "space-between", maxWidth: 860, margin: "0 auto" }}>
          <div style={{ display: "flex", alignItems: "center", gap: 10, cursor: pkg ? "pointer" : "default" }} onClick={() => { if (pkg) { setPkg(null); } }}>
            <span className="serif" style={{ fontSize: 21, color: "#c9a84c", letterSpacing: "-0.01em" }}>רגעים של החיים</span>
            <span style={{ color: "#3a3b4a", margin: "0 4px" }}>|</span>
            <span style={{ fontSize: 12, color: "#6b6c7e" }}>Moments of Life</span>
          </div>
          {pkg && (
            <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
              <div style={{ fontSize: 11, color: "#6b6c7e", background: "#15161f", border: "1px solid #2a2b38", borderRadius: 20, padding: "3px 10px" }}>
                חבילת {pkg.name} · {pkg.price}
              </div>
              <div style={{ fontSize: 11, color: "#6b6c7e", background: "#15161f", border: "1px solid #2a2b38", borderRadius: 20, padding: "3px 10px" }}>
                שלב {step + 1} מתוך 4
              </div>
            </div>
          )}
        </div>

        {/* Main */}
        <div style={{ maxWidth: 860, margin: "0 auto", padding: "36px 16px 80px" }}>
          {!pkg ? (
            <StepPackage onSelect={handleSelectPackage} />
          ) : (
            <>
              <ProgressBar step={step} />
              {step === 0 && <StepUpload pkg={pkg} photos={photos} setPhotos={setPhotos} sceneNotes={sceneNotes} setSceneNotes={setSceneNotes} onNext={() => setStep(1)} />}
              {step === 1 && <StepStyle selected={selectedStyle} setSelected={setSelectedStyle} onNext={() => setStep(2)} onBack={() => setStep(0)} />}
              {step === 2 && <StepMusic selected={selectedMusic} setSelected={setSelectedMusic} onNext={() => setStep(3)} onBack={() => setStep(1)} />}
              {step === 3 && <StepSummary pkg={pkg} photos={photos} style={selectedStyle} music={selectedMusic} onBack={() => setStep(2)} />}
            </>
          )}
        </div>
      </div>
    </>
  );
}
