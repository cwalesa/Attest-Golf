// js/model.js
var STORAGE_KEY = "fairway-iphone-v2";
var LEGACY_KEY = "fairway-golf-v1";
var SAFETY_KEY = "attest-pre-migration-copy";
var SCHEMA_VERSION = 3;
var FAIRWAY = ["H", "L", "R", "NA"];
var ZONES = ["A", "B", "C", "D", "E"];
var ZONE_LABEL = { A: "under 3 ft", B: "3\u20136 ft", C: "6\u201315 ft", D: "15\u201330 ft", E: "30 ft +" };
var isBlank = (v) => v === "" || v === null || v === void 0 || typeof v === "number" && !Number.isFinite(v);
var num = (v) => {
  if (isBlank(v)) return null;
  const n = Number(v);
  return Number.isFinite(n) ? n : null;
};
var intOrBlank = (v, min, max) => {
  const n = num(v);
  if (n === null || !Number.isInteger(n) || n < min || n > max) return "";
  return n;
};
var oneOf = (v, list) => {
  if (isBlank(v)) return "";
  const s = String(v).trim();
  const hit = list.find((x) => x.toLowerCase() === s.toLowerCase());
  return hit ?? "";
};
var uid = () => Date.now().toString(36) + Math.random().toString(36).slice(2, 9);
var todayISO = () => (/* @__PURE__ */ new Date()).toLocaleDateString("en-CA");
function blankHole() {
  return {
    par: "",
    handicap: "",
    yardage: "",
    score: "",
    putts: "",
    penalties: "",
    fairway: "",
    puttZone: "",
    approach: "",
    strike: "",
    shortMiss: "",
    girOverride: "",
    // legacy fields retained so older exports and CSVs stay compatible
    gir: "",
    shortgame: "",
    firstputt: "",
    shape: "",
    mistake: "",
    note: ""
  };
}
function zoneFromFeet(ft) {
  const v = num(ft);
  if (v === null || v < 0) return "";
  return v < 3 ? "A" : v < 6 ? "B" : v < 15 ? "C" : v < 30 ? "D" : "E";
}
function normalizeHole(h) {
  const src = h && typeof h === "object" ? h : {};
  const out = { ...blankHole(), ...src };
  out.par = intOrBlank(src.par, 3, 6);
  out.handicap = intOrBlank(src.handicap, 1, 18);
  out.yardage = intOrBlank(src.yardage, 1, 800);
  out.score = intOrBlank(src.score, 1, 20);
  out.putts = intOrBlank(src.putts, 0, 10);
  out.penalties = intOrBlank(src.penalties, 0, 10);
  out.fairway = oneOf(src.fairway, FAIRWAY);
  out.puttZone = oneOf(src.puttZone, ZONES) || zoneFromFeet(src.firstputt);
  out.approach = oneOf(src.approach, ["S", "LG", "L", "R", "G", "O"]);
  let strike = oneOf(src.strike, ["Solid", "Fat", "Thin", "Other"]);
  if (!strike && src.mistake === "FT") strike = "Fat";
  if (!strike && src.mistake === "TH") strike = "Thin";
  out.strike = strike;
  out.shortMiss = src.shortMiss === true || src.shortMiss === "Y" ? true : src.shortMiss === false || src.shortMiss === "N" ? false : "";
  out.girOverride = oneOf(src.girOverride, ["Y", "N"]);
  return out;
}
function blankRound() {
  return {
    id: uid(),
    date: todayISO(),
    course: "",
    tees: "",
    teeGender: "",
    count: 18,
    thought: "",
    notes: "",
    rating: "",
    slope: "",
    tracking: "basic",
    source: "manual",
    holes: Array.from({ length: 18 }, blankHole),
    createdAt: (/* @__PURE__ */ new Date()).toISOString(),
    updatedAt: (/* @__PURE__ */ new Date()).toISOString()
  };
}
function normalizeRound(r) {
  const src = r && typeof r === "object" ? r : {};
  const count = Number(src.count) === 9 ? 9 : 18;
  const holes = Array.isArray(src.holes) ? src.holes.slice(0, 18).map(normalizeHole) : [];
  while (holes.length < 18) holes.push(blankHole());
  const rating = num(src.rating);
  const slope = num(src.slope);
  const out = {
    ...src,
    id: typeof src.id === "string" && src.id ? src.id : uid(),
    date: /^\d{4}-\d{2}-\d{2}$/.test(String(src.date || "")) ? src.date : todayISO(),
    course: String(src.course ?? "").slice(0, 120),
    tees: String(src.tees ?? "").slice(0, 60),
    teeGender: ["M", "F"].includes(src.teeGender) ? src.teeGender : "",
    count,
    thought: String(src.thought ?? ""),
    notes: String(src.notes ?? ""),
    rating: rating !== null && rating >= 25 && rating <= 85 ? rating : "",
    slope: slope !== null && slope >= 55 && slope <= 155 ? Math.round(slope) : "",
    tracking: src.tracking === "detailed" || holes.some((h) => h.approach || h.strike || h.shortMiss === true) ? "detailed" : "basic",
    source: src.source || "manual",
    holes
  };
  return out;
}
function normalizeCourse(c) {
  if (!c || typeof c !== "object" || typeof c.name !== "string" || !c.name.trim()) return null;
  const count = Number(c.count) === 9 ? 9 : 18;
  const holes = (Array.isArray(c.holes) ? c.holes : []).slice(0, 18).map((h) => ({
    par: intOrBlank(h?.par, 3, 6),
    yardage: intOrBlank(h?.yardage, 1, 800),
    handicap: intOrBlank(h?.handicap, 1, 18)
  }));
  while (holes.length < count) holes.push({ par: "", yardage: "", handicap: "" });
  const rating = num(c.rating), slope = num(c.slope);
  return {
    id: c.id || courseKey(c.name, c.tees, c.teeGender),
    name: c.name.trim().slice(0, 120),
    tees: String(c.tees ?? "").trim().slice(0, 60),
    teeGender: ["M", "F"].includes(c.teeGender) ? c.teeGender : "",
    count,
    rating: rating !== null && rating >= 25 && rating <= 85 ? rating : "",
    slope: slope !== null && slope >= 55 && slope <= 155 ? Math.round(slope) : "",
    holes,
    source: c.source || "manual",
    providerId: c.providerId ?? "",
    updatedAt: c.updatedAt || ""
  };
}
var courseKey = (name, tees, g = "") => `${String(name || "").trim()}|${String(tees || "").trim()}|${g || ""}`.toLowerCase();
function emptyData() {
  return {
    schemaVersion: SCHEMA_VERSION,
    rounds: [],
    practices: [],
    courses: [],
    draft: null,
    profile: { name: "", goal: 80 },
    meta: { lastBackupAt: "", roundsAtLastBackup: 0 }
  };
}
function migrate(raw) {
  const notes = [];
  const base = emptyData();
  const d = raw && typeof raw === "object" ? raw.data && Array.isArray(raw.data.rounds) ? raw.data : raw : {};
  const rounds = Array.isArray(d.rounds) ? d.rounds : [];
  base.rounds = rounds.filter((r) => r && typeof r === "object").map(normalizeRound);
  base.practices = (Array.isArray(d.practices) ? d.practices : []).filter((p) => p && typeof p === "object").map((p) => ({ ...p, id: p.id || uid(), date: p.date || todayISO(), minutes: Number(p.minutes) || 0, skill: String(p.skill ?? p.focus ?? ""), notes: String(p.notes ?? "") }));
  const seen = /* @__PURE__ */ new Set();
  for (const c of Array.isArray(d.courses) ? d.courses : []) {
    const n = normalizeCourse(c);
    if (!n) continue;
    const k = courseKey(n.name, n.tees, n.teeGender);
    if (seen.has(k)) continue;
    seen.add(k);
    base.courses.push(n);
  }
  base.draft = d.draft && typeof d.draft === "object" ? normalizeRound(d.draft) : null;
  base.profile = {
    name: String(d.profile?.name ?? "").slice(0, 50),
    goal: Number.isInteger(Number(d.profile?.goal)) ? Number(d.profile.goal) : 80,
    ...d.profile?.homeCourse ? { homeCourse: d.profile.homeCourse } : {}
  };
  base.meta = { ...base.meta, ...d.meta || {} };
  if ((d.schemaVersion || 2) < SCHEMA_VERSION) notes.push(`Upgraded data from schema ${d.schemaVersion || 2} to ${SCHEMA_VERSION}`);
  return { data: base, notes };
}
function holesPlayed(r) {
  return (r.holes || []).slice(0, r.count || 18);
}
function courseToRound(round, course) {
  round.course = course.name;
  round.tees = course.tees;
  round.teeGender = course.teeGender || "";
  round.count = course.count || 18;
  round.rating = course.rating;
  round.slope = course.slope;
  for (let i = 0; i < 18; i++) {
    const src = course.holes[i];
    if (!round.holes[i]) round.holes[i] = blankHole();
    round.holes[i].par = src ? src.par : "";
    round.holes[i].yardage = src ? src.yardage : "";
    round.holes[i].handicap = src ? src.handicap : "";
  }
  return round;
}
function roundToCourse(r) {
  return normalizeCourse({
    name: r.course,
    tees: r.tees,
    teeGender: r.teeGender,
    count: r.count,
    rating: r.rating,
    slope: r.slope,
    holes: holesPlayed(r).map((h) => ({ par: h.par, yardage: h.yardage, handicap: h.handicap })),
    updatedAt: (/* @__PURE__ */ new Date()).toISOString()
  });
}
function validateRound(r) {
  const errors = [], warnings = [];
  if (!String(r.course || "").trim()) errors.push("Add the course name.");
  const holes = holesPlayed(r);
  const missingPar = holes.map((h, i) => h.par === "" ? i + 1 : null).filter(Boolean);
  if (missingPar.length) errors.push(`Confirm par for hole${missingPar.length > 1 ? "s" : ""} ${missingPar.join(", ")}.`);
  const scored = holes.filter((h) => h.score !== "");
  if (!scored.length) errors.push("Enter at least one hole score.");
  holes.forEach((h, i) => {
    if (h.score === "") return;
    const p = h.putts === "" ? 0 : h.putts, pen = h.penalties === "" ? 0 : h.penalties;
    if (p + pen > h.score - 1) errors.push(`Hole ${i + 1}: ${h.score} strokes can't include ${p} putt${p === 1 ? "" : "s"}${pen ? ` and ${pen} penalty` : ""} plus a tee shot.`);
    if (h.par !== "" && h.score >= h.par + 6) warnings.push(`Hole ${i + 1}: ${h.score} on a par ${h.par} \u2014 check it's right.`);
  });
  if (scored.length && scored.length < holes.length) warnings.push(`${scored.length} of ${holes.length} holes have scores. It will be saved as a partial round and left out of scoring averages.`);
  return { errors, warnings };
}

// js/stats.js
var has = (v) => v !== "" && v !== null && v !== void 0;
var mean = (a) => a.length ? a.reduce((s, x) => s + x, 0) / a.length : null;
var rate = (hits, n) => n ? hits / n : null;
function girInfo(h) {
  const score = num(h.score), par = num(h.par), putts = num(h.putts);
  if (score === null || par === null) return { value: null, source: null, flag: "no-score" };
  if (h.girOverride === "Y" || h.girOverride === "N") return { value: h.girOverride, source: "override", flag: "" };
  if (putts === null) return { value: null, source: null, flag: "no-putts" };
  const est = score - putts <= par - 2 ? "Y" : "N";
  if (putts === 0 && est === "Y") return { value: null, source: "estimate", flag: "holed-out", estimate: est };
  if (est === "Y" && ["S", "LG", "L", "R"].includes(h.approach)) return { value: null, source: "estimate", flag: "approach-conflict", estimate: est };
  return { value: est, source: "estimate", flag: "" };
}
var GIR_FLAG_TEXT = {
  "holed-out": "Holed from off the green with no putts \u2014 GIR can\u2019t be told from the card. Set it on the hole if you know.",
  "approach-conflict": "Arithmetic says green in regulation, but an approach miss is recorded. Usually a putt from the fringe was counted. Set GIR on the hole to include it."
};
function holeRecords(rounds) {
  const out = [];
  for (const r of rounds) {
    holesPlayed(r).forEach((h, i) => {
      if (!has(h.score)) return;
      out.push({ round: r, n: i + 1, h, gir: girInfo(h), toPar: has(h.par) ? h.score - h.par : null });
    });
  }
  return out;
}
var isComplete = (r) => holesPlayed(r).every((h) => has(h.score));
var scoredHoles = (r) => holesPlayed(r).filter((h) => has(h.score));
var gross = (r) => scoredHoles(r).reduce((s, h) => s + h.score, 0);
function toPar(r) {
  const hs = scoredHoles(r).filter((h) => has(h.par));
  return hs.length ? hs.reduce((s, h) => s + h.score - h.par, 0) : null;
}
function nineTotal(r, start) {
  const hs = (r.holes || []).slice(start, start + 9);
  if (start >= (r.count || 18)) return null;
  return hs.every((h) => has(h.score)) ? hs.reduce((s, h) => s + h.score, 0) : null;
}
var sortByDate = (rounds) => rounds.slice().sort((a, b) => String(a.date).localeCompare(String(b.date)) || String(a.createdAt || "").localeCompare(String(b.createdAt || "")));
function summarize(rounds) {
  const recs = holeRecords(rounds);
  const holesN = recs.length;
  const complete182 = rounds.filter((r) => r.count === 18 && isComplete(r));
  const grossScores = complete182.map(gross);
  const withPar = recs.filter((x) => x.toPar !== null);
  const byPar = {};
  for (const p of [3, 4, 5]) {
    const xs = withPar.filter((x) => x.h.par === p);
    byPar[p] = { n: xs.length, avg: mean(xs.map((x) => x.h.score)), toPar: mean(xs.map((x) => x.toPar)) };
  }
  const dist = { eagle: 0, birdie: 0, par: 0, bogey: 0, double: 0, triplePlus: 0 };
  for (const x of withPar) {
    const d = x.toPar;
    if (d <= -2) dist.eagle++;
    else if (d === -1) dist.birdie++;
    else if (d === 0) dist.par++;
    else if (d === 1) dist.bogey++;
    else if (d === 2) dist.double++;
    else dist.triplePlus++;
  }
  const fronts = rounds.map((r) => nineTotal(r, 0)).filter((v) => v !== null);
  const backs = rounds.filter((r) => r.count === 18).map((r) => nineTotal(r, 9)).filter((v) => v !== null);
  const fwElig = recs.filter((x) => x.h.par >= 4 && ["H", "L", "R"].includes(x.h.fairway));
  const fwHit = fwElig.filter((x) => x.h.fairway === "H").length;
  const fwL = fwElig.filter((x) => x.h.fairway === "L").length;
  const fwR = fwElig.filter((x) => x.h.fairway === "R").length;
  const girKnown = recs.filter((x) => x.gir.value);
  const girHit = girKnown.filter((x) => x.gir.value === "Y");
  const girAmbiguous = recs.filter((x) => x.gir.flag === "holed-out" || x.gir.flag === "approach-conflict");
  const putt = recs.filter((x) => has(x.h.putts));
  const one = putt.filter((x) => x.h.putts <= 1).length;
  const zero = putt.filter((x) => x.h.putts === 0).length;
  const two = putt.filter((x) => x.h.putts === 2).length;
  const three = putt.filter((x) => x.h.putts >= 3).length;
  const roundsAllPutts = rounds.filter((r) => isComplete(r) && scoredHoles(r).every((h) => has(h.putts)));
  const puttsPerRound18 = roundsAllPutts.filter((r) => r.count === 18).map((r) => scoredHoles(r).reduce((s, h) => s + h.putts, 0));
  const onGIR = putt.filter((x) => x.gir.value === "Y");
  const offGIR = putt.filter((x) => x.gir.value === "N");
  const zones = {};
  for (const z of ["A", "B", "C", "D", "E"]) {
    const xs = putt.filter((x) => x.h.puttZone === z && x.h.putts >= 1);
    zones[z] = {
      n: xs.length,
      avgPutts: mean(xs.map((x) => x.h.putts)),
      onePutt: xs.filter((x) => x.h.putts === 1).length,
      threePutt: xs.filter((x) => x.h.putts >= 3).length
    };
  }
  const threeFrom = { A: 0, B: 0, C: 0, D: 0, E: 0, unknown: 0 };
  putt.filter((x) => x.h.putts >= 3).forEach((x) => {
    threeFrom[x.h.puttZone || "unknown"]++;
  });
  const penKnown = recs.filter((x) => has(x.h.penalties));
  const penStrokes = penKnown.reduce((s, x) => s + x.h.penalties, 0);
  const missedGreens = recs.filter((x) => x.gir.value === "N" && x.toPar !== null);
  const scrambleSaves = missedGreens.filter((x) => x.toPar <= 0).length;
  const udChances = missedGreens.filter((x) => has(x.h.putts));
  const udMade = udChances.filter((x) => x.h.putts <= 1).length;
  const detailed = recs.filter((x) => x.round.tracking === "detailed");
  const appr = detailed.filter((x) => ["S", "LG", "L", "R"].includes(x.h.approach));
  const approachCounts = { S: 0, LG: 0, L: 0, R: 0 };
  appr.forEach((x) => approachCounts[x.h.approach]++);
  const contact = detailed.filter((x) => ["Solid", "Fat", "Thin"].includes(x.h.strike));
  const contactCounts = { Solid: 0, Fat: 0, Thin: 0 };
  contact.forEach((x) => contactCounts[x.h.strike]++);
  const shortMissKnown = detailed.filter((x) => x.h.shortMiss === true || x.h.shortMiss === false);
  const shortMisses = shortMissKnown.filter((x) => x.h.shortMiss === true).length;
  const threePuttExtra = putt.reduce((s, x) => s + Math.max(0, x.h.putts - 2), 0);
  const beyondBogey = withPar.reduce((s, x) => s + Math.max(0, x.toPar - 1), 0);
  const doublesPlus = withPar.filter((x) => x.toPar >= 2);
  return {
    rounds: rounds.length,
    holesN,
    scoring: {
      complete18: complete182.length,
      grossAvg: mean(grossScores),
      best: grossScores.length ? Math.min(...grossScores) : null,
      toParPerHole: mean(withPar.map((x) => x.toPar)),
      toParPer18: withPar.length ? mean(withPar.map((x) => x.toPar)) * 18 : null,
      parHoles: withPar.length,
      byPar,
      dist,
      frontAvg: mean(fronts),
      frontN: fronts.length,
      backAvg: mean(backs),
      backN: backs.length,
      doublesPlus: doublesPlus.length,
      doublesPer18: withPar.length ? doublesPlus.length / withPar.length * 18 : null
    },
    fairways: { n: fwElig.length, hit: fwHit, left: fwL, right: fwR, pct: rate(fwHit, fwElig.length), misses: fwL + fwR },
    gir: { n: girKnown.length, hit: girHit.length, pct: rate(girHit.length, girKnown.length), ambiguous: girAmbiguous.length, overrides: recs.filter((x) => x.gir.source === "override").length, per18: girKnown.length ? girHit.length / girKnown.length * 18 : null },
    putting: {
      n: putt.length,
      perHole: mean(putt.map((x) => x.h.putts)),
      per18: putt.length ? mean(putt.map((x) => x.h.putts)) * 18 : null,
      perRoundAvg: mean(puttsPerRound18),
      perRoundN: puttsPerRound18.length,
      onePutt: one,
      zeroPutt: zero,
      twoPutt: two,
      threePutt: three,
      onePct: rate(one, putt.length),
      threePct: rate(three, putt.length),
      threePer18: putt.length ? three / putt.length * 18 : null,
      onGIR: { n: onGIR.length, avg: mean(onGIR.map((x) => x.h.putts)) },
      offGIR: { n: offGIR.length, avg: mean(offGIR.map((x) => x.h.putts)) },
      zones,
      threeFrom,
      zoneN: putt.filter((x) => x.h.puttZone && x.h.putts >= 1).length
    },
    penalties: { n: penKnown.length, strokes: penStrokes, holes: penKnown.filter((x) => x.h.penalties > 0).length, per18: penKnown.length ? penStrokes / penKnown.length * 18 : null },
    shortGame: {
      scrambleN: missedGreens.length,
      scrambleSaves,
      scramblePct: rate(scrambleSaves, missedGreens.length),
      udN: udChances.length,
      udMade,
      udPct: rate(udMade, udChances.length)
    },
    detailed: {
      holes: detailed.length,
      approachN: appr.length,
      approach: approachCounts,
      contactN: contact.length,
      contact: contactCounts,
      shortMissN: shortMissKnown.length,
      shortMisses
    },
    lost: {
      penaltyStrokes: penStrokes,
      threePuttExtra,
      beyondBogey,
      per18: {
        penalties: penKnown.length ? penStrokes / penKnown.length * 18 : null,
        threePutt: putt.length ? threePuttExtra / putt.length * 18 : null,
        beyondBogey: withPar.length ? beyondBogey / withPar.length * 18 : null
      }
    },
    records: recs
  };
}
function costlyHoles(round, limit = 3) {
  return holeRecords([round]).filter((x) => x.toPar !== null && x.toPar >= 2).sort((a, b) => b.toPar - a.toPar || (num(a.h.handicap) ?? 99) - (num(b.h.handicap) ?? 99)).slice(0, limit).map((x) => ({ hole: x.n, par: x.h.par, score: x.h.score, toPar: x.toPar, reasons: holeReasons(x) }));
}
function holeReasons(x) {
  const h = x.h, out = [];
  if (h.penalties > 0) out.push(`${h.penalties} penalty stroke${h.penalties > 1 ? "s" : ""}`);
  if (h.putts >= 3) out.push(`${h.putts} putts${h.puttZone ? ` from zone ${h.puttZone}` : ""}`);
  if (h.par >= 4 && (h.fairway === "L" || h.fairway === "R")) out.push(`missed fairway ${h.fairway === "L" ? "left" : "right"}`);
  if (x.gir.value === "N" && has(h.putts) && h.score - h.putts - h.par + 2 >= 2) out.push(`reached the green ${h.score - h.putts - (h.par - 2)} shots after regulation`);
  if (["Fat", "Thin"].includes(h.strike)) out.push(`${h.strike.toLowerCase()} contact`);
  if (h.shortMiss === true) out.push("missed a short putt");
  return out;
}
function scoringSeries(rounds) {
  return sortByDate(rounds).filter((r) => r.count === 18 && isComplete(r)).map((r) => ({ id: r.id, date: r.date, gross: gross(r), toPar: toPar(r), course: r.course }));
}
function compareToBaseline(roundSummary, base) {
  const diffs = [];
  const add = (key, label, cur, prev, better, fmt) => {
    if (cur === null || prev === null || cur === void 0 || prev === void 0) return;
    diffs.push({ key, label, cur, prev, delta: cur - prev, better: better === "lower" ? cur < prev : cur > prev, fmt });
  };
  add("fw", "Fairways", roundSummary.fairways.pct, base.fairways.pct, "higher", "pct");
  add("gir", "Greens (est.)", roundSummary.gir.pct, base.gir.pct, "higher", "pct");
  add("putts", "Putts per 18", roundSummary.putting.per18, base.putting.per18, "lower", "num");
  add("three", "3-putts per 18", roundSummary.putting.threePer18, base.putting.threePer18, "lower", "num");
  add("pen", "Penalties per 18", roundSummary.penalties.per18, base.penalties.per18, "lower", "num");
  add("dbl", "Doubles+ per 18", roundSummary.scoring.doublesPer18, base.scoring.doublesPer18, "lower", "num");
  add("scr", "Scrambling (est.)", roundSummary.shortGame.scramblePct, base.shortGame.scramblePct, "higher", "pct");
  return diffs;
}

// js/coach.js
var f1 = (x) => x === null || x === void 0 ? "\u2014" : (Math.round(x * 10) / 10).toFixed(1);
var pc = (x) => x === null || x === void 0 ? "\u2014" : `${Math.round(x * 100)}%`;
var plural = (n, w, p = w + "s") => `${n} ${n === 1 ? w : p}`;
function confidence(holes) {
  if (holes >= 54) return { label: "Established", level: 3 };
  if (holes >= 18) return { label: "Developing", level: 2 };
  return { label: "Early signal", level: 1 };
}
function unexplainedBlowups(recs) {
  let total = 0;
  const holes = [];
  for (const x of recs) {
    if (x.toPar === null || x.toPar < 2) continue;
    const extra = x.toPar - 1;
    const explained = (x.h.penalties || 0) + Math.max(0, (x.h.putts === "" ? 0 : x.h.putts) - 2);
    const rest = Math.max(0, extra - explained);
    if (rest > 0) {
      total += rest;
      holes.push(x);
    }
  }
  return { total, holes };
}
function directionBias(left, right, minMisses = 8, share = 0.65) {
  const m = left + right;
  if (m < minMisses) return null;
  if (right / m >= share) return { side: "right", count: right, of: m };
  if (left / m >= share) return { side: "left", count: left, of: m };
  return null;
}
function findIssues(rounds) {
  const s = summarize(rounds);
  const recs = s.records;
  const issues = [];
  const conf = (n) => confidence(n);
  if (s.penalties.n >= 9 && s.penalties.per18 >= 0.5) {
    issues.push({
      key: "penalties",
      focus: "penalties",
      kind: "direct",
      impact: s.penalties.per18,
      title: "Keep penalty strokes off the card",
      evidence: `${plural(s.penalties.strokes, "penalty stroke")} across ${plural(s.penalties.n, "hole")} \u2014 about ${f1(s.penalties.per18)} per 18 holes.`,
      advice: "These are strokes you lose outright. Before each tee shot with trouble in play, pick the club and target that keep the ball in play, even if it leaves a longer approach.",
      confidence: conf(s.penalties.n)
    });
  }
  const tf = s.putting.threeFrom;
  const three = s.putting.threePutt;
  if (s.putting.n >= 9 && s.lost.per18.threePutt >= 0.75 && three >= 2) {
    const long = tf.D + tf.E, short = tf.A + tf.B + tf.C, known = long + short;
    const lag = known >= 2 && long / known >= 0.6;
    const zoneTxt = known ? ` ${long} of the ${known} with a recorded zone started 15 ft or more away.` : "";
    issues.push({
      key: "threeputt",
      focus: lag || !known ? "lag" : "shortputts",
      kind: "direct",
      impact: s.lost.per18.threePutt,
      title: lag ? "Long putts are turning into three-putts" : "Cut out three-putts",
      evidence: `${plural(three, "three-putt")} in ${plural(s.putting.n, "hole")} with putts recorded \u2014 ${f1(s.lost.per18.threePutt)} extra putts per 18.${zoneTxt}`,
      advice: lag ? "The problem is distance on the first putt, not holing out. Practise speed from 25\u201345 ft until most finish inside a 3-ft circle." : "Your three-putts start from mid-range, so the second putt is the leak. Practise 3\u20136 ft putts under a little pressure.",
      confidence: conf(s.putting.n)
    });
  }
  if (s.detailed.shortMissN >= 18 && s.detailed.shortMisses >= 2) {
    const per18 = s.detailed.shortMisses / s.detailed.shortMissN * 18;
    if (per18 >= 1) issues.push({
      key: "shortmiss",
      focus: "shortputts",
      kind: "direct",
      impact: per18,
      title: "Short putts are slipping by",
      evidence: `${plural(s.detailed.shortMisses, "short putt")} missed in ${s.detailed.shortMissN} detailed holes \u2014 about ${f1(per18)} per 18.`,
      advice: "Each miss from close range is close to a full stroke. Build a repeatable routine from 3\u20135 ft and test it with a make-in-a-row target.",
      confidence: conf(s.detailed.shortMissN)
    });
  }
  const bu = unexplainedBlowups(recs);
  const buPer18 = s.scoring.parHoles ? bu.total / s.scoring.parHoles * 18 : null;
  if (s.scoring.parHoles >= 9 && buPer18 >= 1 && bu.holes.length >= 2) {
    const fwMiss = bu.holes.filter((x) => x.h.par >= 4 && ["L", "R"].includes(x.h.fairway)).length;
    const lateGreen = bu.holes.filter((x) => x.h.putts !== "" && x.h.score - x.h.putts - (x.h.par - 2) >= 2).length;
    let cause = "";
    if (lateGreen >= bu.holes.length / 2) cause = ` On ${lateGreen} of them you reached the green two or more shots late, so the damage happened before the green.`;
    if (fwMiss >= bu.holes.length / 2) cause += ` ${fwMiss} started with a missed fairway.`;
    issues.push({
      key: "blowups",
      focus: "recovery",
      kind: "direct",
      impact: buPer18,
      title: "Limit the big numbers",
      evidence: `${plural(bu.holes.length, "double bogey or worse", "doubles or worse")} cost ${plural(bu.total, "stroke")} beyond bogey that penalties and three-putts don\u2019t account for \u2014 ${f1(buPer18)} per 18.${cause}`,
      advice: "After a poor shot, take the play that guarantees the next shot is from short grass. Bogey is a good result from trouble.",
      confidence: conf(s.scoring.parHoles)
    });
  }
  if (s.shortGame.udN >= 12) {
    const shortfall = Math.max(0, s.shortGame.udN / 3 - s.shortGame.udMade);
    const per18 = shortfall / s.holesN * 18;
    if (s.shortGame.udPct < 0.25 && per18 >= 0.75) issues.push({
      key: "shortgame",
      focus: "shortgame",
      kind: "reference",
      impact: per18,
      title: "Turn more missed greens into one putt",
      evidence: `Up-and-down (est.) on ${s.shortGame.udMade} of ${s.shortGame.udN} missed greens (${pc(s.shortGame.udPct)}). Converting 1 in 3 would save about ${f1(per18)} strokes per 18.`,
      advice: "Work on getting chips and pitches inside 6 ft rather than just onto the green.",
      confidence: conf(s.shortGame.udN)
    });
  }
  const patterns = [];
  const fb = directionBias(s.fairways.left, s.fairways.right);
  if (fb) patterns.push({
    key: `driving-${fb.side}`,
    focus: `driving-${fb.side}`,
    title: `Tee shots miss ${fb.side}`,
    evidence: `${fb.count} of your ${fb.of} missed fairways went ${fb.side} (${pc(fb.count / fb.of)}).`,
    advice: `Practise starting the ball on your intended line and choose targets that give a ${fb.side} miss more room. This is a pattern in results, not a diagnosis of your swing.`
  });
  if (s.fairways.n >= 14 && s.fairways.pct !== null && s.fairways.pct < 0.4 && !fb) patterns.push({
    key: "driving",
    focus: "driving",
    title: "Fairways are hard to come by",
    evidence: `${s.fairways.hit} of ${s.fairways.n} fairways hit (${pc(s.fairways.pct)}), misses split ${s.fairways.left} left / ${s.fairways.right} right.`,
    advice: "Misses go both ways, so practise a single reliable tee shot and a narrower target corridor."
  });
  if (s.detailed.approachN >= 10) {
    const a = s.detailed.approach;
    const top = Object.entries(a).sort((x, y) => y[1] - x[1])[0];
    if (top[1] / s.detailed.approachN >= 0.45) {
      const name = { S: "short", LG: "long", L: "left", R: "right" }[top[0]];
      patterns.push({
        key: `approach-${top[0]}`,
        focus: top[0] === "S" ? "approach-short" : top[0] === "LG" ? "approach-long" : "approach-dir",
        title: `Approaches miss ${name}`,
        evidence: `${top[1]} of ${s.detailed.approachN} recorded approach misses were ${name} (${pc(top[1] / s.detailed.approachN)}).`,
        advice: top[0] === "S" ? "Short misses usually mean the club choice is based on best carries, not typical ones. Measure your real carry numbers." : top[0] === "LG" ? "Long misses suggest your carries are longer than you plan for. Re-check them, especially with wedges." : "Pick targets that favour the side you rarely miss to."
      });
    }
  }
  if (s.detailed.contactN >= 12) {
    const bad = s.detailed.contact.Fat + s.detailed.contact.Thin;
    if (bad / s.detailed.contactN >= 0.35) patterns.push({
      key: "contact",
      focus: "contact",
      title: "Contact quality on approaches",
      evidence: `${bad} of ${s.detailed.contactN} approaches recorded as fat or thin (${s.detailed.contact.Fat} fat, ${s.detailed.contact.Thin} thin).`,
      advice: "Low-point control drills help both. If one dominates, a lesson is the fastest fix."
    });
  }
  issues.sort((a, b) => b.impact * (b.kind === "reference" ? 0.8 : 1) - a.impact * (a.kind === "reference" ? 0.8 : 1));
  return { summary: s, issues, patterns };
}
function roundTriggers(r) {
  const s = summarize([r]);
  const t = /* @__PURE__ */ new Set();
  if (s.penalties.strokes >= 2) t.add("penalties");
  if (s.putting.threePutt >= 2) t.add("threeputt");
  if (s.detailed.shortMisses >= 2) t.add("shortmiss");
  if (unexplainedBlowups(s.records).total >= 2) t.add("blowups");
  if (s.shortGame.udN >= 4 && s.shortGame.udPct < 0.2) t.add("shortgame");
  return t;
}
function recurrence(rounds, key, window2 = 5) {
  const recent = sortByDate(rounds).slice(-window2);
  const hits = recent.filter((r) => roundTriggers(r).has(key)).length;
  return { hits, of: recent.length, recurring: recent.length >= 3 && hits >= Math.ceil(recent.length * 0.6) };
}
function overallCoaching(rounds, window2 = 10) {
  const recent = sortByDate(rounds).slice(-window2);
  if (!recent.length) return { state: "empty" };
  const res = findIssues(recent);
  const top = res.issues[0] || null;
  const pattern = res.patterns[0] || null;
  let priority = top;
  if (!priority && pattern) priority = { ...pattern, kind: "pattern", impact: null, confidence: confidence(res.summary.holesN) };
  if (priority && top) priority.recurrence = recurrence(recent, top.key);
  return { state: priority ? "ok" : "clean", window: recent.length, holes: res.summary.holesN, priority, issues: res.issues, patterns: res.patterns, summary: res.summary };
}
function roundReport(round, allRounds) {
  const s = summarize([round]);
  const earlier = sortByDate(allRounds.filter((r) => r.id !== round.id && String(r.date) <= String(round.date))).slice(-10);
  const base = earlier.length ? summarize(earlier) : null;
  const went = [];
  const lost = [];
  if (s.penalties.n >= 9 && s.penalties.strokes === 0) went.push({ text: "No penalty strokes.", detail: `${s.penalties.n} holes recorded.` });
  if (s.putting.n >= 9 && s.putting.threePutt === 0) went.push({ text: "No three-putts.", detail: `${s.putting.n} holes with putts recorded.` });
  if (s.scoring.dist.birdie + s.scoring.dist.eagle > 0) went.push({ text: `${plural(s.scoring.dist.birdie + s.scoring.dist.eagle, "birdie")} or better.`, detail: "" });
  if (base) {
    for (const d of compareToBaseline(s, base)) {
      if (!d.better) continue;
      const margin = d.fmt === "pct" ? Math.abs(d.delta) >= 0.1 : Math.abs(d.delta) >= 1;
      if (!margin) continue;
      if (d.key === "pen" && s.penalties.strokes === 0 || d.key === "three" && s.putting.threePutt === 0) continue;
      went.push({ text: `${d.label}: ${d.fmt === "pct" ? pc(d.cur) : f1(d.cur)}`, detail: `Your previous ${earlier.length}-round average was ${d.fmt === "pct" ? pc(d.prev) : f1(d.prev)}.` });
    }
  }
  const pars = s.scoring.dist.par;
  if (!went.length && pars >= 6) went.push({ text: `${plural(pars, "par")} on the card.`, detail: "" });
  const holesWith = (pred) => s.records.filter(pred).map((x) => x.n);
  if (s.penalties.strokes > 0) lost.push({ label: "Penalty strokes", strokes: s.penalties.strokes, holes: holesWith((x) => x.h.penalties > 0) });
  if (s.lost.threePuttExtra > 0) lost.push({ label: "Putts beyond two", strokes: s.lost.threePuttExtra, holes: holesWith((x) => x.h.putts >= 3) });
  const smHoles = holesWith((x) => x.h.shortMiss === true && !(x.h.putts >= 3));
  if (smHoles.length) lost.push({ label: "Short putts missed", strokes: smHoles.length, holes: smHoles, approx: true });
  const bu = unexplainedBlowups(s.records);
  if (bu.total > 0) lost.push({ label: "Other strokes beyond bogey", strokes: bu.total, holes: bu.holes.map((x) => x.n) });
  lost.sort((a, b) => b.strokes - a.strokes);
  const roundIssues = findIssues([round]);
  const history2 = findIssues([...earlier, round]);
  let priority = roundIssues.issues[0] || history2.issues[0] || roundIssues.patterns[0] || history2.patterns[0] || null;
  const histTop = history2.issues[0];
  if (priority && histTop && priority.key !== histTop.key && roundIssues.issues.some((i) => i.key === histTop.key)) {
    const r12 = recurrence([...earlier, round], priority.key), r2 = recurrence([...earlier, round], histTop.key);
    if (!r12.recurring && r2.hits >= r12.hits) priority = { ...histTop, evidence: `${roundIssues.issues.find((i) => i.key === histTop.key).evidence} Across your recent rounds: ${histTop.evidence.charAt(0).toLowerCase()}${histTop.evidence.slice(1)}` };
  }
  let todayNote = "";
  if (priority && histTop && priority.key !== histTop.key && history2.summary.holesN >= 54) {
    const rp = recurrence([...earlier, round], priority.key);
    if (rp.of >= 3 && !rp.recurring) {
      todayNote = `This round also showed: ${priority.evidence} It showed up in ${rp.hits} of your last ${rp.of} rounds, so it\u2019s not the main pattern yet.`;
      priority = histTop;
    }
  }
  let recurringNote = "";
  if (priority) {
    const rec = recurrence([...earlier, round], priority.key);
    if (rec.of >= 3) recurringNote = rec.recurring ? `This has shown up in ${rec.hits} of your last ${rec.of} rounds \u2014 it\u2019s a pattern, not a one-off.` : rec.hits <= 1 ? `It showed up in only ${rec.hits} of your last ${rec.of} rounds, so treat it as a one-off unless it repeats.` : `It showed up in ${rec.hits} of your last ${rec.of} rounds.`;
    priority = { ...priority, recurringNote, todayNote };
  }
  const scoreText = isComplete(round) ? gross(round) : null;
  return {
    summary: s,
    baseline: base,
    baselineRounds: earlier.length,
    gross: scoreText,
    wentWell: went.slice(0, 4),
    lost,
    costly: costlyHoles(round),
    priority,
    patterns: roundIssues.patterns
  };
}

// js/practice.js
var FOCUS = {
  lag: { label: "Lag putting", area: "putting", partner: "shortputts" },
  shortputts: { label: "Short putts", area: "putting", partner: "lag" },
  shortgame: { label: "Chipping & pitching", area: "short", partner: "lag" },
  penalties: { label: "Tee shots in play", area: "tee", partner: "approach" },
  "driving-right": { label: "Tee shots missing right", area: "tee", partner: "approach" },
  "driving-left": { label: "Tee shots missing left", area: "tee", partner: "approach" },
  driving: { label: "Tee-shot accuracy", area: "tee", partner: "approach" },
  "approach-short": { label: "Approach distance", area: "approach", partner: "shortgame" },
  "approach-long": { label: "Approach distance", area: "approach", partner: "shortgame" },
  "approach-dir": { label: "Approach direction", area: "approach", partner: "shortgame" },
  approach: { label: "Approach play", area: "approach", partner: "shortgame" },
  contact: { label: "Strike quality", area: "approach", partner: "shortgame" },
  recovery: { label: "Avoiding big numbers", area: "course", partner: "shortgame" },
  general: { label: "All-round", area: "mixed", partner: "shortgame" }
};
var DRILLS = [
  // Putting — lag
  {
    id: "lag-ladder",
    name: "Lag ladder",
    where: "G",
    focus: ["lag"],
    kind: "skill",
    minutes: 10,
    level: 1,
    setup: "Tee pegs at 20, 30 and 40 ft. Lay a club 2 ft behind the hole as a backstop.",
    steps: "Putt 3 balls from each distance, longest last. Count balls that finish inside 3 ft and do not touch the club.",
    reps: "9 putts \xD7 2 rounds",
    target: "6 of 9 inside 3 ft",
    why: "Trains speed first \u2014 the main cause of three-putts from long range."
  },
  {
    id: "lag-fringe",
    name: "Fringe finish",
    where: "G",
    focus: ["lag"],
    kind: "skill",
    minutes: 10,
    level: 2,
    setup: "Pick a hole 30\u201345 ft away near the edge of the green.",
    steps: "Putt to stop the ball between the hole and the fringe without going off the green. Long = past the fringe, short = outside 3 ft short.",
    reps: "12 putts",
    target: "8 of 12 finish in the zone",
    why: "Teaches the length of putt you actually face on missed-regulation holes."
  },
  {
    id: "lag-one-look",
    name: "One-look lag",
    where: "G",
    focus: ["lag"],
    kind: "transfer",
    minutes: 8,
    level: 2,
    setup: "Choose 6 different holes, 25\u201350 ft, uphill and downhill.",
    steps: "One ball per hole. Full routine, one practice stroke, then putt and hole out the second putt.",
    reps: "6 holes \xD7 2",
    target: "12 holes in 24 putts or fewer",
    why: "Matches how you putt on the course: one attempt, then hole out."
  },
  {
    id: "speed-towel",
    name: "Past-the-hole window",
    where: "G",
    focus: ["lag", "shortputts"],
    kind: "warmup",
    minutes: 5,
    level: 1,
    setup: "Place a towel 18 in. past a hole about 15 ft away.",
    steps: "Roll putts that would stop between the hole and the towel if they missed.",
    reps: "10 putts",
    target: "7 of 10 in the window",
    why: "Sets a consistent speed reference before the main work."
  },
  // Putting — short
  {
    id: "gate-start",
    name: "Start-line gate",
    where: "G",
    focus: ["shortputts"],
    kind: "skill",
    minutes: 8,
    level: 1,
    setup: "Two tees just wider than a ball, 12 in. in front of the ball, on a straight 5-ft putt.",
    steps: "Roll each putt through the gate. Only count putts that pass cleanly and drop.",
    reps: "15 putts",
    target: "12 of 15",
    why: "Short misses usually start off line; the gate shows it immediately."
  },
  {
    id: "clock-4",
    name: "Clock at 4 ft",
    where: "G",
    focus: ["shortputts"],
    kind: "skill",
    minutes: 8,
    level: 2,
    setup: "Four tees around a hole on a slight slope, 4 ft away (12, 3, 6, 9 o\u2019clock).",
    steps: "Go around the clock. A miss sends you back to 12 o\u2019clock.",
    reps: "Until 2 full laps or 8 minutes",
    target: "2 consecutive laps (8 in a row)",
    why: "Covers every break you meet from short range."
  },
  {
    id: "make-25",
    name: "Make 25",
    where: "G",
    focus: ["shortputts"],
    kind: "test",
    minutes: 8,
    level: 3,
    setup: "Five balls from 3, 4, 5, 6 and 7 ft in a line.",
    steps: "Complete each distance before moving back. Record total putts used.",
    reps: "25 makes",
    target: "25 makes in 32 putts or fewer",
    why: "A measurable test you can repeat weekly to see progress."
  },
  // Short game
  {
    id: "landing-towel",
    name: "Landing spot",
    where: "C",
    focus: ["shortgame"],
    kind: "skill",
    minutes: 10,
    level: 1,
    setup: "Hand towel on the green 3 ft onto the putting surface. Hole 20\u201335 ft away.",
    steps: "Chip with one club, landing on the towel. Note where each ball finishes.",
    reps: "15 chips",
    target: "10 of 15 land on the towel; 6 finish inside 6 ft",
    why: "Controlling the landing spot controls the rollout."
  },
  {
    id: "three-club",
    name: "Three-club chip",
    where: "C",
    focus: ["shortgame"],
    kind: "skill",
    minutes: 10,
    level: 2,
    setup: "Same spot, three clubs (e.g. SW, PW, 8-iron), one hole.",
    steps: "Hit 4 with each club using the same stroke. Learn how far each one rolls.",
    reps: "12 chips",
    target: "7 of 12 inside 6 ft",
    why: "Gives you a lower-risk option than lofted shots from tight lies."
  },
  {
    id: "up-down-9",
    name: "Up-and-down nine",
    where: "C",
    focus: ["shortgame", "recovery"],
    kind: "test",
    minutes: 12,
    level: 2,
    setup: "Nine positions around the green: fringe, rough, uphill, downhill, short-sided.",
    steps: "One ball per spot. Chip and hole out. Score how many take 2 strokes or fewer.",
    reps: "9 holes",
    target: "4 of 9 up and down",
    why: "Mirrors the shots you face after missing a green."
  },
  {
    id: "pitch-ladder",
    name: "Pitch ladder",
    where: "C",
    focus: ["shortgame", "approach-short", "approach-long"],
    kind: "skill",
    minutes: 10,
    level: 2,
    setup: "Targets at 15, 25 and 35 yards.",
    steps: "Three balls to each target, in order, then reverse.",
    reps: "18 pitches",
    target: "12 of 18 within 15 ft",
    why: "Builds feel for the in-between distances where strokes leak."
  },
  // Approach
  {
    id: "carry-check",
    name: "Carry check",
    where: "R",
    focus: ["approach-short", "approach-long", "approach"],
    kind: "skill",
    minutes: 12,
    level: 1,
    setup: "Launch monitor or range flags with known yardages. Three clubs you use for approaches.",
    steps: "Hit 8 balls per club. Ignore the best and worst two; the middle four give your typical carry.",
    reps: "24 balls",
    target: "Write down a typical carry for all 3 clubs",
    why: "Most short misses come from planning with best-ever carries."
  },
  {
    id: "green-box",
    name: "Green-sized box",
    where: "R",
    focus: ["approach", "approach-dir", "approach-short", "approach-long"],
    kind: "skill",
    minutes: 12,
    level: 2,
    setup: "Choose a target and imagine a 30 \xD7 30 yard green around it.",
    steps: "Change club and target every ball. Record each miss as short, long, left or right.",
    reps: "20 balls",
    target: "9 of 20 on the \u201Cgreen\u201D",
    why: "Changing targets each ball is closer to the course than raking balls."
  },
  {
    id: "safe-side",
    name: "Safe-side targets",
    where: "R",
    focus: ["approach-dir", "recovery"],
    kind: "transfer",
    minutes: 10,
    level: 2,
    setup: "Picture a flag tucked on one side with trouble beyond it.",
    steps: "Aim at the middle or the safe side. Count balls that finish away from the trouble side.",
    reps: "12 balls",
    target: "10 of 12 on the safe side",
    why: "Reduces big numbers without changing your swing."
  },
  {
    id: "low-point",
    name: "Low-point line",
    where: "R",
    focus: ["contact"],
    kind: "skill",
    minutes: 10,
    level: 1,
    setup: "Spray or chalk line on a mat, or a line scratched in the turf.",
    steps: "Ball just ahead of the line. Strike the ball, then ground in front of the line.",
    reps: "20 balls",
    target: "15 of 20 marks in front of the line",
    why: "Fat and thin both come from where the club bottoms out."
  },
  {
    id: "half-swing",
    name: "Half-swing strike",
    where: "R",
    focus: ["contact"],
    kind: "skill",
    minutes: 8,
    level: 1,
    setup: "8-iron, hip-high to hip-high swing.",
    steps: "Hit with a smaller swing and check strike. Lengthen only after 5 solid in a row.",
    reps: "20 balls",
    target: "5 solid in a row, twice",
    why: "Smaller motions make centred contact easier to groove."
  },
  // Tee shots
  {
    id: "corridor",
    name: "Fairway corridor",
    where: "R",
    focus: ["driving", "driving-right", "driving-left", "penalties"],
    kind: "skill",
    minutes: 12,
    level: 1,
    setup: "Pick two flags or markers about 30 yards apart as fairway edges.",
    steps: "Full routine every ball. Record each ball as fairway, left or right.",
    reps: "14 drives",
    target: "9 of 14 inside",
    why: "Measures the thing that matters on the course: finishing in play."
  },
  {
    id: "start-line",
    name: "Start-line stick",
    where: "R",
    focus: ["driving-right", "driving-left"],
    kind: "skill",
    minutes: 10,
    level: 2,
    setup: "Alignment stick on your target line; a second stick 3 ft in front, just outside your intended start line.",
    steps: "Start each ball on the side of the front stick you intend. Note whether misses start off line or curve off line.",
    reps: "15 balls",
    target: "11 of 15 start on the intended side",
    why: "Shows whether your one-sided misses start that way or curve there."
  },
  {
    id: "trouble-side",
    name: "Away from trouble",
    where: "R",
    focus: ["driving-right", "driving-left", "penalties"],
    kind: "transfer",
    minutes: 10,
    level: 2,
    setup: "Imagine water along your usual miss side.",
    steps: "Aim at the side of the fairway away from the trouble. Count any ball finishing beyond the trouble edge as a penalty.",
    reps: "12 balls",
    target: "0\u20131 penalties",
    why: "Plays your known miss rather than fighting it."
  },
  {
    id: "club-choice",
    name: "Driver vs. safe club",
    where: "R",
    focus: ["penalties", "driving"],
    kind: "test",
    minutes: 10,
    level: 2,
    setup: "Same corridor as your fairway drill.",
    steps: "Hit 6 with driver and 6 with your most reliable tee club. Record in-play results for each.",
    reps: "12 balls",
    target: "Know which club keeps 9 in 12 in play",
    why: "Gives you evidence for tee-shot decisions on tight holes."
  },
  // Course management / pressure
  {
    id: "nine-hole-sim",
    name: "Range nine-hole simulation",
    where: "R",
    focus: ["recovery", "penalties", "general"],
    kind: "transfer",
    minutes: 15,
    level: 2,
    setup: "Write down nine holes from your home course.",
    steps: "Play each: tee shot to a corridor, then the approach club the result leaves. Full routine, one ball each.",
    reps: "9 holes, about 20 balls",
    target: "6 of 9 tee shots in play; 4 of 9 approaches on the \u201Cgreen\u201D",
    why: "Practises decisions and routine, not just mechanics."
  },
  {
    id: "par-18",
    name: "Par-18 short game",
    where: "C",
    focus: ["shortgame", "recovery", "general"],
    kind: "test",
    minutes: 15,
    level: 3,
    setup: "Nine spots around a practice green; par is 2 at each.",
    steps: "Play one ball from each spot and hole out. Record the total.",
    reps: "9 holes",
    target: "22 or better",
    why: "A repeatable score that tracks short-game progress over time."
  },
  {
    id: "random-putts",
    name: "Random nine putts",
    where: "G",
    focus: ["lag", "shortputts", "general"],
    kind: "test",
    minutes: 10,
    level: 2,
    setup: "Nine holes of mixed length: 3 short, 3 medium, 3 long.",
    steps: "One ball, hole out every time. Record total putts.",
    reps: "9 holes",
    target: "17 putts or fewer",
    why: "A quick putting test that mixes speed and holing out."
  }
];
var byId = Object.fromEntries(DRILLS.map((d) => [d.id, d]));
var TEMPLATES = {
  15: [{ role: "Main drill", pick: "primary-skill", min: 9 }, { role: "Test", pick: "primary-test", min: 6 }],
  30: [{ role: "Warm-up", pick: "warmup", min: 5 }, { role: "Main drill", pick: "primary-skill", min: 12 }, { role: "Second skill", pick: "secondary-skill", min: 8 }, { role: "Test", pick: "primary-test", min: 5 }],
  45: [{ role: "Warm-up", pick: "warmup", min: 5 }, { role: "Main drill", pick: "primary-skill", min: 12 }, { role: "Main drill \u2014 variation", pick: "primary-skill2", min: 10 }, { role: "Second skill", pick: "secondary-skill", min: 10 }, { role: "Test", pick: "primary-test", min: 8 }],
  60: [{ role: "Warm-up", pick: "warmup", min: 5 }, { role: "Main drill", pick: "primary-skill", min: 12 }, { role: "Main drill \u2014 variation", pick: "primary-skill2", min: 10 }, { role: "Second skill", pick: "secondary-skill", min: 10 }, { role: "Second skill \u2014 test", pick: "secondary-test", min: 8 }, { role: "On-course simulation", pick: "transfer", min: 15 }]
};
function rotate(candidates, recentIds, seed) {
  const fresh = candidates.filter((d) => !recentIds.has(d.id));
  const pool = fresh.length ? fresh : candidates;
  if (!pool.length) return null;
  return pool[seed % pool.length];
}
function buildSession(focusKey, minutes, history2 = [], opts2 = {}) {
  const focus = FOCUS[focusKey] ? focusKey : "general";
  const secondary = opts2.secondary && opts2.secondary !== focus ? opts2.secondary : FOCUS[focus].partner;
  const recent = new Set(history2.slice(-2).flatMap((p) => (p.drills || []).map((d) => d.id)));
  const seed = history2.length;
  const used = /* @__PURE__ */ new Set();
  const tpl = TEMPLATES[minutes] || TEMPLATES[30];
  const forFocus = (f, kinds) => DRILLS.filter((d) => d.focus.includes(f) && kinds.includes(d.kind) && !used.has(d.id));
  const area = FOCUS[focus].area;
  const blocks = [];
  for (const slot of tpl) {
    let cands = [];
    if (slot.pick === "warmup") {
      cands = DRILLS.filter((d2) => d2.kind === "warmup" && !used.has(d2.id));
      if (area === "tee" || area === "approach") cands = [{ id: "range-warmup", name: "Wedge warm-up", where: "R", focus: [], kind: "warmup", minutes: 5, level: 1, setup: "Pitching wedge, a target 60\u201380 yards away.", steps: "Half swings building to three-quarter swings. No full swings until the last three balls.", reps: "12 balls", target: "Last 6 balls finish within 10 yards of the target", why: "Gets you striking cleanly before the measured work." }];
    } else if (slot.pick === "primary-skill" || slot.pick === "primary-skill2") cands = forFocus(focus, ["skill"]);
    else if (slot.pick === "primary-test") cands = [...forFocus(focus, ["test"]), ...forFocus(focus, ["transfer"])];
    else if (slot.pick === "secondary-skill") {
      cands = forFocus(secondary, ["skill"]);
      if (!cands.length) cands = forFocus(secondary, ["transfer", "test"]);
      if (!cands.length) cands = forFocus(FOCUS[focus].partner, ["skill"]);
    } else if (slot.pick === "secondary-test") cands = [...forFocus(secondary, ["test"]), ...forFocus(secondary, ["transfer"])];
    else if (slot.pick === "transfer") cands = DRILLS.filter((d2) => d2.kind === "transfer" && !used.has(d2.id) && (d2.focus.includes(focus) || d2.focus.includes("general") || d2.focus.includes("recovery")));
    if (!cands.length) cands = forFocus(focus, ["skill", "transfer", "test"]);
    if (!cands.length) cands = forFocus(secondary, ["skill", "transfer", "test"]);
    if (!cands.length) cands = DRILLS.filter((d2) => !used.has(d2.id) && d2.focus.includes("general"));
    const d = rotate(cands, recent, seed + blocks.length);
    if (!d) continue;
    used.add(d.id);
    blocks.push({ ...d, role: slot.role, minutes: slot.min });
  }
  const where = [...new Set(blocks.map((b) => b.where))];
  return {
    focus,
    focusLabel: FOCUS[focus].label,
    secondary,
    secondaryLabel: FOCUS[secondary]?.label,
    minutes,
    blocks,
    where,
    why: opts2.why || "",
    total: blocks.reduce((s, b) => s + b.minutes, 0)
  };
}
var WHERE_LABEL = { G: "Putting green", C: "Chipping area", R: "Range" };

// js/handicap.js
var NOTES = [
  "Unofficial estimate \u2014 not a USGA Handicap Index and not valid for competitions.",
  "Playing Conditions Calculation (PCC) is assumed to be 0.",
  "Soft cap, hard cap and exceptional-score reductions are not applied.",
  "Rounds need a course rating, slope and par for every hole to count.",
  "Partial rounds are not used. 9-hole rounds count only once an estimate exists, using an expected score for the unplayed nine."
];
var r1 = (x) => Math.round(x * 10) / 10;
function selection(n) {
  if (n < 3) return null;
  if (n === 3) return { use: 1, adj: -2 };
  if (n === 4) return { use: 1, adj: -1 };
  if (n === 5) return { use: 1, adj: 0 };
  if (n === 6) return { use: 2, adj: -1 };
  if (n <= 8) return { use: 2, adj: 0 };
  if (n <= 11) return { use: 3, adj: 0 };
  if (n <= 14) return { use: 4, adj: 0 };
  if (n <= 16) return { use: 5, adj: 0 };
  if (n <= 18) return { use: 6, adj: 0 };
  if (n === 19) return { use: 7, adj: 0 };
  return { use: 8, adj: 0 };
}
function indexFromDifferentials(diffs) {
  const recent = diffs.slice(-20);
  const sel = selection(recent.length);
  if (!sel) return null;
  const lowest = recent.map((d, i) => ({ d: d.value, i })).sort((a, b) => a.d - b.d).slice(0, sel.use);
  const value = Math.min(54, r1(lowest.reduce((s, x) => s + x.d, 0) / sel.use + sel.adj));
  return { value, used: sel.use, of: recent.length, adjustment: sel.adj, usedIdx: lowest.map((x) => x.i + Math.max(0, diffs.length - 20)) };
}
function courseHandicap(index, slope, rating, par) {
  if (index === null || index === void 0 || !slope || !rating || !par) return null;
  return Math.round(index * (slope / 113) + (rating - par));
}
function strokesOnHole(ch, si, holes = 18) {
  if (ch === null || ch === void 0) return 0;
  if (!si) return null;
  if (ch >= 0) return Math.floor(ch / holes) + (si <= ch % holes ? 1 : 0);
  const back = -ch;
  const give = Math.floor(back / holes) + (si > holes - back % holes ? 1 : 0);
  return give ? -give : 0;
}
function eligible(r) {
  const hs = holesPlayed(r);
  return isComplete(r) && num(r.rating) !== null && num(r.slope) !== null && hs.every((h) => num(h.par) !== null);
}
function adjustedGross(r, index) {
  const hs = holesPlayed(r);
  const count = hs.length;
  const par = hs.reduce((s, h) => s + h.par, 0);
  const rating = count === 9 && r.rating > 50 ? r.rating / 2 : r.rating;
  const idx = index === null || index === void 0 ? null : count === 9 ? index / 2 : index;
  const ch = idx === null ? null : Math.round(idx * (r.slope / 113) + (rating - par));
  let ags = 0, adjusted = 0, siMissing = false;
  const holes = hs.map((h, i) => {
    let max;
    if (ch === null) max = h.par + 5;
    else {
      const si = num(h.handicap);
      let st = strokesOnHole(ch, count === 9 ? si ? Math.ceil(si / 2) : null : si, count);
      if (st === null) {
        siMissing = true;
        st = Math.floor(ch / count);
      }
      max = h.par + 2 + st;
    }
    const used = Math.min(h.score, max);
    if (used < h.score) adjusted++;
    ags += used;
    return { hole: i + 1, score: h.score, max, used };
  });
  return { ags, par, rating, ch, adjustedHoles: adjusted, siMissing, holes, method: ch === null ? "par+5" : "net double bogey" };
}
function differential(ags, rating, slope) {
  return r1(113 / slope * (ags - rating));
}
function handicapHistory(rounds) {
  const sorted = sortByDate(rounds).filter(eligible);
  const diffs = [];
  const skipped = { nine: 0 };
  let current = null;
  for (const r of sorted) {
    const nine = r.count === 9;
    if (nine && current === null) {
      skipped.nine++;
      continue;
    }
    const adj = adjustedGross(r, current ? current.value : null);
    let value = differential(adj.ags, adj.rating, r.slope);
    let expectedOther = null;
    if (nine) {
      expectedOther = r1(current.value * 0.52 + 1.2);
      value = r1(value + expectedOther);
    }
    diffs.push({ id: r.id, date: r.date, course: r.course, value, ags: adj.ags, gross: adj.holes.reduce((s, h) => s + h.score, 0), adjustedHoles: adj.adjustedHoles, method: adj.method, siMissing: adj.siMissing, nine, expectedOther });
    current = indexFromDifferentials(diffs);
  }
  const usedSet = new Set(current ? current.usedIdx : []);
  diffs.slice(-20).forEach((d, i) => {
    d.used = usedSet.has(i + Math.max(0, diffs.length - 20));
  });
  const eligibleCount = diffs.length;
  return {
    index: current ? current.value : null,
    detail: current,
    differentials: diffs,
    needed: Math.max(0, 3 - eligibleCount),
    skippedNine: skipped.nine,
    ineligible: rounds.length - sorted.length
  };
}
function netForRound(r, index) {
  if (index === null || index === void 0 || !eligible(r)) return null;
  const hs = holesPlayed(r);
  const par = hs.reduce((s, h) => s + h.par, 0);
  const idx = r.count === 9 ? index / 2 : index;
  const rating = r.count === 9 && r.rating > 50 ? r.rating / 2 : r.rating;
  const ch = courseHandicap(idx, r.slope, rating, par);
  const grossScore = hs.reduce((s, h) => s + h.score, 0);
  return { courseHandicap: ch, playingHandicap: Math.round(ch * 0.95), net: grossScore - ch, par };
}

// js/demo.js
function rng(seed) {
  let a = seed >>> 0;
  return () => {
    a |= 0;
    a = a + 1831565813 | 0;
    let t = Math.imul(a ^ a >>> 15, 1 | a);
    t = t + Math.imul(t ^ t >>> 7, 61 | t) ^ t;
    return ((t ^ t >>> 14) >>> 0) / 4294967296;
  };
}
var pick = (r, table) => {
  let x = r();
  for (const [v, p] of table) {
    if ((x -= p) < 0) return v;
  }
  return table[table.length - 1][0];
};
var DEMO_COURSES = [
  {
    name: "Pine Ridge Golf Club",
    tees: "White",
    teeGender: "M",
    rating: 70.8,
    slope: 124,
    par: [4, 5, 3, 4, 4, 3, 5, 4, 4, 4, 4, 3, 5, 4, 4, 3, 5, 4],
    yds: [372, 498, 162, 351, 388, 148, 521, 340, 401, 365, 392, 171, 489, 334, 410, 155, 512, 379],
    si: [7, 11, 15, 9, 1, 17, 5, 13, 3, 8, 2, 16, 10, 14, 4, 18, 12, 6]
  },
  {
    name: "Cedar Run Golf Course",
    tees: "Blue",
    teeGender: "M",
    rating: 71.6,
    slope: 129,
    par: [4, 4, 3, 5, 4, 4, 3, 4, 5, 4, 3, 4, 5, 4, 4, 3, 4, 5],
    yds: [395, 362, 184, 530, 418, 344, 157, 402, 508, 381, 176, 425, 542, 356, 390, 149, 410, 497],
    si: [5, 13, 15, 9, 1, 11, 17, 3, 7, 6, 16, 2, 10, 14, 8, 18, 4, 12]
  },
  {
    name: "Lakeview Links",
    tees: "White",
    teeGender: "M",
    rating: 69.7,
    slope: 121,
    par: [4, 3, 4, 5, 4, 4, 3, 5, 4, 4, 5, 3, 4, 4, 3, 5, 4, 4],
    yds: [355, 149, 368, 489, 340, 377, 166, 502, 361, 344, 495, 158, 372, 330, 172, 480, 386, 359],
    si: [9, 17, 5, 11, 13, 3, 15, 7, 1, 10, 6, 18, 4, 14, 16, 12, 2, 8]
  }
];
function simulateHole(r, par, progress, detailed) {
  let penalties = 0, strokes = 0, fairway = par === 3 ? "NA" : "";
  const penaltyRate = 0.13 - 0.09 * progress;
  strokes++;
  let inTrouble = false;
  if (par >= 4) {
    const hit = r() < 0.5 + 0.06 * progress;
    fairway = hit ? "H" : r() < 0.7 ? "R" : "L";
    if (!hit && r() < penaltyRate * 2.2) {
      penalties++;
      inTrouble = true;
    }
    if (!hit && !inTrouble && r() < 0.12) inTrouble = true;
  }
  if (par === 5) strokes++;
  if (inTrouble) strokes++;
  let gir;
  if (par === 3) gir = r() < 0.36;
  else if (inTrouble) gir = false;
  else gir = r() < (fairway === "H" ? 0.44 : 0.22) + (par === 5 ? 0.06 : 0);
  if (par === 3 && !gir && r() < penaltyRate) penalties++;
  strokes++;
  if (par === 3) strokes--;
  let approach = "", zone;
  if (gir) {
    zone = pick(r, [["C", 0.24], ["D", 0.4], ["E", 0.36]]);
  } else {
    approach = pick(r, [["S", 0.44], ["R", 0.24], ["L", 0.16], ["LG", 0.16]]);
    if (r() < 0.16) strokes++;
    strokes++;
    if (r() < 0.035) {
      const score2 = strokes + penalties;
      return { par, score: score2, putts: 0, penalties, fairway, puttZone: "", approach: detailed ? approach : "", strike: detailed ? pick(r, [["Solid", 0.62], ["Fat", 0.22], ["Thin", 0.16]]) : "", shortMiss: detailed ? false : "" };
    }
    zone = pick(r, [["A", 0.1], ["B", 0.26], ["C", 0.4], ["D", 0.24]]);
  }
  const table = {
    A: [[1, 0.96], [2, 0.04]],
    B: [[1, 0.68], [2, 0.31], [3, 0.01]],
    C: [[1, 0.24], [2, 0.73], [3, 0.03]],
    D: [[1, 0.06], [2, 0.78], [3, 0.16]],
    E: [[1, 0.02], [2, 0.64], [3, 0.33], [4, 0.01]]
  }[zone];
  const putts = pick(r, table);
  const score = strokes + penalties + putts;
  const shortMiss = detailed ? (zone === "A" || zone === "B") && putts >= 2 : "";
  return {
    par,
    score,
    putts,
    penalties,
    fairway,
    puttZone: zone,
    approach: detailed ? approach : "",
    strike: detailed ? pick(r, [["Solid", 0.62], ["Fat", 0.22], ["Thin", 0.16]]) : "",
    shortMiss
  };
}
function buildDemoData() {
  const r = rng(20260429);
  const courses = DEMO_COURSES.map((c) => normalizeCourse({
    name: c.name,
    tees: c.tees,
    teeGender: c.teeGender,
    count: 18,
    rating: c.rating,
    slope: c.slope,
    source: "demo",
    holes: c.par.map((p, i) => ({ par: p, yardage: c.yds[i], handicap: c.si[i] }))
  }));
  const rounds = [];
  const start = /* @__PURE__ */ new Date("2026-04-29T12:00:00Z");
  for (let k = 0; k < 30; k++) {
    const c = DEMO_COURSES[k % 3];
    const d = new Date(start.getTime() + k * 6 * 864e5);
    const progress = k / 29;
    const detailed = k >= 18;
    const holes = c.par.map((p, i) => ({
      ...blankHole(),
      ...simulateHole(r, p, progress, detailed),
      yardage: c.yds[i],
      handicap: c.si[i]
    }));
    rounds.push(normalizeRound({
      id: `demo-round-${String(k + 1).padStart(2, "0")}`,
      date: d.toISOString().slice(0, 10),
      course: c.name,
      tees: c.tees,
      teeGender: c.teeGender,
      count: 18,
      rating: c.rating,
      slope: c.slope,
      tracking: detailed ? "detailed" : "basic",
      source: "demo",
      notes: "Fictional demonstration round",
      holes,
      createdAt: d.toISOString(),
      updatedAt: d.toISOString()
    }));
  }
  const practices = [
    { id: "demo-p1", date: "2026-09-29", minutes: 30, skill: "Lag putting", focus: "lag", notes: "Fictional practice entry", drills: [{ id: "lag-ladder", name: "Lag ladder", target: "6 of 9 inside 3 ft", result: "4/9" }] },
    { id: "demo-p2", date: "2026-10-11", minutes: 45, skill: "Lag putting", focus: "lag", notes: "Fictional practice entry", drills: [{ id: "lag-fringe", name: "Fringe finish", target: "8 of 12 finish in the zone", result: "7/12" }] }
  ];
  return {
    schemaVersion: 3,
    rounds,
    practices,
    courses,
    draft: null,
    profile: { name: "Alex Morgan", goal: 85, demo: true },
    meta: { lastBackupAt: (/* @__PURE__ */ new Date()).toISOString(), roundsAtLastBackup: 30 }
  };
}

// js/storage.js
function loadData() {
  let raw = null, from = "";
  try {
    raw = localStorage.getItem(STORAGE_KEY);
    from = raw ? STORAGE_KEY : "";
    if (!raw) {
      raw = localStorage.getItem(LEGACY_KEY);
      from = raw ? LEGACY_KEY : "";
    }
  } catch (e) {
    return { data: emptyData(), ok: false, error: "Browser storage is blocked. Rounds can\u2019t be saved in this mode." };
  }
  if (!raw) return { data: emptyData(), ok: true, fresh: true };
  let parsed;
  try {
    parsed = JSON.parse(raw);
  } catch {
    try {
      if (!localStorage.getItem(SAFETY_KEY)) localStorage.setItem(SAFETY_KEY, raw);
    } catch {
    }
    return { data: emptyData(), ok: true, error: "Saved data could not be read. A copy was kept; restore a backup in More \u2192 Backup." };
  }
  const { data: data2, notes } = migrate(parsed);
  if ((parsed.schemaVersion || 2) < SCHEMA_VERSION || from === LEGACY_KEY) {
    try {
      if (!localStorage.getItem(SAFETY_KEY)) localStorage.setItem(SAFETY_KEY, raw);
    } catch {
    }
  }
  return { data: data2, ok: true, notes };
}
function saveData(data2) {
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify({ ...data2, schemaVersion: SCHEMA_VERSION }));
    return { ok: true };
  } catch (e) {
    return { ok: false, error: e && e.name === "QuotaExceededError" ? "Storage is full. Export a backup, then delete old card photos." : "Saving failed \u2014 storage is blocked." };
  }
}
var pref = {
  get(k, d) {
    try {
      const v = localStorage.getItem("attest-pref-" + k);
      return v === null ? d : JSON.parse(v);
    } catch {
      return d;
    }
  },
  set(k, v) {
    try {
      localStorage.setItem("attest-pref-" + k, JSON.stringify(v));
    } catch {
    }
  }
};
async function requestPersistence() {
  try {
    if (navigator.storage && navigator.storage.persist) return await navigator.storage.persist();
  } catch {
  }
  return false;
}
function db() {
  return new Promise((resolve, reject) => {
    if (!("indexedDB" in window)) return reject(new Error("IndexedDB unavailable"));
    const req = indexedDB.open("pocket-card-photos", 1);
    req.onupgradeneeded = () => {
      if (!req.result.objectStoreNames.contains("photos")) req.result.createObjectStore("photos");
    };
    req.onsuccess = () => resolve(req.result);
    req.onerror = () => reject(req.error);
  });
}
async function tx(mode, fn) {
  const d = await db();
  return new Promise((resolve, reject) => {
    const t = d.transaction("photos", mode);
    const r = fn(t.objectStore("photos"));
    t.oncomplete = () => {
      d.close();
      resolve(r && "result" in r ? r.result : void 0);
    };
    t.onerror = () => {
      d.close();
      reject(t.error);
    };
  });
}
var photos = {
  put: (id, dataUrl) => tx("readwrite", (s) => s.put(dataUrl, id)),
  get: (id) => tx("readonly", (s) => s.get(id)).then((v) => v || null),
  del: (id) => tx("readwrite", (s) => s.delete(id)),
  keys: () => tx("readonly", (s) => s.getAllKeys()).then((v) => v || [])
};
async function buildBackup(data2, includePhotos) {
  const out = { format: "attest-golf-backup", version: SCHEMA_VERSION, exportedAt: (/* @__PURE__ */ new Date()).toISOString(), data: { ...data2, draft: null } };
  if (includePhotos) {
    out.photos = {};
    for (const r of data2.rounds) {
      try {
        const p = await photos.get(r.id);
        if (p) out.photos[r.id] = p;
      } catch {
      }
    }
  }
  return JSON.stringify(out);
}
function planRestore(current, text) {
  let parsed;
  try {
    parsed = JSON.parse(text);
  } catch {
    throw new Error("That file is not a valid backup (it isn\u2019t JSON).");
  }
  const src = parsed && parsed.data && Array.isArray(parsed.data.rounds) ? parsed.data : parsed;
  if (!src || !Array.isArray(src.rounds)) throw new Error("That file doesn\u2019t contain Attest Golf rounds.");
  const { data: incoming } = migrate(src);
  const ids = new Set(current.rounds.map((r) => r.id));
  const newRounds = incoming.rounds.filter((r) => !ids.has(r.id));
  const keys = new Set(current.courses.map((c) => courseKey(c.name, c.tees, c.teeGender)));
  const newCourses = incoming.courses.filter((c) => !keys.has(courseKey(c.name, c.tees, c.teeGender)));
  const pids = new Set(current.practices.map((p) => p.id));
  const newPractices = incoming.practices.filter((p) => !pids.has(p.id));
  const photoMap = parsed.photos && typeof parsed.photos === "object" ? parsed.photos : {};
  return {
    newRounds,
    newCourses,
    newPractices,
    duplicates: incoming.rounds.length - newRounds.length,
    photos: Object.entries(photoMap).filter(([k, v]) => typeof k === "string" && typeof v === "string" && /^data:image\/(jpeg|png|webp);base64,/.test(v)),
    profile: incoming.profile
  };
}
async function applyRestore(current, plan) {
  current.rounds.push(...plan.newRounds.map(normalizeRound));
  current.courses.push(...plan.newCourses);
  current.practices.push(...plan.newPractices);
  if (!current.profile.name && plan.profile?.name) current.profile = { ...current.profile, ...plan.profile };
  let restoredPhotos = 0;
  for (const [id, v] of plan.photos) {
    try {
      await photos.put(id, v);
      restoredPhotos++;
    } catch {
    }
  }
  return restoredPhotos;
}
var csvCell = (v) => {
  let s = String(v ?? "");
  if (/^[=+\-@\t\r]/.test(s)) s = "'" + s;
  return '"' + s.replace(/"/g, '""') + '"';
};
function buildCSV(rounds) {
  const cols = ["date", "course", "tees", "rating", "slope", "hole", "par", "yardage", "stroke_index", "score", "putts", "penalties", "fairway", "first_putt_zone", "gir_estimate", "gir_source", "approach_miss", "contact", "short_putt_missed", "round_id"];
  const lines = [cols.join(",")];
  for (const r of rounds) holesPlayed(r).forEach((h, i) => {
    const g = girInfo(h);
    lines.push([r.date, r.course, r.tees, r.rating, r.slope, i + 1, h.par, h.yardage, h.handicap, h.score, h.putts, h.penalties, h.fairway, h.puttZone, g.value || "", g.value ? g.source : g.flag === "no-score" ? "" : g.flag, h.approach, h.strike, h.shortMiss === "" ? "" : h.shortMiss ? "Y" : "N", r.id].map(csvCell).join(","));
  });
  return lines.join("\r\n");
}

// js/api.js
var ROOT = "./.netlify/functions/";
var params = new URLSearchParams(location.search);
var MOCK = params.get("mock") === "1" || params.get("demo") === "1";
async function call(path, { body, headers = {}, timeout = 2e4 } = {}) {
  if (!navigator.onLine) throw Object.assign(new Error("You\u2019re offline. This needs an internet connection \u2014 manual entry and saved courses still work."), { code: "offline" });
  const ctl = new AbortController();
  const t = setTimeout(() => ctl.abort(), timeout);
  try {
    const res = await fetch(ROOT + path, {
      method: body ? "POST" : "GET",
      headers: body ? { "Content-Type": "application/json", ...headers } : headers,
      body: body ? JSON.stringify(body) : void 0,
      signal: ctl.signal
    });
    let json = null;
    try {
      json = await res.json();
    } catch {
    }
    if (!res.ok) {
      const fallback = res.status === 404 ? "The online service isn\u2019t deployed with this site. Deploy through GitHub so Netlify Functions are included." : res.status === 502 || res.status === 504 ? "The server took too long or failed. Try again, or enter it manually." : `Request failed (${res.status}).`;
      throw Object.assign(new Error(json?.error || fallback), { code: json?.code || res.status });
    }
    if (!json) throw new Error("The server returned an unreadable response.");
    return json;
  } catch (e) {
    if (e.name === "AbortError") throw Object.assign(new Error("No response from the server. Check your connection and try again."), { code: "timeout" });
    throw e;
  } finally {
    clearTimeout(t);
  }
}
function loadImage(file) {
  return new Promise((resolve, reject) => {
    const url = URL.createObjectURL(file);
    const img = new Image();
    img.onload = () => {
      URL.revokeObjectURL(url);
      resolve(img);
    };
    img.onerror = () => {
      URL.revokeObjectURL(url);
      reject(new Error("That photo couldn\u2019t be opened. Try a JPEG or take a new photo."));
    };
    img.src = url;
  });
}
function draw(img, sx, sy, sw, sh, maxEdge, q = 0.82) {
  const scale = Math.min(1, maxEdge / Math.max(sw, sh));
  const c = document.createElement("canvas");
  c.width = Math.max(1, Math.round(sw * scale));
  c.height = Math.max(1, Math.round(sh * scale));
  const ctx = c.getContext("2d");
  ctx.fillStyle = "#fff";
  ctx.fillRect(0, 0, c.width, c.height);
  ctx.drawImage(img, sx, sy, sw, sh, 0, 0, c.width, c.height);
  return c.toDataURL("image/jpeg", q);
}
async function prepareImage(file) {
  if (!file || !/^image\//.test(file.type || "image/")) throw new Error("Choose a photo.");
  if (file.size > 25 * 1024 * 1024) throw new Error("That photo is over 25 MB. Take a new photo with the camera.");
  const img = await loadImage(file);
  const w = img.naturalWidth, h = img.naturalHeight;
  const full = draw(img, 0, 0, w, h, 2e3);
  if (w >= h * 1.25) {
    const half = Math.round(w * 0.56);
    return { full, front: draw(img, 0, 0, half, h, 1600), back: draw(img, w - half, 0, half, h, 1600), split: true };
  }
  const one = draw(img, 0, 0, w, h, 2e3);
  return { full, front: one, back: one, split: false };
}
function mockScan(kind, half) {
  const holes = half === "front" ? [1, 2, 3, 4, 5, 6, 7, 8, 9] : [10, 11, 12, 13, 14, 15, 16, 17, 18];
  const base = { 1: [5, 2, "R", 0, "C"], 2: [6, 2, "H", 0, "D"], 3: [3, 2, "NA", 0, "D"], 4: [5, 3, "H", 0, "E"], 5: [5, 2, "L", 0, "B"], 6: [4, 1, "NA", 0, "B"], 7: [7, 2, "R", 1, "C"], 8: [4, 2, "H", 0, "C"], 9: [5, 2, "R", 0, "B"], 10: [4, 2, "H", 0, "C"], 11: [5, 1, "R", 0, "A"], 12: [3, 2, "NA", 0, "D"], 13: [6, 3, "H", 0, "E"], 14: [4, 2, "H", 0, "C"], 15: [5, 2, "R", 0, "B"], 16: [4, 2, "NA", 0, "D"], 17: [5, 1, "H", 0, "B"], 18: [5, 2, "L", 0, "C"] };
  return {
    mock: true,
    kind,
    half,
    requiresReview: true,
    warnings: ["Mocked reading for testing \u2014 not produced by an AI model."],
    holes: holes.map((n) => {
      const [score, putts, fairway, penalties, zone] = base[n];
      const status = { score: "read", putts: "read", fairway: "read", penalties: "read", puttZone: "read" };
      const values = { score, putts, fairway, penalties, puttZone: zone };
      if (n === 4) status.putts = "uncertain";
      if (n === 13) {
        values.score = null;
        status.score = "unclear";
      }
      if (n === 16) {
        values.puttZone = null;
        status.puttZone = "blank";
      }
      if (kind === "detailed") Object.assign(values, { approach: fairway === "H" ? null : "S", strike: "Solid", shortMiss: false }), Object.assign(status, { approach: fairway === "H" ? "blank" : "read", strike: "read", shortMiss: "read" });
      return { hole: n, values, status };
    })
  };
}
async function readCard(kind, prepared, { accessCode = "", tee = "" } = {}) {
  const halves = ["front", "back"];
  const run = (half) => MOCK ? new Promise((r) => setTimeout(() => r(kind === "course" ? mockCourseCard(half) : mockScan(kind, half)), 700)) : call("read-card", { body: { image: prepared[half], kind, half, tee }, headers: accessCode ? { "x-attest-code": accessCode } : {}, timeout: 25e3 });
  const results = await Promise.allSettled(halves.map(run));
  const out = { holes: [], warnings: [], errors: {}, mock: MOCK, provider: "" };
  results.forEach((r, i) => {
    if (r.status === "fulfilled") {
      out.holes.push(...r.value.holes);
      out.warnings.push(...r.value.warnings || []);
      out.provider = r.value.provider || out.provider;
    } else out.errors[halves[i]] = r.reason?.message || "Failed";
  });
  if (!out.holes.length) {
    const msg = Object.values(out.errors)[0] || "The card could not be read.";
    throw Object.assign(new Error(msg), { code: results[0].reason?.code });
  }
  out.warnings = [...new Set(out.warnings)];
  return out;
}
function mockCourseCard(half) {
  const c = DEMO_COURSES[0];
  const holes = half === "front" ? [1, 2, 3, 4, 5, 6, 7, 8, 9] : [10, 11, 12, 13, 14, 15, 16, 17, 18];
  return { mock: true, half, warnings: ["Mocked reading for testing \u2014 not produced by an AI model."], holes: holes.map((n) => ({ hole: n, values: { par: c.par[n - 1], yardage: n === 7 ? null : c.yds[n - 1], handicap: c.si[n - 1] }, status: { par: "read", yardage: n === 7 ? "unclear" : "read", handicap: "read" } })) };
}
async function searchCourses(q) {
  if (MOCK) {
    await new Promise((r) => setTimeout(r, 300));
    const s = q.toLowerCase();
    return { mock: true, courses: DEMO_COURSES.map((c, i) => ({ id: 900 + i, name: c.name + " (fictional)", location: "Mock data" })).filter((c) => c.name.toLowerCase().includes(s.split(" ")[0])) };
  }
  return call("course-search?q=" + encodeURIComponent(q), { timeout: 12e3 });
}
async function courseDetail(id) {
  if (MOCK) {
    const c = DEMO_COURSES[Number(id) - 900];
    if (!c) throw new Error("Not found");
    const tee = (name, gender, rating, slope, missingSI) => ({ key: gender + name, name, gender, rating, slope, holes: c.par.map((p, i) => ({ hole: i + 1, par: p, yardage: c.yds[i] - (gender === "F" ? 60 : 0), handicap: missingSI && i === 4 ? null : c.si[i] })) });
    return { mock: true, id, name: c.name + " (fictional)", location: "Mock data", tees: [tee(c.tees, "M", c.rating, c.slope), tee(c.tees, "F", c.rating + 4.1, c.slope + 7, true)] };
  }
  return call("course-search?id=" + encodeURIComponent(id), { timeout: 12e3 });
}

// js/card.js
var esc = (s) => String(s ?? "").replace(/[&<>"']/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" })[c]);
var CARD = {
  width: 10.4,
  panel: 5.2,
  pad: 0.12,
  label: 0.58,
  rows: {
    hole: 0.25,
    par: 0.21,
    yds: 0.19,
    hcp: 0.17,
    parBlank: 0.27,
    score: 0.42,
    putts: 0.36,
    fairway: 0.31,
    penalty: 0.31,
    zone: 0.5,
    approach: 0.5,
    contact: 0.5,
    short: 0.31
  }
};
var cardCSS = `
.ag-sheet{width:10.5in;margin:0 auto;display:flex;flex-direction:column;align-items:center;gap:.42in;font-family:"Helvetica Neue",Helvetica,Arial,sans-serif;color:#000;-webkit-print-color-adjust:exact;print-color-adjust:exact}
.ag-card{position:relative;width:${CARD.width}in;display:grid;grid-template-columns:${CARD.panel}in ${CARD.panel}in;border:.6pt solid #000;box-sizing:border-box;background:#fff}
.ag-panel{padding:${CARD.pad}in ${CARD.pad}in .1in;box-sizing:border-box;display:flex;flex-direction:column}
.ag-fold{position:absolute;top:0;bottom:0;left:50%;border-left:.6pt dashed #777}
.ag-fold-label{position:absolute;left:50%;transform:translateX(-50%);font-size:6pt;letter-spacing:.08em;color:#555;background:#fff;padding:0 3pt}
.ag-fold-label.t{top:-.17in}.ag-fold-label.b{bottom:-.17in}
.ag-crop{position:absolute;width:.16in;height:.16in}
.ag-crop.tl{top:-.22in;left:-.22in;border-right:.4pt solid #000;border-bottom:.4pt solid #000}
.ag-crop.tr{top:-.22in;right:-.22in;border-left:.4pt solid #000;border-bottom:.4pt solid #000}
.ag-crop.bl{bottom:-.22in;left:-.22in;border-right:.4pt solid #000;border-top:.4pt solid #000}
.ag-crop.br{bottom:-.22in;right:-.22in;border-left:.4pt solid #000;border-top:.4pt solid #000}
.ag-reg{position:absolute;width:.12in;height:.12in}
.ag-reg.tl{top:.04in;left:.04in;border-top:1.6pt solid #000;border-left:1.6pt solid #000}
.ag-reg.tr{top:.04in;right:.04in;border-top:1.6pt solid #000;border-right:1.6pt solid #000}
.ag-reg.bl{bottom:.04in;left:.04in;border-bottom:1.6pt solid #000;border-left:1.6pt solid #000}
.ag-reg.br{bottom:.04in;right:.04in;border-bottom:1.6pt solid #000;border-right:1.6pt solid #000}
.ag-head{display:flex;align-items:flex-end;justify-content:space-between;gap:.08in;height:.3in;margin:0 0 .05in;font-size:7pt;line-height:1.15}
.ag-brand{font-weight:800;font-size:9pt;letter-spacing:-.01em;white-space:nowrap}
.ag-brand small{display:block;font-weight:600;font-size:6pt;letter-spacing:.12em;color:#333}
.ag-meta{text-align:right;flex:1;min-width:0}
.ag-meta b{font-size:8pt}
.ag-line{display:inline-block;border-bottom:.5pt solid #000;min-width:.8in;height:.13in;vertical-align:bottom}
.ag-grid{border-collapse:collapse;table-layout:fixed;width:${CARD.panel - CARD.pad * 2}in}
.ag-grid col.l{width:${CARD.label}in}
.ag-grid th,.ag-grid td{border:.5pt solid #000;padding:0;text-align:center;vertical-align:middle;overflow:hidden}
.ag-grid th.rl{text-align:left;padding-left:.04in;font-size:6.6pt;font-weight:800;letter-spacing:.02em;line-height:1.05}
.ag-grid th.rl small{display:block;font-size:6pt;font-weight:600;letter-spacing:0;color:#222}
.ag-grid thead th{font-size:10.5pt;font-weight:800;height:${CARD.rows.hole}in}
.ag-grid thead th.rl{font-size:6.6pt}
.ag-grid tr.pre td{font-size:7.5pt;font-weight:700}
.ag-grid tr.pre.yds td,.ag-grid tr.pre.hcp td{font-size:6.5pt;font-weight:500}
.ag-grid tr.pre th.rl,.ag-grid tr.pre td{border-color:#000}
.ag-grid tr.write td{background:#fff}
.ag-grid tr.thick td,.ag-grid tr.thick th{border-top-width:1.2pt}
.ag-opts{display:flex;flex-wrap:wrap;justify-content:space-evenly;align-content:space-evenly;height:100%;padding:0 .03in;font-size:8.2pt;font-weight:700;letter-spacing:.01em}
.ag-opts span{display:inline-block;min-width:.13in;text-align:center;line-height:1}
.ag-opts.two span{width:45%}
.ag-opts.three span{width:31%}
.ag-na{font-size:7pt;color:#666}
.ag-legend{margin-top:.06in;font-size:6.9pt;line-height:1.32;color:#000}
.ag-legend b{font-weight:800}
.ag-code{position:absolute;bottom:.05in;right:.24in;font-size:6pt;letter-spacing:.1em;color:#444}
`;
function rowHTML(label, sub, cls, height, cells) {
  return `<tr class="${cls}" style="height:${height}in"><th class="rl">${label}${sub ? `<small>${sub}</small>` : ""}</th>${cells.join("")}</tr>`;
}
var opts = (list, layout = "") => `<div class="ag-opts ${layout}">${list.map((x) => `<span>${x}</span>`).join("")}</div>`;
function panelHTML({ start, course, detailed, front, code }) {
  const R = CARD.rows;
  const idx = Array.from({ length: 9 }, (_, i) => start + i);
  const hole = (i) => course?.holes?.[i] || {};
  const hasPar = course && idx.every((i) => hole(i).par);
  const hasYds = course && idx.some((i) => hole(i).yardage);
  const hasHcp = course && idx.some((i) => hole(i).handicap);
  const rows = [];
  rows.push(rowHTML("PAR", "", hasPar ? "pre" : "write", hasPar ? R.par : R.parBlank, idx.map((i) => `<td>${hasPar ? esc(hole(i).par) : ""}</td>`)));
  if (hasYds) rows.push(rowHTML("YDS", "", "pre yds", R.yds, idx.map((i) => `<td>${esc(hole(i).yardage || "")}</td>`)));
  if (hasHcp) rows.push(rowHTML("HCP", "", "pre hcp", R.hcp, idx.map((i) => `<td>${esc(hole(i).handicap || "")}</td>`)));
  rows.push(rowHTML("SCORE", "incl. penalties", "write thick", R.score, idx.map(() => "<td></td>")));
  rows.push(rowHTML("PUTTS", "on green only", "write", R.putts, idx.map(() => "<td></td>")));
  rows.push(rowHTML("FAIRWAY", "circle one", "write", R.fairway, idx.map((i) => `<td>${hasPar && Number(hole(i).par) === 3 ? '<span class="ag-na">\u2014</span>' : opts(["H", "L", "R"])}</td>`)));
  rows.push(rowHTML("PENALTY", "strokes", "write", R.penalty, idx.map(() => "<td></td>")));
  rows.push(rowHTML("1ST PUTT", "circle zone", "write", R.zone, idx.map(() => `<td>${opts(["A", "B", "C", "D", "E"], "three")}</td>`)));
  if (detailed) {
    rows.push(rowHTML("APPROACH", "if green missed", "write thick", R.approach, idx.map(() => `<td>${opts(["SH", "LG", "LT", "RT"], "two")}</td>`)));
    rows.push(rowHTML("CONTACT", "approach", "write", R.contact, idx.map(() => `<td>${opts(["SOL", "FAT", "THN"], "two")}</td>`)));
    rows.push(rowHTML("SHORT MISS", "\u2264 5 ft putt", "write", R.short, idx.map(() => `<td>${opts(["Y", "N"])}</td>`)));
  }
  const name = course ? `<b>${esc(course.name)}</b> \xB7 ${esc(course.tees || "")}` : 'Course <span class="ag-line" style="min-width:1.5in"></span> Tees <span class="ag-line" style="min-width:.5in"></span>';
  const head = front ? `<div class="ag-head"><div class="ag-brand">ATTEST GOLF<small>${detailed ? "DETAILED CARD" : "POCKET CARD"} \xB7 HOLES 1\u20139 \xB7 ${code}</small></div><div class="ag-meta">${name}<br>Date <span class="ag-line" style="min-width:.75in"></span></div></div>` : `<div class="ag-head"><div class="ag-brand">HOLES 10\u201318<small>${course ? esc(course.name).toUpperCase().slice(0, 34) : "ATTEST GOLF"}</small></div><div class="ag-meta">Name <span class="ag-line" style="min-width:1.25in"></span></div></div>`;
  const legend = front ? `<div class="ag-legend"><b>FAIRWAY</b> H hit \xB7 L left \xB7 R right. <b>1ST PUTT</b> length of your first putt: <b>A</b> under 3 ft \xB7 <b>B</b> 3\u20136 \xB7 <b>C</b> 6\u201315 \xB7 <b>D</b> 15\u201330 \xB7 <b>E</b> 30+.</div>` : `<div class="ag-legend"><b>PUTTS</b> count only strokes on the green. Leave a box empty if you didn\u2019t track it \u2014 don\u2019t write 0 unless it was 0.${detailed ? " <b>APPROACH</b> SH short \xB7 LG long \xB7 LT left \xB7 RT right (circle only if the green was missed). <b>CONTACT</b> solid / fat / thin." : ""}</div>`;
  return `<div class="ag-panel">${head}<table class="ag-grid"><colgroup><col class="l">${idx.map(() => "<col>").join("")}</colgroup><thead><tr><th class="rl">HOLE</th>${idx.map((i) => `<th>${i + 1}</th>`).join("")}</tr></thead><tbody>${rows.join("")}</tbody></table>${legend}</div>`;
}
function cardHTML({ course = null, detailed = false } = {}) {
  const code = `AG-${detailed ? "D" : "B"}2`;
  return `<article class="ag-card" data-layout="${code}">${panelHTML({ start: 0, course, detailed, front: true, code })}${panelHTML({ start: 9, course, detailed, front: false })}<div class="ag-fold"></div><i class="ag-crop tl"></i><i class="ag-crop tr"></i><i class="ag-crop bl"></i><i class="ag-crop br"></i><i class="ag-reg tl"></i><i class="ag-reg tr"></i><i class="ag-reg bl"></i><i class="ag-reg br"></i></article>`;
}
function sheetHTML({ course = null, detailed = false } = {}) {
  const n = detailed ? 1 : 2;
  return `<div class="ag-sheet">${Array.from({ length: n }, () => cardHTML({ course, detailed })).join("")}</div>`;
}

// js/share.js
var FONT = '-apple-system, BlinkMacSystemFont, "SF Pro Display", "Helvetica Neue", Arial, sans-serif';
function drawShareCard(canvas, d, opts2) {
  const W = 1080, H = 1350;
  canvas.width = W;
  canvas.height = H;
  const c = canvas.getContext("2d");
  const green = "#1D5A3E", ink = "#14201A", muted = "#5D6A62", line = "#DFE4DE";
  c.fillStyle = "#F5F6F3";
  c.fillRect(0, 0, W, H);
  c.fillStyle = "#FFFFFF";
  roundRect(c, 60, 60, W - 120, H - 120, 36);
  c.fill();
  c.strokeStyle = line;
  c.lineWidth = 2;
  c.stroke();
  c.fillStyle = green;
  c.fillRect(60, 60, W - 120, 14);
  let y = 170;
  c.fillStyle = ink;
  c.font = `600 44px ${FONT}`;
  c.fillText(trim(c, d.name || "Golfer", W - 240), 120, y);
  c.fillStyle = muted;
  c.font = `400 34px ${FONT}`;
  y += 56;
  c.fillText(trim(c, d.course, W - 240), 120, y);
  y += 46;
  c.fillText(trim(c, [d.tees, d.date].filter(Boolean).join(", "), W - 240), 120, y);
  y += 200;
  c.fillStyle = ink;
  c.font = `700 220px ${FONT}`;
  c.fillText(String(d.gross ?? "\u2014"), 112, y);
  const gw = c.measureText(String(d.gross ?? "\u2014")).width;
  c.font = `500 52px ${FONT}`;
  c.fillStyle = green;
  if (d.toPar !== null && d.toPar !== void 0) c.fillText(d.toPar > 0 ? `+${d.toPar}` : d.toPar === 0 ? "Even" : `${d.toPar}`, 140 + gw, y - 120);
  c.fillStyle = muted;
  c.font = `400 32px ${FONT}`;
  const sub = [];
  if (opts2.net && d.net !== null && d.net !== void 0) sub.push(`Net ${d.net}`);
  if (opts2.handicap && d.index !== null && d.index !== void 0) sub.push(`Est. handicap ${d.index.toFixed(1)}*`);
  if (sub.length) c.fillText(sub.join("    "), 140 + gw, y - 40);
  y += 90;
  const stats = [];
  if (opts2.fairways && d.fairways) stats.push(["Fairways", d.fairways]);
  if (opts2.gir && d.gir) stats.push(["Greens (est.)", d.gir]);
  if (opts2.putts && d.putts) stats.push(["Putts", d.putts]);
  if (opts2.penalties && d.penalties !== null && d.penalties !== void 0) stats.push(["Penalty strokes", String(d.penalties)]);
  const colW = (W - 240) / 2;
  stats.forEach(([k, v], i) => {
    const x = 120 + i % 2 * colW, yy = y + Math.floor(i / 2) * 150;
    c.strokeStyle = line;
    c.beginPath();
    c.moveTo(x, yy);
    c.lineTo(x + colW - 30, yy);
    c.stroke();
    c.fillStyle = muted;
    c.font = `400 30px ${FONT}`;
    c.fillText(k, x, yy + 48);
    c.fillStyle = ink;
    c.font = `600 56px ${FONT}`;
    c.fillText(v, x, yy + 115);
  });
  y += Math.ceil(stats.length / 2) * 150 + 40;
  if (opts2.highlight && d.highlight) {
    c.fillStyle = "#E7EFEA";
    roundRect(c, 120, y, W - 240, 130, 20);
    c.fill();
    c.fillStyle = green;
    c.font = `600 34px ${FONT}`;
    wrap(c, d.highlight, 150, y + 55, W - 300, 42, 2);
  }
  c.fillStyle = muted;
  c.font = `400 24px ${FONT}`;
  c.fillText(opts2.handicap && d.index !== null && d.index !== void 0 ? "Attest Golf  \xB7  *Unofficial estimate, not a USGA Handicap Index" : "Attest Golf", 120, H - 110);
  return canvas;
}
function roundRect(c, x, y, w, h, r) {
  c.beginPath();
  c.moveTo(x + r, y);
  c.arcTo(x + w, y, x + w, y + h, r);
  c.arcTo(x + w, y + h, x, y + h, r);
  c.arcTo(x, y + h, x, y, r);
  c.arcTo(x, y, x + w, y, r);
  c.closePath();
}
function trim(c, s, max) {
  s = String(s || "");
  if (c.measureText(s).width <= max) return s;
  while (s.length && c.measureText(s + "\u2026").width > max) s = s.slice(0, -1);
  return s + "\u2026";
}
function wrap(c, text, x, y, max, lh, lines) {
  const words = String(text).split(" ");
  let line = "", n = 0;
  for (const w of words) {
    const t = line ? line + " " + w : w;
    if (c.measureText(t).width > max && line) {
      c.fillText(line, x, y + n * lh);
      line = w;
      if (++n >= lines) return;
    } else line = t;
  }
  if (line && n < lines) c.fillText(line, x, y + n * lh);
}
async function shareCanvas(canvas, filename) {
  const blob = await new Promise((r) => canvas.toBlob(r, "image/png"));
  const file = new File([blob], filename, { type: "image/png" });
  if (navigator.canShare && navigator.canShare({ files: [file] })) {
    try {
      await navigator.share({ files: [file], title: "My round" });
      return "shared";
    } catch (e) {
      if (e.name === "AbortError") return "cancelled";
    }
  }
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = filename;
  document.body.appendChild(a);
  a.click();
  a.remove();
  setTimeout(() => URL.revokeObjectURL(url), 3e4);
  return "downloaded";
}
async function shareOrDownloadText(text, filename, type) {
  const file = new File([text], filename, { type });
  if (navigator.canShare && navigator.canShare({ files: [file] })) {
    try {
      await navigator.share({ files: [file], title: filename });
      return "shared";
    } catch (e) {
      if (e.name === "AbortError") return "cancelled";
    }
  }
  const url = URL.createObjectURL(file);
  const a = document.createElement("a");
  a.href = url;
  a.download = filename;
  document.body.appendChild(a);
  a.click();
  a.remove();
  setTimeout(() => URL.revokeObjectURL(url), 3e4);
  return "downloaded";
}

// js/ui.js
var esc2 = (s) => String(s ?? "").replace(/[&<>"']/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" })[c]);
var pct = (x) => x === null || x === void 0 ? "\u2014" : `${Math.round(x * 100)}%`;
var f12 = (x) => x === null || x === void 0 ? "\u2014" : (Math.round(x * 10) / 10).toFixed(1);
var signed = (x) => x === null || x === void 0 ? "\u2014" : x > 0 ? `+${x}` : x === 0 ? "E" : `${x}`;
var signed1 = (x) => x === null || x === void 0 ? "\u2014" : x > 0.05 ? `+${f12(x)}` : x < -0.05 ? `\u2212${f12(-x)}` : "0.0";
var plural2 = (n, w, p = w + "s") => `${n} ${n === 1 ? w : p}`;
function dateLabel(iso, opts2 = { month: "short", day: "numeric", year: "numeric" }) {
  const d = /* @__PURE__ */ new Date(iso + "T12:00:00");
  return Number.isNaN(d.getTime()) ? iso : d.toLocaleDateString(void 0, opts2);
}
var P = {
  home: '<path d="M3.5 10.5 12 4l8.5 6.5"/><path d="M5.5 9v10.5h13V9"/><path d="M10 19.5v-5h4v5"/>',
  rounds: '<rect x="3.5" y="5" width="17" height="14" rx="2"/><path d="M3.5 10h17M9 5v14M14.5 5v14"/>',
  insights: '<path d="M4 20V10M10 20V4M16 20v-7M21 20H3"/>',
  practice: '<circle cx="12" cy="12" r="8.5"/><circle cx="12" cy="12" r="4.5"/><circle cx="12" cy="12" r="1" fill="currentColor"/>',
  more: '<path d="M4 7h10M18 7h2M4 17h4M12 17h8"/><circle cx="16" cy="7" r="2"/><circle cx="10" cy="17" r="2"/>',
  plus: '<path d="M12 5v14M5 12h14"/>',
  camera: '<path d="M4 8h3l1.5-2.5h7L17 8h3v11H4z"/><circle cx="12" cy="13" r="3.5"/>',
  pencil: '<path d="M4 20l1-4L16 5l3 3L8 19z"/><path d="M14 7l3 3"/>',
  close: '<path d="M6 6l12 12M18 6 6 18"/>',
  back: '<path d="M15 5l-7 7 7 7"/>',
  chevron: '<path d="M9 5l7 7-7 7"/>',
  search: '<circle cx="11" cy="11" r="6.5"/><path d="m20 20-4.2-4.2"/>',
  print: '<path d="M7 9V4h10v5"/><rect x="4" y="9" width="16" height="7" rx="1.5"/><path d="M7 14h10v6H7z"/>',
  share: '<path d="M12 15V4M8 8l4-4 4 4"/><path d="M5 12v7.5h14V12"/>',
  download: '<path d="M12 4v11M8 11l4 4 4-4"/><path d="M5 19.5h14"/>',
  upload: '<path d="M12 15V4M8 8l4-4 4 4"/><path d="M5 19.5h14"/>',
  flag: '<path d="M6 21V4"/><path d="M6 4h11l-2.5 4L17 12H6"/>',
  check: '<path d="m5 12.5 4.5 4.5L19 7.5"/>',
  alert: '<path d="M12 4 2.8 19.5h18.4z"/><path d="M12 10v4.5M12 17.2v.3"/>',
  trash: '<path d="M5 7h14M10 7V4.5h4V7M7 7l1 13h8l1-13"/>',
  info: '<circle cx="12" cy="12" r="8.5"/><path d="M12 11v5.5M12 8v.3"/>',
  wifi: '<path d="M3 9a13 13 0 0 1 18 0M6 12.5a8.5 8.5 0 0 1 12 0M9 16a4 4 0 0 1 6 0"/><path d="M12 19.5v.2"/>'
};
var icon = (name, size = 22) => `<svg class="ic" width="${size}" height="${size}" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.7" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">${P[name] || ""}</svg>`;
function scoreMark(score, par) {
  if (score === "" || score == null) return '<span class="mk empty">\xB7</span>';
  if (par === "" || par == null) return `<span class="mk">${score}</span>`;
  const d = score - par;
  const cls = d <= -2 ? "eagle" : d === -1 ? "birdie" : d === 0 ? "par" : d === 1 ? "bogey" : "double";
  return `<span class="mk ${cls}">${score}</span>`;
}
var FW_SHOW = { H: '<span class="fw-hit" aria-label="hit">\u25CF</span>', L: '<span aria-label="left">\u2190</span>', R: '<span aria-label="right">\u2192</span>', NA: "" };
function scorecardGrid(r, { showPutts = true, compact = false } = {}) {
  const hs = holesPlayed(r);
  const anyPen = hs.some((h) => h.penalties > 0);
  const anyGirFlag = hs.some((h) => ["holed-out", "approach-conflict"].includes(girInfo(h).flag));
  const nine = (start) => {
    const idx = Array.from({ length: 9 }, (_, i) => start + i).filter((i) => i < hs.length);
    if (!idx.length) return "";
    const sumOf = (k) => {
      const v = idx.map((i) => hs[i][k]);
      return v.every((x) => x !== "") ? v.reduce((a, b) => a + b, 0) : "";
    };
    const label = start === 0 ? "Out" : "In";
    const tot = nineTotal(r, start);
    const row2 = (name, cells, total2 = "", cls = "") => `<tr class="${cls}"><th scope="row">${name}</th>${cells.join("")}<td class="tot">${total2}</td></tr>`;
    return `<table class="sc">
      <thead><tr><th scope="col">Hole</th>${idx.map((i) => `<th scope="col">${i + 1}</th>`).join("")}<th class="tot" scope="col">${label}</th></tr></thead>
      <tbody>
      ${row2("Par", idx.map((i) => `<td>${hs[i].par === "" ? '<span class="miss">?</span>' : hs[i].par}</td>`), sumOf("par"), "par")}
      ${row2("Score", idx.map((i) => `<td>${scoreMark(hs[i].score, hs[i].par)}</td>`), tot ?? "", "score")}
      ${showPutts ? row2("Putts", idx.map((i) => `<td>${hs[i].putts === "" ? "" : hs[i].putts}</td>`), sumOf("putts"), "sub") : ""}
      ${compact ? "" : row2("Fwy", idx.map((i) => `<td>${hs[i].par === 3 ? "" : FW_SHOW[hs[i].fairway] ?? ""}</td>`), "", "sub")}
      ${compact ? "" : row2("GIR", idx.map((i) => {
      const g = girInfo(hs[i]);
      return `<td>${g.value === "Y" ? '<span class="fw-hit">\u25CF</span>' : g.flag === "holed-out" || g.flag === "approach-conflict" ? '<span class="miss">?</span>' : ""}</td>`;
    }), "", "sub")}
      ${anyPen ? row2("Pen", idx.map((i) => `<td>${hs[i].penalties > 0 ? hs[i].penalties : ""}</td>`), "", "sub") : ""}
      </tbody></table>`;
  };
  const total = hs.every((h) => h.score !== "") ? gross(r) : null;
  return `<div class="sc-wrap">${nine(0)}${nine(9)}</div>
    <div class="sc-key"><span><span class="mk birdie">3</span> birdie</span><span><span class="mk bogey">5</span> bogey</span><span><span class="mk double">6</span> double+</span><span>\u25CF hit</span>${anyGirFlag ? '<span><span class="miss">?</span> GIR unclear</span>' : ""}${total !== null ? `<span class="sc-total">Total <b>${total}</b></span>` : ""}</div>`;
}
function trendChart(series, { height = 170 } = {}) {
  if (series.length < 2) return "";
  const pts = series.slice(-20);
  const vals = pts.map((p) => p.gross);
  const roll = vals.map((_, i) => {
    const w = vals.slice(Math.max(0, i - 4), i + 1);
    return w.reduce((a, b) => a + b, 0) / w.length;
  });
  const lo = Math.floor((Math.min(...vals) - 2) / 5) * 5, hi = Math.ceil((Math.max(...vals) + 2) / 5) * 5;
  const W = 340, H = height, L = 30, R = 8, T = 10, B = 22;
  const x = (i) => L + i * (W - L - R) / Math.max(1, pts.length - 1);
  const y = (v) => T + (hi - v) * (H - T - B) / (hi - lo || 1);
  const ticks = [];
  for (let v = lo; v <= hi; v += 5) ticks.push(v);
  const path = (arr) => arr.map((v, i) => `${i ? "L" : "M"}${x(i).toFixed(1)},${y(v).toFixed(1)}`).join("");
  return `<svg class="chart" viewBox="0 0 ${W} ${H}" role="img" aria-label="Scores for the last ${pts.length} complete rounds">
    ${ticks.map((v) => `<line x1="${L}" x2="${W - R}" y1="${y(v)}" y2="${y(v)}" class="grid"/><text x="${L - 6}" y="${y(v) + 4}" text-anchor="end" class="axis">${v}</text>`).join("")}
    <path d="${path(roll)}" class="roll"/>
    <path d="${path(vals)}" class="line"/>
    ${vals.map((v, i) => `<circle cx="${x(i)}" cy="${y(v)}" r="3" class="dot"/>`).join("")}
    <text x="${L}" y="${H - 5}" class="axis">${esc2(dateLabel(pts[0].date, { month: "short", day: "numeric" }))}</text>
    <text x="${W - R}" y="${H - 5}" text-anchor="end" class="axis">${esc2(dateLabel(pts[pts.length - 1].date, { month: "short", day: "numeric" }))}</text>
  </svg>`;
}
function splitBar(parts) {
  const total = parts.reduce((s, p) => s + p.value, 0);
  if (!total) return "";
  return `<div class="split" role="img" aria-label="${esc2(parts.map((p) => `${p.label} ${p.value}`).join(", "))}">${parts.filter((p) => p.value).map((p) => `<span class="bar-seg ${p.cls || ""}" style="flex:${p.value}"></span>`).join("")}</div>
  <div class="split-key">${parts.map((p) => `<span><i class="sw ${p.cls || ""}"></i>${esc2(p.label)} <b>${p.value}</b></span>`).join("")}</div>`;
}

// js/app.js
var VERSION = "2.0.0";
var params2 = new URLSearchParams(location.search);
var DEMO = params2.get("demo") === "1";
var data;
var bootNote = "";
if (DEMO) data = buildDemoData();
else {
  const r = loadData();
  data = r.data;
  bootNote = r.error || "";
}
var S = {
  hole: 0,
  scan: null,
  scanKind: pref.get("cardType", "basic"),
  prepared: null,
  photoUrl: "",
  scanBusy: false,
  courseResults: null,
  courseInfo: null,
  courseBusy: false,
  courseError: "",
  range: 10,
  practice: { minutes: 30, focus: null, active: null, results: {} },
  restorePlan: null,
  restoreError: "",
  share: { net: true, handicap: true, fairways: true, gir: true, putts: true, penalties: false, highlight: true },
  printType: pref.get("cardType", "basic"),
  printCourse: "",
  editCourseIdx: null,
  swWaiting: null
};
function persist() {
  if (DEMO) return true;
  const r = saveData(data);
  if (!r.ok) toast(r.error, "error");
  return r.ok;
}
var FLOWS = /* @__PURE__ */ new Set(["new", "course", "course-confirm", "entry", "scan", "scan-review", "review", "share", "onboarding"]);
function route() {
  const h = location.hash.replace(/^#\/?/, "");
  const [name, ...rest] = h.split("/");
  return { name: name || "home", arg: decodeURIComponent(rest.join("/") || "") };
}
function go(path, replace = false) {
  const url = "#/" + path;
  if (replace) history.replaceState(null, "", url);
  else history.pushState(null, "", url);
  render(true);
}
window.addEventListener("popstate", () => render(true));
var $ = (s, el = document) => el.querySelector(s);
function toast(msg, kind = "") {
  const t = $("#toast");
  t.textContent = msg;
  t.className = "toast show " + kind;
  clearTimeout(toast.t);
  toast.t = setTimeout(() => {
    t.className = "toast";
  }, kind === "error" ? 5e3 : 2600);
}
var TABS = [["home", "Home", "home"], ["rounds", "Rounds", "rounds"], ["insights", "Insights", "insights"], ["practice", "Practice", "practice"], ["more", "More", "more"]];
var TAB_OF = { round: "rounds", handicap: "more", courses: "more", "course-edit": "more", print: "more", backup: "more", about: "more", settings: "more" };
function applyTheme() {
  const t = pref.get("theme", "light");
  const dark = t === "dark" || t === "system" && matchMedia("(prefers-color-scheme: dark)").matches;
  document.documentElement.dataset.theme = dark ? "dark" : "light";
  $("meta[name=theme-color]").setAttribute("content", dark ? "#121915" : "#F5F6F3");
}
function render(scrollTop = false) {
  const r = route();
  if (!DEMO && !pref.get("onboarded", false) && !data.rounds.length && r.name === "home") return renderOnboarding();
  const flow = FLOWS.has(r.name);
  document.body.classList.toggle("in-flow", flow);
  const page = PAGES[r.name] || PAGES.home;
  let html;
  try {
    html = page(r.arg);
  } catch (e) {
    console.error(e);
    html = `<div class="page"><h1>Something went wrong</h1><p class="lead">${esc2(e.message)}</p><button class="btn" data-act="go" data-to="">Go home</button></div>`;
  }
  $("#view").innerHTML = (DEMO ? demoBanner() : "") + (S.swWaiting ? updateBanner() : "") + html;
  const active = TAB_OF[r.name] || r.name;
  $("#tabs").innerHTML = TABS.map(([k, label, ic]) => `<a href="#/${k === "home" ? "" : k}" class="tab ${active === k ? "on" : ""}" ${active === k ? 'aria-current="page"' : ""}>${icon(ic, 24)}<span>${label}</span></a>`).join("");
  if (scrollTop) window.scrollTo(0, 0);
  AFTER[r.name]?.(r.arg);
}
var demoBanner = () => `<div class="demo-bar" role="note"><span><b>Demo golfer.</b> Fictional rounds \u2014 nothing here is saved.</span><a class="btn small" href="./">Exit demo</a></div>`;
var updateBanner = () => `<div class="demo-bar update"><span>A new version is ready. Your rounds are not affected.</span><button class="btn small" data-act="sw-update">Update</button></div>`;
var backBtn = (to, label = "Back") => `<button class="nav-back" data-act="go" data-to="${to}" aria-label="${label}">${icon("back", 22)}<span>${label}</span></button>`;
var flowTop = (title, to, label = "Close") => `<header class="flow-top"><button class="icon-btn" data-act="go" data-to="${to}" aria-label="${label}">${icon(label === "Close" ? "close" : "back", 24)}</button><h1>${title}</h1><span class="spacer"></span></header>`;
var note = (text, kind = "") => `<div class="note ${kind}">${kind === "warn" ? icon("alert", 18) : icon("info", 18)}<div>${text}</div></div>`;
var row = (label, value, sub = "", href = "") => href ? `<a class="li link" href="${href}"><span class="li-main">${label}${sub ? `<small>${sub}</small>` : ""}</span><span class="li-val">${value}</span>${icon("chevron", 18)}</a>` : `<div class="li"><span class="li-main">${label}${sub ? `<small>${sub}</small>` : ""}</span><span class="li-val">${value}</span></div>`;
var complete18 = () => sortByDate(data.rounds).filter((r) => r.count === 18 && isComplete(r));
var hcpCache = null;
var hcpKey = "";
function hcp() {
  const k = data.rounds.map((r) => r.id + r.updatedAt).join();
  if (k !== hcpKey) {
    hcpCache = handicapHistory(data.rounds);
    hcpKey = k;
  }
  return hcpCache;
}
var PAGES = {};
var AFTER = {};
function renderOnboarding() {
  document.body.classList.add("in-flow");
  $("#tabs").innerHTML = "";
  $("#view").innerHTML = `<div class="page onboarding">
    <div class="brand-mark" aria-hidden="true">${icon("flag", 34)}</div>
    <h1>Attest Golf</h1>
    <p class="lead">Keep your phone in your bag. Mark a pocket card with a pencil as you play, photograph it afterwards, and see what to work on.</p>
    <ol class="steps">
      <li><b>Print a pocket card</b> \u2014 or use the course\u2019s own scorecard.</li>
      <li><b>Mark five things per hole</b>: score, putts, fairway, penalties, and how far your first putt was.</li>
      <li><b>Photograph the card</b> after the round. You check every reading before anything is saved.</li>
    </ol>
    <button class="btn primary block" data-act="onboard-done">Get started</button>
    <a class="btn block" href="?demo=1">Look around with a demo golfer</a>
    <p class="fine">Your rounds stay on this phone. Export a backup from time to time \u2014 there\u2019s no cloud account.</p>
  </div>`;
}
PAGES.home = () => {
  const name = data.profile?.name;
  const out = [];
  out.push(`<div class="page home"><header class="page-head"><p class="wordmark">Attest Golf</p><h1>${name ? `Hi, ${esc2(name.split(" ")[0])}` : "Your game"}</h1></header>`);
  if (bootNote) out.push(note(esc2(bootNote), "warn"));
  if (data.draft && holesPlayed(data.draft).some((h2) => h2.score !== "")) {
    const d = data.draft;
    out.push(`<div class="resume"><div><b>Unfinished round</b><small>${esc2(d.course || "Course not set")}, ${holesPlayed(d).filter((h2) => h2.score !== "").length} of ${d.count} holes</small></div><button class="btn small primary" data-act="resume">Resume</button></div>`);
  }
  if (!DEMO && data.rounds.length) {
    const since = data.rounds.length - (data.meta.roundsAtLastBackup || 0);
    const old = !data.meta.lastBackupAt || Date.now() - Date.parse(data.meta.lastBackupAt) > 30 * 864e5;
    if (since >= 3 || old && since > 0) out.push(`<a class="resume warn" href="#/backup"><div><b>Back up your rounds</b><small>${since} round${since === 1 ? "" : "s"} since your last backup. Safari can clear website data.</small></div>${icon("chevron", 18)}</a>`);
  }
  out.push(`<button class="btn primary block big" data-act="go" data-to="new">${icon("plus", 22)} Record a round</button>`);
  if (!data.rounds.length) {
    out.push(`<section class="group empty-state"><h2>No rounds yet</h2><p>Print a card before your next round, or enter a past round from a scorecard you kept.</p><div class="btn-row"><a class="btn" href="#/print">${icon("print", 20)} Print cards</a><a class="btn" href="?demo=1">See the demo</a></div></section></div>`);
    return out.join("");
  }
  const recent = complete18().slice(-10);
  const s = summarize(sortByDate(data.rounds).slice(-10));
  const h = hcp();
  const avg = recent.length ? recent.reduce((a, r) => a + gross(r), 0) / recent.length : null;
  out.push(`<section class="kpis">
    <div class="kpi"><span class="k-label">Scoring average</span><span class="k-val">${f12(avg)}</span><small>${recent.length ? `last ${plural2(recent.length, "round")}` : "needs a full 18"}</small></div>
    <a class="kpi" href="#/handicap"><span class="k-label">Handicap estimate</span><span class="k-val">${h.index === null ? "\u2014" : f12(h.index)}</span><small>${h.index === null ? `${h.needed} more rated round${h.needed === 1 ? "" : "s"}` : "unofficial"}</small></a>
    <div class="kpi"><span class="k-label">Putts per 18</span><span class="k-val">${f12(s.putting.per18)}</span><small>${s.putting.n} holes</small></div>
    <div class="kpi"><span class="k-label">Greens (est.)</span><span class="k-val">${pct(s.gir.pct)}</span><small>${s.gir.n} holes</small></div>
  </section>`);
  const series = scoringSeries(data.rounds);
  if (series.length >= 2) out.push(`<section class="group"><div class="group-head"><h2>Scores</h2><span class="legend"><i class="ln"></i>round <i class="ln roll"></i>5-round average</span></div>${trendChart(series)}</section>`);
  const c = overallCoaching(data.rounds);
  out.push(coachingCard(c));
  const last = sortByDate(data.rounds).reverse().slice(0, 4);
  out.push(`<section class="group"><div class="group-head"><h2>Recent rounds</h2><a href="#/rounds" class="more-link">All rounds</a></div>${last.map(roundRow).join("")}</section></div>`);
  return out.join("");
};
function coachingCard(c, { full = false } = {}) {
  if (c.state === "empty") return "";
  if (c.state === "clean") return `<section class="group coach"><h2>What to work on</h2><p>No single weakness stands out in your last ${plural2(c.window, "round")} (${c.holes} holes). Keep recording putts, fairways and penalties \u2014 patterns show up after a few more rounds.</p></section>`;
  const p = c.priority;
  const rec = p.recurrence;
  return `<section class="group coach">
    <h2>What to work on</h2>
    <p class="coach-title">${esc2(p.title)}</p>
    <p>${esc2(p.evidence)}</p>
    ${rec && rec.of >= 3 ? `<p class="recur ${rec.recurring ? "yes" : ""}">${rec.recurring ? `Recurring: showed up in ${rec.hits} of your last ${rec.of} rounds.` : `Showed up in ${rec.hits} of your last ${rec.of} rounds.`}</p>` : ""}
    <p class="advice">${esc2(p.advice)}</p>
    <p class="fine">Based on ${c.holes} holes from your last ${plural2(c.window, "round")}. ${p.confidence ? esc2(p.confidence.label) + " evidence." : ""}</p>
    <a class="btn" href="#/practice" data-act="practice-focus" data-focus="${esc2(p.focus)}">Practise this</a>
    ${full && c.issues.length > 1 ? `<details class="others"><summary>Other things the numbers show</summary>${c.issues.slice(1).map((i) => `<div class="other"><b>${esc2(i.title)}</b><p>${esc2(i.evidence)}</p></div>`).join("")}${c.patterns.map((i) => `<div class="other"><b>${esc2(i.title)}</b><p>${esc2(i.evidence)} ${esc2(i.advice)}</p></div>`).join("")}</details>` : ""}
    ${!full && c.patterns.length ? `<p class="pattern"><b>Also:</b> ${esc2(c.patterns[0].evidence)}</p>` : ""}
  </section>`;
}
function roundRow(r) {
  const done = isComplete(r);
  const tp = toPar(r);
  const n = holesPlayed(r).filter((h) => h.score !== "").length;
  return `<a class="li link round-row" href="#/round/${encodeURIComponent(r.id)}">
    <span class="li-main"><b>${esc2(r.course || "Untitled course")}</b><small>${esc2(dateLabel(r.date))}${r.tees ? `, ${esc2(r.tees)} tees` : ""}${done ? "" : `, ${n} of ${r.count} holes`}${r.count === 9 ? ", 9 holes" : ""}</small></span>
    <span class="li-score"><b>${n ? gross(r) : "\u2014"}</b><small>${tp === null ? "" : signed(tp)}</small></span>${icon("chevron", 18)}</a>`;
}
PAGES.rounds = () => {
  const list = sortByDate(data.rounds).reverse();
  let month = "", body = "";
  for (const r of list) {
    const m = dateLabel(r.date, { month: "long", year: "numeric" });
    if (m !== month) {
      if (month) body += "</section>";
      body += `<section class="group"><h3 class="month">${esc2(m)}</h3>`;
      month = m;
    }
    body += roundRow(r);
  }
  if (month) body += "</section>";
  return `<div class="page"><header class="page-head"><h1>Rounds</h1><p class="lead">${plural2(data.rounds.length, "round")} on this phone.</p></header>
    <button class="btn primary block" data-act="go" data-to="new">${icon("plus", 22)} Record a round</button>
    ${body || '<section class="group empty-state"><p>Rounds you record appear here.</p></section>'}</div>`;
};
PAGES.round = (id) => {
  const r = data.rounds.find((x) => x.id === id);
  if (!r) return `<div class="page">${backBtn("rounds", "Rounds")}<h1>Round not found</h1></div>`;
  const rep = roundReport(r, data.rounds);
  const s = rep.summary;
  const tp = toPar(r);
  const h = hcp();
  const net = h.index !== null ? netForRound(r, h.index) : null;
  const flags = s.records.filter((x) => GIR_FLAG_TEXT[x.gir.flag]);
  const out = [];
  out.push(`<div class="page report">${backBtn("rounds", "Rounds")}
    <header class="page-head"><h1>${esc2(r.course)}</h1><p class="lead">${esc2(dateLabel(r.date))}${r.tees ? `, ${esc2(r.tees)} tees` : ""}${r.rating && r.slope ? ` (${r.rating}/${r.slope})` : ""}</p></header>
    <section class="score-hero">
      <div><span class="big">${rep.gross ?? gross(r)}</span>${rep.gross === null ? `<small>${s.holesN} of ${r.count} holes</small>` : ""}</div>
      <div class="hero-side">${tp !== null ? `<span class="topar">${signed(tp)}</span>` : ""}${net ? `<span>Net ${net.net} <small>(course handicap ${net.courseHandicap}, unofficial)</small></span>` : ""}</div>
    </section>
    <section class="group">${scorecardGrid(r)}</section>`);
  if (r.source === "scan" || r.hasPhoto) out.push(`<details class="group photo-box" data-photo="${esc2(r.id)}"><summary>Card photo</summary><div class="photo-slot">Loading\u2026</div></details>`);
  if (rep.wentWell.length) out.push(`<section class="group"><h2>What went well</h2>${rep.wentWell.map((w) => `<div class="li"><span class="li-main">${esc2(w.text)}${w.detail ? `<small>${esc2(w.detail)}</small>` : ""}</span><span class="good">${icon("check", 20)}</span></div>`).join("")}</section>`);
  out.push(`<section class="group"><h2>Where strokes went</h2>${rep.lost.length ? rep.lost.map((l) => row(esc2(l.label), `${l.strokes}`, `Hole${l.holes.length > 1 ? "s" : ""} ${l.holes.join(", ")}${l.approx ? " \u2014 about one stroke each" : ""}`)).join("") + '<p class="fine">Literal counts from your card, not strokes gained. Categories don\u2019t overlap: \u201Cbeyond bogey\u201D excludes strokes already counted as penalties or extra putts.</p>' : "<p>No penalty strokes, three-putts or double bogeys recorded.</p>"}</section>`);
  if (rep.costly.length) out.push(`<section class="group"><h2>Costliest holes</h2>${rep.costly.map((c) => row(`Hole ${c.hole} <span class="muted">par ${c.par}</span>`, `${c.score} <small>${signed(c.toPar)}</small>`, c.reasons.length ? esc2(c.reasons.join(", ")) : "Nothing else recorded on this hole")).join("")}</section>`);
  if (rep.priority) {
    const p = rep.priority;
    out.push(`<section class="group coach"><h2>Next priority</h2><p class="coach-title">${esc2(p.title)}</p><p>${esc2(p.evidence)}</p>${p.recurringNote ? `<p class="recur ${/pattern/.test(p.recurringNote) ? "yes" : ""}">${esc2(p.recurringNote)}</p>` : ""}<p class="advice">${esc2(p.advice)}</p>${p.todayNote ? `<p class="pattern">${esc2(p.todayNote)}</p>` : ""}<a class="btn" href="#/practice" data-act="practice-focus" data-focus="${esc2(p.focus)}">Plan practice</a></section>`);
  }
  out.push(`<section class="group"><h2>Round stats</h2>
    ${row("Fairways", s.fairways.n ? `${s.fairways.hit}/${s.fairways.n}` : "\u2014", s.fairways.misses ? `${s.fairways.left} left, ${s.fairways.right} right` : "")}
    ${row('Greens in regulation <span class="est">est.</span>', s.gir.n ? `${s.gir.hit}/${s.gir.n}` : "\u2014", s.gir.ambiguous ? `${plural2(s.gir.ambiguous, "hole")} left out \u2014 see below` : "From score minus putts")}
    ${row("Putts", s.putting.n === s.holesN && s.holesN ? holesPlayed(r).reduce((a, x) => a + (x.putts || 0), 0) : s.putting.n ? `${f12(s.putting.perHole)} per hole` : "\u2014", s.putting.n ? `${plural2(s.putting.onePutt, "one-putt")}, ${plural2(s.putting.threePutt, "three-putt")}` : "")}
    ${row('Putts on greens hit <span class="est">est.</span>', s.putting.onGIR.n ? f12(s.putting.onGIR.avg) : "\u2014", nOfText(s.putting.onGIR.n))}
    ${row('Scrambling <span class="est">est.</span>', s.shortGame.scrambleN ? `${s.shortGame.scrambleSaves}/${s.shortGame.scrambleN}` : "\u2014", "Par or better after missing the green")}
    ${row("Penalty strokes", s.penalties.n ? s.penalties.strokes : "\u2014", s.penalties.n < s.holesN ? `${s.penalties.n} of ${s.holesN} holes recorded` : "")}
    ${row("Front / back", `${nineTotal(r, 0) ?? "\u2014"} / ${r.count === 18 ? nineTotal(r, 9) ?? "\u2014" : "\u2014"}`)}
  </section>`);
  if (flags.length) out.push(`<section class="group"><h2>GIR couldn\u2019t be told on ${plural2(flags.length, "hole")}</h2>${flags.map((x) => `<div class="li"><span class="li-main">Hole ${x.n}<small>${esc2(GIR_FLAG_TEXT[x.gir.flag])}</small></span></div>`).join("")}<p class="fine">Edit the round to set GIR on these holes. Until then they\u2019re left out of your green percentage.</p></section>`);
  out.push(`<div class="btn-row wrap"><button class="btn" data-act="edit-round" data-id="${esc2(r.id)}">${icon("pencil", 20)} Edit</button><a class="btn" href="#/share/${encodeURIComponent(r.id)}">${icon("share", 20)} Share</a><button class="btn danger" data-act="delete-round" data-id="${esc2(r.id)}">${icon("trash", 20)} Delete</button></div></div>`);
  return out.join("");
};
var nOfText = (n) => n ? `${n} hole${n === 1 ? "" : "s"}` : "no data";
AFTER.round = (id) => {
  const box = document.querySelector("[data-photo]");
  if (!box) return;
  photos.get(id).then((p) => {
    const slot = box.querySelector(".photo-slot");
    if (slot) slot.innerHTML = p ? `<img src="${p}" alt="Photo of the scorecard for this round">` : "No photo stored on this phone.";
  }).catch(() => {
  });
};
PAGES.insights = () => {
  if (!data.rounds.length) return `<div class="page"><header class="page-head"><h1>Insights</h1></header><section class="group empty-state"><p>Record a round to see your scoring, driving, short game and putting.</p></section></div>`;
  const all = sortByDate(data.rounds);
  const rs = S.range === 0 ? all : all.slice(-S.range);
  const s = summarize(rs);
  const c = overallCoaching(rs, rs.length);
  const z = s.putting.zones;
  const zoneRows = ["A", "B", "C", "D", "E"].map((k) => {
    const d = z[k];
    const ok = d.n >= 5;
    return `<tr><th>${k}<small>${ZONE_LABEL[k]}</small></th><td>${d.n}</td><td>${ok ? f12(d.avgPutts) : "\u2014"}</td><td>${ok ? pct(d.onePutt / d.n) : "\u2014"}</td><td>${ok ? pct(d.threePutt / d.n) : "\u2014"}</td></tr>`;
  }).join("");
  return `<div class="page"><header class="page-head"><h1>Insights</h1></header>
    <div class="seg" role="group" aria-label="Rounds included">${[[5, "Last 5"], [10, "Last 10"], [20, "Last 20"], [0, "All"]].map(([v, l]) => `<button class="${S.range === v ? "on" : ""}" data-act="range" data-v="${v}" aria-pressed="${S.range === v}">${l}</button>`).join("")}</div>
    <p class="fine center">${plural2(rs.length, "round")}, ${s.holesN} holes. Blank boxes on your cards are left out, never counted as zero.</p>
    ${coachingCard(c, { full: true })}
    <section class="group"><h2>Scoring</h2>
      ${row("Average (18 holes)", f12(s.scoring.grossAvg), `${plural2(s.scoring.complete18, "complete round")}${s.scoring.best !== null ? `, best ${s.scoring.best}` : ""}`)}
      ${row("Over par per 18", signed1(s.scoring.toParPer18), nOfText(s.scoring.parHoles))}
      ${[3, 4, 5].map((p) => row(`Par ${p}s`, s.scoring.byPar[p].n ? f12(s.scoring.byPar[p].avg) : "\u2014", s.scoring.byPar[p].n ? `${signed1(s.scoring.byPar[p].toPar)} per hole, ${s.scoring.byPar[p].n} holes` : "no data")).join("")}
      ${row("Front nine / back nine", `${f12(s.scoring.frontAvg)} / ${f12(s.scoring.backAvg)}`, `${s.scoring.frontN} and ${s.scoring.backN} complete nines`)}
      ${row("Double bogeys or worse", f12(s.scoring.doublesPer18), "per 18 holes")}
      ${splitBar([{ label: "Birdie+", value: s.scoring.dist.birdie + s.scoring.dist.eagle, cls: "c1" }, { label: "Par", value: s.scoring.dist.par, cls: "c2" }, { label: "Bogey", value: s.scoring.dist.bogey, cls: "c3" }, { label: "Double", value: s.scoring.dist.double, cls: "c4" }, { label: "Triple+", value: s.scoring.dist.triplePlus, cls: "c5" }])}
    </section>
    <section class="group"><h2>Off the tee</h2>
      ${row("Fairways hit", pct(s.fairways.pct), nOfText(s.fairways.n) + " (par 4s and 5s)")}
      ${s.fairways.misses ? splitBar([{ label: "Left", value: s.fairways.left, cls: "c4" }, { label: "Hit", value: s.fairways.hit, cls: "c2" }, { label: "Right", value: s.fairways.right, cls: "c4" }]) : ""}
      ${row("Penalty strokes", f12(s.penalties.per18), `per 18, from ${nOfText(s.penalties.n)}`)}
    </section>
    <section class="group"><h2>Approach <span class="est">estimated</span></h2>
      ${row("Greens in regulation", pct(s.gir.pct), `${s.gir.hit} of ${s.gir.n} holes, about ${f12(s.gir.per18)} per 18`)}
      ${s.gir.ambiguous ? `<p class="fine">${plural2(s.gir.ambiguous, "hole")} left out because GIR can\u2019t be told from the card (holed from off the green, or a putt counted from the fringe). Set GIR on those holes when editing.</p>` : ""}
      ${s.detailed.approachN ? splitBar([{ label: "Short", value: s.detailed.approach.S, cls: "c4" }, { label: "Long", value: s.detailed.approach.LG, cls: "c3" }, { label: "Left", value: s.detailed.approach.L, cls: "c5" }, { label: "Right", value: s.detailed.approach.R, cls: "c1" }]) + `<p class="fine">${s.detailed.approachN} recorded approach misses (detailed card).</p>` : '<p class="fine">Use the detailed card to record where approaches miss.</p>'}
      ${s.detailed.contactN ? row("Contact: fat / thin", `${s.detailed.contact.Fat} / ${s.detailed.contact.Thin}`, `of ${s.detailed.contactN} approaches recorded`) : ""}
    </section>
    <section class="group"><h2>Short game <span class="est">estimated</span></h2>
      ${row("Scrambling", pct(s.shortGame.scramblePct), `par or better on ${s.shortGame.scrambleSaves} of ${s.shortGame.scrambleN} missed greens`)}
      ${row("Up and down", pct(s.shortGame.udPct), `one putt or holed out on ${s.shortGame.udMade} of ${s.shortGame.udN} missed greens`)}
    </section>
    <section class="group"><h2>Putting</h2>
      ${row("Putts per 18", f12(s.putting.per18), nOfText(s.putting.n))}
      ${row('On greens hit / missed <span class="est">est.</span>', `${f12(s.putting.onGIR.avg)} / ${f12(s.putting.offGIR.avg)}`, `per hole, ${s.putting.onGIR.n} and ${s.putting.offGIR.n} holes`)}
      ${splitBar([{ label: "1 putt or fewer", value: s.putting.onePutt, cls: "c1" }, { label: "2 putts", value: s.putting.twoPutt, cls: "c2" }, { label: "3+ putts", value: s.putting.threePutt, cls: "c4" }])}
      <h3 class="sub-h">By length of first putt</h3>
      <div class="tbl-wrap"><table class="tbl"><thead><tr><th>Zone</th><th>Holes</th><th>Avg</th><th>1-putt</th><th>3-putt</th></tr></thead><tbody>${zoneRows}</tbody></table></div>
      <p class="fine">Rates appear once a zone has at least 5 holes.${s.detailed.shortMissN ? ` Short putts missed: ${s.detailed.shortMisses} in ${s.detailed.shortMissN} detailed holes.` : ""}</p>
    </section>
    <section class="group"><h2>How these are worked out</h2>
      <p class="fine">Greens in regulation are estimated: strokes before your first putt (score minus putts) must be par minus two or fewer. Penalty strokes count, as in the official definition. It goes wrong if a putt from the fringe is written as a putt \u2014 so the card says \u201Con green only\u201D. Scrambling and up-and-downs build on that estimate. Nothing here is strokes gained.</p>
    </section></div>`;
};
PAGES.practice = () => {
  const c = overallCoaching(data.rounds);
  const suggested = c.priority?.focus || "general";
  const focus = S.practice.focus || suggested;
  const secondary = c.issues?.[1]?.focus || c.patterns?.[0]?.focus;
  const why = focus === suggested && c.priority ? c.priority.evidence : "";
  const sess = buildSession(focus, S.practice.minutes, data.practices, { secondary: secondary !== focus ? secondary : void 0, why });
  const active = S.practice.active;
  const hist = data.practices.slice().sort((a, b) => String(b.date).localeCompare(String(a.date))).slice(0, 10);
  return `<div class="page"><header class="page-head"><h1>Practice</h1><p class="lead">${c.priority ? `Built around: ${esc2(c.priority.title.toLowerCase())}.` : "Record a few rounds and the plan will follow your numbers."}</p></header>
    <section class="group">
      <label class="field"><span>Focus</span><select data-bind="practice-focus">${Object.entries(FOCUS).filter(([k]) => !["approach"].includes(k)).map(([k, v]) => `<option value="${k}" ${k === focus ? "selected" : ""}>${esc2(v.label)}${k === suggested ? " (suggested)" : ""}</option>`).join("")}</select></label>
      <div class="seg" role="group" aria-label="Session length">${[15, 30, 45, 60].map((m) => `<button class="${S.practice.minutes === m ? "on" : ""}" data-act="minutes" data-v="${m}" aria-pressed="${S.practice.minutes === m}">${m} min</button>`).join("")}</div>
      ${why ? `<p class="fine">Why: ${esc2(why)}</p>` : ""}
      <p class="fine">You\u2019ll need: ${sess.where.map((w) => WHERE_LABEL[w]).join(", ").toLowerCase()}.</p>
    </section>
    <ol class="plan">${sess.blocks.map((b, i) => `<li class="drill">
      <div class="drill-head"><span class="drill-min">${b.minutes} min</span><div><small>${esc2(b.role)}</small><h3>${esc2(b.name)}</h3></div></div>
      <p><b>Set up:</b> ${esc2(b.setup)}</p><p><b>Do:</b> ${esc2(b.steps)}</p>
      <p class="drill-meta"><span><b>Reps</b> ${esc2(b.reps)}</span><span><b>Target</b> ${esc2(b.target)}</span></p>
      <p class="fine">${esc2(b.why)}</p>
      ${active ? `<label class="field inline"><span>Result</span><input data-bind="drill-result" data-i="${i}" value="${esc2(S.practice.results[i] || "")}" placeholder="e.g. 7 of 9" inputmode="text"></label>` : ""}
    </li>`).join("")}</ol>
    ${active ? `<div class="btn-row"><button class="btn primary" data-act="log-practice">Save session</button><button class="btn" data-act="cancel-practice">Cancel</button></div>` : `<button class="btn primary block" data-act="start-practice">Start this session</button>`}
    <section class="group"><h2>Practice log</h2>${hist.length ? hist.map((p) => `<div class="li"><span class="li-main"><b>${esc2(p.skill || "Practice")}</b><small>${esc2(dateLabel(p.date))}, ${p.minutes} min${p.drills?.length ? ` \u2014 ${esc2(p.drills.map((d) => d.result ? `${d.name}: ${d.result}` : d.name).join("; "))}` : ""}</small></span><button class="icon-btn" data-act="delete-practice" data-id="${esc2(p.id)}" aria-label="Delete session">${icon("trash", 20)}</button></div>`).join("") : '<p class="fine">Sessions you save appear here, and the next plan rotates to different drills.</p>'}</section>
  </div>`;
};
PAGES.more = () => `<div class="page"><header class="page-head"><h1>More</h1></header>
  <section class="group">${row("Handicap estimate", hcp().index === null ? "\u2014" : f12(hcp().index), "Unofficial", "#/handicap")}${row("Print pocket cards", "", "", "#/print")}${row("Saved courses", data.courses.length, "", "#/courses")}${row("Backup & restore", data.meta.lastBackupAt ? dateLabel(data.meta.lastBackupAt.slice(0, 10), { month: "short", day: "numeric" }) : "Never", "", "#/backup")}</section>
  <section class="group"><h2>Profile</h2>
    <label class="field"><span>Your name</span><input data-bind="profile-name" value="${esc2(data.profile.name || "")}" maxlength="50" autocomplete="name" placeholder="Shown on shared rounds"></label>
    <label class="field"><span>Score you\u2019re trying to break</span><input data-bind="profile-goal" type="number" inputmode="numeric" min="50" max="150" value="${esc2(data.profile.goal || 80)}"></label>
  </section>
  <section class="group"><h2>Appearance</h2><div class="seg" role="group" aria-label="Theme">${[["light", "Light"], ["dark", "Dark"], ["system", "Match phone"]].map(([v, l]) => `<button class="${pref.get("theme", "light") === v ? "on" : ""}" data-act="theme" data-v="${v}" aria-pressed="${pref.get("theme", "light") === v}">${l}</button>`).join("")}</div></section>
  <section class="group"><h2>AI scanning</h2>
    <p class="fine">If whoever set up this site added an access code, enter it here. Photos are sent to the AI service only when you tap \u201CRead card\u201D.</p>
    <label class="field"><span>Access code</span><input data-bind="access-code" value="${esc2(pref.get("accessCode", ""))}" autocomplete="off" autocapitalize="off"></label>
  </section>
  <section class="group">${DEMO ? row("Leave the demo", "", "", "./") : row("Show the demo golfer", "", "Fictional rounds, kept separate from yours", "?demo=1")}${row("About and accuracy", "", `Version ${VERSION}`, "#/about")}</section></div>`;
PAGES.about = () => `<div class="page">${backBtn("more", "More")}<header class="page-head"><h1>About and accuracy</h1></header>
  <section class="group prose"><h2>What the numbers can and can\u2019t tell you</h2>
  <p>Everything is worked out from what you write on the card. Blank boxes are left out, never treated as zero, and every rate shows how many holes it\u2019s based on.</p>
  <p><b>Greens in regulation</b> are estimated from score minus putts. Penalty strokes count toward regulation, as they do officially. The estimate fails when a putt from the fringe is written down as a putt, or when you hole out from off the green. Those holes are flagged and left out unless you set GIR yourself.</p>
  <p><b>Scrambling and up-and-downs</b> depend on the GIR estimate, so they\u2019re estimates too.</p>
  <p><b>\u201CWhere strokes went\u201D</b> counts penalty strokes, putts beyond two, and strokes beyond bogey. These are literal counts, not strokes gained, which needs shot distances the card doesn\u2019t record.</p>
  <p><b>The handicap</b> follows World Handicap System principles but is unofficial and can\u2019t be used for competitions.</p>
  <p><b>AI card reading</b> can misread handwriting. Nothing is saved until you\u2019ve reviewed it.</p></section>
  <section class="group prose"><h2>Your data</h2><p>Rounds, courses and practice are stored in this browser on this phone. Card photos are stored separately on the phone. Photos leave the phone only when you tap \u201CRead card\u201D, and only to the AI service set up for this site. There is no account or cloud sync \u2014 export backups.</p></section>
  <p class="fine center">Attest Golf ${VERSION}${MOCK ? " \u2014 mock mode: online services are simulated" : ""}</p></div>`;
PAGES.handicap = () => {
  const h = hcp();
  const list = h.differentials.slice(-20).reverse();
  return `<div class="page">${backBtn("more", "More")}<header class="page-head"><h1>Handicap estimate</h1><p class="lead">Unofficial. Not a USGA Handicap Index.</p></header>
    <section class="score-hero"><div><span class="big">${h.index === null ? "\u2014" : f12(h.index)}</span></div><div class="hero-side">${h.index === null ? `<span>Needs ${plural2(h.needed, "more round")} with course rating, slope and pars.</span>` : `<span>Best ${h.detail.used} of ${h.detail.of} score differentials${h.detail.adjustment ? `, ${h.detail.adjustment} adjustment` : ""}</span>`}</div></section>
    ${h.ineligible ? note(`${plural2(h.ineligible, "round")} can\u2019t count \u2014 they\u2019re partial, or missing a course rating, slope or par. Edit the course details to include them.`) : ""}
    ${h.skippedNine ? note(`${plural2(h.skippedNine, "9-hole round")} played before you had an estimate ${h.skippedNine === 1 ? "isn\u2019t" : "aren\u2019t"} counted.`) : ""}
    <section class="group"><h2>Score differentials</h2>${list.length ? list.map((d) => `<div class="li ${d.used ? "used" : ""}"><span class="li-main"><b>${esc2(d.course)}</b><small>${esc2(dateLabel(d.date))} \u2014 gross ${d.gross}, adjusted ${d.ags}${d.adjustedHoles ? ` (${plural2(d.adjustedHoles, "hole")} capped at ${d.method})` : ""}${d.nine ? ", 9 holes + expected score" : ""}${d.siMissing ? ", stroke index missing \u2014 approximate" : ""}</small></span><span class="li-val">${f12(d.value)}${d.used ? " <small>used</small>" : ""}</span></div>`).join("") : '<p class="fine">No eligible rounds yet.</p>'}</section>
    <section class="group prose"><h2>How it\u2019s calculated</h2><p>Each round: (113 \xF7 slope) \xD7 (adjusted gross \u2212 course rating). Hole scores are capped at net double bogey for the adjusted score only \u2014 your real score is never changed. The estimate averages your lowest differentials from the last 20, using the World Handicap System table.</p><ul>${NOTES.map((n) => `<li>${esc2(n)}</li>`).join("")}</ul></section></div>`;
};
PAGES.print = () => {
  const course = S.printCourse !== "" ? data.courses[Number(S.printCourse)] : null;
  return `<div class="page">${backBtn("more", "More")}<header class="page-head"><h1>Pocket cards</h1><p class="lead">Print, cut on the outer line, fold on the dashed line with the printing outside. Holes 1\u20139 face you; flip it for 10\u201318.</p></header>
    <section class="group">
      <div class="seg" role="group" aria-label="Card type">${[["basic", "Standard"], ["detailed", "Detailed"]].map(([v, l]) => `<button class="${S.printType === v ? "on" : ""}" data-act="print-type" data-v="${v}" aria-pressed="${S.printType === v}">${l}</button>`).join("")}</div>
      <p class="fine">${S.printType === "basic" ? "Score, putts, fairway, penalties and first-putt zone \u2014 about 10 seconds a hole. Two cards per sheet." : "Adds approach miss, contact and short putts missed. One card per sheet."}</p>
      <label class="field"><span>Course</span><select data-bind="print-course"><option value="">Blank card \u2014 write pars yourself</option>${data.courses.map((c, i) => `<option value="${i}" ${String(i) === S.printCourse ? "selected" : ""}>${esc2(c.name)}, ${esc2(c.tees || "tees not set")}</option>`).join("")}</select></label>
      ${course && course.holes.some((h) => h.par === "") ? note("This course is missing some pars, so the par row will be left blank to write in.", "warn") : ""}
    </section>
    <div class="card-preview" aria-label="Preview of the printed card"><style>${cardCSS}</style><div class="card-scale">${sheetHTML({ course, detailed: S.printType === "detailed" })}</div></div>
    <button class="btn primary block" data-act="print">${icon("print", 20)} Print</button>
    ${note("In the print dialog choose US Letter, landscape, and 100% scale (turn off \u201Cfit to page\u201D). Flat card: 10.4 in wide, folding to 5.2 in.")}
    <section class="group prose"><h2>No printer?</h2><p>Use the course\u2019s own scorecard. Use four rows for each hole: score, putts, fairway (a tick for hit, \u2190 or \u2192 for a miss, and a P for each penalty stroke), and the first-putt letter A\u2013E. Pick \u201CCourse scorecard\u201D when you photograph it.</p></section></div>`;
};
AFTER.print = () => {
  const box = document.querySelector(".card-preview"), inner = box?.querySelector(".card-scale");
  if (!inner) return;
  const sheet = inner.firstElementChild;
  const scale = (box.clientWidth - 20) / sheet.offsetWidth;
  inner.style.transform = `scale(${scale})`;
  inner.style.width = sheet.offsetWidth + "px";
  box.style.height = Math.ceil(sheet.offsetHeight * scale + 20) + "px";
};
PAGES.courses = () => `<div class="page">${backBtn("more", "More")}<header class="page-head"><h1>Saved courses</h1><p class="lead">Saved here, they work offline.</p></header>
  <section class="group">${data.courses.length ? data.courses.map((c, i) => {
  const missing = c.holes.slice(0, c.count).filter((h) => h.par === "").length;
  return `<a class="li link" href="#/course-edit/${i}"><span class="li-main"><b>${esc2(c.name)}</b><small>${esc2(c.tees || "Tees not set")}${c.teeGender ? c.teeGender === "F" ? ", women\u2019s" : ", men\u2019s" : ""}, ${c.count} holes${c.rating && c.slope ? `, ${c.rating}/${c.slope}` : ", no rating"}${missing ? `, ${missing} pars missing` : ""}</small></span>${icon("chevron", 18)}</a>`;
}).join("") : '<p class="fine">Courses are saved when you set one up for a round.</p>'}</section></div>`;
PAGES["course-edit"] = (idx) => {
  const c = data.courses[Number(idx)];
  if (!c) return `<div class="page">${backBtn("courses", "Courses")}<h1>Course not found</h1></div>`;
  return `<div class="page">${backBtn("courses", "Courses")}<header class="page-head"><h1>${esc2(c.name)}</h1></header>${courseForm(c, "saved")}
    <div class="btn-row"><button class="btn primary" data-act="save-course-edit" data-i="${idx}">Save changes</button><button class="btn danger" data-act="delete-course" data-i="${idx}">Delete</button></div></div>`;
};
function courseForm(c, mode) {
  const count = c.count || 18;
  const holes = mode === "draft" ? holesPlayed(c) : c.holes.slice(0, count);
  return `<section class="group" data-course-form="${mode}">
    <label class="field"><span>Course name</span><input name="name" value="${esc2(mode === "draft" ? c.course : c.name)}" autocomplete="off"></label>
    <div class="field-row"><label class="field"><span>Tees</span><input name="tees" value="${esc2(c.tees)}" autocomplete="off"></label>
    <label class="field"><span>Holes</span><select name="count"><option value="18" ${count === 18 ? "selected" : ""}>18</option><option value="9" ${count === 9 ? "selected" : ""}>9</option></select></label></div>
    <div class="field-row"><label class="field"><span>Course rating</span><input name="rating" type="number" inputmode="decimal" step="0.1" value="${esc2(c.rating)}" placeholder="e.g. 70.8"></label>
    <label class="field"><span>Slope</span><input name="slope" type="number" inputmode="numeric" value="${esc2(c.slope)}" placeholder="e.g. 124"></label></div>
    <p class="fine">Rating and slope are only needed for the handicap estimate. Leave blank if you don\u2019t know them.</p>
    <div class="tbl-wrap"><table class="tbl hole-tbl"><thead><tr><th>Hole</th><th>Par</th><th>Yards</th><th>Index</th></tr></thead><tbody>
    ${holes.map((h, i) => `<tr><th>${i + 1}</th><td><input aria-label="Hole ${i + 1} par" name="par-${i}" type="number" inputmode="numeric" min="3" max="6" value="${esc2(h.par)}" class="${h.par === "" ? "need" : ""}"></td><td><input aria-label="Hole ${i + 1} yards" name="yardage-${i}" type="number" inputmode="numeric" value="${esc2(h.yardage)}"></td><td><input aria-label="Hole ${i + 1} stroke index" name="handicap-${i}" type="number" inputmode="numeric" min="1" max="18" value="${esc2(h.handicap)}"></td></tr>`).join("")}
    </tbody></table></div>
    <p class="fine">Par is required for every hole. Yards and stroke index (the \u201Chandicap\u201D row on the scorecard) are optional \u2014 leave a box empty if you don\u2019t know it.</p>
  </section>`;
}
function readCourseForm() {
  const f = document.querySelector("[data-course-form]");
  const v = (n) => f.querySelector(`[name="${n}"]`)?.value ?? "";
  const count = Number(v("count")) === 9 ? 9 : 18;
  const holes = Array.from({ length: 18 }, (_, i) => ({ par: v(`par-${i}`), yardage: v(`yardage-${i}`), handicap: v(`handicap-${i}`) }));
  return { name: v("name").trim(), tees: v("tees").trim(), count, rating: v("rating"), slope: v("slope"), holes };
}
PAGES.backup = () => {
  const plan = S.restorePlan;
  let safety = false;
  try {
    safety = !!localStorage.getItem("attest-pre-migration-copy");
  } catch {
  }
  return `<div class="page">${backBtn("more", "More")}<header class="page-head"><h1>Backup & restore</h1><p class="lead">${data.meta.lastBackupAt ? `Last backup ${esc2(dateLabel(data.meta.lastBackupAt.slice(0, 10)))}.` : "No backup yet."} Your rounds live only on this phone.</p></header>
    ${DEMO ? note("This is the demo golfer. Backups here contain fictional data.", "warn") : ""}
    <section class="group"><h2>Back up</h2>
      <p class="fine">Saves a file you can keep in Files, iCloud Drive or email to yourself.</p>
      <button class="btn primary block" data-act="export-json">${icon("download", 20)} Back up rounds</button>
      <button class="btn block" data-act="export-json-photos">Back up with card photos (larger file)</button>
      <button class="btn block" data-act="export-csv">Export spreadsheet (CSV)</button>
    </section>
    <section class="group"><h2>Restore</h2>
      <p class="fine">Adds rounds from a backup file. Rounds already on this phone are kept \u2014 nothing is overwritten.</p>
      <label class="btn block file-btn">${icon("upload", 20)} Choose backup file<input type="file" accept=".json,application/json" data-bind="restore-file"></label>
      ${S.restoreError ? note(esc2(S.restoreError), "warn") : ""}
      ${plan ? `<div class="restore-plan"><p><b>This backup will add:</b></p><ul><li>${plural2(plan.newRounds.length, "round")}</li><li>${plural2(plan.newCourses.length, "course")}</li><li>${plural2(plan.newPractices.length, "practice session")}</li>${plan.photos.length ? `<li>${plural2(plan.photos.length, "card photo")}</li>` : ""}</ul>${plan.duplicates ? `<p class="fine">${plural2(plan.duplicates, "round")} already on this phone will be skipped.</p>` : ""}<div class="btn-row"><button class="btn primary" data-act="apply-restore" ${plan.newRounds.length + plan.newCourses.length + plan.newPractices.length + plan.photos.length ? "" : "disabled"}>Add to this phone</button><button class="btn" data-act="cancel-restore">Cancel</button></div></div>` : ""}
    </section>
    ${safety ? `<section class="group"><h2>Pre-upgrade copy</h2><p class="fine">A copy of your data from before this version was kept, just in case.</p><button class="btn block" data-act="export-safety">Download that copy</button></section>` : ""}</div>`;
};
PAGES.new = () => {
  const d = data.draft;
  return `<div class="page flow">${flowTop("Record a round", "")}
    ${d && holesPlayed(d).some((h) => h.score !== "") ? `<div class="resume"><div><b>Unfinished round</b><small>${esc2(d.course || "Course not set")}</small></div><button class="btn small primary" data-act="resume">Resume</button></div>` : ""}
    <button class="choice" data-act="start-scan">${icon("camera", 28)}<span><b>Photograph a scorecard</b><small>An Attest card or the course\u2019s own card. You check every reading before saving.</small></span></button>
    <button class="choice" data-act="start-manual">${icon("pencil", 28)}<span><b>Enter hole by hole</b><small>Works offline. Takes about two minutes.</small></span></button>
  </div>`;
};
function ensureDraft() {
  if (!data.draft) {
    data.draft = blankRound();
    data.draft.tracking = pref.get("cardType", "basic") === "detailed" ? "detailed" : "basic";
    S.photoUrl = "";
  }
  return data.draft;
}
function startFresh() {
  if (data.draft && holesPlayed(data.draft).some((h) => h.score !== "") && !confirm("Start a new round? The unfinished one will be discarded.")) return false;
  data.draft = null;
  S.photoUrl = "";
  S.scan = null;
  S.prepared = null;
  S.hole = 0;
  ensureDraft();
  persist();
  return true;
}
PAGES.course = () => {
  const d = ensureDraft();
  const results = S.courseResults;
  const info = S.courseInfo;
  return `<div class="page flow">${flowTop("Course and tees", "new", "Back")}
    ${d.course ? note(`Current: <b>${esc2(d.course)}</b>${d.tees ? `, ${esc2(d.tees)}` : ""}. <button class="link-btn" data-act="go" data-to="course-confirm">Keep and check holes</button>`) : ""}
    <section class="group">
      <h2>Saved courses</h2>
      ${data.courses.length ? data.courses.map((c, i) => `<button class="li link btn-li" data-act="pick-saved" data-i="${i}"><span class="li-main"><b>${esc2(c.name)}</b><small>${esc2(c.tees || "Tees not set")}${c.teeGender ? c.teeGender === "F" ? ", women\u2019s" : ", men\u2019s" : ""}, ${c.count} holes</small></span>${icon("chevron", 18)}</button>`).join("") : '<p class="fine">None yet. Courses you set up are saved for next time and work offline.</p>'}
    </section>
    <section class="group">
      <h2>Find a course</h2>
      <form class="search" data-act-submit="course-search"><input name="q" type="search" placeholder="Course name" autocomplete="off" enterkeyhint="search" aria-label="Course name" minlength="3"><button class="btn primary" type="submit" ${S.courseBusy ? "disabled" : ""}>${icon("search", 20)}<span class="sr">Search</span></button></form>
      ${MOCK ? '<p class="fine mock">Mock mode \u2014 results are fictional.</p>' : ""}
      ${S.courseError ? note(esc2(S.courseError), "warn") : ""}
      ${S.courseBusy ? '<p class="fine">Searching\u2026</p>' : ""}
      ${info ? `<h3 class="sub-h">${esc2(info.name)} \u2014 choose tees</h3>${info.tees.length ? info.tees.map((t, i) => {
    const miss = t.holes.filter((h) => h.par === null).length, noSI = t.holes.filter((h) => h.handicap === null).length;
    return `<button class="li link btn-li" data-act="pick-tee" data-i="${i}"><span class="li-main"><b>${esc2(t.name)}${t.gender ? ` <span class="muted">${t.gender === "F" ? "women\u2019s" : "men\u2019s"}</span>` : ""}</b><small>${t.rating ?? "\u2014"} / ${t.slope ?? "\u2014"}, ${t.holes.length} holes${miss ? `, ${miss} pars missing` : ""}${noSI ? `, ${noSI} stroke indexes missing` : ""}</small></span>${icon("chevron", 18)}</button>`;
  }).join("") : '<p class="fine">No tee data for this course. Enter it by hand or scan the course\u2019s card.</p>'}<button class="link-btn" data-act="clear-course-info">Back to results</button>` : results ? results.length ? results.map((c) => `<button class="li link btn-li" data-act="pick-result" data-id="${esc2(c.id)}"><span class="li-main"><b>${esc2(c.name)}</b><small>${esc2(c.location)}</small></span>${icon("chevron", 18)}</button>`).join("") : '<p class="fine">No matches. Try fewer words, or set it up yourself below.</p>' : ""}
    </section>
    <section class="group"><h2>Not listed?</h2>
      <button class="btn block" data-act="scan-course-card">${icon("camera", 20)} Photograph the course\u2019s scorecard</button>
      <button class="btn block" data-act="manual-course">${icon("pencil", 20)} Type in pars</button>
    </section></div>`;
};
PAGES["course-confirm"] = () => {
  const d = ensureDraft();
  return `<div class="page flow">${flowTop("Check the course", "course", "Back")}
    <p class="lead">Check pars before you continue. Nothing here is filled in by guesswork \u2014 empty boxes stay empty.</p>
    ${courseForm(d, "draft")}
    <div class="flow-bar"><button class="btn primary block" data-act="confirm-course">Save course and continue</button></div></div>`;
};
PAGES.entry = () => {
  const d = ensureDraft();
  const hs = holesPlayed(d);
  if (S.hole >= hs.length) S.hole = hs.length - 1;
  const i = S.hole, h = hs[i];
  const g = girInfo(h);
  const chips = (field, items, extraCls = "") => `<div class="chips ${extraCls}" role="group">${items.map(([v, label, sub]) => {
    const on = String(h[field]) === String(v);
    return `<button class="chip ${on ? "on" : ""}" data-act="set" data-f="${field}" data-v="${v}" aria-pressed="${on}">${label}${sub ? `<small>${sub}</small>` : ""}</button>`;
  }).join("")}</div>`;
  const par = h.par === "" ? null : h.par;
  let scoreItems = [];
  if (par) {
    const names = { "-2": "Eagle", "-1": "Birdie", 0: "Par", 1: "Bogey", 2: "Double", 3: "Triple" };
    for (let s = Math.max(1, par - 2); s <= par + 3; s++) scoreItems.push([s, s, names[s - par] || ""]);
    const top = par + 3;
    scoreItems.push([h.score !== "" && h.score > top ? h.score : top + 1, h.score !== "" && h.score > top ? h.score : `${top + 1}`, ""]);
  } else for (let s = 2; s <= 8; s++) scoreItems.push([s, s, ""]);
  const detailed = d.tracking === "detailed";
  const scored = hs.map((x) => x.score !== "");
  return `<div class="page flow entry">
    <header class="flow-top"><button class="icon-btn" data-act="close-entry" aria-label="Close and keep draft">${icon("close", 24)}</button><h1>Hole ${i + 1}<small>${esc2(d.course || "No course")}</small></h1><button class="link-btn" data-act="go" data-to="review">Review</button></header>
    <nav class="holes" aria-label="Holes">${hs.map((x, k) => `<button class="hd ${k === i ? "cur" : ""} ${scored[k] ? "done" : ""}" data-act="hole" data-v="${k}" aria-label="Hole ${k + 1}${scored[k] ? ", scored" : ""}" ${k === i ? 'aria-current="step"' : ""}>${k + 1}</button>`).join("")}</nav>
    <div class="hole-info">${par ? `<span>Par <b>${par}</b></span>` : '<span class="need-par">Par not set</span>'}${h.yardage ? `<span>${h.yardage} yds</span>` : ""}${h.handicap ? `<span>Index ${h.handicap}</span>` : ""}</div>
    ${par ? "" : `<section class="entry-sec"><h2>Par</h2>${chips("par", [[3, "3"], [4, "4"], [5, "5"]])}</section>`}
    <section class="entry-sec"><h2>Score <small>including penalties</small></h2>${chips("score", scoreItems, "score-chips")}${h.score !== "" && h.score > (par ? par + 3 : 8) ? `<div class="stepper"><button class="chip" data-act="bump" data-f="score" data-v="-1" aria-label="One less">\u2212</button><button class="chip" data-act="bump" data-f="score" data-v="1" aria-label="One more">+</button></div>` : ""}</section>
    <section class="entry-sec"><h2>Putts <small>on the green only</small></h2>${chips("putts", [[0, "0"], [1, "1"], [2, "2"], [3, "3"], [4, "4+"]])}</section>
    ${par === 3 ? "" : `<section class="entry-sec"><h2>Tee shot</h2>${chips("fairway", [["L", "\u2190 Left"], ["H", "Fairway"], ["R", "Right \u2192"]])}</section>`}
    <section class="entry-sec"><h2>Penalty strokes</h2>${chips("penalties", [[0, "0"], [1, "1"], [2, "2"], [3, "3"]])}</section>
    <section class="entry-sec"><h2>First putt length</h2>${chips("puttZone", ["A", "B", "C", "D", "E"].map((z) => [z, z, ZONE_LABEL[z]]), "zone-chips")}</section>
    <section class="entry-sec gir"><h2>Green in regulation <span class="est">est.</span></h2>
      <p>${g.value ? `<b>${g.value === "Y" ? "Yes" : "No"}</b> \u2014 ${g.source === "override" ? "set by you" : `${h.score} strokes \u2212 ${h.putts} putts = ${h.score - h.putts} to reach the green (par ${h.par} needs ${h.par - 2})`}` : g.flag === "no-score" || g.flag === "no-putts" ? "Worked out once score and putts are in." : esc2(GIR_FLAG_TEXT[g.flag])}</p>
      ${chips("girOverride", [["", "Auto"], ["Y", "Yes"], ["N", "No"]], "small")}
    </section>
    ${detailed ? `<section class="entry-sec"><h2>Approach missed <small>only if you missed the green</small></h2>${chips("approach", [["S", "Short"], ["LG", "Long"], ["L", "Left"], ["R", "Right"]])}</section>
      <section class="entry-sec"><h2>Approach contact</h2>${chips("strike", [["Solid", "Solid"], ["Fat", "Fat"], ["Thin", "Thin"]])}</section>
      <section class="entry-sec"><h2>Missed a putt of 5 ft or less?</h2>${chips("shortMiss", [["true", "Yes"], ["false", "No"]])}</section>
      <button class="link-btn" data-act="tracking" data-v="basic">Hide detailed tracking</button>` : `<button class="link-btn" data-act="tracking" data-v="detailed">Add approach, contact and short-putt detail</button>`}
    <p class="fine">Tap a selected option again to clear it. Leave anything you didn\u2019t track empty.</p>
    <div class="flow-bar two"><button class="btn" data-act="prev-hole" ${i === 0 ? "disabled" : ""}>Previous</button><button class="btn primary" data-act="next-hole">${i === hs.length - 1 ? "Review round" : `Hole ${i + 2}`}</button></div>
  </div>`;
};
PAGES.scan = () => {
  const kind = S.scanKind;
  const course = kind === "course";
  return `<div class="page flow">${flowTop(course ? "Photograph course card" : "Photograph your card", course ? "course" : "new", "Back")}
    ${course ? "" : `<section class="group"><h2>Which card?</h2><div class="seg three" role="group">${[["basic", "Attest card"], ["detailed", "Detailed card"], ["course-score", "Course card"]].map(([v, l]) => `<button class="${kind === v ? "on" : ""}" data-act="scan-kind" data-v="${v}" aria-pressed="${kind === v}">${l}</button>`).join("")}</div>
      ${kind === "course-score" ? '<p class="fine">For a course\u2019s own card with four rows per hole: score, putts, fairway (\u2713, \u2190 or \u2192, plus a P per penalty), and first-putt letter.</p>' : ""}</section>`}
    ${course ? `<section class="group"><label class="field"><span>Which tees did you play?</span><input data-bind="scan-tee" value="${esc2(S.scanTee || "")}" placeholder="e.g. White"></label><p class="fine">The AI reads printed par, yards for that tee row, and stroke index. You\u2019ll check them next.</p></section>` : ""}
    <section class="group"><h2>Photo</h2>
      <p class="fine">Lay the card flat and unfolded in good light. Fill the frame, avoid shadows, hold the phone level.</p>
      <div class="btn-row"><label class="btn file-btn">${icon("camera", 20)} Take photo<input type="file" accept="image/*" capture="environment" data-bind="photo"></label><label class="btn file-btn">Choose photo<input type="file" accept="image/*" data-bind="photo"></label></div>
      ${S.photoUrl ? `<img class="scan-preview" src="${S.photoUrl}" alt="Your scorecard photo">` : ""}
    </section>
    ${MOCK ? note("Mock mode: the reading will be simulated, not done by an AI model.", "warn") : ""}
    ${!navigator.onLine ? note("You\u2019re offline. Reading needs internet \u2014 you can still enter the round by hand with this photo for reference.", "warn") : ""}
    <div class="flow-bar">
      <button class="btn primary block" data-act="read-card" ${!S.prepared || S.scanBusy ? "disabled" : ""}>${S.scanBusy ? "Reading both nines\u2026" : "Read card"}</button>
      ${course ? "" : '<button class="btn block" data-act="photo-manual">Enter by hand instead</button>'}
      <p class="fine center">Photos are sent to the AI service only when you tap Read card.</p>
    </div></div>`;
};
var SCAN_FIELDS = {
  basic: [["score", "Score", "num"], ["putts", "Putts", "num"], ["fairway", "Fwy", ["", "H", "L", "R", "NA"]], ["penalties", "Pen", "num"], ["puttZone", "1st", ["", "A", "B", "C", "D", "E"]]],
  detailed: [["score", "Score", "num"], ["putts", "Putts", "num"], ["fairway", "Fwy", ["", "H", "L", "R", "NA"]], ["penalties", "Pen", "num"], ["puttZone", "1st", ["", "A", "B", "C", "D", "E"]], ["approach", "Appr", ["", "S", "LG", "L", "R"]], ["strike", "Contact", ["", "Solid", "Fat", "Thin"]], ["shortMiss", "Short", ["", "true", "false"]]],
  course: [["par", "Par", "num"], ["yardage", "Yards", "num"], ["handicap", "Index", "num"]]
};
SCAN_FIELDS["course-score"] = SCAN_FIELDS.basic;
var OPT_LABEL = { H: "Hit", L: "\u2190 L", R: "R \u2192", NA: "\u2014", S: "Short", LG: "Long", true: "Yes", false: "No", Solid: "Solid", Fat: "Fat", Thin: "Thin" };
var STATUS_TEXT = { uncertain: "unsure", unclear: "unreadable", conflict: "doesn\u2019t add up", invalid: "not valid", missing: "not returned" };
PAGES["scan-review"] = () => {
  const sc = S.scan;
  if (!sc) return `<div class="page flow">${flowTop("Check the reading", "scan", "Back")}<p>No reading yet.</p></div>`;
  const fields = SCAN_FIELDS[sc.kind];
  const count = sc.kind === "course" ? 18 : data.draft?.count || 18;
  const byHole = new Map(sc.holes.map((h) => [h.hole, h]));
  let flagged = 0;
  const rows = Array.from({ length: count }, (_, k) => {
    const n = k + 1, h = byHole.get(n) || { values: {}, status: {} };
    return `<tr><th>${n}</th>${fields.map(([f, , type]) => {
      const st = h.status[f] || "missing";
      const bad = ["uncertain", "unclear", "conflict", "invalid", "missing"].includes(st) && !h.touched?.[f];
      if (bad) flagged++;
      const v = h.values[f];
      const val = v === null || v === void 0 ? "" : String(v);
      const cls = bad ? `flag ${st}` : "";
      const title = bad ? ` title="${STATUS_TEXT[st]}"` : "";
      if (type === "num") return `<td><input class="${cls}"${title} data-bind="scan-cell" data-h="${n}" data-f="${f}" value="${esc2(val)}" inputmode="numeric" pattern="[0-9]*" aria-label="Hole ${n} ${f}${bad ? ", " + STATUS_TEXT[st] : ""}"></td>`;
      return `<td><select class="${cls}"${title} data-bind="scan-cell" data-h="${n}" data-f="${f}" aria-label="Hole ${n} ${f}${bad ? ", " + STATUS_TEXT[st] : ""}">${type.map((o) => `<option value="${o}" ${o === val ? "selected" : ""}>${o === "" ? "\xB7" : OPT_LABEL[o] || o}</option>`).join("")}</select></td>`;
    }).join("")}</tr>`;
  }).join("");
  return `<div class="page flow scan-review">${flowTop("Check the reading", "scan", "Back")}
    ${sc.mock ? note("<b>Mocked reading.</b> These values are simulated for testing and were not read from your photo.", "warn") : ""}
    ${Object.entries(sc.errors || {}).map(([half, msg]) => note(`<b>${half === "front" ? "Holes 1\u20139" : "Holes 10\u201318"} weren\u2019t read:</b> ${esc2(msg)} Fill them in below or after.`, "warn")).join("")}
    ${sc.warnings.filter((w) => !/^Mocked/.test(w)).map((w) => note(esc2(w), "warn")).join("")}
    ${S.photoUrl ? `<details class="group photo-box" open><summary>Your photo</summary><img src="${S.photoUrl}" alt="Your scorecard photo"></details>` : ""}
    <p class="lead">${flagged ? `<b>${plural2(flagged, "box", "boxes")}</b> need a look (outlined). Check every hole against the photo anyway.` : "Nothing was flagged, but check every hole against the photo."} Empty means nothing was written.</p>
    <div class="tbl-wrap"><table class="tbl scan-tbl"><thead><tr><th>Hole</th>${fields.map(([, l]) => `<th>${l}</th>`).join("")}</tr></thead><tbody>${rows}</tbody></table></div>
    <p class="fine">Outlined: unsure, unreadable, doesn\u2019t add up (e.g. more putts than strokes allow), or not returned. Fixing a box clears its outline.</p>
    <div class="flow-bar"><button class="btn primary block" data-act="accept-scan">Use these values</button><p class="fine center">Nothing is saved until you save the round.</p></div></div>`;
};
PAGES.review = () => {
  const d = data.draft;
  if (!d) return `<div class="page flow">${flowTop("Review", "")}<p>No round in progress.</p></div>`;
  const v = validateRound(d);
  const flags = holesPlayed(d).map((h, i) => ({ i, g: girInfo(h) })).filter((x) => GIR_FLAG_TEXT[x.g.flag]);
  return `<div class="page flow">${flowTop("Review round", "entry", "Back")}
    <section class="group"><div class="field-row"><label class="field"><span>Date</span><input type="date" data-bind="draft-date" value="${esc2(d.date)}" max="${todayISO()}"></label></div>
    <p class="lead"><b>${esc2(d.course || "No course yet")}</b>${d.tees ? `, ${esc2(d.tees)}` : ""} <button class="link-btn" data-act="go" data-to="course">Change</button></p></section>
    <section class="group">${scorecardGrid(d)}</section>
    ${v.errors.length ? `<section class="group errors"><h2>Fix before saving</h2>${v.errors.map((e) => `<p>${esc2(e)}</p>`).join("")}</section>` : ""}
    ${v.warnings.length ? `<section class="group">${v.warnings.map((w) => note(esc2(w), "warn")).join("")}</section>` : ""}
    ${flags.length ? `<section class="group"><h2>Was this a green in regulation?</h2><p class="fine">The card can\u2019t tell on ${plural2(flags.length, "hole")}. Answer if you remember; otherwise they\u2019re left out of GIR.</p>${flags.map((x) => `<div class="li"><span class="li-main">Hole ${x.i + 1}<small>${esc2(GIR_FLAG_TEXT[x.g.flag])}</small></span><span class="mini-seg"><button class="chip" data-act="gir-fix" data-i="${x.i}" data-v="Y">Yes</button><button class="chip" data-act="gir-fix" data-i="${x.i}" data-v="N">No</button></span></div>`).join("")}</section>` : ""}
    <section class="group"><label class="field"><span>Notes (optional)</span><textarea data-bind="draft-notes" rows="2" placeholder="Conditions, how you felt, what you tried">${esc2(d.notes || "")}</textarea></label></section>
    <div class="flow-bar two"><button class="btn" data-act="go" data-to="entry">Edit holes</button><button class="btn primary" data-act="save-round" ${v.errors.length ? "disabled" : ""}>Save round</button></div></div>`;
};
PAGES.share = (id) => {
  const r = data.rounds.find((x) => x.id === id);
  if (!r) return `<div class="page flow">${flowTop("Share", "rounds")}<p>Round not found.</p></div>`;
  const o = S.share;
  const tg = (k, l) => `<label class="switch"><input type="checkbox" data-bind="share-opt" data-k="${k}" ${o[k] ? "checked" : ""}><span>${l}</span></label>`;
  return `<div class="page flow">${flowTop("Share round", `round/${encodeURIComponent(id)}`, "Back")}
    <canvas id="share-canvas" class="share-canvas" role="img" aria-label="Image of your round summary"></canvas>
    <section class="group"><h2>Show</h2>${tg("fairways", "Fairways")}${tg("gir", "Greens in regulation")}${tg("putts", "Putts")}${tg("penalties", "Penalty strokes")}${tg("net", "Net score")}${tg("handicap", "Handicap estimate")}${tg("highlight", "Highlight")}</section>
    ${data.profile.name ? "" : note("Add your name in More \u2192 Profile to show it on the image.")}
    <div class="flow-bar"><button class="btn primary block" data-act="share-image" data-id="${esc2(id)}">${icon("share", 20)} Share image</button></div></div>`;
};
function shareData(r) {
  const s = summarize([r]);
  const h = hcp();
  const net = h.index !== null ? netForRound(r, h.index) : null;
  const rep = roundReport(r, data.rounds);
  const putts = s.putting.n === s.holesN && s.holesN ? holesPlayed(r).reduce((a, x) => a + (x.putts || 0), 0) : null;
  return {
    name: data.profile.name + (DEMO ? " (demo)" : ""),
    course: r.course,
    tees: r.tees ? `${r.tees} tees` : "",
    date: dateLabel(r.date),
    gross: isComplete(r) ? gross(r) : null,
    toPar: toPar(r),
    net: net ? net.net : null,
    index: h.index,
    fairways: s.fairways.n ? `${s.fairways.hit}/${s.fairways.n}` : null,
    gir: s.gir.n ? `${s.gir.hit}/${s.gir.n}` : null,
    putts: putts !== null ? String(putts) : null,
    penalties: s.penalties.n ? s.penalties.strokes : null,
    highlight: rep.wentWell[0] ? rep.wentWell[0].text : null
  };
}
AFTER.share = (id) => {
  const r = data.rounds.find((x) => x.id === id);
  const c = $("#share-canvas");
  if (r && c) drawShareCard(c, shareData(r), S.share);
};
var ACT = {};
ACT.go = (el) => go(el.dataset.to);
ACT["onboard-done"] = () => {
  pref.set("onboarded", true);
  render(true);
};
ACT.resume = () => {
  S.hole = Math.max(0, holesPlayed(data.draft).findIndex((h) => h.score === ""));
  if (S.hole < 0) S.hole = 0;
  photos.get(data.draft.id).then((p) => {
    S.photoUrl = p || "";
  }).catch(() => {
  });
  go("entry");
};
ACT["start-manual"] = () => {
  if (!startFresh()) return;
  go("course");
};
ACT["start-scan"] = () => {
  if (!startFresh()) return;
  S.scanKind = pref.get("cardType", "basic");
  go("scan");
};
ACT["scan-kind"] = (el) => {
  S.scanKind = el.dataset.v;
  if (data.draft) data.draft.tracking = el.dataset.v === "detailed" ? "detailed" : data.draft.tracking;
  render();
};
ACT["scan-course-card"] = () => {
  S.scanKind = "course";
  S.prepared = null;
  go("scan");
};
ACT["manual-course"] = () => go("course-confirm");
ACT["clear-course-info"] = () => {
  S.courseInfo = null;
  render();
};
ACT["photo-manual"] = () => {
  savePhotoToDraft();
  go("course");
};
ACT["pick-saved"] = (el) => {
  const c = data.courses[Number(el.dataset.i)];
  courseToRound(ensureDraft(), c);
  persist();
  S.courseInfo = null;
  S.courseResults = null;
  go("course-confirm");
};
ACT["pick-result"] = async (el) => {
  S.courseBusy = true;
  S.courseError = "";
  render();
  try {
    S.courseInfo = await courseDetail(el.dataset.id);
  } catch (e) {
    S.courseError = e.message;
  }
  S.courseBusy = false;
  render();
};
ACT["pick-tee"] = (el) => {
  const info = S.courseInfo, t = info.tees[Number(el.dataset.i)];
  const course = normalizeCourse({
    name: info.name,
    tees: t.name,
    teeGender: t.gender,
    count: t.holes.length === 9 ? 9 : 18,
    rating: t.rating ?? "",
    slope: t.slope ?? "",
    source: info.mock ? "mock" : "golfcourseapi",
    providerId: info.id,
    holes: Array.from({ length: 18 }, (_, i) => {
      const h = t.holes.find((x) => x.hole === i + 1) || {};
      return { par: h.par ?? "", yardage: h.yardage ?? "", handicap: h.handicap ?? "" };
    })
  });
  courseToRound(ensureDraft(), course);
  persist();
  S.courseInfo = null;
  S.courseResults = null;
  go("course-confirm");
};
ACT["confirm-course"] = () => {
  const f = readCourseForm();
  const d = ensureDraft();
  if (!f.name) return toast("Add the course name.", "error");
  d.course = f.name;
  d.tees = f.tees;
  d.count = f.count;
  const num2 = (v, lo, hi) => {
    const n = Number(v);
    return v === "" || !Number.isFinite(n) || n < lo || n > hi ? "" : n;
  };
  d.rating = num2(f.rating, 25, 85);
  d.slope = num2(f.slope, 55, 155);
  f.holes.forEach((h, i) => {
    d.holes[i].par = num2(h.par, 3, 6);
    d.holes[i].yardage = num2(h.yardage, 1, 800);
    d.holes[i].handicap = num2(h.handicap, 1, 18);
  });
  const missing = holesPlayed(d).filter((h) => h.par === "").length;
  if (missing) {
    persist();
    render();
    return toast(`Par is missing on ${plural2(missing, "hole")}.`, "error");
  }
  upsertCourse(roundToCourse(d));
  persist();
  go(holesPlayed(d).some((h) => h.score !== "") ? "review" : "entry");
};
function upsertCourse(c) {
  if (!c || !c.name) return;
  const k = courseKey(c.name, c.tees, c.teeGender);
  const i = data.courses.findIndex((x) => courseKey(x.name, x.tees, x.teeGender) === k);
  if (i >= 0) data.courses[i] = { ...data.courses[i], ...c, source: data.courses[i].source || c.source };
  else data.courses.push(c);
}
ACT.hole = (el) => {
  S.hole = Number(el.dataset.v);
  render();
};
ACT["prev-hole"] = () => {
  S.hole = Math.max(0, S.hole - 1);
  render(true);
};
ACT["next-hole"] = () => {
  const n = holesPlayed(data.draft).length;
  if (S.hole < n - 1) {
    S.hole++;
    render(true);
  } else go("review");
};
ACT["close-entry"] = () => {
  persist();
  toast("Draft kept on this phone.");
  go("");
};
ACT.tracking = (el) => {
  data.draft.tracking = el.dataset.v;
  persist();
  render();
};
var NUMERIC = /* @__PURE__ */ new Set(["score", "putts", "penalties", "par"]);
ACT.set = (el) => {
  const h = data.draft.holes[S.hole];
  const f = el.dataset.f;
  let v = el.dataset.v;
  if (NUMERIC.has(f)) v = Number(v);
  if (f === "shortMiss") v = v === "true";
  if (f === "girOverride") {
    h.girOverride = v;
  } else h[f] = String(h[f]) === String(v) ? "" : v;
  if (f === "par" && h.par === 3) h.fairway = "NA";
  persist();
  render();
};
ACT.bump = (el) => {
  const h = data.draft.holes[S.hole];
  h.score = Math.max(1, Math.min(15, (h.score || 0) + Number(el.dataset.v)));
  persist();
  render();
};
ACT["gir-fix"] = (el) => {
  data.draft.holes[Number(el.dataset.i)].girOverride = el.dataset.v;
  persist();
  render();
};
ACT["save-round"] = async () => {
  const d = data.draft;
  const v = validateRound(d);
  if (v.errors.length) return toast(v.errors[0], "error");
  holesPlayed(d).forEach((h) => {
    const g = girInfo(h);
    h.gir = g.value || "";
  });
  const now = (/* @__PURE__ */ new Date()).toISOString();
  const r = normalizeRound({ ...d, updatedAt: now, createdAt: d.createdAt || now });
  if (S.photoUrl) {
    try {
      await photos.put(r.id, S.photoUrl);
      r.hasPhoto = true;
    } catch {
      toast("The card photo couldn\u2019t be stored, but the round will be saved.", "error");
    }
  }
  const i = data.rounds.findIndex((x) => x.id === r.id);
  if (i >= 0) data.rounds[i] = r;
  else data.rounds.push(r);
  upsertCourse(roundToCourse(r));
  data.draft = null;
  S.photoUrl = "";
  S.scan = null;
  S.prepared = null;
  if (persist()) {
    toast(i >= 0 ? "Round updated" : "Round saved");
    requestPersistence();
  }
  go(`round/${encodeURIComponent(r.id)}`, true);
};
ACT["edit-round"] = (el) => {
  const r = data.rounds.find((x) => x.id === el.dataset.id);
  if (!r) return;
  if (data.draft && data.draft.id !== r.id && holesPlayed(data.draft).some((h) => h.score !== "") && !confirm("Discard the unfinished round to edit this one?")) return;
  data.draft = normalizeRound(JSON.parse(JSON.stringify(r)));
  S.hole = 0;
  S.photoUrl = "";
  photos.get(r.id).then((p) => {
    S.photoUrl = p || "";
  }).catch(() => {
  });
  persist();
  go("entry");
};
ACT["delete-round"] = (el) => {
  const r = data.rounds.find((x) => x.id === el.dataset.id);
  if (!r || !confirm(`Delete the round at ${r.course} on ${dateLabel(r.date)}? This can\u2019t be undone unless you have a backup.`)) return;
  data.rounds = data.rounds.filter((x) => x.id !== r.id);
  photos.del(r.id).catch(() => {
  });
  persist();
  toast("Round deleted");
  go("rounds", true);
};
async function onPhoto(file) {
  try {
    S.prepared = await prepareImage(file);
    S.photoUrl = S.prepared.full;
    render();
  } catch (e) {
    toast(e.message, "error");
  }
}
function savePhotoToDraft() {
  if (S.photoUrl && data.draft) photos.put(data.draft.id, S.photoUrl).catch(() => {
  });
}
ACT["read-card"] = async () => {
  if (!S.prepared) return toast("Take or choose a photo first.", "error");
  S.scanBusy = true;
  render();
  try {
    const res = await readCard(S.scanKind, S.prepared, { accessCode: pref.get("accessCode", ""), tee: S.scanTee || "" });
    S.scan = { ...res, kind: S.scanKind };
    S.scan.holes.forEach((h) => {
      h.touched = {};
    });
    savePhotoToDraft();
    S.scanBusy = false;
    go("scan-review");
  } catch (e) {
    S.scanBusy = false;
    render();
    toast(e.message, "error");
  }
};
ACT["accept-scan"] = () => {
  const sc = S.scan, d = ensureDraft();
  const fields = SCAN_FIELDS[sc.kind].map((x) => x[0]);
  for (const h of sc.holes) {
    const dest = d.holes[h.hole - 1];
    if (!dest) continue;
    for (const f of fields) {
      const v = h.values[f];
      dest[f] = v === null || v === void 0 ? "" : v;
    }
  }
  if (sc.kind === "detailed") d.tracking = "detailed";
  if (sc.kind !== "course") d.source = "scan";
  data.draft = normalizeRound(d);
  persist();
  S.scan = null;
  if (sc.kind === "course") {
    if (S.scanTee && !d.tees) data.draft.tees = S.scanTee;
    go("course-confirm");
    return;
  }
  go(d.course && holesPlayed(d).every((x) => x.par !== "") ? "review" : "course");
  toast("Values applied. Choose or confirm the course next.");
};
ACT.range = (el) => {
  S.range = Number(el.dataset.v);
  render();
};
ACT.minutes = (el) => {
  S.practice.minutes = Number(el.dataset.v);
  S.practice.active = null;
  render();
};
ACT["practice-focus"] = (el) => {
  S.practice.focus = el.dataset.focus || null;
  S.practice.active = null;
};
ACT["start-practice"] = () => {
  S.practice.active = true;
  S.practice.results = {};
  render();
};
ACT["cancel-practice"] = () => {
  S.practice.active = null;
  render();
};
ACT["log-practice"] = () => {
  const c = overallCoaching(data.rounds);
  const focus = S.practice.focus || c.priority?.focus || "general";
  const secondary = c.issues?.[1]?.focus || c.patterns?.[0]?.focus;
  const sess = buildSession(focus, S.practice.minutes, data.practices, { secondary: secondary !== focus ? secondary : void 0 });
  data.practices.push({ id: uid(), date: todayISO(), minutes: S.practice.minutes, skill: FOCUS[focus]?.label || "Practice", focus, notes: "", drills: sess.blocks.map((b, i) => ({ id: b.id, name: b.name, target: b.target, result: (S.practice.results[i] || "").slice(0, 40) })) });
  S.practice.active = null;
  S.practice.results = {};
  persist();
  toast("Practice saved");
  render();
};
ACT["delete-practice"] = (el) => {
  if (!confirm("Delete this practice session?")) return;
  data.practices = data.practices.filter((p) => p.id !== el.dataset.id);
  persist();
  render();
};
ACT.theme = (el) => {
  pref.set("theme", el.dataset.v);
  applyTheme();
  render();
};
ACT["print-type"] = (el) => {
  S.printType = el.dataset.v;
  pref.set("cardType", el.dataset.v);
  render();
};
ACT.print = () => {
  const course = S.printCourse !== "" ? data.courses[Number(S.printCourse)] : null;
  $("#print-root").innerHTML = `<style>${cardCSS}</style>${sheetHTML({ course, detailed: S.printType === "detailed" })}`;
  window.print();
};
ACT["save-course-edit"] = (el) => {
  const f = readCourseForm();
  if (!f.name) return toast("Add the course name.", "error");
  const c = normalizeCourse({ ...data.courses[Number(el.dataset.i)], ...f, updatedAt: (/* @__PURE__ */ new Date()).toISOString() });
  data.courses[Number(el.dataset.i)] = c;
  persist();
  toast("Course saved");
  go("courses");
};
ACT["delete-course"] = (el) => {
  if (!confirm("Delete this saved course? Rounds played there are kept.")) return;
  data.courses.splice(Number(el.dataset.i), 1);
  persist();
  go("courses", true);
};
var stamp = () => todayISO();
ACT["export-json"] = async (el, withPhotos = false) => {
  const text = await buildBackup(data, withPhotos);
  const res = await shareOrDownloadText(text, `Attest Golf backup ${stamp()}.json`, "application/json");
  if (res !== "cancelled" && !DEMO) {
    data.meta.lastBackupAt = (/* @__PURE__ */ new Date()).toISOString();
    data.meta.roundsAtLastBackup = data.rounds.length;
    persist();
    render();
  }
  if (res === "downloaded") toast("Backup downloaded");
};
ACT["export-json-photos"] = (el) => ACT["export-json"](el, true);
ACT["export-csv"] = async () => {
  const r = await shareOrDownloadText(buildCSV(sortByDate(data.rounds)), `Attest Golf rounds ${stamp()}.csv`, "text/csv");
  if (r === "downloaded") toast("Spreadsheet downloaded");
};
ACT["export-safety"] = async () => {
  try {
    await shareOrDownloadText(localStorage.getItem("attest-pre-migration-copy") || "", `Attest Golf pre-upgrade copy.json`, "application/json");
  } catch {
  }
};
ACT["apply-restore"] = async () => {
  const plan = S.restorePlan;
  const n = await applyRestore(data, plan);
  persist();
  S.restorePlan = null;
  toast(`Added ${plural2(plan.newRounds.length, "round")}${n ? ` and ${plural2(n, "photo")}` : ""}`);
  render();
};
ACT["cancel-restore"] = () => {
  S.restorePlan = null;
  render();
};
ACT["share-image"] = async (el) => {
  const c = $("#share-canvas");
  const r = data.rounds.find((x) => x.id === el.dataset.id);
  const res = await shareCanvas(c, `${(r?.course || "Round").replace(/[^\w ]+/g, "")} ${r?.date || ""}.png`);
  if (res === "downloaded") toast("Image saved");
};
ACT["sw-update"] = () => {
  S.swWaiting?.postMessage("SKIP_WAITING");
};
async function courseSearch(q) {
  if (q.length < 3) return toast("Type at least three letters.", "error");
  S.courseBusy = true;
  S.courseError = "";
  S.courseInfo = null;
  render();
  try {
    S.courseResults = (await searchCourses(q)).courses;
  } catch (e) {
    S.courseError = e.message;
    S.courseResults = null;
  }
  S.courseBusy = false;
  render();
}
document.addEventListener("click", (e) => {
  const el = e.target.closest("[data-act]");
  if (!el) return;
  const fn = ACT[el.dataset.act];
  if (!fn) return;
  if (el.tagName !== "A") e.preventDefault();
  fn(el);
});
document.addEventListener("submit", (e) => {
  const f = e.target.closest("[data-act-submit]");
  if (!f) return;
  e.preventDefault();
  if (f.dataset.actSubmit === "course-search") courseSearch(f.q.value.trim());
});
document.addEventListener("change", async (e) => {
  const t = e.target, b = t.dataset.bind;
  if (!b) return;
  if (b === "photo") {
    if (t.files[0]) await onPhoto(t.files[0]);
    t.value = "";
  }
  if (b === "restore-file") {
    const file = t.files[0];
    t.value = "";
    if (!file) return;
    S.restoreError = "";
    S.restorePlan = null;
    try {
      S.restorePlan = planRestore(data, await file.text());
    } catch (err) {
      S.restoreError = err.message;
    }
    render();
  }
  if (b === "practice-focus") {
    S.practice.focus = t.value;
    S.practice.active = null;
    render();
  }
  if (b === "print-course") {
    S.printCourse = t.value;
    render();
  }
  if (b === "profile-goal") {
    const g = Number(t.value);
    if (Number.isInteger(g) && g >= 50 && g <= 150) {
      data.profile.goal = g;
      persist();
      toast("Saved");
    } else toast("Enter a score between 50 and 150.", "error");
  }
  if (b === "profile-name") {
    data.profile.name = t.value.trim().slice(0, 50);
    persist();
    toast("Saved");
  }
  if (b === "access-code") {
    pref.set("accessCode", t.value.trim());
    toast("Saved");
  }
  if (b === "draft-date") {
    if (/^\d{4}-\d{2}-\d{2}$/.test(t.value)) {
      data.draft.date = t.value;
      persist();
    }
  }
  if (b === "share-opt") {
    S.share[t.dataset.k] = t.checked;
    AFTER.share(route().arg);
  }
  if (b === "scan-cell") {
    const n = Number(t.dataset.h), f = t.dataset.f;
    let h = S.scan.holes.find((x) => x.hole === n);
    if (!h) {
      h = { hole: n, values: {}, status: {}, touched: {} };
      S.scan.holes.push(h);
    }
    let v = t.value.trim();
    if (v === "") v = null;
    else if (SCAN_FIELDS[S.scan.kind].find((x) => x[0] === f)[2] === "num") {
      v = Number(v);
      if (!Number.isInteger(v) || v < 0 || v > 900) {
        toast("Enter a whole number.", "error");
        v = null;
      }
    } else if (f === "shortMiss") v = v === "true";
    h.values[f] = v;
    h.touched = { ...h.touched || {}, [f]: true };
    t.className = "";
  }
});
document.addEventListener("input", (e) => {
  const t = e.target, b = t.dataset.bind;
  if (b === "draft-notes") {
    data.draft.notes = t.value;
    persist();
  }
  if (b === "drill-result") S.practice.results[t.dataset.i] = t.value;
  if (b === "scan-tee") S.scanTee = t.value;
});
window.addEventListener("online", () => {
  if (["scan", "course"].includes(route().name)) render();
});
window.addEventListener("offline", () => {
  if (["scan", "course"].includes(route().name)) render();
});
matchMedia("(prefers-color-scheme: dark)").addEventListener?.("change", applyTheme);
if ("serviceWorker" in navigator && (location.protocol === "https:" || location.hostname === "localhost" || location.hostname === "127.0.0.1")) {
  navigator.serviceWorker.register("./sw.js").then((reg) => {
    const check = (w) => {
      if (w && navigator.serviceWorker.controller) {
        S.swWaiting = w;
        render();
      }
    };
    if (reg.waiting) check(reg.waiting);
    reg.addEventListener("updatefound", () => {
      const w = reg.installing;
      w?.addEventListener("statechange", () => {
        if (w.state === "installed") check(w);
      });
    });
  }).catch(() => {
  });
  let reloaded = false;
  navigator.serviceWorker.addEventListener("controllerchange", () => {
    if (S.swWaiting && !reloaded) {
      reloaded = true;
      location.reload();
    }
  });
}
applyTheme();
if (DEMO) document.title = "Attest Golf \u2014 demo";
render();
window.__attest = { get data() {
  return data;
}, S, VERSION, DEMO };
