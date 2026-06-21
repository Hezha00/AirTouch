"use client";

import { createContext, useContext, useState, useCallback, type ReactNode } from "react";

export type Lang = "en" | "fa";

type I18nCtx = {
  lang: Lang;
  setLang: (l: Lang) => void;
  toggle: () => void;
  t: (key: string) => string;
  dir: "ltr" | "rtl";
};

const Ctx = createContext<I18nCtx>({
  lang: "en", setLang: () => {}, toggle: () => {}, t: (k) => k, dir: "ltr",
});

const translations: Record<string, { en: string; fa: string }> = {
  // ---- nav ----
  "nav.hub": { en: "Hub", fa: "خانه" },
  "nav.cursor": { en: "Cursor", fa: "نشانگر" },
  "nav.canvas": { en: "Canvas", fa: "نقاشی" },
  "nav.whiteboard": { en: "Whiteboard", fa: "وایت‌برد" },
  "nav.orchestra": { en: "Orchestra", fa: "ارکستر" },
  "nav.piano": { en: "Piano", fa: "پیانو" },
  "nav.drumkit": { en: "Drumkit", fa: "درام" },
  "nav.sign": { en: "Sign", fa: "اشاره" },
  "nav.lab": { en: "Hand Lab", fa: "آزمایشگاه" },

  // ---- hero ----
  "hero.badge": { en: "A hub for webcam-powered gesture tools · MediaPipe · Tone.js", fa: "مجموعه‌ای از ابزارهای کنترل با ژست و وب‌کم · مدیا‌پایپ · تون.جی‌اس" },
  "hero.title1": { en: "Control your PC", fa: "کامپیوترت رو" },
  "hero.title2": { en: "bare hands", fa: "با دست خالی کنترل کن" },
  "hero.desc": { en: "A growing collection of browser-based tools that turn any webcam into a gesture interface. No install, no accounts, everything runs locally.", fa: "مجموعه‌ای از ابزارهای تحت مرورگر که وب‌کم شما رو به یک رابط ژستی تبدیل می‌کنن. بدون نصب، بدون حساب کاربری، همه‌چیز توی مرورگرتون اجرا می‌شه." },
  "hero.cta1": { en: "Launch Cursor Control", fa: "شروع کنترل نشانگر" },
  "hero.cta2": { en: "Try Air Canvas", fa: "نقاشی هوایی رو امتحان کن" },

  // ---- tool cards ----
  "tool.cursor.title": { en: "Cursor Control", fa: "کنترل نشانگر" },
  "tool.cursor.tag": { en: "A touchless mouse, in your browser", fa: "ماوس بدون لمس، توی مرورگرتون" },
  "tool.cursor.desc": { en: "Move a virtual cursor with your index finger, click by tucking your thumb, drag cards, toggle switches, and paint on a canvas — all with hand gestures.", fa: "نشانگر مجازی رو با انگشت اشاره حرکت بده، با جمع کردن شست کلیک کن، کارت‌ها رو بکش، کلیدها رو تغییر بده و روی بوم نقاشی کن — همه‌ش با ژست دست." },
  "tool.canvas.title": { en: "Air Canvas", fa: "نقاشی هوایی" },
  "tool.canvas.tag": { en: "Paint in the air with your finger", fa: "با انگشتت تو هوا نقاشی کن" },
  "tool.canvas.desc": { en: "A full-screen gesture drawing studio. Point to paint, pinch to lift the brush, open your hand to erase, make a fist to clear.", fa: "استودیوی نقاشی با ژست تمام‌صفحه. برای نقاشی اشاره کن، برای برداشتن قلمو انگشت‌هاتو ببند، دستت رو باز کن تا پاک کنی، مشت کن تا همه‌چیز پاک بشه." },
  "tool.whiteboard.title": { en: "Air Whiteboard", fa: "وایت‌برد هوایی" },
  "tool.whiteboard.tag": { en: "A structured gesture whiteboard", fa: "وایت‌برد ساختاریافته با ژست دست" },
  "tool.whiteboard.desc": { en: "Multi-page whiteboard with pen, rectangle, circle, line, arrow, and text tools. Pinch to draw, open hand to lift, fist to clear.", fa: "وایت‌برد چندصفحه‌ای با قلم، مستطیل، دایره، خط، فلش و ابزار متن. برای رسم انگشت‌هاتو ببند، دستت رو باز کن تا برداشتی، مشت کن تا پاک بشه." },
  "tool.orchestra.title": { en: "AI Conducting Orchestra", fa: "ارکستر رهبری هوشمند" },
  "tool.orchestra.tag": { en: "Conduct generative music with both hands", fa: "موسیقی زنده رو با هر دو دست رهبری کن" },
  "tool.orchestra.desc": { en: "A real-time procedural music engine powered by Tone.js. Right hand sets tempo & melody; left hand sets dynamics & harmony.", fa: "موتور موسیقی بلادرنگ با تون.جی‌اس. دست راست تمپو و ملودی رو تنظیم می‌کنه، دست چپ پویایی و هارمونی رو." },
  "tool.piano.title": { en: "Gesture Piano", fa: "پیانوی ژستی" },
  "tool.piano.tag": { en: "Play a virtual piano in the air", fa: "پیانوی مجازی رو تو هوا بزن" },
  "tool.piano.desc": { en: "A 1.5-octave keyboard you play by pinching over the keys. Four instruments, volume, octave shift, sustain pedal, and record + playback.", fa: "کیبورد یک‌ونیم اکتاو که با بستن انگشت‌ها روی کلیدها می‌نوازی. چهار ساز، تنظیم صدا، تغییر اکتاو، پدال پایداری و ضبط + پخش." },
  "tool.drumkit.title": { en: "Air Drumkit", fa: "درام هوایی" },
  "tool.drumkit.tag": { en: "Play a 6-pad drum kit in the air", fa: "درام شش‌پد رو تو هوا بزن" },
  "tool.drumkit.desc": { en: "Six synthesized drum pads (kick, snare, hi-hat, two toms, cymbal). Move your hand over a pad and pinch to hit it. Record & playback.", fa: "شش پد درام سینتی‌سایز شده (کیک، اسنیر، های‌هت، دو تام، سیمبال). دستت رو روی پد ببر و انگشت‌هاتو ببند تا بزنی. ضبط و پخش." },
  "tool.sign.title": { en: "Sign Language Trainer", fa: "آموزش زبان اشاره" },
  "tool.sign.tag": { en: "Learn the ASL alphabet", fa: "الفبای زبان اشاره رو یاد بگیر" },
  "tool.sign.desc": { en: "An accessibility + education tool. Browse 20 ASL letters, practice mode, or take a timed quiz. Live finger-pattern matching.", fa: "ابزار آموزشی و دسترسی‌پذیر. ۲۰ حرف زبان اشاره رو مرور کن، تمرین کن یا آزمون زمان‌دار بده. تطبیق زنده الگوی انگشتان." },
  "tool.lab.title": { en: "Hand Lab", fa: "آزمایشگاه دست" },
  "tool.lab.tag": { en: "Inspect all 21 landmarks in real time", fa: "همه ۲۱ نقطه رو زنده بررسی کن" },
  "tool.lab.desc": { en: "An educational + developer visualizer: depth-shaded 2D skeleton, a rotating 3D projection, per-finger extension angles, and live FPS.", fa: "ابزار آموزشی و توسعه: اسکلت دوبعدی با سایه عمق، تصویر سه‌بعدی چرخان، زاویه بازشدن هر انگشت و فریم بر ثانیه زنده." },

  // ---- stats ----
  "stats.landmarks": { en: "hand landmarks tracked", fa: "نقطه دست ردیابی می‌شه" },
  "stats.inference": { en: "per-frame inference", fa: "استنتاج هر فریم" },
  "stats.tools": { en: "interactive tools", fa: "ابزار تعاملی" },
  "stats.cloud": { en: "cloud dependencies", fa: "وابستگی ابری" },

  // ---- footer ----
  "footer.desc": { en: "A webcam-powered gesture control hub. Built with MediaPipe and Tone.js.", fa: "مرکز کنترل ژستی با وب‌کم. ساخته شده با مدیا‌پایپ و تون.جی‌اس." },
  "footer.creator": { en: "Creator", fa: "سازنده" },
  "footer.contact": { en: "Contact", fa: "راه ارتباطی" },
  "footer.rights": { en: "All rights reserved.", fa: "تمامی حقوق محفوظ است." },
  "footer.built": { en: "Built with", fa: "ساخته شده با" },
  "footer.and": { en: "and computer vision", fa: "و بینایی ماشین" },

  // ---- arcade ad ----
  "arcade.title": { en: "Learning English?", fa: "داری انگلیسی یاد می‌گیری؟" },
  "arcade.desc": { en: "Check out English Arcade — a fun, game-based platform for mastering English.", fa: "سر به English Arcade بزن — یه پلتفرم بازی‌محور برای یادگیری انگلیسی." },
  "arcade.cta": { en: "Visit english-arcade.ir", fa: "مشاهده english-arcade.ir" },

  // ---- common tool view strings ----
  "view.start": { en: "Start", fa: "شروع" },
  "view.stop": { en: "Stop", fa: "توقف" },
  "view.loading": { en: "Loading…", fa: "در حال بارگذاری…" },
  "view.cameraError": { en: "Camera error", fa: "خطای دوربین" },
  "view.gestures": { en: "Gestures", fa: "ژست‌ها" },
  "view.howToPlay": { en: "How to play", fa: "روش استفاده" },
  "view.howToUse": { en: "How to use", fa: "روش استفاده" },
  "view.color": { en: "Color", fa: "رنگ" },
  "view.brushSize": { en: "Brush size", fa: "اندازه قلمو" },
  "view.mode": { en: "Mode", fa: "حالت" },
  "view.actions": { en: "Actions", fa: "عملیات" },
  "view.undo": { en: "Undo", fa: "برگردون" },
  "view.clear": { en: "Clear", fa: "پاک کردن" },
  "view.savePng": { en: "Save PNG", fa: "ذخیره PNG" },
  "view.pages": { en: "Pages", fa: "صفحات" },
  "view.newPage": { en: "New page", fa: "صفحه جدید" },
  "view.clearPage": { en: "Clear page", fa: "پاک کردن صفحه" },
  "view.tools": { en: "Tools", fa: "ابزارها" },
  "view.shapeFill": { en: "Shape fill", fa: "پر کردن شکل" },
  "view.outlined": { en: "OUTLINED", fa: "خط دور" },
  "view.filled": { en: "FILLED", fa: "پر شده" },
  "view.textContent": { en: "Text content", fa: "متن" },
  "view.paint": { en: "Paint", fa: "نقاشی" },
  "view.erase": { en: "Erase", fa: "پاک‌کن" },
  "view.strokes": { en: "strokes", fa: "خطوط" },
  "view.notesPlayed": { en: "notes played", fa: "نت نواخته شده" },
  "view.hits": { en: "hits", fa: "ضربه" },
  "view.clicks": { en: "clicks", fa: "کلیک" },
  "view.leftBtn": { en: "left button", fa: "دکمه چپ" },
  "view.record": { en: "Record", fa: "ضبط" },
  "view.play": { en: "Play", fa: "پخش" },
  "view.retry": { en: "Retry", fa: "دوباره" },
  "view.volume": { en: "Volume", fa: "صدا" },
  "view.instrument": { en: "Instrument", fa: "ساز" },
  "view.octave": { en: "Octave", fa: "اکتاو" },
  "view.cMajorGuide": { en: "C Major guide", fa: "راهنمای دو ماژور" },
  "view.sustain": { en: "Sustain", fa: "پایداری" },
  "view.recent": { en: "Recent", fa: "آخرین" },
  "view.pointer": { en: "Pointer", fa: "نشانگر" },
  "view.slide": { en: "slide", fa: "اسلاید" },
  "view.tips": { en: "Tips", fa: "نکات" },
  "view.pads": { en: "Pads", fa: "پدها" },
  "view.fingerPattern": { en: "Finger pattern", fa: "الگوی انگشتان" },
  "view.note": { en: "Note", fa: "نکته" },
  "view.startPractice": { en: "Start Practice", fa: "شروع تمرین" },
  "view.endPractice": { en: "End Practice", fa: "پایان تمرین" },
  "view.timedQuiz": { en: "Timed Quiz", fa: "آزمون زمان‌دار" },
  "view.endQuiz": { en: "End Quiz", fa: "پایان آزمون" },
  "view.backToBrowse": { en: "Back to Browse", fa: "بازگشت به مرور" },
  "view.easy": { en: "Easy", fa: "آسان" },
  "view.medium": { en: "Med", fa: "متوسط" },
  "view.hard": { en: "Hard", fa: "سخت" },
  "view.perfect": { en: "Perfect! 🏆", fa: "عالی! 🏆" },
  "view.greatJob": { en: "Great job!", fa: "آفرین!" },
  "view.goodEffort": { en: "Good effort!", fa: "خوب بود!" },
  "view.keepPracticing": { en: "Keep practicing!", fa: "بیشتر تمرین کن!" },
  "view.holdCorrect": { en: "Hold the correct shape for 0.8s to advance", fa: "شکل درست رو ۰.۸ ثانیه نگه‌دار تا بری بعدی" },
  "view.formEach": { en: "Form each letter and hold 0.6s to score", fa: "هر حرف رو درست کن و ۰.۶ ثانیه نگه‌دار تا امتیاز بگیری" },

  // ---- view descriptions ----
  "desc.cursor": { en: "A touchless mouse you control with your hand. Point with your index finger to move, tuck your thumb to the base of your index finger to click. Drag the card, flip the switch, and paint on the canvas.", fa: "ماوس بدون لمس که با دستت کنترلش می‌کنی. با انگشت اشاره حرکت بده، شستت رو به پایه انگشت اشاره بزن تا کلیک کنی. کارت رو بکش، کلید رو تغییر بده و روی بوم نقاشی کن." },
  "desc.canvas": { en: "Paint in the air with your index finger. Pinch to lift the brush, open your hand to erase, make a fist to clear.", fa: "با انگشت اشاره‌ات تو هوا نقاشی کن. انگشت‌هاتو ببند تا قلمو برداشته بشه، دستت رو باز کن تا پاک‌کن بشه، مشت کن تا همه‌چیز پاک بشه." },
  "desc.whiteboard": { en: "A multi-page gesture whiteboard. Pinch to draw, open hand to lift, fist to clear the page.", fa: "وایت‌برد چندصفحه‌ای با ژست دست. برای رسم انگشت‌هاتو ببند، دستت رو باز کن تا برداشتی، مشت کن تا صفحه پاک بشه." },
  "desc.orchestra": { en: "Conduct a live, procedurally-generated cinematic score with both hands. Right hand sets tempo & melody; left hand sets dynamics & harmony.", fa: "با هر دو دست یه موسیقی سینمایی زنده و خودکار رهبری کن. دست راست تمپو و ملودی رو تنظیم می‌کنه، دست چپ پویایی و هارمونی رو." },
  "desc.piano": { en: "Play a virtual piano in the air. Move your hand over the keys, pinch to strike. Multi-note chords, 4 instruments, record & playback.", fa: "پیانوی مجازی رو تو هوا بزن. دستت رو روی کلیدها ببر، انگشت‌هاتو ببند تا بزنی. آکورد چندنت‌ای، ۴ ساز، ضبط و پخش." },
  "desc.drumkit": { en: "Play a 6-pad drum kit in the air. Move your hand over a pad and pinch to hit it. Record and playback your beats.", fa: "درام شش‌پد رو تو هوا بزن. دستت رو روی پد ببر و انگشت‌هاتو ببند تا بزنی. ضبط و پخش ریتم‌هات." },
  "desc.sign": { en: "Learn the ASL alphabet. Browse the reference, or start practice mode and form each letter with your hand.", fa: "الفبای زبان اشاره رو یاد بگیر. مرجع رو ببین، یا تمرین رو شروع کن و هر حرف رو با دستت درست کن." },
  "desc.lab": { en: "A real-time visualizer of all 21 MediaPipe hand landmarks, with depth-aware skeleton, a 3D rotation view, and per-finger extension angles.", fa: "نمایشگر زنده همه ۲۱ نقطه دست مدیا‌پایپ، با اسکلت آگاه از عمق، نمای سه‌بعدی چرخان و زاویه بازشدن هر انگشت." },

  // ---- features section ----
  "section.features.badge": { en: "Why AirTouch", fa: "چرا ایر‌تاچ" },
  "section.features.title": { en: "Engineered for precision", fa: "طراحی شده برای دقت" },
  "section.features.desc": { en: "Every detail — from depth normalisation to hysteresis bands — is tuned so the cursor feels like an extension of your hand, not a novelty toy.", fa: "هر جزئیات — از نرمال‌سازی عمق تا باندهای هیسترزیس — طوری تنظیم شده که نشانگر حس می‌کنه بخشی از دستته، نه یه اسباب‌بازی." },

  // ---- gestures section ----
  "section.gestures.badge": { en: "The gesture set", fa: "ژست‌ها" },
  "section.gestures.title": { en: "Four gestures. Full control.", fa: "چهار ژست. کنترل کامل." },
  "section.gestures.desc": { en: "A deliberately minimal vocabulary so every action is unmistakable. No combos to memorise, no cooldowns to fight.", fa: "مجموعه‌ای عمداً محدود تا هر حرکت کاملاً مشخص باشه. بدون ترکیب پیچیده، بدون تاخیر آزاردهنده." },

  // ---- how it works section ----
  "section.how.badge": { en: "Under the hood", fa: "زیر پوشش" },
  "section.how.title": { en: "From pixels to pointer", fa: "از پیکسل تا نشانگر" },
  "section.how.desc": { en: "Four stages, one process, zero external services. The entire pipeline runs on your machine in a single browser tab.", fa: "چهار مرحله، یک پردازش، بدون سرویس خارجی. تمام مسیر روی سیستم شما و توی یک تب مرورگر اجرا می‌شه." },

  // ---- ideas section ----
  "section.ideas.badge": { en: "Where to take it next", fa: "قدم بعدی" },
  "section.ideas.title": { en: "Make it your own", fa: "خودت بسازش" },
  "section.ideas.desc": { en: "Every gesture is a pure function of 21 landmarks. Add your own by editing the gesture engine — the state machine, hysteresis, and depth-normalisation utilities are all reusable.", fa: "هر ژست یه تابع خالص از ۲۱ نقطه‌ست. ژست خودت رو اضافه کن — ماشین حالت، هیسترزیس و ابزارهای نرمال‌سازی عمق همگی قابل استفاده مجدد هستن." },

  // ---- gesture guide cards ----
  "gesture.move.title": { en: "Move cursor", fa: "حرکت نشانگر" },
  "gesture.move.pose": { en: "Index finger only", fa: "فقط انگشت اشاره" },
  "gesture.move.desc": { en: "Point with your index finger. The fingertip drives the cursor; an EMA filter smooths out jitter.", fa: "با انگشت اشاره اشاره کن. نوک انگشت نشانگر رو حرکت می‌ده و یه فیلترEMR لرزش‌ها رو حذف می‌کنه." },
  "gesture.click.title": { en: "Left click / drag", fa: "کلیک چپ / کشیدن" },
  "gesture.click.pose": { en: "Thumb tip → index knuckle", fa: "نوک شست → مفصل اشاره" },
  "gesture.click.desc": { en: "Tuck your thumb to the base of your index finger. Hold to keep the button down and drag; release to click.", fa: "شستت رو به پایه انگشت اشاره بزن. نگه‌دار تا دکمه پایین بمونه و بکشی؛ رها کن تا کلیک بشه." },
  "gesture.right.title": { en: "Right click", fa: "کلیک راست" },
  "gesture.right.pose": { en: "Thumb + middle pinch", fa: "شست + میان‌دست" },
  "gesture.right.desc": { en: "Pinch your thumb and middle fingertips together while keeping the index extended. The cursor freezes during the click.", fa: "شست و میان‌دستت رو هم بزن در حالی که اشاره بازه. نشانگر موقع کلیک فریز می‌شه." },
  "gesture.volume.title": { en: "Volume up / down", fa: "بالا/پایین کردن صدا" },
  "gesture.volume.pose": { en: "Open palm — push / pull", fa: "دست باز — جلو/عقب" },
  "gesture.volume.desc": { en: "Open your hand fully, then push it toward the camera to raise the volume or pull it back to lower.", fa: "دستت رو کامل باز کن، بعد به سمت دوربین ببر تا صدا زیاد بشه یا عقب بکش تا کم بشه." },
};

export function I18nProvider({ children }: { children: ReactNode }) {
  const [lang, setLang] = useState<Lang>("en");

  const toggle = useCallback(() => {
    setLang((l) => (l === "en" ? "fa" : "en"));
  }, []);

  const t = useCallback((key: string) => {
    const entry = translations[key];
    if (!entry) return key;
    return entry[lang];
  }, [lang]);

  const dir = lang === "fa" ? "rtl" : "ltr";

  return (
    <Ctx.Provider value={{ lang, setLang, toggle, t, dir }}>
      {children}
    </Ctx.Provider>
  );
}

export function useI18n() {
  return useContext(Ctx);
}
