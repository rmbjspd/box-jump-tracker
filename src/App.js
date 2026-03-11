import { useState, useEffect, useCallback } from "react";
import {
  LineChart, Line, XAxis, YAxis, CartesianGrid, Tooltip,
  ReferenceLine, ResponsiveContainer, RadarChart, Radar,
  PolarGrid, PolarAngleAxis,
} from "recharts";
import { supabase } from "./supabase";

// ─── ATHLETE PROFILE ─────────────────────────────────────────────────────────
const ATHLETE = {
  bodyweight: 255,
  height: "6'1\"",
  goalDate: "2026-10-01",
  targetJump: 36,
  baseline: { backSquat1RM: 105, rdl: "10 × 115 lbs", lunges: "20 lb DBs", calfRaise: "15 × 125 lbs" },
};

// ─── PHASES ───────────────────────────────────────────────────────────────────
const PHASES = [
  { id: 1, name: "Foundation & Hypertrophy", weeks: 10, startWeek: 1,  endWeek: 10, color: "#4ade80", targetHeight: 0,  description: "Extended to 10 wks for 255 lbs — tendon integrity, landing mechanics, posterior chain base", squatTarget: "Build to ~185 lbs (5×5)", keyFocus: ["Landing mechanics first", "Pogo jumps progressive", "Joints over ego", "Zone 2 cardio only"], deloadWeeks: [4, 8] },
  { id: 2, name: "Strength & Force Production", weeks: 8, startWeek: 11, endWeek: 18, color: "#facc15", targetHeight: 18, description: "Close the strength gap — 1.5× BW squat is prerequisite for 36\"", squatTarget: "Build to ~225 lbs (3×5)", keyFocus: ["Weekly squat loading targets", "Box jumps intro 12–18\"", "Upper 2×/week", "Swim/bike over running"], deloadWeeks: [14, 18] },
  { id: 3, name: "Power & Rate of Force Dev",  weeks: 8, startWeek: 19, endWeek: 26, color: "#f97316", targetHeight: 30, description: "Convert strength into explosion — conservative height progression, perfect mechanics", squatTarget: "Maintain 315 lbs+, shift to speed squats", keyFocus: ["Complex training: squat → depth jump", "Jumps before cardio always", "24–30\" box progression", "BW drops = free jump gains"], deloadWeeks: [22, 26] },
  { id: 4, name: "Peaking & Specificity",      weeks: 4, startWeek: 27, endWeek: 30, color: "#f43f5e", targetHeight: 36, description: "Trimmed to 4 weeks — taper volume, keep intensity, attempt 36\"", squatTarget: "Low volume, high intensity maintenance", keyFocus: ["3–5 max attempts, full rest between", "No new training stimuli", "Sleep & nutrition dialed", "Attempt on week 29 or 30"], deloadWeeks: [] },
];
const TOTAL_WEEKS = 30;

const SESSION_TYPES = [
  "Lower Power (Jumps + Squats)",
  "Lower Strength (Deadlifts, Split Squats)",
  "Upper Push",
  "Upper Pull",
  "Cardio",
  "Plyometrics",
  "Core & Stability",
  "Complex Training (Squat → Depth Jump)",
  "Recovery / Mobility",
];
const CARDIO_TYPES = ["Swimming", "Biking", "Running", "Other"];

const JUMP_MILESTONES  = [{ height: 12, label: "First jump", emoji: "🌱" }, { height: 18, label: "Phase 2 target", emoji: "⚡" }, { height: 24, label: "2-foot barrier", emoji: "🔥" }, { height: 30, label: "Phase 3 target", emoji: "💥" }, { height: 33, label: "3 inches out", emoji: "🎯" }, { height: 36, label: "GOAL", emoji: "🏆" }];
const SQUAT_MILESTONES = [{ weight: 135, label: "Plate on each side", emoji: "🔩" }, { weight: 185, label: "Phase 1 target", emoji: "💪" }, { weight: 225, label: "Phase 2 target", emoji: "⚡" }, { weight: 275, label: "~1.1× BW", emoji: "🔥" }, { weight: 315, label: "Three plates", emoji: "💥" }, { weight: 380, label: "1.5× BW — jump ready", emoji: "🏆" }];

const phaseFor = (week) => PHASES.find(p => week >= p.startWeek && week <= p.endWeek) || PHASES[0];

const BLANK_FORM = {
  date: new Date().toISOString().split("T")[0],
  type: SESSION_TYPES[0], week: "1", phase: "1",
  boxHeight: "", squatWeight: "", sets: "", reps: "",
  load: "", notes: "", cardioType: "", cardioMinutes: "", bodyweight: "255",
};

export default function App() {
  const [sessions, setSessions]     = useState([]);
  const [loading, setLoading]       = useState(true);
  const [saving, setSaving]         = useState(false);
  const [error, setError]           = useState(null);
  const [tab, setTab]               = useState("dashboard");
  const [showForm, setShowForm]     = useState(false);
  const [showFeedback, setShowFeedback] = useState(false);
  const [feedbackText, setFeedbackText] = useState("");
  const [copied, setCopied]         = useState(false);
  const [form, setForm]             = useState(BLANK_FORM);

  // ── Load sessions from Supabase ──
  useEffect(() => {
    async function load() {
      setLoading(true);
      const { data, error } = await supabase
        .from("sessions")
        .select("*")
        .order("date", { ascending: true });
      if (error) setError(error.message);
      else setSessions(data || []);
      setLoading(false);
    }
    load();
  }, []);

  // ── Derived stats ──
  const currentWeek        = sessions.length ? Math.max(...sessions.map(s => s.week), 1) : 1;
  const currentPhase       = phaseFor(currentWeek);
  const maxJump            = Math.max(...sessions.map(s => s.box_height || 0), 0);
  const maxSquat           = Math.max(...sessions.map(s => s.squat_weight || 0), ATHLETE.baseline.backSquat1RM);
  const latestBW           = sessions.filter(s => s.bodyweight).slice(-1)[0]?.bodyweight || ATHLETE.bodyweight;
  const bwDrop             = ATHLETE.bodyweight - latestBW;
  const nextJumpMilestone  = JUMP_MILESTONES.find(m => m.height > maxJump)  || JUMP_MILESTONES.at(-1);
  const nextSquatMilestone = SQUAT_MILESTONES.find(m => m.weight > maxSquat) || SQUAT_MILESTONES.at(-1);
  const jumpProgress       = Math.round((maxJump / 36) * 100);
  const squatProgress      = Math.round(Math.min((maxSquat / 380) * 100, 100));
  const weeksLeft          = Math.max(0, TOTAL_WEEKS - currentWeek);

  // ── Chart data ──
  const heightData = sessions.filter(s => s.box_height).map(s => ({ week: `W${s.week}`, height: s.box_height }));
  const squatData  = sessions.filter(s => s.squat_weight).map(s => ({ week: `W${s.week}`, squat: s.squat_weight }));
  const bwData     = sessions.filter(s => s.bodyweight).map(s => ({ week: `W${s.week}`, bw: s.bodyweight }));

  const radarData = [
    { axis: "Lower Power",  value: Math.min(sessions.filter(s => s.type.includes("Lower Power") || s.type.includes("Complex")).length * 12, 100) },
    { axis: "Strength",     value: Math.min(sessions.filter(s => s.type.includes("Lower Strength")).length * 10, 100) },
    { axis: "Plyos",        value: Math.min(sessions.filter(s => s.type === "Plyometrics").length * 14, 100) },
    { axis: "Upper",        value: Math.min(sessions.filter(s => s.type.includes("Upper")).length * 10, 100) },
    { axis: "Cardio",       value: Math.min(sessions.filter(s => s.type === "Cardio").length * 10, 100) },
    { axis: "Recovery",     value: Math.min(sessions.filter(s => s.type.includes("Core") || s.type.includes("Recovery")).length * 12, 100) },
  ];

  // ── Save session ──
  const addSession = async () => {
    setSaving(true);
    setError(null);
    const payload = {
      date:            form.date,
      week:            parseInt(form.week),
      phase:           parseInt(form.phase),
      type:            form.type,
      box_height:      form.boxHeight      ? parseInt(form.boxHeight)      : null,
      squat_weight:    form.squatWeight    ? parseInt(form.squatWeight)    : null,
      sets:            form.sets           ? parseInt(form.sets)           : null,
      reps:            form.reps           ? parseInt(form.reps)           : null,
      load:            form.load           || null,
      notes:           form.notes          || null,
      cardio_type:     form.cardioType     || null,
      cardio_minutes:  form.cardioMinutes  ? parseInt(form.cardioMinutes)  : null,
      bodyweight:      form.bodyweight     ? parseInt(form.bodyweight)     : null,
    };
    const { data, error } = await supabase.from("sessions").insert([payload]).select();
    if (error) {
      setError(error.message);
    } else {
      setSessions(prev => [...prev, ...data].sort((a, b) => new Date(a.date) - new Date(b.date)));
      setShowForm(false);
      setForm({ ...BLANK_FORM, week: String(currentWeek), phase: String(currentPhase.id) });
    }
    setSaving(false);
  };

  // ── Delete session ──
  const deleteSession = async (id) => {
    const { error } = await supabase.from("sessions").delete().eq("id", id);
    if (!error) setSessions(prev => prev.filter(s => s.id !== id));
  };

  // ── AI Feedback ──
  const generateFeedback = useCallback(() => {
    const recent = sessions.slice(-12);
    const txt = `PROJECT 36-INCH COUNTER — TRAINING LOG
Generated: ${new Date().toLocaleDateString()}

ATHLETE PROFILE:
- Bodyweight: ${latestBW} lbs (started: 255 lbs, dropped: ${bwDrop} lbs)
- Height: 6'1"
- Goal: 36" box jump by October 1, 2026

CURRENT STATUS:
- Training week: ${currentWeek} of ${TOTAL_WEEKS} (${weeksLeft} weeks remaining)
- Phase: ${currentPhase.id} — ${currentPhase.name}
- Best box jump: ${maxJump > 0 ? maxJump + '"' : "not yet attempted"}
- Best squat logged: ${maxSquat} lbs (goal: 380 lbs = 1.5× BW)
- Jump progress: ${jumpProgress}% to goal
- Squat progress: ${squatProgress}% to 380 lb target

BASELINE (March 10, 2026):
- Back squat est. 1RM: ~105 lbs
- RDL: 10 × 115 lbs | Lunges: 20 lb DBs | Calf raise: 15 × 125 lbs

PHASE SQUAT TARGETS:
- End Phase 1 (Wk 10): 185 lbs
- End Phase 2 (Wk 18): 225 lbs
- End Phase 3 (Wk 26): 315 lbs
- Goal day: 380 lbs

RECENT SESSIONS (last 12):
${recent.map(s =>
  `- ${s.date} | Wk${s.week} Ph${s.phase} | ${s.type}` +
  (s.box_height    ? ` | Jump: ${s.box_height}"` : "") +
  (s.squat_weight  ? ` | Squat: ${s.squat_weight} lbs` : "") +
  (s.load          ? ` | ${s.load}` : "") +
  (s.cardio_type   ? ` | ${s.cardio_type} ${s.cardio_minutes}min` : "") +
  (s.notes         ? ` | "${s.notes}"` : "")
).join("\n")}

SESSION VOLUME TOTALS:
- Lower power/complex: ${sessions.filter(s => s.type.includes("Lower Power") || s.type.includes("Complex")).length}
- Lower strength: ${sessions.filter(s => s.type.includes("Lower Strength")).length}
- Upper body: ${sessions.filter(s => s.type.includes("Upper")).length}
- Cardio: ${sessions.filter(s => s.type === "Cardio").length}
- Plyometrics: ${sessions.filter(s => s.type === "Plyometrics").length}
- Recovery/core: ${sessions.filter(s => s.type.includes("Core") || s.type.includes("Recovery")).length}

Please analyze and respond with:
1. Am I on track to hit 36" by Oct 1, 2026 given my 255 lb starting weight?
2. Is my squat progression on pace for the 380 lb target?
3. Any training imbalances or red flags?
4. Top 3 priorities for the next 2–3 weeks
5. Body composition notes — does the BW trend look right?`;
    setFeedbackText(txt);
    setShowFeedback(true);
  }, [sessions, currentWeek, currentPhase, maxJump, maxSquat, latestBW, bwDrop, weeksLeft, jumpProgress, squatProgress]);

  const copyFeedback = () => {
    navigator.clipboard.writeText(feedbackText);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  // ── Shared style helpers ──
  const card  = { background: "#111118", border: "1px solid #1d1d2e", borderRadius: 14, padding: "20px 22px" };
  const lbl   = { fontFamily: "'DM Sans', sans-serif", fontSize: 10, color: "#44445a", textTransform: "uppercase", letterSpacing: "1.5px", marginBottom: 6 };

  if (loading) return (
    <div style={{ background: "#0b0b12", minHeight: "100vh", display: "flex", alignItems: "center", justifyContent: "center", fontFamily: "'Barlow Condensed', sans-serif", color: "#4ade80", fontSize: 28, letterSpacing: 3 }}>
      <style>{"@import url('https://fonts.googleapis.com/css2?family=Barlow+Condensed:wght@700&display=swap');"}</style>
      LOADING YOUR LOG...
    </div>
  );

  return (
    <div style={{ fontFamily: "'Barlow Condensed', sans-serif", background: "#0b0b12", minHeight: "100vh", color: "#e8e8f0" }}>
      <style>{`
        @import url('https://fonts.googleapis.com/css2?family=Barlow+Condensed:wght@400;600;700;800&family=DM+Sans:wght@300;400;500&display=swap');
        *, *::before, *::after { box-sizing: border-box; margin: 0; padding: 0; }
        ::-webkit-scrollbar { width: 3px; } ::-webkit-scrollbar-track { background: #0b0b12; } ::-webkit-scrollbar-thumb { background: #2a2a40; border-radius: 2px; }
        .tab { font-family: 'Barlow Condensed', sans-serif; font-size: 13px; font-weight: 700; letter-spacing: 2px; text-transform: uppercase; padding: 10px 18px; background: none; border: none; color: #33334a; cursor: pointer; border-bottom: 2px solid transparent; transition: all 0.18s; white-space: nowrap; }
        .tab.on { color: #4ade80; border-bottom-color: #4ade80; }
        .tab:hover:not(.on) { color: #666680; }
        .inp { font-family: 'DM Sans', sans-serif; background: #16161f; border: 1px solid #22223a; border-radius: 8px; color: #e8e8f0; padding: 10px 13px; width: 100%; font-size: 13px; outline: none; transition: border-color 0.2s; }
        .inp:focus { border-color: #4ade80; }
        .inp option { background: #16161f; }
        .btn-g { font-family: 'Barlow Condensed', sans-serif; font-weight: 700; letter-spacing: 2px; font-size: 15px; background: #4ade80; color: #0b0b12; border: none; border-radius: 8px; padding: 11px 24px; cursor: pointer; transition: all 0.15s; }
        .btn-g:hover { background: #22c55e; transform: translateY(-1px); }
        .btn-g:disabled { opacity: 0.5; cursor: not-allowed; transform: none; }
        .btn-o { font-family: 'Barlow Condensed', sans-serif; font-weight: 700; letter-spacing: 2px; font-size: 13px; background: none; color: #4ade80; border: 1px solid #2a3d2a; border-radius: 8px; padding: 9px 18px; cursor: pointer; transition: all 0.15s; }
        .btn-o:hover { border-color: #4ade80; background: rgba(74,222,128,0.06); }
        .btn-r { font-family: 'Barlow Condensed', sans-serif; font-weight: 700; letter-spacing: 2px; font-size: 13px; background: none; color: #f43f5e; border: 1px solid #3d1a22; border-radius: 8px; padding: 9px 18px; cursor: pointer; }
        .pbar { height: 5px; background: #1a1a28; border-radius: 3px; overflow: hidden; }
        .pfill { height: 100%; border-radius: 3px; transition: width 0.7s cubic-bezier(.4,0,.2,1); }
        .overlay { position: fixed; inset: 0; background: rgba(0,0,0,0.88); z-index: 200; display: flex; align-items: center; justify-content: center; padding: 20px; }
        .modal { background: #111118; border: 1px solid #1d1d2e; border-radius: 18px; padding: 28px; width: 100%; max-width: 580px; max-height: 92vh; overflow-y: auto; }
        .badge { display: inline-block; padding: 2px 9px; border-radius: 20px; font-family: 'DM Sans', sans-serif; font-size: 10px; font-weight: 600; }
        .g2 { display: grid; grid-template-columns: 1fr 1fr; gap: 12px; }
        .g3 { display: grid; grid-template-columns: repeat(3,1fr); gap: 12px; }
        .srow { background: #111118; border: 1px solid #1a1a28; border-radius: 10px; padding: 13px 16px; margin-bottom: 8px; }
        .del-btn { background: none; border: none; color: #33334a; cursor: pointer; font-size: 14px; padding: 4px 8px; border-radius: 4px; transition: color 0.15s; }
        .del-btn:hover { color: #f43f5e; }
        .err { background: rgba(244,63,94,0.08); border: 1px solid rgba(244,63,94,0.25); border-radius: 10px; padding: 12px 16px; margin-bottom: 16px; font-family: 'DM Sans', sans-serif; font-size: 13px; color: #f43f5e; }
      `}</style>

      {/* ── HEADER ── */}
      <div style={{ background: "linear-gradient(160deg,#0e0e18,#12121e)", borderBottom: "1px solid #16162a", padding: "22px 24px 0" }}>
        <div style={{ maxWidth: 980, margin: "0 auto" }}>
          <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start", flexWrap: "wrap", gap: 16, paddingBottom: 20 }}>
            <div>
              <div style={{ fontFamily: "'DM Sans',sans-serif", fontSize: 10, color: "#4ade80", letterSpacing: 3, marginBottom: 5 }}>PROJECT</div>
              <div style={{ fontSize: 48, fontWeight: 800, lineHeight: 1, letterSpacing: 1 }}>36-INCH <span style={{ color: "#4ade80" }}>COUNTER</span></div>
              <div style={{ fontFamily: "'DM Sans',sans-serif", fontSize: 12, color: "#33334a", marginTop: 6 }}>255 lbs · 6'1" · Vertical Explosion Protocol · Goal: Oct 1, 2026</div>
            </div>
            <div style={{ display: "flex", alignItems: "stretch" }}>
              {[
                { val: maxJump > 0 ? `${maxJump}"` : "—", sub: "BEST JUMP",      color: "#4ade80" },
                { val: `${maxSquat}`,                      sub: "BEST SQUAT",     color: "#facc15", unit: "lbs" },
                { val: `${latestBW}`,                      sub: "BODYWEIGHT",     color: bwDrop > 0 ? "#4ade80" : "#f97316", unit: "lbs" },
                { val: `W${currentWeek}`,                  sub: `PHASE ${currentPhase.id}`, color: currentPhase.color },
              ].map((s, i) => (
                <div key={i} style={{ padding: "10px 20px", borderLeft: i > 0 ? "1px solid #16162a" : "none", textAlign: "center", minWidth: 80 }}>
                  <div style={{ fontSize: 34, fontWeight: 800, color: s.color, lineHeight: 1 }}>{s.val}</div>
                  {s.unit && <div style={{ fontFamily: "'DM Sans',sans-serif", fontSize: 10, color: s.color, opacity: 0.6 }}>{s.unit}</div>}
                  <div style={{ fontFamily: "'DM Sans',sans-serif", fontSize: 9, color: "#33334a", letterSpacing: 1.5, marginTop: 3 }}>{s.sub}</div>
                </div>
              ))}
            </div>
          </div>

          {/* dual progress bars */}
          <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 20, paddingBottom: 18 }}>
            {[
              { label: `Jump progress → 36"`, pct: jumpProgress, color: "linear-gradient(90deg,#4ade80,#22d3ee)", textColor: "#4ade80" },
              { label: "Squat progress → 380 lbs (1.5× BW)", pct: squatProgress, color: "linear-gradient(90deg,#facc15,#f97316)", textColor: "#facc15" },
            ].map(b => (
              <div key={b.label}>
                <div style={{ display: "flex", justifyContent: "space-between", marginBottom: 5 }}>
                  <span style={{ fontFamily: "'DM Sans',sans-serif", fontSize: 11, color: "#33334a" }}>{b.label}</span>
                  <span style={{ fontFamily: "'DM Sans',sans-serif", fontSize: 11, color: b.textColor }}>{b.pct}%</span>
                </div>
                <div className="pbar"><div className="pfill" style={{ width: `${b.pct}%`, background: b.color }} /></div>
              </div>
            ))}
          </div>

          {/* tabs */}
          <div style={{ display: "flex", overflowX: "auto", borderTop: "1px solid #16162a" }}>
            {["dashboard","log","progress","phases","milestones"].map(t => (
              <button key={t} className={`tab ${tab === t ? "on" : ""}`} onClick={() => setTab(t)}>{t}</button>
            ))}
          </div>
        </div>
      </div>

      {/* ── CONTENT ── */}
      <div style={{ maxWidth: 980, margin: "0 auto", padding: "26px 24px" }}>
        {error && <div className="err">⚠ {error}</div>}

        {/* DASHBOARD */}
        {tab === "dashboard" && (
          <div style={{ display: "grid", gap: 18 }}>
            {bwDrop > 0 && (
              <div style={{ background: "rgba(74,222,128,0.06)", border: "1px solid rgba(74,222,128,0.18)", borderRadius: 10, padding: "12px 16px", fontFamily: "'DM Sans',sans-serif", fontSize: 13, color: "#4ade80" }}>
                ↓ {bwDrop} lb bodyweight drop logged — every pound less is a free jump gain 🎯
              </div>
            )}
            <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit,minmax(220px,1fr))", gap: 16 }}>
              {/* phase */}
              <div style={{ ...card, borderColor: currentPhase.color + "44" }}>
                <div style={lbl}>Active Phase</div>
                <div style={{ fontSize: 22, fontWeight: 700, color: currentPhase.color }}>{currentPhase.name}</div>
                <div style={{ fontFamily: "'DM Sans',sans-serif", fontSize: 12, color: "#44445a", marginTop: 5 }}>{currentPhase.description}</div>
                <div style={{ marginTop: 12 }}>
                  <div className="pbar"><div className="pfill" style={{ width: `${Math.min(Math.round(((currentWeek - currentPhase.startWeek) / currentPhase.weeks) * 100), 100)}%`, background: currentPhase.color }} /></div>
                  <div style={{ fontFamily: "'DM Sans',sans-serif", fontSize: 10, color: "#33334a", marginTop: 4 }}>Wk {currentWeek - currentPhase.startWeek + 1} of {currentPhase.weeks} · {currentPhase.squatTarget}</div>
                </div>
              </div>
              {/* jump milestone */}
              <div style={card}>
                <div style={lbl}>Next Jump Milestone</div>
                <div style={{ fontSize: 42, fontWeight: 800 }}>{nextJumpMilestone.emoji} {nextJumpMilestone.height}"</div>
                <div style={{ fontFamily: "'DM Sans',sans-serif", fontSize: 12, color: "#44445a" }}>{nextJumpMilestone.label} · {nextJumpMilestone.height - maxJump}" to go</div>
                <div style={{ marginTop: 10 }}><div className="pbar"><div className="pfill" style={{ width: `${Math.round((maxJump / nextJumpMilestone.height) * 100)}%`, background: "#4ade80" }} /></div></div>
              </div>
              {/* squat milestone */}
              <div style={card}>
                <div style={lbl}>Next Squat Milestone</div>
                <div style={{ fontSize: 42, fontWeight: 800, color: "#facc15" }}>{nextSquatMilestone.emoji} {nextSquatMilestone.weight}</div>
                <div style={{ fontFamily: "'DM Sans',sans-serif", fontSize: 12, color: "#44445a" }}>{nextSquatMilestone.label} · {nextSquatMilestone.weight - maxSquat} lbs to go</div>
                <div style={{ marginTop: 10 }}><div className="pbar"><div className="pfill" style={{ width: `${Math.round((maxSquat / nextSquatMilestone.weight) * 100)}%`, background: "#facc15" }} /></div></div>
              </div>
              {/* weeks */}
              <div style={card}>
                <div style={lbl}>Timeline</div>
                <div style={{ fontSize: 42, fontWeight: 800, color: "#f97316" }}>{weeksLeft}</div>
                <div style={{ fontFamily: "'DM Sans',sans-serif", fontSize: 12, color: "#44445a" }}>weeks remaining of {TOTAL_WEEKS}</div>
                <div style={{ marginTop: 10 }}><div className="pbar"><div className="pfill" style={{ width: `${Math.round((currentWeek / TOTAL_WEEKS) * 100)}%`, background: "#f97316" }} /></div></div>
              </div>
            </div>

            {/* charts */}
            <div className="g2">
              <div style={card}>
                <div style={lbl}>Training Balance</div>
                <ResponsiveContainer width="100%" height={190}>
                  <RadarChart data={radarData}>
                    <PolarGrid stroke="#1d1d2e" />
                    <PolarAngleAxis dataKey="axis" tick={{ fill: "#44445a", fontSize: 10, fontFamily: "DM Sans" }} />
                    <Radar dataKey="value" stroke="#4ade80" fill="#4ade80" fillOpacity={0.12} strokeWidth={1.5} />
                  </RadarChart>
                </ResponsiveContainer>
              </div>
              <div style={card}>
                <div style={lbl}>Box Jump Height</div>
                {heightData.length > 0 ? (
                  <ResponsiveContainer width="100%" height={190}>
                    <LineChart data={heightData}>
                      <CartesianGrid stroke="#1a1a28" strokeDasharray="3 3" />
                      <XAxis dataKey="week" tick={{ fill: "#44445a", fontSize: 10 }} />
                      <YAxis domain={[0, 40]} tick={{ fill: "#44445a", fontSize: 10 }} unit='"' />
                      <Tooltip contentStyle={{ background: "#111118", border: "1px solid #1d1d2e", fontFamily: "DM Sans", fontSize: 12 }} formatter={v => [`${v}"`, "Height"]} />
                      <ReferenceLine y={36} stroke="#f43f5e" strokeDasharray="4 4" />
                      <Line type="monotone" dataKey="height" stroke="#4ade80" strokeWidth={2.5} dot={{ fill: "#4ade80", r: 4 }} />
                    </LineChart>
                  </ResponsiveContainer>
                ) : (
                  <div style={{ fontFamily: "'DM Sans',sans-serif", fontSize: 13, color: "#33334a", height: 190, display: "flex", alignItems: "center", justifyContent: "center", textAlign: "center", padding: "0 20px" }}>
                    Log a session with a box height to see your jump curve
                  </div>
                )}
              </div>
            </div>

            {/* AI feedback */}
            <div style={{ ...card, background: "linear-gradient(135deg,#0d1a10,#0f1815)", borderColor: "#1a3020" }}>
              <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", flexWrap: "wrap", gap: 14 }}>
                <div>
                  <div style={{ fontSize: 22, fontWeight: 700, color: "#4ade80" }}>AI FEEDBACK ENGINE</div>
                  <div style={{ fontFamily: "'DM Sans',sans-serif", fontSize: 12, color: "#33554a", marginTop: 4 }}>Generate a full training snapshot → paste into a new Claude chat for analysis & adjustments</div>
                </div>
                <button className="btn-g" onClick={generateFeedback}>Generate Summary</button>
              </div>
            </div>
          </div>
        )}

        {/* LOG */}
        {tab === "log" && (
          <div>
            <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 20 }}>
              <div style={{ fontSize: 32, fontWeight: 800, letterSpacing: 1 }}>SESSION LOG</div>
              <button className="btn-g" onClick={() => setShowForm(true)}>+ Log Session</button>
            </div>
            {sessions.length === 0 && <div style={{ fontFamily: "'DM Sans',sans-serif", color: "#33334a", textAlign: "center", padding: "60px 0" }}>No sessions yet — hit "+ Log Session" to start</div>}
            {[...sessions].reverse().map(s => {
              const ph = PHASES[s.phase - 1];
              return (
                <div key={s.id} className="srow">
                  <div style={{ display: "flex", justifyContent: "space-between", flexWrap: "wrap", gap: 8 }}>
                    <div style={{ flex: 1 }}>
                      <div style={{ fontSize: 17, fontWeight: 700 }}>{s.type}</div>
                      <div style={{ fontFamily: "'DM Sans',sans-serif", fontSize: 12, color: "#44445a", marginTop: 3, lineHeight: 1.7 }}>
                        {s.date} · Wk {s.week}
                        {s.box_height   ? <span style={{ color: "#4ade80" }}> · 📦 {s.box_height}"</span> : ""}
                        {s.squat_weight ? <span style={{ color: "#facc15" }}> · 🏋️ {s.squat_weight} lbs</span> : ""}
                        {s.sets         ? ` · ${s.sets}×${s.reps}` : ""}
                        {s.load         ? ` · ${s.load}` : ""}
                        {s.cardio_type  ? <span style={{ color: "#f97316" }}> · {s.cardio_type} {s.cardio_minutes}min</span> : ""}
                        {s.bodyweight   ? <span style={{ color: "#a78bfa" }}> · BW: {s.bodyweight} lbs</span> : ""}
                      </div>
                      {s.notes && <div style={{ fontFamily: "'DM Sans',sans-serif", fontSize: 12, color: "#55556a", marginTop: 4, fontStyle: "italic" }}>"{s.notes}"</div>}
                    </div>
                    <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
                      <span className="badge" style={{ background: ph?.color + "22", color: ph?.color }}>P{s.phase}</span>
                      <button className="del-btn" onClick={() => deleteSession(s.id)} title="Delete session">✕</button>
                    </div>
                  </div>
                </div>
              );
            })}
          </div>
        )}

        {/* PROGRESS */}
        {tab === "progress" && (
          <div style={{ display: "grid", gap: 18 }}>
            <div style={{ fontSize: 32, fontWeight: 800, letterSpacing: 1 }}>PROGRESS CHARTS</div>
            <div style={card}>
              <div style={lbl}>Box Jump Height Over Time (goal: 36")</div>
              {heightData.length > 0 ? (
                <ResponsiveContainer width="100%" height={260}>
                  <LineChart data={heightData} margin={{ top: 16, right: 16, bottom: 0, left: 0 }}>
                    <CartesianGrid stroke="#1a1a28" strokeDasharray="3 3" />
                    <XAxis dataKey="week" tick={{ fill: "#44445a", fontSize: 11, fontFamily: "DM Sans" }} />
                    <YAxis domain={[0, 40]} tick={{ fill: "#44445a", fontSize: 11 }} unit='"' />
                    <Tooltip contentStyle={{ background: "#111118", border: "1px solid #4ade80", fontFamily: "DM Sans" }} formatter={v => [`${v}"`, "Jump height"]} />
                    <ReferenceLine y={36} stroke="#f43f5e" strokeDasharray="5 5" label={{ value: "🎯 36\" GOAL", fill: "#f43f5e", fontSize: 11 }} />
                    <ReferenceLine y={24} stroke="#facc1566" strokeDasharray="3 3" />
                    <Line type="monotone" dataKey="height" stroke="#4ade80" strokeWidth={3} dot={{ fill: "#4ade80", r: 5 }} activeDot={{ r: 7, fill: "#22d3ee" }} />
                  </LineChart>
                </ResponsiveContainer>
              ) : <div style={{ fontFamily: "'DM Sans',sans-serif", color: "#33334a", padding: "60px 0", textAlign: "center" }}>No jump data yet</div>}
            </div>
            <div className="g2">
              <div style={card}>
                <div style={lbl}>Squat → 380 lbs (1.5× BW)</div>
                {squatData.length > 0 ? (
                  <ResponsiveContainer width="100%" height={200}>
                    <LineChart data={squatData}>
                      <CartesianGrid stroke="#1a1a28" strokeDasharray="3 3" />
                      <XAxis dataKey="week" tick={{ fill: "#44445a", fontSize: 10 }} />
                      <YAxis domain={[0, 420]} tick={{ fill: "#44445a", fontSize: 10 }} unit=" lbs" />
                      <Tooltip contentStyle={{ background: "#111118", border: "1px solid #facc15", fontFamily: "DM Sans" }} formatter={v => [`${v} lbs`, "Squat"]} />
                      <ReferenceLine y={380} stroke="#f43f5e" strokeDasharray="4 4" label={{ value: "380 target", fill: "#f43f5e", fontSize: 10 }} />
                      <ReferenceLine y={225} stroke="#facc1566" strokeDasharray="3 3" />
                      <Line type="monotone" dataKey="squat" stroke="#facc15" strokeWidth={2.5} dot={{ fill: "#facc15", r: 4 }} />
                    </LineChart>
                  </ResponsiveContainer>
                ) : <div style={{ fontFamily: "'DM Sans',sans-serif", color: "#33334a", padding: "40px 0", textAlign: "center", fontSize: 13 }}>Log squat weight to track</div>}
              </div>
              <div style={card}>
                <div style={lbl}>Bodyweight Over Time</div>
                {bwData.length > 0 ? (
                  <ResponsiveContainer width="100%" height={200}>
                    <LineChart data={bwData}>
                      <CartesianGrid stroke="#1a1a28" strokeDasharray="3 3" />
                      <XAxis dataKey="week" tick={{ fill: "#44445a", fontSize: 10 }} />
                      <YAxis domain={[220, 265]} tick={{ fill: "#44445a", fontSize: 10 }} unit=" lbs" />
                      <Tooltip contentStyle={{ background: "#111118", border: "1px solid #a78bfa", fontFamily: "DM Sans" }} formatter={v => [`${v} lbs`, "BW"]} />
                      <ReferenceLine y={240} stroke="#4ade8066" strokeDasharray="3 3" label={{ value: "240 target", fill: "#4ade80", fontSize: 10 }} />
                      <Line type="monotone" dataKey="bw" stroke="#a78bfa" strokeWidth={2.5} dot={{ fill: "#a78bfa", r: 4 }} />
                    </LineChart>
                  </ResponsiveContainer>
                ) : <div style={{ fontFamily: "'DM Sans',sans-serif", color: "#33334a", padding: "40px 0", textAlign: "center", fontSize: 13 }}>Log bodyweight each session to track</div>}
              </div>
            </div>
            <div style={card}>
              <div style={lbl}>Session Volume Breakdown</div>
              <div className="g3" style={{ marginTop: 12 }}>
                {[
                  { label: "Lower Power / Complex", count: sessions.filter(s => s.type.includes("Lower Power") || s.type.includes("Complex")).length, color: "#4ade80" },
                  { label: "Lower Strength",         count: sessions.filter(s => s.type.includes("Lower Strength")).length, color: "#4ade80" },
                  { label: "Upper Push",             count: sessions.filter(s => s.type === "Upper Push").length, color: "#22d3ee" },
                  { label: "Upper Pull",             count: sessions.filter(s => s.type === "Upper Pull").length, color: "#22d3ee" },
                  { label: "Cardio",                 count: sessions.filter(s => s.type === "Cardio").length, color: "#f97316" },
                  { label: "Plyometrics",            count: sessions.filter(s => s.type === "Plyometrics").length, color: "#facc15" },
                  { label: "Core & Stability",       count: sessions.filter(s => s.type.includes("Core")).length, color: "#a78bfa" },
                  { label: "Recovery / Mobility",    count: sessions.filter(s => s.type.includes("Recovery")).length, color: "#a78bfa" },
                  { label: "Total Sessions",         count: sessions.length, color: "#f43f5e" },
                ].map(item => (
                  <div key={item.label} style={{ background: "#0d0d15", borderRadius: 10, padding: "14px 16px" }}>
                    <div style={{ fontSize: 36, fontWeight: 800, color: item.color }}>{item.count}</div>
                    <div style={{ fontFamily: "'DM Sans',sans-serif", fontSize: 11, color: "#44445a", marginTop: 2 }}>{item.label}</div>
                  </div>
                ))}
              </div>
            </div>
          </div>
        )}

        {/* PHASES */}
        {tab === "phases" && (
          <div>
            <div style={{ fontSize: 32, fontWeight: 800, letterSpacing: 1, marginBottom: 8 }}>TRAINING PHASES</div>
            <div style={{ background: "rgba(251,146,60,0.08)", border: "1px solid rgba(251,146,60,0.2)", borderRadius: 10, padding: "12px 16px", marginBottom: 16, fontFamily: "'DM Sans',sans-serif", fontSize: 12, color: "#fb923c" }}>
              <strong>255 lbs adjustment:</strong> Phase 1 extended to 10 weeks · Phase 4 trimmed to 4 weeks · Deloads every 4th week · Squat to 380 lbs (1.5× BW) is the central prerequisite
            </div>
            {PHASES.map(phase => {
              const isActive   = currentPhase.id === phase.id;
              const isComplete = currentWeek > phase.endWeek;
              return (
                <div key={phase.id} style={{ ...card, borderColor: isActive ? phase.color + "66" : "#1d1d2e", marginBottom: 14, opacity: isComplete ? 0.55 : 1 }}>
                  <div style={{ display: "flex", justifyContent: "space-between", flexWrap: "wrap", gap: 12, marginBottom: 12 }}>
                    <div>
                      <div style={{ display: "flex", alignItems: "center", gap: 10, flexWrap: "wrap" }}>
                        <div style={{ fontSize: 26, fontWeight: 800, color: phase.color }}>PHASE {phase.id}</div>
                        {isActive   && <span className="badge" style={{ background: phase.color + "22", color: phase.color }}>ACTIVE</span>}
                        {isComplete && <span className="badge" style={{ background: "#ffffff0a", color: "#33334a" }}>DONE</span>}
                        {phase.deloadWeeks.length > 0 && <span className="badge" style={{ background: "#f9731622", color: "#f97316" }}>Deloads: Wk {phase.deloadWeeks.join(", ")}</span>}
                      </div>
                      <div style={{ fontFamily: "'DM Sans',sans-serif", fontSize: 14, color: "#c0c0d0", marginTop: 3 }}>{phase.name}</div>
                      <div style={{ fontFamily: "'DM Sans',sans-serif", fontSize: 12, color: "#44445a", marginTop: 4 }}>{phase.description}</div>
                    </div>
                    <div style={{ textAlign: "right" }}>
                      <div style={{ fontFamily: "'DM Sans',sans-serif", fontSize: 11, color: "#33334a" }}>Weeks {phase.startWeek}–{phase.endWeek} · {phase.weeks} wks</div>
                      {phase.targetHeight > 0 && <div style={{ fontSize: 22, fontWeight: 800, color: phase.color, marginTop: 4 }}>Jump target: {phase.targetHeight}"</div>}
                      <div style={{ fontFamily: "'DM Sans',sans-serif", fontSize: 11, color: "#55556a", marginTop: 2 }}>{phase.squatTarget}</div>
                    </div>
                  </div>
                  <div style={{ display: "flex", flexWrap: "wrap", gap: 6, marginBottom: isActive ? 12 : 0 }}>
                    {phase.keyFocus.map(f => (
                      <span key={f} style={{ fontFamily: "'DM Sans',sans-serif", fontSize: 11, background: "#16161f", border: "1px solid #22223a", borderRadius: 6, padding: "3px 9px", color: "#66667a" }}>{f}</span>
                    ))}
                  </div>
                  {isActive && (
                    <div>
                      <div className="pbar"><div className="pfill" style={{ width: `${Math.min(Math.round(((currentWeek - phase.startWeek) / phase.weeks) * 100), 100)}%`, background: phase.color }} /></div>
                      <div style={{ fontFamily: "'DM Sans',sans-serif", fontSize: 10, color: "#33334a", marginTop: 4 }}>Week {currentWeek - phase.startWeek + 1} of {phase.weeks}</div>
                    </div>
                  )}
                </div>
              );
            })}
          </div>
        )}

        {/* MILESTONES */}
        {tab === "milestones" && (
          <div>
            <div style={{ fontSize: 32, fontWeight: 800, letterSpacing: 1, marginBottom: 20 }}>MILESTONES</div>
            <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 24 }}>
              <div>
                <div style={{ fontFamily: "'DM Sans',sans-serif", fontSize: 11, color: "#44445a", letterSpacing: 2, marginBottom: 14 }}>JUMP HEIGHT</div>
                {JUMP_MILESTONES.map(m => {
                  const done = maxJump >= m.height;
                  return (
                    <div key={m.height} style={{ ...card, borderColor: done ? "#4ade8033" : "#1d1d2e", background: done ? "linear-gradient(135deg,#0d1a10,#0f1815)" : "#111118", display: "flex", alignItems: "center", gap: 14, marginBottom: 10 }}>
                      <div style={{ fontSize: 28 }}>{m.emoji}</div>
                      <div style={{ flex: 1 }}>
                        <div style={{ fontSize: 22, fontWeight: 800, color: done ? "#4ade80" : "#2a2a3e" }}>{m.height}"</div>
                        <div style={{ fontFamily: "'DM Sans',sans-serif", fontSize: 12, color: done ? "#44665a" : "#33334a" }}>{m.label}</div>
                      </div>
                      {done
                        ? <span style={{ fontFamily: "'DM Sans',sans-serif", fontSize: 10, color: "#4ade80", letterSpacing: 1 }}>✓</span>
                        : <span style={{ fontFamily: "'DM Sans',sans-serif", fontSize: 11, color: "#33334a" }}>{m.height - maxJump}" out</span>}
                    </div>
                  );
                })}
              </div>
              <div>
                <div style={{ fontFamily: "'DM Sans',sans-serif", fontSize: 11, color: "#44445a", letterSpacing: 2, marginBottom: 14 }}>SQUAT STRENGTH</div>
                {SQUAT_MILESTONES.map(m => {
                  const done = maxSquat >= m.weight;
                  return (
                    <div key={m.weight} style={{ ...card, borderColor: done ? "#facc1533" : "#1d1d2e", background: done ? "linear-gradient(135deg,#1a1500,#161200)" : "#111118", display: "flex", alignItems: "center", gap: 14, marginBottom: 10 }}>
                      <div style={{ fontSize: 28 }}>{m.emoji}</div>
                      <div style={{ flex: 1 }}>
                        <div style={{ fontSize: 22, fontWeight: 800, color: done ? "#facc15" : "#2a2a3e" }}>{m.weight} lbs</div>
                        <div style={{ fontFamily: "'DM Sans',sans-serif", fontSize: 12, color: done ? "#66601a" : "#33334a" }}>{m.label}</div>
                      </div>
                      {done
                        ? <span style={{ fontFamily: "'DM Sans',sans-serif", fontSize: 10, color: "#facc15", letterSpacing: 1 }}>✓</span>
                        : <span style={{ fontFamily: "'DM Sans',sans-serif", fontSize: 11, color: "#33334a" }}>{m.weight - maxSquat} lbs out</span>}
                    </div>
                  );
                })}
              </div>
            </div>
          </div>
        )}
      </div>

      {/* ── LOG SESSION MODAL ── */}
      {showForm && (
        <div className="overlay" onClick={() => setShowForm(false)}>
          <div className="modal" onClick={e => e.stopPropagation()}>
            <div style={{ fontSize: 26, fontWeight: 800, letterSpacing: 1, marginBottom: 20 }}>LOG SESSION</div>
            {error && <div className="err">⚠ {error}</div>}
            <div style={{ display: "grid", gap: 13 }}>
              <div className="g2">
                <div><div style={lbl}>Date</div><input type="date" className="inp" value={form.date} onChange={e => setForm(f => ({ ...f, date: e.target.value }))} /></div>
                <div><div style={lbl}>Bodyweight (lbs)</div><input type="number" className="inp" placeholder="255" value={form.bodyweight} onChange={e => setForm(f => ({ ...f, bodyweight: e.target.value }))} /></div>
              </div>
              <div className="g2">
                <div><div style={lbl}>Week #</div><input type="number" className="inp" min={1} max={30} value={form.week} onChange={e => setForm(f => ({ ...f, week: e.target.value }))} /></div>
                <div>
                  <div style={lbl}>Phase</div>
                  <select className="inp" value={form.phase} onChange={e => setForm(f => ({ ...f, phase: e.target.value }))}>
                    {PHASES.map(p => <option key={p.id} value={p.id}>Phase {p.id} — {p.name}</option>)}
                  </select>
                </div>
              </div>
              <div>
                <div style={lbl}>Session Type</div>
                <select className="inp" value={form.type} onChange={e => setForm(f => ({ ...f, type: e.target.value }))}>
                  {SESSION_TYPES.map(t => <option key={t}>{t}</option>)}
                </select>
              </div>
              <div className="g2">
                <div><div style={lbl}>Box Jump Height (inches)</div><input type="number" className="inp" placeholder="blank if no jumps" value={form.boxHeight} onChange={e => setForm(f => ({ ...f, boxHeight: e.target.value }))} /></div>
                <div><div style={lbl}>Squat Weight (lbs)</div><input type="number" className="inp" placeholder="working weight" value={form.squatWeight} onChange={e => setForm(f => ({ ...f, squatWeight: e.target.value }))} /></div>
              </div>
              <div className="g2">
                <div><div style={lbl}>Sets</div><input type="number" className="inp" placeholder="3" value={form.sets} onChange={e => setForm(f => ({ ...f, sets: e.target.value }))} /></div>
                <div><div style={lbl}>Reps</div><input type="number" className="inp" placeholder="5" value={form.reps} onChange={e => setForm(f => ({ ...f, reps: e.target.value }))} /></div>
              </div>
              <div><div style={lbl}>Key Lifts / Load Notes</div><input type="text" className="inp" placeholder="e.g. RDL 155 lbs, split squat 40 lb DBs" value={form.load} onChange={e => setForm(f => ({ ...f, load: e.target.value }))} /></div>
              <div className="g2">
                <div>
                  <div style={lbl}>Cardio Type</div>
                  <select className="inp" value={form.cardioType} onChange={e => setForm(f => ({ ...f, cardioType: e.target.value }))}>
                    <option value="">None</option>
                    {CARDIO_TYPES.map(t => <option key={t}>{t}</option>)}
                  </select>
                </div>
                <div><div style={lbl}>Duration (min)</div><input type="number" className="inp" placeholder="30" value={form.cardioMinutes} onChange={e => setForm(f => ({ ...f, cardioMinutes: e.target.value }))} /></div>
              </div>
              <div><div style={lbl}>Notes</div><input type="text" className="inp" placeholder="How did it feel? PRs? Aches?" value={form.notes} onChange={e => setForm(f => ({ ...f, notes: e.target.value }))} /></div>
              <div style={{ display: "flex", gap: 10, justifyContent: "flex-end", marginTop: 6 }}>
                <button className="btn-r" onClick={() => setShowForm(false)}>Cancel</button>
                <button className="btn-g" onClick={addSession} disabled={saving}>{saving ? "Saving..." : "Save Session"}</button>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* ── FEEDBACK MODAL ── */}
      {showFeedback && (
        <div className="overlay" onClick={() => setShowFeedback(false)}>
          <div className="modal" style={{ maxWidth: 640 }} onClick={e => e.stopPropagation()}>
            <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 14 }}>
              <div style={{ fontSize: 24, fontWeight: 800, letterSpacing: 1 }}>AI FEEDBACK SUMMARY</div>
              <button onClick={copyFeedback} style={{ fontFamily: "'DM Sans',sans-serif", fontSize: 13, fontWeight: 600, background: copied ? "#22c55e" : "#4ade80", color: "#0b0b12", border: "none", borderRadius: 7, padding: "8px 18px", cursor: "pointer", transition: "background 0.2s" }}>
                {copied ? "✓ Copied!" : "Copy All"}
              </button>
            </div>
            <div style={{ fontFamily: "'DM Sans',sans-serif", fontSize: 12, color: "#33334a", marginBottom: 12 }}>
              Copy → open a new Claude chat → paste. Claude will give you bodyweight-adjusted analysis and plan adjustments.
            </div>
            <pre style={{ fontFamily: "'DM Sans',sans-serif", fontSize: 11.5, color: "#88889a", background: "#0d0d15", borderRadius: 10, padding: 16, whiteSpace: "pre-wrap", wordBreak: "break-word", lineHeight: 1.75, maxHeight: 420, overflowY: "auto" }}>
              {feedbackText}
            </pre>
            <button className="btn-o" style={{ marginTop: 16, width: "100%" }} onClick={() => setShowFeedback(false)}>Close</button>
          </div>
        </div>
      )}
    </div>
  );
}
