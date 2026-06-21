"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { motion, AnimatePresence } from "framer-motion";
import {
  Camera, CameraOff, Loader2, Hand, Sparkles, Trophy, RotateCcw,
  Check, X, BookOpen, GraduationCap, ChevronRight, Target,
} from "lucide-react";
import { cn } from "@/lib/utils";
import { useHandTracking, type HandState, type Landmark } from "@/lib/gesture/use-hand-tracking";

const HAND_CONNECTIONS: [number, number][] = [
  [0, 1], [1, 2], [2, 3], [3, 4],
  [0, 5], [5, 6], [6, 7], [7, 8],
  [5, 9], [9, 10], [10, 11], [11, 12],
  [9, 13], [13, 14], [14, 15], [15, 16],
  [13, 17], [17, 18], [18, 19], [19, 20],
  [0, 17],
];

// ASL alphabet reference — each entry describes the hand shape + a simple ASCII glyph
type AslSign = {
  letter: string;
  name: string;
  desc: string;
  // a coarse finger-pattern signature we can match against
  // [thumb, index, middle, ring, pinky] booleans (true = extended)
  pattern: boolean[];
  // additional heuristic notes
  hint: string;
};

const ASL: AslSign[] = [
  { letter: "A", name: "A", desc: "Closed fist, thumb to the side", pattern: [false, false, false, false, false], hint: "Make a fist with your thumb resting on the side" },
  { letter: "B", name: "B", desc: "Flat hand, four fingers up, thumb tucked across palm", pattern: [false, true, true, true, true], hint: "Four fingers straight up, thumb folded across the palm" },
  { letter: "C", name: "C", desc: "Curved hand like the letter C", pattern: [true, true, true, true, true], hint: "Curve all fingers into a C shape" },
  { letter: "D", name: "D", desc: "Index finger up, others touching thumb", pattern: [false, true, false, false, false], hint: "Point up with index, touch thumb to other fingertips" },
  { letter: "E", name: "E", desc: "Fingers curled into a fist, thumb across", pattern: [false, false, false, false, false], hint: "Curl all fingers into the palm, thumb tucked" },
  { letter: "F", name: "F", desc: "Thumb and index touching in a circle, others up", pattern: [false, false, true, true, true], hint: "Circle thumb+index, three fingers up" },
  { letter: "G", name: "G", desc: "Index finger pointing sideways", pattern: [false, true, false, false, false], hint: "Index finger extended sideways" },
  { letter: "H", name: "H", desc: "Index and middle fingers pointing together", pattern: [false, true, true, false, false], hint: "Two fingers (index+middle) extended together" },
  { letter: "I", name: "I", desc: "Pinky finger up, others folded", pattern: [false, false, false, false, true], hint: "Just the pinky up" },
  { letter: "K", name: "K", desc: "Index and middle in a V, thumb between them", pattern: [true, true, true, false, false], hint: "Like a V but with thumb out between the fingers" },
  { letter: "L", name: "L", desc: "Thumb and index out in an L shape", pattern: [true, true, false, false, false], hint: "Make an L: thumb out sideways, index up" },
  { letter: "P", name: "P", desc: "Like K but pointing down", pattern: [true, true, true, false, false], hint: "K shape rotated downward" },
  { letter: "Q", name: "Q", desc: "Index and middle pointing down", pattern: [false, true, true, false, false], hint: "Like H but pointing downward" },
  { letter: "R", name: "R", desc: "Index and middle fingers crossed", pattern: [false, true, true, false, false], hint: "Cross index and middle fingers" },
  { letter: "T", name: "T", desc: "Thumb between index and middle fingers", pattern: [false, false, false, false, false], hint: "Thumb poking out between index+middle" },
  { letter: "V", name: "V", desc: "Index and middle fingers up in a V", pattern: [false, true, true, false, false], hint: "Peace sign — index and middle up in a V" },
  { letter: "W", name: "W", desc: "Index, middle, ring fingers up", pattern: [false, true, true, true, false], hint: "Three fingers up (index, middle, ring)" },
  { letter: "X", name: "X", desc: "Index finger bent into a hook", pattern: [false, false, false, false, false], hint: "Bend your index finger into a hook shape" },
  { letter: "Y", name: "Y", desc: "Thumb and pinky out, others folded", pattern: [true, false, false, false, true], hint: "Hang loose — thumb and pinky out, three fingers folded" },
  { letter: "Z", name: "Z", desc: "Index finger drawing a Z in the air", pattern: [false, true, false, false, false], hint: "Point with index, trace a Z shape" },
];

function fingerStates(lm: Landmark[]): boolean[] {
  const palmCx = (lm[5].x + lm[9].x + lm[13].x + lm[17].x) / 4;
  const palmCy = (lm[5].y + lm[9].y + lm[13].y + lm[17].y) / 4;
  const tipFrom = Math.abs(lm[4].x - palmCx) + Math.abs(lm[4].y - palmCy);
  const ipFrom = Math.abs(lm[3].x - palmCx) + Math.abs(lm[3].y - palmCy);
  const lateral = tipFrom > ipFrom * 1.1;
  const upward = lm[4].y < lm[3].y - 0.03;
  return [lateral || upward, lm[8].y < lm[6].y, lm[12].y < lm[10].y, lm[16].y < lm[14].y, lm[20].y < lm[18].y];
}

// match the live hand pattern against an ASL sign's pattern, return similarity 0..1
function matchPattern(live: boolean[], target: boolean[]): number {
  let matches = 0;
  for (let i = 0; i < 5; i++) if (live[i] === target[i]) matches++;
  return matches / 5;
}

type Mode = "browse" | "practice" | "quiz";

export function SignTrainerView() {
  const videoRef = useRef<HTMLVideoElement>(null);
  const overlayRef = useRef<HTMLCanvasElement>(null);
  const holdStartRef = useRef<number>(0);
  const practiceIdxRef = useRef(0);
  const scoreRef = useRef(0);
  const quizOrderRef = useRef<number[]>([]);
  const quizIdxRef = useRef(0);
  const quizTimerRef = useRef<number>(0);

  const [running, setRunning] = useState(false);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [mode, setMode] = useState<Mode>("browse");
  const [selectedIdx, setSelectedIdx] = useState(0);
  const [quizIdx, setQuizIdx] = useState(0);
  const [quizScore, setQuizScore] = useState(0);
  const [quizTimeLeft, setQuizTimeLeft] = useState(60);
  const [quizFinished, setQuizFinished] = useState(false);
  const [quizTotal, setQuizTotal] = useState(0);
  const [livePattern, setLivePattern] = useState<boolean[] | null>(null);
  const [similarity, setSimilarity] = useState(0);
  const [matched, setMatched] = useState(false);
  const [practiceIdx, setPracticeIdx] = useState(0);
  const [score, setScore] = useState(0);
  const [attempts, setAttempts] = useState(0);
  const [feedback, setFeedback] = useState<"none" | "good" | "try">("none");

  const onFrame = useCallback((h: HandState, lm: Landmark[] | null) => {
    // draw skeleton
    const oc = overlayRef.current;
    const video = videoRef.current;
    if (oc && video) {
      const ctx = oc.getContext("2d")!;
      oc.width = video.videoWidth || 640;
      oc.height = video.videoHeight || 480;
      ctx.clearRect(0, 0, oc.width, oc.height);
      if (lm) {
        const w = oc.width, hh = oc.height;
        ctx.strokeStyle = matched ? "rgba(0,255,140,0.9)" : "rgba(0,255,200,0.7)";
        ctx.lineWidth = matched ? 4 : 2.5;
        for (const [a, b] of HAND_CONNECTIONS) {
          ctx.beginPath();
          ctx.moveTo(lm[a].x * w, lm[a].y * hh);
          ctx.lineTo(lm[b].x * w, lm[b].y * hh);
          ctx.stroke();
        }
        ctx.fillStyle = "rgba(255,210,80,0.95)";
        for (const p of lm) {
          ctx.beginPath();
          ctx.arc(p.x * w, p.y * hh, 5, 0, Math.PI * 2);
          ctx.fill();
        }
      }
    }

    if (!h.present || !lm) {
      setLivePattern(null);
      setSimilarity(0);
      setMatched(false);
      holdStartRef.current = 0;
      return;
    }

    const live = fingerStates(lm);
    setLivePattern(live);

    // match against the active target
    const target = mode === "browse" ? ASL[selectedIdx]
      : mode === "practice" ? ASL[practiceIdxRef.current]
      : ASL[quizOrderRef.current[quizIdxRef.current] ?? 0];
    const sim = matchPattern(live, target.pattern);
    setSimilarity(sim);

    const isMatch = sim >= 0.8; // 4/5 fingers correct
    setMatched(isMatch);

    if (mode === "practice") {
      if (isMatch) {
        if (holdStartRef.current === 0) holdStartRef.current = performance.now();
        const held = performance.now() - holdStartRef.current;
        if (held > 800) {
          // success — advance
          setFeedback("good");
          setScore((s) => s + 1);
          scoreRef.current += 1;
          setAttempts((a) => a + 1);
          holdStartRef.current = 0;
          setTimeout(() => {
            const next = (practiceIdxRef.current + 1) % ASL.length;
            practiceIdxRef.current = next;
            setPracticeIdx(next);
            setFeedback("none");
          }, 600);
        }
      } else {
        holdStartRef.current = 0;
        if (sim < 0.4) setFeedback("try");
        else setFeedback("none");
      }
    } else if (mode === "quiz" && !quizFinished) {
      if (isMatch) {
        if (holdStartRef.current === 0) holdStartRef.current = performance.now();
        const held = performance.now() - holdStartRef.current;
        if (held > 600) {
          // correct — next letter
          setFeedback("good");
          setQuizScore((s) => s + 1);
          holdStartRef.current = 0;
          const nextIdx = quizIdxRef.current + 1;
          if (nextIdx >= quizOrderRef.current.length) {
            // quiz complete
            setQuizFinished(true);
            if (quizTimerRef.current) { clearInterval(quizTimerRef.current); quizTimerRef.current = 0; }
          } else {
            quizIdxRef.current = nextIdx;
            setQuizIdx(nextIdx);
            setTimeout(() => setFeedback("none"), 500);
          }
        }
      } else {
        holdStartRef.current = 0;
      }
    }
  }, [mode, selectedIdx, matched, quizFinished]);

  const tracking = useHandTracking({ onFrame, smoothing: 0.55 });
  useEffect(() => { videoRef.current = tracking.videoRef.current; });

  const start = async () => {
    setError(null);
    setLoading(true);
    try {
      await tracking.start();
      setRunning(true);
    } catch (e) {
      setError(e instanceof Error ? e.message : "Camera error");
    } finally {
      setLoading(false);
    }
  };
  const stop = () => { tracking.stop(); setRunning(false); setLivePattern(null); setMatched(false); };

  const startPractice = () => {
    setMode("practice");
    practiceIdxRef.current = 0;
    setPracticeIdx(0);
    setScore(0);
    setAttempts(0);
    scoreRef.current = 0;
    setFeedback("none");
  };
  const stopPractice = () => {
    setMode("browse");
    setFeedback("none");
    holdStartRef.current = 0;
  };

  // shuffle helper
  const shuffle = (arr: number[]) => {
    const a = [...arr];
    for (let i = a.length - 1; i > 0; i--) {
      const j = Math.floor(Math.random() * (i + 1));
      [a[i], a[j]] = [a[j], a[i]];
    }
    return a;
  };

  const startQuiz = (difficulty: "easy" | "medium" | "hard") => {
    const config = {
      easy: { count: 10, time: 90 },
      medium: { count: 20, time: 60 },
      hard: { count: 20, time: 30 },
    }[difficulty];
    setMode("quiz");
    const allIndices = Array.from({ length: ASL.length }, (_, i) => i);
    quizOrderRef.current = shuffle(allIndices).slice(0, config.count);
    quizIdxRef.current = 0;
    setQuizIdx(0);
    setQuizScore(0);
    setQuizTotal(quizOrderRef.current.length);
    setQuizTimeLeft(config.time);
    setQuizFinished(false);
    setFeedback("none");
    holdStartRef.current = 0;
    // countdown timer
    if (quizTimerRef.current) clearInterval(quizTimerRef.current);
    quizTimerRef.current = window.setInterval(() => {
      setQuizTimeLeft((t) => {
        if (t <= 1) {
          if (quizTimerRef.current) { clearInterval(quizTimerRef.current); quizTimerRef.current = 0; }
          setQuizFinished(true);
          return 0;
        }
        return t - 1;
      });
    }, 1000);
  };

  const stopQuiz = () => {
    setMode("browse");
    setFeedback("none");
    holdStartRef.current = 0;
    if (quizTimerRef.current) { clearInterval(quizTimerRef.current); quizTimerRef.current = 0; }
    setQuizFinished(false);
  };

  // cleanup timer on unmount
  useEffect(() => {
    return () => { if (quizTimerRef.current) clearInterval(quizTimerRef.current); };
  }, []);

  const target = mode === "browse" ? ASL[selectedIdx]
    : mode === "practice" ? ASL[practiceIdx]
    : ASL[quizOrderRef.current[quizIdx] ?? 0];
  const FINGER_NAMES = ["Thumb", "Index", "Middle", "Ring", "Pinky"];

  return (
    <div className="relative min-h-screen pt-16 sm:pt-20 pb-12">
      <div className="mx-auto max-w-7xl px-4 sm:px-6 lg:px-8">
        {/* header */}
        <div className="mb-6 flex flex-col sm:flex-row sm:items-end sm:justify-between gap-4">
          <div>
            <h1 className="text-3xl sm:text-4xl font-bold tracking-tight">
              Sign Language <span className="text-gradient">Trainer</span>
            </h1>
            <p className="mt-2 text-muted-foreground max-w-xl text-sm">
              Learn the ASL alphabet. Browse the reference, or start practice mode and form each letter with your hand.
            </p>
          </div>
          <div className="flex items-center gap-2">
            {!running ? (
              <button onClick={start} disabled={loading} className="flex items-center gap-2 px-5 py-2.5 rounded-xl bg-primary text-primary-foreground font-medium hover:brightness-110 transition-all hover:glow-emerald disabled:opacity-50">
                {loading ? <Loader2 className="h-4 w-4 animate-spin" /> : <Camera className="h-4 w-4" />}
                {loading ? "Loading…" : "Start"}
              </button>
            ) : (
              <button onClick={stop} className="flex items-center gap-2 px-5 py-2.5 rounded-xl glass text-foreground font-medium hover:bg-white/10 transition-all">
                <CameraOff className="h-4 w-4" /> Stop
              </button>
            )}
          </div>
        </div>

        <div className="grid lg:grid-cols-[1fr_320px] gap-4">
          {/* ---- main area ---- */}
          <div className="flex flex-col gap-3">
            {/* camera */}
            <div className="relative rounded-2xl overflow-hidden glass-strong aspect-video bg-black">
              <video ref={tracking.videoRef} playsInline muted className="absolute inset-0 h-full w-full object-cover opacity-0" />
              <canvas ref={overlayRef} className="absolute inset-0 h-full w-full object-cover" />
              {!running && (
                <div className="absolute inset-0 flex flex-col items-center justify-center gap-4 grid-bg">
                  <div className="relative">
                    <div className="absolute inset-0 bg-primary/30 blur-2xl rounded-full animate-pulse-glow" />
                    <Hand className="relative h-16 w-16 text-primary/70" />
                  </div>
                  <p className="text-muted-foreground text-sm max-w-xs text-center">Click Start and show your hand to the camera</p>
                </div>
              )}

              {/* live target letter overlay (big, top-center) */}
              {running && (
                <div className="absolute top-3 left-1/2 -translate-x-1/2 flex flex-col items-center">
                  <div className="text-[10px] text-muted-foreground uppercase tracking-widest">Form the letter</div>
                  <div className={cn(
                    "text-7xl font-bold leading-none transition-all",
                    matched ? "text-primary scale-110" : feedback === "try" ? "text-destructive" : "text-foreground"
                  )}>
                    {target.letter}
                  </div>
                </div>
              )}

              {/* feedback banner */}
              <AnimatePresence>
                {feedback === "good" && (
                  <motion.div initial={{ opacity: 0, scale: 0.8, y: 20 }} animate={{ opacity: 1, scale: 1, y: 0 }} exit={{ opacity: 0 }} className="absolute bottom-4 left-1/2 -translate-x-1/2 flex items-center gap-2 px-5 py-2.5 rounded-xl bg-primary text-primary-foreground font-bold">
                    <Check className="h-5 w-5" /> Correct! Next…
                  </motion.div>
                )}
              </AnimatePresence>

              {/* similarity meter (right side) */}
              {running && (
                <div className="absolute top-3 right-3 w-28">
                  <div className="text-[10px] text-muted-foreground uppercase tracking-wider mb-1 text-right">Match</div>
                  <div className="h-2 rounded-full bg-black/50 overflow-hidden">
                    <div className={cn("h-full rounded-full transition-all", similarity >= 0.8 ? "bg-primary" : similarity >= 0.5 ? "bg-chart-3" : "bg-muted-foreground")} style={{ width: `${similarity * 100}%` }} />
                  </div>
                  <div className="text-xs font-mono text-right mt-0.5 tabular-nums text-muted-foreground">{Math.round(similarity * 100)}%</div>
                </div>
              )}

              {error && <div className="absolute bottom-3 left-3 right-3 px-4 py-3 rounded-lg bg-destructive/20 border border-destructive/40 text-sm text-destructive">{error}</div>}
            </div>

            {/* alphabet grid (browse mode) / practice strip */}
            <div className="rounded-xl glass-strong p-4">
              {mode === "browse" ? (
                <>
                  <div className="text-xs text-muted-foreground uppercase tracking-wider mb-3 flex items-center gap-1.5">
                    <BookOpen className="h-3.5 w-3.5" /> ASL Alphabet — click a letter to practice it
                  </div>
                  <div className="grid grid-cols-5 sm:grid-cols-10 gap-2">
                    {ASL.map((s, i) => (
                      <button
                        key={s.letter}
                        onClick={() => setSelectedIdx(i)}
                        className={cn(
                          "aspect-square rounded-xl border-2 flex flex-col items-center justify-center transition-all",
                          selectedIdx === i ? "border-primary bg-primary/10 scale-105" : "border-white/10 bg-white/[0.02] hover:border-white/30"
                        )}
                      >
                        <span className={cn("text-xl font-bold", selectedIdx === i ? "text-primary" : "text-foreground")}>{s.letter}</span>
                      </button>
                    ))}
                  </div>
                </>
              ) : mode === "practice" ? (
                <>
                  <div className="flex items-center justify-between mb-3">
                    <div className="text-xs text-muted-foreground uppercase tracking-wider flex items-center gap-1.5">
                      <Target className="h-3.5 w-3.5" /> Practice — letter {practiceIdx + 1} of {ASL.length}
                    </div>
                    <div className="flex items-center gap-3 text-xs">
                      <span className="text-primary font-bold flex items-center gap-1"><Trophy className="h-3.5 w-3.5" /> {score}</span>
                      <span className="text-muted-foreground">/ {attempts} tries</span>
                    </div>
                  </div>
                  <div className="flex items-center gap-1">
                    {ASL.map((s, i) => (
                      <div key={s.letter} className={cn(
                        "flex-1 h-1.5 rounded-full transition-colors",
                        i < practiceIdx ? "bg-primary" : i === practiceIdx ? "bg-primary/50 animate-pulse" : "bg-white/10"
                      )} />
                    ))}
                  </div>
                </>
              ) : (
                // quiz mode
                <>
                  <div className="flex items-center justify-between mb-3">
                    <div className="text-xs text-muted-foreground uppercase tracking-wider flex items-center gap-1.5">
                      <Target className="h-3.5 w-3.5" /> Quiz — letter {quizIdx + 1} of {quizTotal}
                    </div>
                    <div className="flex items-center gap-3 text-xs">
                      <span className="text-chart-4 font-bold flex items-center gap-1"><Trophy className="h-3.5 w-3.5" /> {quizScore}</span>
                      <span className={cn("font-mono tabular-nums", quizTimeLeft <= 10 ? "text-destructive animate-pulse" : "text-muted-foreground")}>{quizTimeLeft}s</span>
                    </div>
                  </div>
                  <div className="flex items-center gap-1">
                    {quizOrderRef.current.map((_, i) => (
                      <div key={i} className={cn(
                        "flex-1 h-1.5 rounded-full transition-colors",
                        i < quizIdx ? "bg-primary" : i === quizIdx ? "bg-chart-4/50 animate-pulse" : "bg-white/10"
                      )} />
                    ))}
                  </div>
                </>
              )}
            </div>
          </div>

          {/* ---- sidebar ---- */}
          <div className="grid grid-cols-2 lg:grid-cols-1 gap-3">
            {/* current sign detail */}
            <div className="rounded-xl glass-strong p-5 col-span-2 lg:col-span-1">
              <div className="flex items-center gap-4 mb-4">
                <div className={cn("flex items-center justify-center h-20 w-20 rounded-2xl text-5xl font-bold border-2 transition-colors", matched ? "border-primary bg-primary/15 text-primary" : "border-white/10 bg-white/[0.02] text-foreground")}>
                  {target.letter}
                </div>
                <div>
                  <div className="text-xs text-muted-foreground uppercase tracking-wider">Letter {target.letter}</div>
                  <h3 className="font-bold text-lg">{target.name}</h3>
                  <p className="text-xs text-muted-foreground mt-0.5">{target.desc}</p>
                </div>
              </div>
              <div className="rounded-lg bg-white/[0.03] p-3">
                <div className="text-[10px] text-muted-foreground uppercase tracking-wider mb-1.5">Hint</div>
                <p className="text-sm text-foreground/90">{target.hint}</p>
              </div>
            </div>

            {/* finger pattern visualizer */}
            <div className="rounded-xl glass-strong p-4 col-span-2 lg:col-span-1">
              <div className="text-xs text-muted-foreground uppercase tracking-wider mb-3">Finger pattern</div>
              <div className="space-y-2">
                {FINGER_NAMES.map((name, i) => {
                  const targetOn = target.pattern[i];
                  const liveOn = livePattern?.[i];
                  const correct = liveOn !== undefined && liveOn === targetOn;
                  return (
                    <div key={name} className="flex items-center gap-2">
                      <span className="text-xs w-14 text-muted-foreground">{name}</span>
                      <div className={cn("h-2.5 w-8 rounded-full", targetOn ? "bg-primary" : "bg-white/10")} title="target" />
                      <span className="text-[10px] text-muted-foreground">← target</span>
                      <div className={cn("h-2.5 w-8 rounded-full transition-colors", liveOn === undefined ? "bg-white/5" : liveOn ? "bg-chart-3" : "bg-white/10")} title="your hand" />
                      <span className="text-[10px] text-muted-foreground">← you</span>
                      {liveOn !== undefined && (
                        correct ? <Check className="h-3.5 w-3.5 text-primary" /> : <X className="h-3.5 w-3.5 text-destructive" />
                      )}
                    </div>
                  );
                })}
              </div>
            </div>

            {/* mode controls */}
            <div className="rounded-xl glass-strong p-4 col-span-2 lg:col-span-1">
              <div className="text-xs text-muted-foreground uppercase tracking-wider mb-3">Mode</div>
              {mode === "browse" ? (
                <div className="space-y-2">
                  <button onClick={startPractice} className="w-full flex items-center justify-center gap-2 px-4 py-2.5 rounded-lg bg-primary text-primary-foreground text-sm font-medium hover:brightness-110 transition-all">
                    <GraduationCap className="h-4 w-4" /> Start Practice
                  </button>
                  <div className="text-[10px] text-muted-foreground uppercase tracking-wider pt-1">Timed Quiz</div>
                  <div className="grid grid-cols-3 gap-1.5">
                    <button onClick={() => startQuiz("easy")} className="flex flex-col items-center gap-0.5 px-1 py-2 rounded-lg bg-primary/15 text-primary text-xs font-medium hover:bg-primary/25 transition-colors">
                      <span className="font-bold">Easy</span>
                      <span className="text-[9px] opacity-70">10 / 90s</span>
                    </button>
                    <button onClick={() => startQuiz("medium")} className="flex flex-col items-center gap-0.5 px-1 py-2 rounded-lg bg-chart-3/15 text-chart-3 text-xs font-medium hover:bg-chart-3/25 transition-colors">
                      <span className="font-bold">Med</span>
                      <span className="text-[9px] opacity-70">20 / 60s</span>
                    </button>
                    <button onClick={() => startQuiz("hard")} className="flex flex-col items-center gap-0.5 px-1 py-2 rounded-lg bg-destructive/15 text-destructive text-xs font-medium hover:bg-destructive/25 transition-colors">
                      <span className="font-bold">Hard</span>
                      <span className="text-[9px] opacity-70">20 / 30s</span>
                    </button>
                  </div>
                </div>
              ) : mode === "practice" ? (
                <div className="space-y-2">
                  <button onClick={stopPractice} className="w-full flex items-center justify-center gap-2 px-4 py-2.5 rounded-lg glass text-sm font-medium hover:bg-white/10 transition-all">
                    <RotateCcw className="h-4 w-4" /> End Practice
                  </button>
                  <div className="text-center text-xs text-muted-foreground">Hold the correct shape for 0.8s to advance</div>
                </div>
              ) : quizFinished ? (
                <div className="space-y-3 text-center">
                  <div className="text-3xl font-bold text-gradient">{quizScore} / {quizTotal}</div>
                  <div className="text-xs text-muted-foreground">{quizScore === quizTotal ? "Perfect! 🏆" : quizScore >= quizTotal * 0.7 ? "Great job!" : quizScore >= quizTotal * 0.5 ? "Good effort!" : "Keep practicing!"}</div>
                  <button onClick={() => startQuiz("medium")} className="w-full flex items-center justify-center gap-2 px-4 py-2.5 rounded-lg bg-chart-4 text-white text-sm font-medium hover:brightness-110 transition-all">
                    <RotateCcw className="h-4 w-4" /> Retry (Medium)
                  </button>
                  <button onClick={stopQuiz} className="w-full flex items-center justify-center gap-2 px-4 py-2 rounded-lg glass text-sm font-medium hover:bg-white/10 transition-all">
                    Back to Browse
                  </button>
                </div>
              ) : (
                <div className="space-y-2">
                  <button onClick={stopQuiz} className="w-full flex items-center justify-center gap-2 px-4 py-2.5 rounded-lg glass text-sm font-medium hover:bg-white/10 transition-all">
                    <RotateCcw className="h-4 w-4" /> End Quiz
                  </button>
                  <div className="text-center text-xs text-muted-foreground">Form each letter and hold 0.6s to score</div>
                </div>
              )}
            </div>

            {/* tip */}
            <div className="rounded-xl glass p-3 text-xs space-y-1.5 col-span-2 lg:col-span-1">
              <p className="font-medium flex items-center gap-1.5 text-muted-foreground"><Sparkles className="h-3.5 w-3.5 text-primary" /> Note</p>
              <p className="text-muted-foreground">
                This trainer recognises coarse finger-extension patterns. Real ASL uses subtle hand shapes — use it as a learning aid, not a strict reference.
              </p>
            </div>
          </div>
        </div>

        <p className="mt-4 text-center text-xs text-muted-foreground">
          <Hand className="inline h-3 w-3 text-primary mr-1" />
          An accessibility + education tool — learn the ASL alphabet with real-time hand-shape feedback.
        </p>
      </div>
    </div>
  );
}
