import React, { useState, useRef, useCallback } from "react";
import { db, storage } from "./firebase";
import { collection, addDoc, serverTimestamp } from "firebase/firestore";
import { ref, uploadBytes, getDownloadURL } from "firebase/storage";

// ── EMAILJS — email notifications ──────────────────────────────
// Fill these in after signing up (free) at emailjs.com.
// NOTE for US launch: create a NEW EmailJS account/templates for the US brand
// (or reuse this one, but update the "from" name/copy to English).
const EMAILJS_PUBLIC_KEY = "NE3YZm-vpQZyEQ9hL";
const EMAILJS_SERVICE_ID = "service_qbik3ut";
const EMAILJS_TEMPLATE_CUSTOMER = "template_uzjjemc";
const EMAILJS_TEMPLATE_ADMIN = "template_5cg5t9l";
const ADMIN_EMAIL = "momentsoflife.770@gmail.com";

// ── PAYMENTS ─────────────────────────────────────────────────────
// Safety switch: while this is false, checkout ends on the normal thank-you
// page with no redirect to a payment processor.
// NOTE for US launch: Invoice4U/Cardcom (Israeli processor) does not work
// for US customers — swap the api/create-payment.js, api/payment-callback.js
// and api/check-payment-status.js serverless functions for a US processor
// (e.g. Stripe) before enabling this in production.
const PAYMENT_INTEGRATION_ENABLED = false; // OFF for the US site for now — orders end on the normal thank-you page, no charge is made.

async function sendEmail(templateId, templateParams) {
  try {
    const res = await fetch("https://api.emailjs.com/api/v1.0/email/send", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        service_id: EMAILJS_SERVICE_ID,
        template_id: templateId,
        user_id: EMAILJS_PUBLIC_KEY,
        template_params: templateParams,
      }),
    });
    if (!res.ok) {
      console.error("Failed to send email:", await res.text());
    }
  } catch (e) {
    console.error("Error sending email:", e);
  }
}

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

  /* Value proposition — hero image with integrated benefits caption */
  .hero-image-wrap { border-radius: 16px; overflow: hidden; border: 1px solid #2a2b38; margin-bottom: 40px; background: #0f1018; }
  .hero-image-wrap img { width: 100%; height: auto; display: block; }
  .benefits-grid { display: grid; grid-template-columns: repeat(4, 1fr); gap: 0; border-top: 1px solid #2a2b38; }
  @media (max-width: 900px) { .benefits-grid { grid-template-columns: repeat(2, 1fr); } }
  @media (max-width: 480px) { .benefits-grid { grid-template-columns: 1fr; } }
  .benefit-card {
    padding: 18px 14px; text-align: center;
    border-left: 1px solid #2a2b38;
  }
  .benefit-card:first-child { border-left: none; }
  .benefit-icon { font-size: 24px; margin-bottom: 8px; }
  .benefit-title { color: #e8e2d9; font-size: 13px; font-weight: 700; margin-bottom: 4px; line-height: 1.4; }
  .benefit-sub { color: #6b6c7e; font-size: 11px; line-height: 1.5; }
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
  .package-features { list-style: none; margin-top: 14px; width: 100%; text-align: left; }
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
  .timeline-photo-box { position: relative; width: 80px; height: 80px; border-radius: 8px; overflow: hidden; flex-shrink: 0; cursor: grab; border: 2px solid transparent; transition: all 0.2s; -webkit-touch-callout: none; -webkit-user-select: none; user-select: none; }
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
  .scene-input::placeholder { color: #8a8b9e; }

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
// NOTE: USD prices below are a starting point (roughly converted + rounded
// for US price psychology). Adjust once you've validated margins with a US
// payment processor and US shipping costs.
const PACKAGES = [
  {
    id: "basic",
    name: "Basic",
    price: "$149",
    photos: 30,
    clips: 15,
    duration: "3 minutes",
    hasFrame: false,
    frameSize: null,
    highlight: false,
    badge: null,
    features: [
      { label: "Photos", val: "30" },
      { label: "Video length", val: "3 minutes" },
      { label: "Digital frame", val: "Not included" },
      { label: "Price", val: "$149" },
    ]
  },
  {
    id: "premium",
    name: "Premium",
    price: "$249",
    photos: 30,
    clips: 15,
    duration: "3 minutes",
    hasFrame: true,
    frameSize: '10"',
    highlight: true,
    badge: "Most Popular ⭐",
    features: [
      { label: "Photos", val: "30" },
      { label: "Video length", val: "3 minutes" },
      { label: "Digital frame", val: '10"' },
      { label: "Premium gift packaging", val: "✓" },
      { label: "Price", val: "$249" },
    ]
  },
  {
    id: "vip",
    name: "VIP 👑",
    price: "$449",
    photos: 40,
    clips: 20,
    duration: "4 minutes",
    hasFrame: true,
    frameSize: '15"',
    highlight: false,
    badge: null,
    features: [
      { label: "Photos", val: "40" },
      { label: "Video length", val: "4 minutes" },
      { label: "Digital frame", val: '15"' },
      { label: "Premium gift packaging", val: "✓" },
      { label: "Price", val: "$449" },
    ]
  }
];

const STYLES_DATA = [
  { id:"romantic",  emoji:"🌹", name:"Romantic",   desc:"Warm golden light, soft transitions, a feeling of love", occasions:["Bat/Bar Mitzvah","Wedding","New Baby","Anniversary"], preview:"linear-gradient(90deg,#d4a5b5,#f7d6e0)" },
  { id:"happy",     emoji:"✨", name:"Joyful & Vibrant",  desc:"Bold colors, festive energy, big celebrations",  occasions:["Birthday","Graduation","Family Trip","School Milestone"], preview:"linear-gradient(90deg,#e8c94c,#f7a500)" },
  { id:"modern",    emoji:"🎬", name:"Cinematic",  desc:"Movie-style, sharp contrast, luxurious and impressive", occasions:["Bar/Bat Mitzvah","Graduation","Business Launch","Big Achievement"], preview:"linear-gradient(90deg,#7a9fff,#4a6fff)" },
  { id:"nostalgic", emoji:"📷", name:"Nostalgic",  desc:"Vintage tones, old-album feel, warm sense of memory",     occasions:["50+ Birthday","Retirement","Wedding Anniversary"],       preview:"linear-gradient(90deg,#c4a882,#a07850)" },
  { id:"dramatic",  emoji:"🌙", name:"Dramatic",    desc:"Powerful transitions, light from the darkness, breathtaking", occasions:["Graduation","Bar/Bat Mitzvah","Big Win"],            preview:"linear-gradient(90deg,#9b7fff,#6a3fff)" },
  { id:"playful",   emoji:"🎈", name:"Playful",   desc:"Wonder and mischief, warm colors, a living storybook",  occasions:["Birthday (ages 1–5)","First Day of School","Holiday Party"],    preview:"linear-gradient(90deg,#7fd4a0,#4aaa6a)" },
];

// ── SHORT MUSIC LIBRARY (3-minute package — Basic + Premium) ──
const MUSIC_LIBRARY_SHORT = {
  "Romantic": [
    { id:1,  name:"A Gentle Breeze",   artist:"The Fly Guy Five",  duration:"3:28", file:"a-gentle-breeze_romantic-1.mp3",    mood:"Romantic" },
    { id:2,  name:"Beloved",           artist:"Tobias Voigt",      duration:"3:45", file:"beloved_romantic-2.mp3",            mood:"Romantic" },
    { id:3,  name:"Pure Life",         artist:"Aakash Gandhi",     duration:"3:55", file:"pure-life_romantic-3.mp3",          mood:"Romantic" },
    { id:4,  name:"Memories",          artist:"Bensound",          duration:"3:32", file:"memories_romantic-4.mp3",           mood:"Romantic" },
    { id:5,  name:"Tenderness",        artist:"Aakash Gandhi",     duration:"3:20", file:"tenderness_romantic-5.mp3",         mood:"Romantic" },
  ],
  "Joyful & Vibrant": [
    { id:6,  name:"Happy Background",  artist:"Bensound",          duration:"3:24", file:"happy-background_happy-1.mp3",      mood:"Joyful & Vibrant" },
    { id:7,  name:"Ukulele",           artist:"Bensound",          duration:"3:32", file:"ukulele_happy-2.mp3",               mood:"Joyful & Vibrant" },
    { id:8,  name:"Sunny Days",        artist:"Loxbeats",          duration:"3:15", file:"sunny-days_happy-3.mp3",            mood:"Joyful & Vibrant" },
    { id:9,  name:"Summer Smile",      artist:"Del",               duration:"3:40", file:"summer-smile_happy-4.mp3",          mood:"Joyful & Vibrant" },
    { id:10, name:"Positive Carefree", artist:"Rafael Krux",       duration:"3:20", file:"positive-carefree_happy-5.mp3",     mood:"Joyful & Vibrant" },
  ],
  "Cinematic": [
    { id:11, name:"Inspiring",         artist:"Bensound",          duration:"3:10", file:"inspiring_cinematic-1.mp3",         mood:"Cinematic" },
    { id:12, name:"Emergence",         artist:"Jimena Contreras",  duration:"3:20", file:"emergence_cinematic-2.mp3",         mood:"Cinematic" },
    { id:13, name:"Epic Rise",         artist:"Rafael Krux",       duration:"3:15", file:"epic-rise_cinematic-3.mp3",         mood:"Cinematic" },
    { id:14, name:"Cinematic Dawn",    artist:"Kevin MacLeod",     duration:"3:30", file:"cinematic-dawn_cinematic-4.mp3",    mood:"Cinematic" },
    { id:15, name:"Tension",           artist:"Bensound",          duration:"3:58", file:"tension_cinematic-5.mp3",           mood:"Cinematic" },
  ],
  "Nostalgic": [
    { id:16, name:"Once Upon a Time",  artist:"DP Music",          duration:"3:50", file:"once-upon-a-time_nostalgic-1.mp3",  mood:"Nostalgic" },
    { id:17, name:"Nostalgia",         artist:"Tobu",              duration:"3:45", file:"nostalgia_nostalgic-2.mp3",         mood:"Nostalgic" },
    { id:18, name:"Sentimental",       artist:"Bensound",          duration:"3:36", file:"sentimental_nostalgic-3.mp3",       mood:"Nostalgic" },
    { id:19, name:"Old Memories",      artist:"Everet Zeevalkink", duration:"3:50", file:"old-memories_nostalgic-4.mp3",      mood:"Nostalgic" },
    { id:20, name:"Reflection",        artist:"Aakash Gandhi",     duration:"3:40", file:"reflection_nostalgic-5.mp3",        mood:"Nostalgic" },
  ],
  "Dramatic": [
    { id:21, name:"Darkness",          artist:"Bensound",          duration:"3:58", file:"darkness_dramatic-1.mp3",           mood:"Dramatic" },
    { id:22, name:"Tension Rise",      artist:"Bensound",          duration:"3:30", file:"tension-rise_dramatic-2.mp3",       mood:"Dramatic" },
    { id:23, name:"Power",             artist:"Rafael Krux",       duration:"3:45", file:"power_dramatic-3.mp3",              mood:"Dramatic" },
    { id:24, name:"Storm",             artist:"Kevin MacLeod",     duration:"3:20", file:"storm_dramatic-4.mp3",              mood:"Dramatic" },
    { id:25, name:"Rising",            artist:"Jimena Contreras",  duration:"3:50", file:"rising_dramatic-5.mp3",             mood:"Dramatic" },
  ],
  "Playful": [
    { id:26, name:"Sweet",             artist:"Bensound",          duration:"3:20", file:"sweet_playful-1.mp3",               mood:"Playful" },
    { id:27, name:"Whimsical",         artist:"Aakash Gandhi",     duration:"3:15", file:"whimsical_playful-2.mp3",           mood:"Playful" },
    { id:28, name:"Children Festival", artist:"Rafael Krux",       duration:"3:30", file:"children-festival_playful-3.mp3",   mood:"Playful" },
    { id:29, name:"Happy Kids",        artist:"Loxbeats",          duration:"3:10", file:"happy-kids_playful-4.mp3",          mood:"Playful" },
    { id:30, name:"Playful Day",       artist:"Bensound",          duration:"3:25", file:"playful-day_playful-5.mp3",         mood:"Playful" },
  ],
};

// ── LONG MUSIC LIBRARY (4-minute package — VIP) ──
const MUSIC_LIBRARY_LONG = {
  "Romantic": [
    { id:101, name:"Weightless",          artist:"Marconi Union",      duration:"4:10", file:"weightless_romantic-long-1.mp3",           mood:"Romantic" },
    { id:102, name:"Beloved Long",        artist:"Tobias Voigt",       duration:"4:30", file:"beloved-long_romantic-long-2.mp3",          mood:"Romantic" },
    { id:103, name:"Eternal Love",        artist:"Aakash Gandhi",      duration:"4:20", file:"eternal-love_romantic-long-3.mp3",          mood:"Romantic" },
    { id:104, name:"Romance",             artist:"Bensound",           duration:"4:05", file:"romance_romantic-long-4.mp3",               mood:"Romantic" },
    { id:105, name:"Forever",             artist:"DP Music",           duration:"4:45", file:"forever_romantic-long-5.mp3",               mood:"Romantic" },
  ],
  "Joyful & Vibrant": [
    { id:106, name:"Celebration",         artist:"Bensound",           duration:"4:12", file:"celebration_happy-long-1.mp3",              mood:"Joyful & Vibrant" },
    { id:107, name:"Joy",                 artist:"Rafael Krux",        duration:"4:05", file:"joy_happy-long-2.mp3",                      mood:"Joyful & Vibrant" },
    { id:108, name:"Good Day",            artist:"Loxbeats",           duration:"4:20", file:"good-day_happy-long-3.mp3",                 mood:"Joyful & Vibrant" },
    { id:109, name:"Sunshine",            artist:"Del",                duration:"4:15", file:"sunshine_happy-long-4.mp3",                 mood:"Joyful & Vibrant" },
    { id:110, name:"Happy Together",      artist:"Aakash Gandhi",      duration:"4:30", file:"happy-together_happy-long-5.mp3",           mood:"Joyful & Vibrant" },
  ],
  "Cinematic": [
    { id:111, name:"Dreams",              artist:"Bensound",           duration:"4:45", file:"dreams_cinematic-long-1.mp3",               mood:"Cinematic" },
    { id:112, name:"Epic Motivation",     artist:"Rafael Krux",        duration:"4:15", file:"epic-motivation_cinematic-long-2.mp3",      mood:"Cinematic" },
    { id:113, name:"Cinematic Suspense",  artist:"Kevin MacLeod",      duration:"4:30", file:"cinematic-suspense_cinematic-long-3.mp3",   mood:"Cinematic" },
    { id:114, name:"Inspiring Journey",   artist:"Jimena Contreras",   duration:"4:20", file:"inspiring-journey_cinematic-long-4.mp3",    mood:"Cinematic" },
    { id:115, name:"Grand Vision",        artist:"DP Music",           duration:"4:40", file:"grand-vision_cinematic-long-5.mp3",         mood:"Cinematic" },
  ],
  "Nostalgic": [
    { id:116, name:"Old Memories Long",   artist:"Everet Zeevalkink",  duration:"4:00", file:"old-memories-long_nostalgic-long-1.mp3",    mood:"Nostalgic" },
    { id:117, name:"Yesterday",           artist:"Bensound",           duration:"4:15", file:"yesterday_nostalgic-long-2.mp3",            mood:"Nostalgic" },
    { id:118, name:"Times Gone By",       artist:"Tobu",               duration:"4:30", file:"times-gone-by_nostalgic-long-3.mp3",        mood:"Nostalgic" },
    { id:119, name:"Long Ago",            artist:"Aakash Gandhi",      duration:"4:10", file:"long-ago_nostalgic-long-4.mp3",             mood:"Nostalgic" },
    { id:120, name:"Sweet Memories",      artist:"DP Music",           duration:"4:45", file:"sweet-memories_nostalgic-long-5.mp3",       mood:"Nostalgic" },
  ],
  "Dramatic": [
    { id:121, name:"Darkness Long",       artist:"Bensound",           duration:"4:12", file:"darkness-long_dramatic-long-1.mp3",         mood:"Dramatic" },
    { id:122, name:"Epic Trailer",        artist:"Rafael Krux",        duration:"4:40", file:"epic-trailer_dramatic-long-2.mp3",          mood:"Dramatic" },
    { id:123, name:"Into the Unknown",    artist:"Jimena Contreras",   duration:"4:15", file:"into-the-unknown_dramatic-long-3.mp3",      mood:"Dramatic" },
    { id:124, name:"Powerful Cinematic",  artist:"Kevin MacLeod",      duration:"4:20", file:"powerful-cinematic_dramatic-long-4.mp3",    mood:"Dramatic" },
    { id:125, name:"Thunder",             artist:"DP Music",           duration:"4:35", file:"thunder_dramatic-long-5.mp3",               mood:"Dramatic" },
  ],
  "Playful": [
    { id:126, name:"Cute Long",           artist:"Bensound",           duration:"4:05", file:"cute-long_playful-long-1.mp3",              mood:"Playful" },
    { id:127, name:"Adventure",           artist:"Rafael Krux",        duration:"4:20", file:"adventure_playful-long-2.mp3",              mood:"Playful" },
    { id:128, name:"Magic Garden",        artist:"Aakash Gandhi",      duration:"4:10", file:"magic-garden_playful-long-3.mp3",           mood:"Playful" },
    { id:129, name:"Fairy Tale",          artist:"DP Music",           duration:"4:30", file:"fairy-tale_playful-long-4.mp3",             mood:"Playful" },
    { id:130, name:"Rainbow",             artist:"Loxbeats",           duration:"4:15", file:"rainbow_playful-long-5.mp3",               mood:"Playful" },
  ],
};

const ALL_TRACKS = [
  ...Object.values(MUSIC_LIBRARY_SHORT).flat(),
  ...Object.values(MUSIC_LIBRARY_LONG).flat(),
];

// ── FRAME MOCKUP COMPONENT ────────────────────────────────────
function FrameMockup({ pkg }) {
  const IMAGE_BASIC = "/product-basic.png";
  const IMAGE_10 = "/product-10inch.png";
  const IMAGE_15 = "/product-15inch.png";

  const imgSrc = !pkg.hasFrame ? IMAGE_BASIC : pkg.frameSize === '15"' ? IMAGE_15 : IMAGE_10;
  const imgHeight = 230;

  return (
    <div style={{ marginBottom: 12, width: "100%", height: imgHeight, display: "flex", alignItems: "center", justifyContent: "center" }}>
      <img
        src={imgSrc}
        alt={pkg.name}
        style={{ maxHeight: "100%", maxWidth: "100%", width: "auto", height: "auto", objectFit: "contain", borderRadius: 8 }}
        onError={e => { e.target.style.display = "none"; }}
      />
    </div>
  );
}

// ── STEP 0: Package selection ─────────────────────────────────
function StepPackage({ onSelect }) {
  return (
    <div>
      <div style={{ textAlign: "center", marginBottom: 28 }}>
        <h1 className="serif" style={{ fontSize: 42, lineHeight: 1.2, marginBottom: 16, letterSpacing: "-0.02em", color: "#e8e2d9" }}>
          Your memories <span style={{ color: "#c9a84c" }}>come back to life</span>
        </h1>
        <p style={{ color: "#8a8b9e", fontSize: 16, lineHeight: 1.8, maxWidth: 540, margin: "0 auto" }}>
          From your own photos, we create a moving personal memory video — delivered ready to watch on a luxury digital picture frame for your home
        </p>
      </div>

      {/* Hero image — frame in use + gift box, with integrated benefits caption */}
      <div className="hero-image-wrap">
        <img src="/frame-gift-hero.jpg" alt="Moments of Life digital frame at home and in luxury packaging" />
        <div className="benefits-grid">
          <div className="benefit-card">
            <div className="benefit-icon">🎬</div>
            <div className="benefit-title">A custom memory video</div>
            <div className="benefit-sub">Made from your photos, with music and a story</div>
          </div>
          <div className="benefit-card">
            <div className="benefit-icon">🖼️</div>
            <div className="benefit-title">A smart touchscreen digital frame</div>
            <div className="benefit-sub">The video comes pre-loaded on it (Premium & VIP)</div>
          </div>
          <div className="benefit-card">
            <div className="benefit-icon">📱</div>
            <div className="benefit-title">Updates right from your phone</div>
            <div className="benefit-sub">Send new photos to it anytime</div>
          </div>
          <div className="benefit-card">
            <div className="benefit-icon">🎁</div>
            <div className="benefit-title">Beautifully designed packaging</div>
            <div className="benefit-sub">The perfect gift for any occasion</div>
          </div>
        </div>
      </div>

      {/* Demo video 1 - memory video example */}
      <div style={{ marginBottom: 20, borderRadius: 16, overflow: "hidden", background: "#0d0e14", border: "1px solid #2a2b38" }}>
        <div style={{ padding: "16px 20px 12px", display: "flex", alignItems: "center", gap: 10 }}>
          <div style={{ width: 8, height: 8, borderRadius: "50%", background: "#c9a84c" }} />
          <span style={{ fontSize: 13, color: "#6b6c7e" }}>Sample video — here's what a memory video we made looks like</span>
        </div>
        <div style={{ position: "relative", paddingBottom: "56.25%", height: 0 }}>
          <iframe
            src="https://www.youtube.com/embed/Qdrh4a72yNQ?rel=0&modestbranding=1"
            title="Sample video - Moments of Life"
            frameBorder="0"
            allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture"
            allowFullScreen
            style={{ position: "absolute", top: 0, left: 0, width: "100%", height: "100%" }}
          />
        </div>
      </div>

      {/* Demo video 2 - gift unboxing */}
      <div style={{ marginBottom: 40, borderRadius: 16, overflow: "hidden", background: "#0d0e14", border: "1px solid #2a2b38" }}>
        <div style={{ padding: "16px 20px 12px", display: "flex", alignItems: "center", gap: 10 }}>
          <div style={{ width: 8, height: 8, borderRadius: "50%", background: "#c9a84c" }} />
          <span style={{ fontSize: 13, color: "#6b6c7e" }}>🎁 The digital frame — see the gift-unboxing experience</span>
        </div>
        <div style={{ position: "relative", paddingBottom: "56.25%", height: 0 }}>
          <iframe
            src="https://www.youtube.com/embed/cztUZUbTyZ4?rel=0&modestbranding=1"
            title="Unboxing - Moments of Life digital frame"
            frameBorder="0"
            allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture"
            allowFullScreen
            style={{ position: "absolute", top: 0, left: 0, width: "100%", height: "100%" }}
          />
        </div>
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
              Choose this package
            </button>
          </div>
        ))}
      </div>

      {/* Frame bonus note */}
      <div style={{ marginTop: 24, padding: "16px 20px", background: "rgba(201,168,76,0.06)", border: "1px solid rgba(201,168,76,0.18)", borderRadius: 12, display: "flex", alignItems: "center", gap: 16 }}>
        <img src="/frame-display.jpg" alt="Digital picture frame" style={{ width: 90, height: 65, objectFit: "cover", borderRadius: 8, flexShrink: 0 }} />
        <p style={{ fontSize: 14, color: "#a0a1b5", lineHeight: 1.6, margin: 0 }}>
          <strong style={{ color: "#c9a84c" }}>The frame doesn't just play your video</strong> — it also displays any photo you send to it from your phone, with one tap. A beautiful, living piece of decor for the home.
        </p>
      </div>

      <p style={{ marginTop: 14, textAlign: "center", fontSize: 13, color: "#6b6c7e" }}>
        ⏱ Estimated delivery: within 14 business days
      </p>
    </div>
  );
}

// ── PROGRESS BAR ──────────────────────────────────────────────
function ProgressBar({ step }) {
  const steps = ["Photos", "Style", "Music", "Summary"];
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
function StepUpload({ pkg, photos, setPhotos, sceneNotes, setSceneNotes, onNext, onBack }) {
  const [dropZoneOver, setDropZoneOver] = useState(false);
  const [draggedId, setDraggedId] = useState(null);
  const [dragOverId, setDragOverId] = useState(null);
  const inputRef = useRef();
  const touchDraggedId = useRef(null);
  const touchDragOverId = useRef(null);

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

  const onTouchStart = (e, id) => {
    touchDraggedId.current = id;
    setDraggedId(id);
  };
  const onTouchMove = (e) => {
    e.preventDefault();
    const touch = e.touches[0];
    const boxes = document.querySelectorAll('[data-photo-id]');
    boxes.forEach(box => {
      const rect = box.getBoundingClientRect();
      if (touch.clientX >= rect.left && touch.clientX <= rect.right &&
          touch.clientY >= rect.top && touch.clientY <= rect.bottom) {
        const targetId = parseFloat(box.dataset.photoId);
        if (targetId !== touchDraggedId.current) {
          setDragOverId(targetId);
          touchDragOverId.current = targetId;
        }
      }
    });
  };
  const onTouchEnd = () => {
    const fromId = touchDraggedId.current;
    const toId = touchDragOverId.current;
    if (fromId && toId && fromId !== toId) {
      setPhotos(prev => {
        const arr = [...prev];
        const fi = arr.findIndex(p => p.id === fromId);
        const ti = arr.findIndex(p => p.id === toId);
        if (fi === -1 || ti === -1) return prev;
        const [item] = arr.splice(fi, 1);
        arr.splice(ti, 0, item);
        return arr;
      });
    }
    touchDraggedId.current = null;
    touchDragOverId.current = null;
    setDraggedId(null);
    setDragOverId(null);
  };

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
        <h2 className="serif" style={{ fontSize: 24, color: "#e8e2d9" }}>Upload your photos</h2>
        <div style={{ background: "rgba(201,168,76,0.12)", border: "1px solid rgba(201,168,76,0.3)", borderRadius: 8, padding: "6px 14px", fontSize: 13, color: "#c9a84c", fontWeight: 700, flexShrink: 0 }}>
          {photos.length} / {maxPhotos} photos
        </div>
      </div>
      <p style={{ color: "#6b6c7e", fontSize: 13, marginBottom: 14, lineHeight: 1.6 }}>
        The <strong style={{ color: "#c9a84c" }}>{pkg.name}</strong> package includes up to <strong style={{ color: "#c9a84c" }}>{maxPhotos} photos</strong>.
        Once uploaded, you can drag to arrange them in chronological order, and add a few words about the transition between any two photos (optional).
      </p>

      <p style={{ color: "#e8e2d9", fontSize: 14, marginBottom: 20, lineHeight: 1.7, background: "rgba(201,168,76,0.08)", border: "1px solid rgba(201,168,76,0.25)", borderRadius: 8, padding: "10px 14px" }}>
        ⚠️ <strong style={{ color: "#c9a84c" }}>Important:</strong> choose photos where faces are as clear and visible as possible — this directly affects the quality of the final video. Landscape-orientation photos are preferred <strong style={{ color: "#c9a84c" }}>(not required)</strong>.
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
          <p style={{ fontWeight: 600, marginBottom: 4, color: "#e8e2d9" }}>Drag photos here</p>
          <p style={{ color: "#6b6c7e", fontSize: 12 }}>or click to choose files · JPG, PNG, HEIC</p>
          <p style={{ color: "#4a4b5e", fontSize: 11, marginTop: 6 }}>{maxPhotos - photos.length} slots remaining</p>
          <input ref={inputRef} type="file" multiple accept="image/*" style={{ display: "none" }} onChange={e => handleFiles(e.target.files)} />
        </div>
      )}

      {photos.length > 0 && (
        <div className="timeline-wrap">
          <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 14, marginTop: 18 }}>
            <span style={{ fontSize: 12, color: "#6b6c7e" }}>↕️ Drag to reorder chronologically</span>
            <button className="btn-ghost" style={{ padding: "4px 12px", fontSize: 11 }} onClick={() => setPhotos([])}>Clear all</button>
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
                    data-photo-id={photo.id}
                    draggable
                    onDragStart={e => onItemDragStart(e, photo.id)}
                    onDragOver={e => onItemDragOver(e, photo.id)}
                    onDrop={e => onItemDrop(e, photo.id)}
                    onDragEnd={onItemDragEnd}
                    onTouchStart={e => onTouchStart(e, photo.id)}
                    onTouchMove={onTouchMove}
                    onTouchEnd={onTouchEnd}
                    style={{ touchAction: "none" }}
                  >
                    <img src={photo.url} alt="" draggable={false} />
                    <div className="photo-num">{idx + 1}</div>
                    <button className="photo-remove" onClick={e => { e.stopPropagation(); removePhoto(photo.id); }}>✕</button>
                  </div>
                  <div style={{ flex: 1, fontSize: 12, color: "#6b6c7e" }}>
                    Photo {idx + 1}
                    {idx === 0 && <span style={{ color: "#4a4b5e", marginLeft: 6 }}>· first</span>}
                    {idx === photos.length - 1 && <span style={{ color: "#4a4b5e", marginLeft: 6 }}>· last</span>}
                  </div>
                </div>

                {/* Connector + scene note between photos */}
                {showConnector && (
                  <div style={{ display: "flex", alignItems: "center", gap: 10, marginBottom: 4, paddingLeft: 4 }}>
                    <div style={{ display: "flex", flexDirection: "column", alignItems: "center", width: 80, flexShrink: 0 }}>
                      <div style={{ width: 1, height: 8, background: "#3a3b4a" }} />
                      <div style={{ fontSize: 14, color: "#3a3b4a" }}>↕</div>
                      <div style={{ width: 1, height: 8, background: "#3a3b4a" }} />
                    </div>
                    <input
                      className="scene-input"
                      placeholder={`A few words about this transition (optional) — e.g.: their first birthday`}
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

      <div style={{ display: "flex", justifyContent: "space-between", marginTop: 24 }}>
        <button className="btn-ghost" onClick={onBack}>← Back to packages</button>
        <button className="btn-gold" onClick={onNext} disabled={photos.length === 0}>
          Continue to style selection →
        </button>
      </div>
    </div>
  );
}

// ── STEP 2: Style ──────────────────────────────────────────────
function StepStyle({ selected, setSelected, onNext, onBack }) {
  return (
    <div className="card">
      <h2 className="serif" style={{ fontSize: 24, marginBottom: 8, color: "#e8e2d9" }}>Choose a style</h2>
      <p style={{ color: "#6b6c7e", fontSize: 13, marginBottom: 24 }}>Each style suits different occasions — pick the one that feels right.</p>
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
        💡 Not sure? For growing-up videos and family milestones — <span style={{ color: "#c9a84c", fontWeight: 600 }}>Romantic</span> works beautifully almost every time
      </div>
      <div style={{ display: "flex", justifyContent: "space-between", marginTop: 22 }}>
        <button className="btn-ghost" onClick={onBack}>← Back</button>
        <button className="btn-gold" onClick={onNext} disabled={!selected}>Continue to music selection →</button>
      </div>
    </div>
  );
}

// ── STEP 3: Music ──────────────────────────────────────────────
function StepMusic({ pkg, selected, setSelected, customTrack, setCustomTrack, onNext, onBack }) {
  const isVIP = pkg?.id === "vip";
  const MUSIC_LIBRARY = isVIP ? MUSIC_LIBRARY_LONG : MUSIC_LIBRARY_SHORT;
  const [activeCategory, setActiveCategory] = useState(Object.keys(MUSIC_LIBRARY)[0]);
  const [playing, setPlaying] = useState(null);
  const [showPlayer, setShowPlayer] = useState(false);
  const [currentYtId, setCurrentYtId] = useState(null);
  const customFileRef = useRef();

  const categories = Object.keys(MUSIC_LIBRARY);
  const tracks = MUSIC_LIBRARY[activeCategory] || [];

  const handlePlay = (e, track) => {
    e.stopPropagation();
    if (playing === track.id) {
      setPlaying(null);
      setShowPlayer(false);
      setCurrentYtId(null);
    } else {
      setPlaying(track.id);
      setCurrentYtId(track.file ? (track.id >= 101 ? `/music/long/${track.file}` : `/music/${track.file}`) : null);
      setShowPlayer(true);
    }
  };

  const handleCustomFile = (e) => {
    const file = e.target.files[0];
    if (!file) return;
    setCustomTrack({ name: file.name.replace(/\.[^.]+$/, ""), file });
    setSelected("custom");
    setPlaying(null);
    setShowPlayer(false);
  };

  return (
    <div className="card">
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 8 }}>
        <h2 className="serif" style={{ fontSize: 24, color: "#e8e2d9" }}>Choose a soundtrack</h2>
        <div style={{ fontSize: 11, padding: "4px 12px", borderRadius: 20, background: isVIP ? "rgba(201,168,76,0.15)" : "rgba(255,255,255,0.06)", border: `1px solid ${isVIP ? "#c9a84c" : "#3a3b4a"}`, color: isVIP ? "#c9a84c" : "#6b6c7e" }}>
          {isVIP ? "👑 4+ minute songs" : "3-minute songs"}
        </div>
      </div>
      <p style={{ color: "#6b6c7e", fontSize: 13, marginBottom: 20 }}>Press ▶ to preview, and pick the music that feels right to you.</p>

      {/* Mini audio player */}
      {showPlayer && currentYtId && (
        <div style={{ marginBottom: 16, borderRadius: 10, padding: "12px 16px", border: "1px solid #c9a84c", background: "rgba(201,168,76,0.06)", display: "flex", alignItems: "center", gap: 12 }}>
          <span style={{ fontSize: 20 }}>🎵</span>
          <audio
            key={currentYtId}
            controls
            autoPlay
            style={{ flex: 1, height: 36, accentColor: "#c9a84c" }}
          >
            <source src={currentYtId} type="audio/mpeg" />
          </audio>
        </div>
      )}

      {/* Category tabs */}
      <div className="cat-tabs" style={{ marginBottom: 14 }}>
        {categories.map(cat => (
          <button key={cat} className={`cat-tab ${activeCategory === cat ? "active" : ""}`}
            onClick={() => { setActiveCategory(cat); setPlaying(null); setShowPlayer(false); }}>
            {cat}
          </button>
        ))}
      </div>

      {/* Track list */}
      <div style={{ maxHeight: 320, overflowY: "auto", marginBottom: 16 }}>
        {tracks.map(track => (
          <div key={track.id} className={`music-item ${selected === track.id ? "selected" : ""}`} onClick={() => { setSelected(track.id); setCustomTrack(null); }}>
            <button
              className={`music-play-btn ${playing === track.id ? "playing" : ""}`}
              onClick={e => handlePlay(e, track)}
              title="Preview this track"
            >
              {playing === track.id ? "⏹" : "▶"}
            </button>
            <div style={{ flex: 1, minWidth: 0 }}>
              <div style={{ fontWeight: 600, fontSize: 13, marginBottom: 2, whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis", color: "#e8e2d9" }}>{track.name}</div>
              <div style={{ fontSize: 11, color: "#6b6c7e" }}>{track.artist}</div>
            </div>
            {playing === track.id && (
              <div className="music-bar">
                <span style={{height:8}}/><span style={{height:14}}/><span style={{height:6}}/><span style={{height:16}}/><span style={{height:10}}/>
              </div>
            )}
            <div style={{ fontSize: 11, color: "#6b6c7e", flexShrink: 0 }}>{track.duration}</div>
            {selected === track.id && <div style={{ color: "#c9a84c", fontWeight: 700, fontSize: 15, flexShrink: 0 }}>✓</div>}
          </div>
        ))}
      </div>

      {/* Upload custom track */}
      <div style={{ borderTop: "1px solid #2a2b38", paddingTop: 16 }}>
        <p style={{ fontSize: 12, color: "#6b6c7e", marginBottom: 10 }}>
          🎵 Didn't find the right song? You can upload your own:
        </p>
        <div
          style={{ border: `2px dashed ${selected === "custom" ? "#c9a84c" : "#3a3b4a"}`, borderRadius: 10, padding: "14px 16px", cursor: "pointer", background: selected === "custom" ? "rgba(201,168,76,0.06)" : "#0d0e14", display: "flex", alignItems: "center", gap: 12, transition: "all 0.2s" }}
          onClick={() => customFileRef.current.click()}
        >
          <span style={{ fontSize: 22 }}>📂</span>
          <div style={{ flex: 1 }}>
            {customTrack
              ? <div style={{ fontWeight: 600, fontSize: 13, color: "#c9a84c" }}>✓ {customTrack.name}</div>
              : <div style={{ fontSize: 13, color: "#8a8b9e" }}>Click to upload an MP3 / WAV file</div>
            }
          </div>
          {selected === "custom" && <div style={{ color: "#c9a84c", fontWeight: 700 }}>✓</div>}
        </div>
        <input ref={customFileRef} type="file" accept="audio/*" style={{ display: "none" }} onChange={handleCustomFile} />
      </div>

      <div style={{ display: "flex", justifyContent: "space-between", marginTop: 24 }}>
        <button className="btn-ghost" onClick={onBack}>← Back</button>
        <button className="btn-gold" onClick={onNext} disabled={!selected}>Continue to summary →</button>
      </div>
    </div>
  );
}

// ── STEP 4: Summary ────────────────────────────────────────────
function StepSummary({ pkg, photos, sceneNotes, style, music, customTrack, onBack }) {
  const [firstName, setFirstName] = useState("");
  const [lastName, setLastName] = useState("");
  const [email, setEmail] = useState("");
  const [phone, setPhone] = useState("");
  const [streetAddress, setStreetAddress] = useState("");
  const [aptUnit, setAptUnit] = useState("");
  const [city, setCity] = useState("");
  const [state, setState] = useState("");
  const [zip, setZip] = useState("");
  const [notes, setNotes] = useState("");
  const [submitted, setSubmitted] = useState(false);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(null);
  const [orderId] = useState(() => Math.random().toString(36).substr(2, 8).toUpperCase());

  const styleObj = STYLES_DATA.find(s => s.id === style);
  const trackObj = music === "custom" ? { name: customTrack?.name || "Custom uploaded song", artist: "Personal upload" } : ALL_TRACKS.find(t => t.id === music);

  const inputSt = { width: "100%", background: "#0d0e14", border: "1px solid #3a3b4a", borderRadius: 8, padding: "11px 14px", color: "#e8e2d9", fontSize: 13, fontFamily: "'Inter',sans-serif", outline: "none", marginTop: 5, display: "block", transition: "border-color 0.2s" };

  const handleSubmit = async () => {
    if (!firstName || !lastName || !email || !phone || !streetAddress || !city || !state || !zip) return;
    setLoading(true);
    setError(null);
    try {
      // 1. Upload photos to Storage
      const photoURLs = await Promise.all(photos.map(async (photo, idx) => {
        const response = await fetch(photo.url);
        const blob = await response.blob();
        const storageRef = ref(storage, `orders/${orderId}/photo-${idx + 1}.jpg`);
        await uploadBytes(storageRef, blob);
        const url = await getDownloadURL(storageRef);
        return { index: idx + 1, url, name: photo.name };
      }));

      // 2. Upload custom song, if any
      let customTrackURL = null;
      if (music === "custom" && customTrack?.file) {
        const trackRef = ref(storage, `orders/${orderId}/custom-track-${customTrack.name}`);
        await uploadBytes(trackRef, customTrack.file);
        customTrackURL = await getDownloadURL(trackRef);
      }

      // 3. Save order details to Firestore
      await addDoc(collection(db, "orders"), {
        orderId,
        firstName,
        lastName,
        name: `${firstName} ${lastName}`.trim(),
        email,
        phone,
        streetAddress,
        aptUnit: aptUnit || "",
        city,
        state,
        zip,
        notes: notes || "",
        sceneNotes: (sceneNotes || []).map(n => n || ""),
        package: pkg.name,
        packagePrice: pkg.price,
        photoCount: photos.length,
        photos: photoURLs,
        style: styleObj?.name || style || "",
        music: music === "custom" ? (customTrack?.name || "") : (trackObj?.name || ""),
        musicArtist: music === "custom" ? "Personal upload" : (trackObj?.artist || ""),
        customTrackURL: customTrackURL || "",
        status: "New",
        createdAt: serverTimestamp(),
      });

      // 4. Send confirmation email to customer + notification email to admin
      await Promise.all([
        sendEmail(EMAILJS_TEMPLATE_CUSTOMER, {
          to_email: email,
          first_name: firstName,
          last_name: lastName,
          order_id: orderId,
          package_name: pkg.name,
          package_price: pkg.price,
        }),
        sendEmail(EMAILJS_TEMPLATE_ADMIN, {
          to_email: ADMIN_EMAIL,
          first_name: firstName,
          last_name: lastName,
          customer_email: email,
          phone,
          street_address: streetAddress,
          apt_unit: aptUnit || "",
          city,
          state,
          zip,
          order_id: orderId,
          package_name: pkg.name,
          package_price: pkg.price,
          photo_count: photos.length,
          notes: notes || "—",
        }),
      ]);

      // 5. Redirect to payment (only if the integration is enabled - see safety switch at top of file)
      if (PAYMENT_INTEGRATION_ENABLED) {
        try {
          const paymentRes = await fetch("/api/create-payment", {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({
              orderId,
              firstName,
              lastName,
              phone,
              email,
              packageName: pkg.name,
              packagePrice: pkg.price,
            }),
          });
          const paymentData = await paymentRes.json();
          if (paymentRes.ok && paymentData.redirectUrl) {
            window.location.href = paymentData.redirectUrl;
            return; // stop here - customer is already headed to the payment page
          }
          console.error("Payment creation failed, continuing to normal thank-you page:", paymentData);
        } catch (paymentErr) {
          // if payment creation fails, don't block the customer - continue to the normal thank-you page
          console.error("Error calling create-payment:", paymentErr);
        }
      }

      setSubmitted(true);
    } catch (err) {
      console.error(err);
      setError("Something went wrong submitting your order. Please try again.");
    } finally {
      setLoading(false);
    }
  };

  if (submitted) {
    return (
      <div className="card" style={{ textAlign: "center", padding: "56px 28px" }}>
        <div className="success-ring">🎬</div>
        <h2 className="serif" style={{ fontSize: 28, marginBottom: 10, color: "#e8e2d9" }}>Order received!</h2>
        <p style={{ color: "#6b6c7e", fontSize: 14, lineHeight: 1.7, maxWidth: 380, margin: "0 auto 20px" }}>
          Thank you, {firstName}! We've received everything we need to create your video. We're already getting to work and will be in touch soon.
        </p>
        <p style={{ color: "#6b6c7e", fontSize: 13, textAlign: "center", marginTop: -12, marginBottom: 20 }}>
          ⏱ Estimated delivery: within 14 business days
        </p>
        <div style={{ background: "rgba(201,168,76,0.08)", border: "1px solid rgba(201,168,76,0.2)", borderRadius: 12, padding: "14px 22px", display: "inline-block" }}>
          <div style={{ fontSize: 12, color: "#6b6c7e", marginBottom: 4 }}>Order number</div>
          <div style={{ fontSize: 20, fontWeight: 700, color: "#c9a84c", fontFamily: "monospace" }}>#{orderId}</div>
        </div>
      </div>
    );
  }

  return (
    <div className="card">
      <h2 className="serif" style={{ fontSize: 24, marginBottom: 8, color: "#e8e2d9" }}>Summary & your details</h2>
      <p style={{ color: "#6b6c7e", fontSize: 13, marginBottom: 24 }}>Double-check everything below and complete your order.</p>
      <div style={{ background: "#0d0e14", borderRadius: 10, padding: "2px 14px", marginBottom: 24 }}>
        {[
          ["Package", pkg.name],
          ["Photos uploaded", `${photos.length} photos`],
          ["Style", `${styleObj?.emoji} ${styleObj?.name}`],
          ["Soundtrack", `${trackObj?.name} — ${trackObj?.artist}`],
          ["Video length", pkg.duration],
          pkg.hasFrame ? ["Digital frame", pkg.frameSize] : null,
          ["Price", pkg.price],
        ].filter(Boolean).map(([key, val]) => (
          <div key={key} className="summary-row">
            <span className="summary-key">{key}</span>
            <span className="summary-val">{val}</span>
          </div>
        ))}
      </div>
      <div style={{ display: "flex", flexDirection: "column", gap: 14 }}>
        <div style={{ display: "flex", gap: 12 }}>
          <div style={{ flex: 1 }}>
            <label style={{ fontSize: 12, color: "#6b6c7e" }}>First name *</label>
            <input style={inputSt} value={firstName} onChange={e => setFirstName(e.target.value)} placeholder="Jane" />
          </div>
          <div style={{ flex: 1 }}>
            <label style={{ fontSize: 12, color: "#6b6c7e" }}>Last name *</label>
            <input style={inputSt} value={lastName} onChange={e => setLastName(e.target.value)} placeholder="Smith" />
          </div>
        </div>
        <div>
          <label style={{ fontSize: 12, color: "#6b6c7e" }}>Email *</label>
          <input type="email" style={inputSt} value={email} onChange={e => setEmail(e.target.value)} placeholder="name@example.com" />
        </div>
        <div>
          <label style={{ fontSize: 12, color: "#6b6c7e" }}>Phone *</label>
          <input style={inputSt} value={phone} onChange={e => setPhone(e.target.value)} placeholder="(555) 000-0000" />
        </div>
        <div>
          <label style={{ fontSize: 12, color: "#6b6c7e" }}>Street address *</label>
          <input style={inputSt} value={streetAddress} onChange={e => setStreetAddress(e.target.value)} placeholder="123 Main St" />
        </div>
        <div>
          <label style={{ fontSize: 12, color: "#6b6c7e" }}>Apt / Unit (optional)</label>
          <input style={inputSt} value={aptUnit} onChange={e => setAptUnit(e.target.value)} placeholder="Apt 4B" />
        </div>
        <div style={{ display: "flex", gap: 12 }}>
          <div style={{ flex: 2 }}>
            <label style={{ fontSize: 12, color: "#6b6c7e" }}>City *</label>
            <input style={inputSt} value={city} onChange={e => setCity(e.target.value)} placeholder="Austin" />
          </div>
          <div style={{ flex: 1 }}>
            <label style={{ fontSize: 12, color: "#6b6c7e" }}>State *</label>
            <input style={inputSt} value={state} onChange={e => setState(e.target.value)} placeholder="TX" maxLength={2} />
          </div>
          <div style={{ flex: 1 }}>
            <label style={{ fontSize: 12, color: "#6b6c7e" }}>ZIP *</label>
            <input style={inputSt} value={zip} onChange={e => setZip(e.target.value)} placeholder="73301" />
          </div>
        </div>
        <div>
          <label style={{ fontSize: 12, color: "#6b6c7e" }}>Notes (optional)</label>
          <textarea style={{ ...inputSt, resize: "vertical", minHeight: 70 }} value={notes} onChange={e => setNotes(e.target.value)} placeholder="For example: birthday gift, the child's name is..." />
        </div>
      </div>
      {error && (
        <div style={{ marginTop: 14, padding: "10px 14px", background: "rgba(220,50,50,0.1)", border: "1px solid rgba(220,50,50,0.3)", borderRadius: 8, color: "#ff6b6b", fontSize: 13 }}>
          {error}
        </div>
      )}
      <div style={{ display: "flex", justifyContent: "space-between", marginTop: 28 }}>
        <button className="btn-ghost" onClick={onBack} disabled={loading}>← Back</button>
        <button className="btn-gold" onClick={handleSubmit} disabled={!firstName || !lastName || !email || !phone || !streetAddress || !city || !state || !zip || loading}>
          {loading ? "⏳ Submitting order..." : "🎬 Submit order"}
        </button>
      </div>
    </div>
  );
}

// ── ADMIN PAGE ────────────────────────────────────────────────
const ADMIN_PASSWORD = "moments2024admin";

function AdminPage() {
  const [authed, setAuthed] = useState(false);
  const [pass, setPass] = useState("");
  const [orders, setOrders] = useState([]);
  const [loading, setLoading] = useState(false);
  const [selectedOrder, setSelectedOrder] = useState(null);
  const [searchQuery, setSearchQuery] = useState("");

  const loadOrders = async () => {
    setLoading(true);
    try {
      const { getDocs, collection: fsCol, query: fsQuery, orderBy: fsOrderBy } = await import("firebase/firestore");
      const q = fsQuery(fsCol(db, "orders"), fsOrderBy("createdAt", "desc"));
      const snap = await getDocs(q);
      setOrders(snap.docs.map(d => ({ id: d.id, ...d.data() })));
    } catch (e) {
      console.error(e);
    }
    setLoading(false);
  };

  const updateStatus = async (docId, status) => {
    const { updateDoc: upDoc, doc: fsDoc } = await import("firebase/firestore");
    await upDoc(fsDoc(db, "orders", docId), { status });
    setOrders(prev => prev.map(o => o.id === docId ? { ...o, status } : o));
    if (selectedOrder?.id === docId) setSelectedOrder(prev => ({ ...prev, status }));
  };

  const [deleting, setDeleting] = useState(false);

  const deleteOrder = async (order) => {
    const confirmed = window.confirm(
      `Permanently delete order #${order.orderId}?\n\nThis will also delete all photos and files from the server, and cannot be undone.`
    );
    if (!confirmed) return;

    setDeleting(true);
    try {
      const { deleteDoc, doc: fsDoc } = await import("firebase/firestore");
      const { ref: storageRef, deleteObject } = await import("firebase/storage");

      // Delete all photos from Storage
      for (const photo of (order.photos || [])) {
        try {
          await deleteObject(storageRef(storage, photo.url));
        } catch (e) {
          console.error("Error deleting photo:", photo?.name, e);
        }
      }

      // Delete custom song if present
      if (order.customTrackURL) {
        try {
          await deleteObject(storageRef(storage, order.customTrackURL));
        } catch (e) {
          console.error("Error deleting custom song:", e);
        }
      }

      // Delete order document from Firestore
      await deleteDoc(fsDoc(db, "orders", order.id));

      setOrders(prev => prev.filter(o => o.id !== order.id));
      setSelectedOrder(prev => (prev?.id === order.id ? null : prev));
    } catch (e) {
      console.error("Error deleting order:", e);
      alert("Something went wrong deleting the order. Please try again.");
    }
    setDeleting(false);
  };

  if (!authed) {
    return (
      <div style={{ minHeight: "100vh", background: "#0d0e14", display: "flex", alignItems: "center", justifyContent: "center" }}>
        <div style={{ background: "#15161f", border: "1px solid #2a2b38", borderRadius: 16, padding: 40, width: 340, textAlign: "center" }}>
          <div style={{ fontSize: 40, marginBottom: 16 }}>🔐</div>
          <h2 style={{ color: "#e8e2d9", marginBottom: 8, fontFamily: "'Playfair Display', serif" }}>Admin Panel</h2>
          <p style={{ color: "#6b6c7e", fontSize: 13, marginBottom: 24 }}>Moments of Life</p>
          <input
            type="password"
            placeholder="Password"
            value={pass}
            onChange={e => setPass(e.target.value)}
            onKeyDown={e => { if (e.key === "Enter" && pass === ADMIN_PASSWORD) { setAuthed(true); loadOrders(); } }}
            style={{ width: "100%", background: "#0d0e14", border: "1px solid #3a3b4a", borderRadius: 8, padding: "11px 14px", color: "#e8e2d9", fontSize: 13, outline: "none", marginBottom: 14 }}
          />
          <button
            onClick={() => { if (pass === ADMIN_PASSWORD) { setAuthed(true); loadOrders(); } else alert("Incorrect password"); }}
            style={{ width: "100%", background: "linear-gradient(135deg,#c9a84c,#e8c96a)", color: "#0d0e14", border: "none", borderRadius: 40, padding: "12px", fontWeight: 700, fontSize: 14, cursor: "pointer" }}
          >
            Log in
          </button>
        </div>
      </div>
    );
  }

  const statusColor = { "New": "#c9a84c", "In Progress": "#4a9eff", "Completed": "#5cc97a" };

  const normalize = v => (v == null ? "" : String(v)).toLowerCase();

  const filteredOrders = orders.filter(order => {
    const q = normalize(searchQuery).trim();
    if (!q) return true;
    const dateStr = order.createdAt?.toDate?.()?.toLocaleDateString("en-US") || "";
    const haystack = [
      order.firstName, order.lastName, order.name, order.email, order.phone,
      order.city, order.streetAddress, order.state, order.zip, order.notes,
      order.package, order.packagePrice, order.style, order.music, order.musicArtist,
      order.status, order.orderId, dateStr,
    ].map(normalize).join(" | ");
    return haystack.includes(q);
  });

  return (
    <div dir="ltr" style={{ minHeight: "100vh", background: "#0d0e14", color: "#e8e2d9", fontFamily: "'Inter',sans-serif" }}>
      <div style={{ borderBottom: "1px solid #1e1f2e", padding: "16px 24px", display: "flex", justifyContent: "space-between", alignItems: "center" }}>
        <h1 style={{ fontFamily: "'Playfair Display',serif", fontSize: 22, color: "#c9a84c" }}>🎬 Order Admin Panel</h1>
        <div style={{ display: "flex", gap: 10, alignItems: "center" }}>
          <span style={{ fontSize: 12, color: "#6b6c7e" }}>{searchQuery ? `${filteredOrders.length} of ${orders.length}` : `${orders.length} orders`}</span>
          <button onClick={loadOrders} style={{ background: "#15161f", border: "1px solid #3a3b4a", color: "#e8e2d9", borderRadius: 8, padding: "6px 14px", cursor: "pointer", fontSize: 12 }}>🔄 Refresh</button>
        </div>
      </div>

      {/* Search bar */}
      <div style={{ padding: "14px 24px", borderBottom: "1px solid #1e1f2e" }}>
        <div style={{ position: "relative", maxWidth: 420 }}>
          <input
            type="text"
            value={searchQuery}
            onChange={e => setSearchQuery(e.target.value)}
            placeholder="Search by name, phone, email, city, address, date, order number..."
            style={{ width: "100%", background: "#15161f", border: "1px solid #3a3b4a", borderRadius: 40, padding: "10px 40px 10px 16px", color: "#e8e2d9", fontSize: 13, fontFamily: "'Inter',sans-serif", outline: "none", transition: "border-color 0.2s" }}
            onFocus={e => e.target.style.borderColor = "#c9a84c"}
            onBlur={e => e.target.style.borderColor = "#3a3b4a"}
          />
          <span style={{ position: "absolute", left: 14, top: "50%", transform: "translateY(-50%)", color: "#6b6c7e", fontSize: 14, pointerEvents: "none" }}>🔍</span>
          {searchQuery && (
            <button
              onClick={() => setSearchQuery("")}
              style={{ position: "absolute", right: 8, top: "50%", transform: "translateY(-50%)", background: "transparent", border: "none", color: "#6b6c7e", cursor: "pointer", fontSize: 14, padding: 4 }}
              title="Clear search"
            >
              ✕
            </button>
          )}
        </div>
      </div>

      <div style={{ display: "flex", height: "calc(100vh - 65px)" }}>

        {/* Orders list */}
        <div style={{ width: selectedOrder ? 380 : "100%", borderRight: "1px solid #1e1f2e", overflowY: "auto", padding: 16 }}>
          {loading && <div style={{ textAlign: "center", color: "#6b6c7e", padding: 40 }}>Loading orders...</div>}
          {!loading && orders.length === 0 && <div style={{ textAlign: "center", color: "#6b6c7e", padding: 40 }}>No orders yet</div>}
          {!loading && orders.length > 0 && filteredOrders.length === 0 && <div style={{ textAlign: "center", color: "#6b6c7e", padding: 40 }}>No results found for "{searchQuery}"</div>}
          {filteredOrders.map(order => (
            <div
              key={order.id}
              onClick={() => setSelectedOrder(order)}
              style={{ background: selectedOrder?.id === order.id ? "rgba(201,168,76,0.08)" : "#15161f", border: `1px solid ${selectedOrder?.id === order.id ? "#c9a84c" : "#2a2b38"}`, borderRadius: 12, padding: "14px 16px", marginBottom: 10, cursor: "pointer", transition: "all 0.2s" }}
            >
              <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 6 }}>
                <span style={{ fontWeight: 700, color: "#e8e2d9" }}>{order.firstName ? `${order.firstName} ${order.lastName || ""}` : order.name}</span>
                <span style={{ fontSize: 11, fontWeight: 700, color: statusColor[order.status] || "#6b6c7e", background: "rgba(0,0,0,0.3)", padding: "2px 10px", borderRadius: 20 }}>{order.status}</span>
              </div>
              <div style={{ fontSize: 12, color: "#6b6c7e", marginBottom: 4 }}>{order.phone} · {order.package} · {order.packagePrice}</div>
              <div style={{ fontSize: 11, color: "#4a4b5e", display: "flex", justifyContent: "space-between" }}>
                <span>#{order.orderId}</span>
                <span>{order.createdAt?.toDate?.()?.toLocaleDateString("en-US") || ""}</span>
              </div>
            </div>
          ))}
        </div>

        {/* Order detail */}
        {selectedOrder && (
          <div style={{ flex: 1, overflowY: "auto", padding: 24 }}>
            <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 20 }}>
              <h2 style={{ fontFamily: "'Playfair Display',serif", fontSize: 20 }}>Order details #{selectedOrder.orderId}</h2>
              <div style={{ display: "flex", gap: 8 }}>
                <button
                  onClick={() => deleteOrder(selectedOrder)}
                  disabled={deleting}
                  style={{ background: "transparent", border: "1px solid #e05c5c", color: "#e05c5c", borderRadius: 8, padding: "4px 12px", cursor: deleting ? "not-allowed" : "pointer", opacity: deleting ? 0.6 : 1, fontSize: 13 }}
                >
                  {deleting ? "Deleting..." : "🗑 Delete order"}
                </button>
                <button onClick={() => setSelectedOrder(null)} style={{ background: "transparent", border: "1px solid #3a3b4a", color: "#6b6c7e", borderRadius: 8, padding: "4px 12px", cursor: "pointer" }}>✕ Close</button>
              </div>
            </div>

            {/* Status buttons */}
            <div style={{ display: "flex", gap: 8, marginBottom: 20 }}>
              {["New", "In Progress", "Completed"].map(s => (
                <button key={s} onClick={() => updateStatus(selectedOrder.id, s)}
                  style={{ padding: "7px 18px", borderRadius: 20, border: `2px solid ${statusColor[s]}`, background: selectedOrder.status === s ? statusColor[s] : "transparent", color: selectedOrder.status === s ? "#0d0e14" : statusColor[s], fontWeight: 700, fontSize: 13, cursor: "pointer" }}>
                  {s}
                </button>
              ))}
            </div>

            {/* Details */}
            <div style={{ background: "#15161f", borderRadius: 12, padding: "4px 16px", marginBottom: 20 }}>
              {[
                ["First name", selectedOrder.firstName || selectedOrder.name || "—"],
                ["Last name", selectedOrder.lastName || "—"],
                ["Email", selectedOrder.email || "—"],
                ["Phone", selectedOrder.phone],
                ["Street address", selectedOrder.streetAddress || "—"],
                ["Apt / Unit", selectedOrder.aptUnit || "—"],
                ["City", selectedOrder.city || "—"],
                ["State", selectedOrder.state || "—"],
                ["ZIP", selectedOrder.zip || "—"],
                ["Package", `${selectedOrder.package} · ${selectedOrder.packagePrice}`],
                ["Style", selectedOrder.style],
                ["Music", `${selectedOrder.music} — ${selectedOrder.musicArtist}`],
                ["Photos", `${selectedOrder.photoCount} photos`],
                ["Notes", selectedOrder.notes || "—"],
              ].map(([k, v]) => (
                <div key={k} style={{ display: "flex", justifyContent: "space-between", padding: "10px 0", borderBottom: "1px solid #2a2b38", fontSize: 13 }}>
                  <span style={{ color: "#6b6c7e" }}>{k}</span>
                  <span style={{ color: "#e8e2d9", fontWeight: 500 }}>{v}</span>
                </div>
              ))}
            </div>

            {/* Photos */}
            <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 12 }}>
              <h3 style={{ fontSize: 14, color: "#c9a84c" }}>Photos ({selectedOrder.photoCount})</h3>
              <button
                onClick={async () => {
                  try {
                    // Try the File System Access API (Chrome/Edge)
                    if (window.showDirectoryPicker) {
                      const dirHandle = await window.showDirectoryPicker();
                      for (const photo of (selectedOrder.photos || [])) {
                        try {
                          const res = await fetch(photo.url);
                          const blob = await res.blob();
                          const fileHandle = await dirHandle.getFileHandle(`photo-${photo.index}.jpg`, { create: true });
                          const writable = await fileHandle.createWritable();
                          await writable.write(blob);
                          await writable.close();
                        } catch(e) { console.error(e); }
                      }
                      alert(`✅ All photos were downloaded successfully to the folder you chose!`);
                    } else {
                      // fallback for older browsers
                      for (let i = 0; i < (selectedOrder.photos || []).length; i++) {
                        const photo = selectedOrder.photos[i];
                        const res = await fetch(photo.url);
                        const blob = await res.blob();
                        const blobUrl = URL.createObjectURL(blob);
                        const a = document.createElement("a");
                        a.href = blobUrl;
                        a.download = `photo-${photo.index}.jpg`;
                        document.body.appendChild(a);
                        a.click();
                        document.body.removeChild(a);
                        URL.revokeObjectURL(blobUrl);
                        await new Promise(r => setTimeout(r, 800));
                      }
                    }
                  } catch(e) {
                    if (e.name !== 'AbortError') alert("Download error: " + e.message);
                  }
                }}
                style={{ fontSize: 12, color: "#4a9eff", cursor: "pointer", background: "rgba(74,158,255,0.1)", padding: "5px 12px", borderRadius: 8, border: "1px solid rgba(74,158,255,0.3)" }}
              >
                ⬇️ Download all photos
              </button>
            </div>
            <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fill, minmax(120px, 1fr))", gap: 8, marginBottom: 20 }}>
              {(selectedOrder.photos || []).map((photo, i) => (
                <a key={i} href={photo.url} target="_blank" rel="noopener noreferrer"
                  style={{ display: "block", borderRadius: 8, overflow: "hidden", border: "1px solid #2a2b38", textDecoration: "none" }}>
                  <img src={photo.url} alt={`Photo ${photo.index}`} style={{ width: "100%", height: 100, objectFit: "cover", display: "block" }} />
                  <div style={{ padding: "4px 8px", fontSize: 10, color: "#6b6c7e", background: "#15161f" }}>Photo {photo.index} ↗</div>
                </a>
              ))}
            </div>

            {/* Scene notes */}
            {selectedOrder.sceneNotes && selectedOrder.sceneNotes.some(n => n) && (
              <div style={{ marginBottom: 20 }}>
                <h3 style={{ fontSize: 14, color: "#c9a84c", marginBottom: 12 }}>Notes between photos</h3>
                <div style={{ background: "#15161f", borderRadius: 12, padding: "4px 16px" }}>
                  {selectedOrder.sceneNotes.map((note, i) => note ? (
                    <div key={i} style={{ display: "flex", gap: 12, padding: "8px 0", borderBottom: "1px solid #2a2b38", fontSize: 13 }}>
                      <span style={{ color: "#6b6c7e", flexShrink: 0 }}>After photo {i + 1}:</span>
                      <span style={{ color: "#e8e2d9" }}>{note}</span>
                    </div>
                  ) : null)}
                </div>
              </div>
            )}

            {/* Custom track */}
            {selectedOrder.customTrackURL && (
              <div style={{ marginBottom: 20 }}>
                <h3 style={{ fontSize: 14, color: "#c9a84c", marginBottom: 12 }}>Custom song</h3>
                <div style={{ background: "#15161f", borderRadius: 12, padding: 14, display: "flex", justifyContent: "space-between", alignItems: "center" }}>
                  <span style={{ color: "#e8e2d9", fontSize: 13 }}>{selectedOrder.music}</span>
                  <button
                    onClick={async () => {
                      try {
                        const res = await fetch(selectedOrder.customTrackURL);
                        const blob = await res.blob();
                        if (window.showSaveFilePicker) {
                          const fileHandle = await window.showSaveFilePicker({
                            suggestedName: `${selectedOrder.music}.mp3`,
                            types: [{ description: "MP3 Audio", accept: { "audio/mpeg": [".mp3"] } }]
                          });
                          const writable = await fileHandle.createWritable();
                          await writable.write(blob);
                          await writable.close();
                        } else {
                          const blobUrl = URL.createObjectURL(blob);
                          const a = document.createElement("a");
                          a.href = blobUrl;
                          a.download = `${selectedOrder.music}.mp3`;
                          document.body.appendChild(a);
                          a.click();
                          document.body.removeChild(a);
                          URL.revokeObjectURL(blobUrl);
                        }
                      } catch(e) {
                        if (e.name !== 'AbortError') alert("Download error: " + e.message);
                      }
                    }}
                    style={{ fontSize: 12, color: "#4a9eff", cursor: "pointer", background: "rgba(74,158,255,0.1)", padding: "5px 12px", borderRadius: 8, border: "1px solid rgba(74,158,255,0.3)" }}
                  >
                    ⬇️ Download song
                  </button>
                </div>
              </div>
            )}
          </div>
        )}
      </div>
    </div>
  );
}

// ── MAIN APP ──────────────────────────────────────────────────
function MainApp() {
  const [pkg, setPkg] = useState(null);
  const [step, setStep] = useState(0); // 0=upload 1=style 2=music 3=summary
  const [photos, setPhotos] = useState([]);
  const [sceneNotes, setSceneNotes] = useState([]);
  const [selectedStyle, setSelectedStyle] = useState(null);
  const [selectedMusic, setSelectedMusic] = useState(null);
  const [customTrack, setCustomTrack] = useState(null);

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
      <div dir="ltr" style={{ minHeight: "100vh", background: "#0d0e14", color: "#e8e2d9", fontFamily: "'Inter',sans-serif" }}>

        {/* Header */}
        <div style={{ borderBottom: "1px solid #1e1f2e", padding: "20px 24px", maxWidth: 860, margin: "0 auto", position: "relative" }}>
          {/* Logo centered */}
          <div style={{ display: "flex", justifyContent: "center", cursor: pkg ? "pointer" : "default" }} onClick={() => { if (pkg) { setPkg(null); } }}>
            <img
              src="/logo.png"
              alt="Moments of Life"
              style={{ height: 160, width: "auto", mixBlendMode: "screen", filter: "brightness(1.1)" }}
            />
          </div>
          {/* Package info - below logo when in flow */}
          {pkg && (
            <div style={{ display: "flex", justifyContent: "center", gap: 10, marginTop: 10 }}>
              <div style={{ fontSize: 11, color: "#6b6c7e", background: "#15161f", border: "1px solid #2a2b38", borderRadius: 20, padding: "3px 10px" }}>
                {pkg.name} package · {pkg.price}
              </div>
              <div style={{ fontSize: 11, color: "#6b6c7e", background: "#15161f", border: "1px solid #2a2b38", borderRadius: 20, padding: "3px 10px" }}>
                Step {step + 1} of 4
              </div>
            </div>
          )}
        </div>

        {/* Main */}
        <div style={{ maxWidth: 860, margin: "0 auto", padding: "14px 16px 80px" }}>
          {!pkg ? (
            <StepPackage onSelect={handleSelectPackage} />
          ) : (
            <>
              <ProgressBar step={step} />
              {step === 0 && <StepUpload pkg={pkg} photos={photos} setPhotos={setPhotos} sceneNotes={sceneNotes} setSceneNotes={setSceneNotes} onNext={() => setStep(1)} onBack={() => setPkg(null)} />}
              {step === 1 && <StepStyle selected={selectedStyle} setSelected={setSelectedStyle} onNext={() => setStep(2)} onBack={() => setStep(0)} />}
              {step === 2 && <StepMusic pkg={pkg} selected={selectedMusic} setSelected={setSelectedMusic} customTrack={customTrack} setCustomTrack={setCustomTrack} onNext={() => setStep(3)} onBack={() => setStep(1)} />}
              {step === 3 && <StepSummary pkg={pkg} photos={photos} sceneNotes={sceneNotes} style={selectedStyle} music={selectedMusic} customTrack={customTrack} onBack={() => setStep(2)} />}
            </>
          )}
        </div>
      </div>

      {/* WhatsApp floating button */}
      {/* NOTE for US launch: this Israeli WhatsApp number (+972...) should be replaced
          with a US contact number/WhatsApp Business number, or swapped for SMS/live chat. */}
      <a
        href="https://wa.me/972508490098"
        target="_blank"
        rel="noopener noreferrer"
        style={{
          position: "fixed", bottom: 24, right: 24, zIndex: 999,
          width: 56, height: 56, borderRadius: "50%",
          background: "#25D366", boxShadow: "0 4px 20px rgba(37,211,102,0.5)",
          display: "flex", alignItems: "center", justifyContent: "center",
          textDecoration: "none", transition: "transform 0.2s, box-shadow 0.2s",
        }}
        onMouseEnter={e => { e.currentTarget.style.transform = "scale(1.1)"; e.currentTarget.style.boxShadow = "0 6px 28px rgba(37,211,102,0.7)"; }}
        onMouseLeave={e => { e.currentTarget.style.transform = "scale(1)"; e.currentTarget.style.boxShadow = "0 4px 20px rgba(37,211,102,0.5)"; }}
        title="Message us on WhatsApp"
      >
        <svg width="28" height="28" viewBox="0 0 32 32" fill="white">
          <path d="M16 2C8.28 2 2 8.28 2 16c0 2.52.68 4.88 1.86 6.92L2 30l7.3-1.84A13.94 13.94 0 0016 30c7.72 0 14-6.28 14-14S23.72 2 16 2zm0 25.5a11.44 11.44 0 01-5.84-1.6l-.42-.25-4.34 1.1 1.12-4.22-.27-.44A11.5 11.5 0 1116 27.5zm6.3-8.62c-.34-.17-2.02-1-2.34-1.1-.32-.12-.56-.17-.8.17-.23.34-.9 1.1-1.1 1.34-.2.22-.4.25-.74.08-.34-.17-1.44-.53-2.74-1.7-1.01-.9-1.7-2.02-1.9-2.36-.2-.34-.02-.52.15-.7.15-.15.34-.4.5-.6.17-.2.23-.34.34-.56.12-.23.06-.43-.02-.6-.08-.17-.8-1.93-1.1-2.64-.28-.68-.58-.58-.8-.6h-.68c-.23 0-.6.08-.9.43-.32.34-1.2 1.17-1.2 2.86s1.23 3.32 1.4 3.55c.17.22 2.42 3.7 5.86 5.18.82.35 1.46.56 1.96.72.82.26 1.57.22 2.16.13.66-.1 2.02-.82 2.3-1.62.28-.8.28-1.48.2-1.62-.08-.14-.3-.22-.64-.4z"/>
        </svg>
      </a>
    </>
  );
}

function PaymentReturn({ lowProfileCode }) {
  const [status, setStatus] = useState("checking"); // checking | success | failed | error
  const [orderInfo, setOrderInfo] = useState(null);

  React.useEffect(() => {
    let cancelled = false;
    (async () => {
      try {
        const res = await fetch(`/api/check-payment-status?lowProfileCode=${encodeURIComponent(lowProfileCode)}`);
        const data = await res.json();
        if (cancelled) return;
        if (res.ok) {
          setOrderInfo(data);
          setStatus(data.success ? "success" : "failed");

          // Real Meta Pixel conversion event — fires only here, after payment is
          // actually verified with the payment processor (so only real paying
          // customers count as a Purchase).
          if (data.success) {
            try {
              if (window.fbq) {
                const cleanValue = Number(String(data.packagePrice || "").replace(/[^\d.]/g, "")) || 0;
                window.fbq("track", "Purchase", {
                  value: cleanValue,
                  currency: "USD",
                  content_name: data.packageName || "Moments of Life package",
                  content_type: "product",
                });
              }
            } catch (pixelErr) {
              console.error("Meta Pixel Purchase event error:", pixelErr);
            }
          }
        } else {
          setStatus("error");
        }
      } catch (e) {
        if (!cancelled) setStatus("error");
      }
    })();
    return () => { cancelled = true; };
  }, [lowProfileCode]);

  return (
    <>
      <style>{STYLES}</style>
      <div dir="ltr" style={{ minHeight: "100vh", background: "#0d0e14", color: "#e8e2d9", fontFamily: "'Inter',sans-serif", display: "flex", alignItems: "center", justifyContent: "center", padding: 24 }}>
        <div style={{ maxWidth: 440, width: "100%", textAlign: "center", background: "#15161f", border: "1px solid #2a2b38", borderRadius: 16, padding: "40px 28px" }}>
          <div style={{ display: "flex", justifyContent: "center", marginBottom: 20 }}>
            <img src="/logo.png" alt="Moments of Life" style={{ height: 80, width: "auto", mixBlendMode: "screen", filter: "brightness(1.1)" }} />
          </div>

          {status === "checking" && (
            <>
              <div style={{ fontSize: 32, marginBottom: 12 }}>⏳</div>
              <h2 className="serif" style={{ fontSize: 22, marginBottom: 8 }}>Verifying your payment...</h2>
              <p style={{ color: "#8a8b9e", fontSize: 14 }}>One moment, we're checking the transaction status with the payment processor.</p>
            </>
          )}

          {status === "success" && (
            <>
              <div style={{ fontSize: 40, marginBottom: 12 }}>✅</div>
              <h2 className="serif" style={{ fontSize: 22, marginBottom: 8, color: "#c9a84c" }}>Payment received!</h2>
              <p style={{ color: "#8a8b9e", fontSize: 14, lineHeight: 1.7 }}>
                {orderInfo?.firstName ? `Thank you, ${orderInfo.firstName}! ` : ""}
                We've received your payment for {orderInfo?.packageName || "your order"}. We're already getting to work on your video and will be in touch soon.
              </p>
              <p style={{ color: "#6b6c7e", fontSize: 12 }}>⏱ Estimated delivery: within 14 business days</p>
            </>
          )}

          {status === "failed" && (
            <>
              <div style={{ fontSize: 40, marginBottom: 12 }}>⚠️</div>
              <h2 className="serif" style={{ fontSize: 22, marginBottom: 8 }}>Payment not completed</h2>
              <p style={{ color: "#8a8b9e", fontSize: 14, lineHeight: 1.7 }}>
                It looks like the payment didn't go through. You can try again, or reach out to us and we'll help you complete your order.
              </p>
            </>
          )}

          {status === "error" && (
            <>
              <div style={{ fontSize: 40, marginBottom: 12 }}>🤔</div>
              <h2 className="serif" style={{ fontSize: 22, marginBottom: 8 }}>We couldn't verify the payment</h2>
              <p style={{ color: "#8a8b9e", fontSize: 14, lineHeight: 1.7 }}>
                If you were actually charged, don't worry - we'll reach out to confirm your order. You can also contact us directly.
              </p>
            </>
          )}

          <a
            href="https://wa.me/972508490098"
            target="_blank"
            rel="noopener noreferrer"
            style={{ display: "inline-block", marginTop: 20, color: "#c9a84c", fontSize: 13, textDecoration: "underline" }}
          >
            Contact us
          </a>
        </div>
      </div>
    </>
  );
}

export default function App() {
  if (window.location.search.includes("admin=true")) return <AdminPage />;

  const params = new URLSearchParams(window.location.search);
  const lowProfileCode = params.get("lowprofilecode") || params.get("lowProfileCode") || params.get("LowProfileCode");
  if (lowProfileCode) return <PaymentReturn lowProfileCode={lowProfileCode} />;

  return <MainApp />;
}
