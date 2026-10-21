// Attest Golf — GolfCourseAPI.com proxy (singular "course").
// Docs: https://api.golfcourseapi.com/docs/api/  (v1)
//   GET /v1/search?search_query=…  → { courses: [{ id, club_name, course_name, location }] }
//   GET /v1/courses/{id}           → { course: { …, tees: { male: [...], female: [...] } } }
//   Each tee: tee_name, course_rating, slope_rating, par_total, number_of_holes,
//             holes: [{ par, yardage, handicap }]   (handicap = stroke index)
// Auth header: "Authorization: Key <API key>". Field names were taken from the
// provider documentation; they could not be checked against a live response
// without a key, so every field is read defensively and missing values stay null.
//
// Environment: GOLFCOURSE_API_KEY (required), ALLOWED_ORIGINS (optional)

const BASE = 'https://api.golfcourseapi.com/v1';
const reply = (status, body, cache = 'no-store') => ({
  statusCode: status,
  headers: { 'Content-Type': 'application/json', 'Cache-Control': cache, 'X-Content-Type-Options': 'nosniff' },
  body: JSON.stringify(body),
});

const recent = new Map();
function limited(ip) {
  const now = Date.now();
  const arr = (recent.get(ip) || []).filter((t) => now - t < 60_000);
  if (arr.length >= 20) return true;
  arr.push(now); recent.set(ip, arr);
  if (recent.size > 2000) recent.clear();
  return false;
}

const numOrNull = (v, lo, hi) => {
  const n = Number(v);
  return v === null || v === undefined || v === '' || !Number.isFinite(n) || n < lo || n > hi ? null : n;
};

function mapTee(t, gender, i) {
  const holes = (Array.isArray(t?.holes) ? t.holes : []).map((h, j) => ({
    hole: numOrNull(h?.hole ?? h?.hole_number, 1, 18) ?? j + 1,
    par: numOrNull(h?.par, 3, 6),
    yardage: numOrNull(h?.yardage ?? h?.yards, 1, 800),
    handicap: numOrNull(h?.handicap ?? h?.stroke_index ?? h?.hcp, 1, 18),
  })).sort((a, b) => a.hole - b.hole);
  return {
    key: `${gender}-${i}`,
    name: String(t?.tee_name || t?.name || `Tee ${i + 1}`).slice(0, 60),
    gender,
    rating: numOrNull(t?.course_rating, 25, 85),
    slope: numOrNull(t?.slope_rating, 55, 155),
    parTotal: numOrNull(t?.par_total, 25, 80),
    totalYards: numOrNull(t?.total_yards, 500, 9000),
    numberOfHoles: numOrNull(t?.number_of_holes, 1, 27) ?? holes.length,
    holes,
  };
}

function mapCourse(raw) {
  const c = raw?.course || raw || {};
  const tees = c.tees || {};
  const list = Array.isArray(tees)
    ? tees.map((t, i) => mapTee(t, '', i))
    : [...(tees.male || []).map((t, i) => mapTee(t, 'M', i)), ...(tees.female || []).map((t, i) => mapTee(t, 'F', i))];
  return {
    id: c.id ?? null,
    name: [c.club_name, c.course_name].filter(Boolean).filter((v, i, a) => a.indexOf(v) === i).join(' — ') || 'Course',
    club: c.club_name || '',
    course: c.course_name || '',
    location: [c.location?.city, c.location?.state, c.location?.country].filter(Boolean).join(', '),
    tees: list,
  };
}

function mapSearch(raw) {
  return (Array.isArray(raw?.courses) ? raw.courses : []).slice(0, 25).map((c) => ({
    id: c.id,
    name: [c.club_name, c.course_name].filter(Boolean).filter((v, i, a) => a.indexOf(v) === i).join(' — ') || 'Course',
    location: [c.location?.city, c.location?.state, c.location?.country].filter(Boolean).join(', '),
  }));
}

exports.handler = async (event) => {
  if (event.httpMethod !== 'GET') return reply(405, { error: 'GET only.' });
  const key = process.env.GOLFCOURSE_API_KEY;
  if (!key) return reply(503, { error: 'Course search is not set up on this site. Use a saved course, scan the course’s card, or enter it once by hand.', code: 'not_configured' });
  const ip = String(event.headers?.['x-nf-client-connection-ip'] || event.headers?.['x-forwarded-for'] || 'unknown').split(',')[0].trim();
  if (limited(ip)) return reply(429, { error: 'Too many searches in a minute. Wait a moment.' });
  const q = String(event.queryStringParameters?.q || '').trim();
  const id = event.queryStringParameters?.id;
  if (id !== undefined && !/^\d{1,12}$/.test(String(id))) return reply(400, { error: 'Invalid course ID.' });
  if (id === undefined && (q.length < 3 || q.length > 80)) return reply(400, { error: 'Type at least three letters of the course name.' });
  const url = id !== undefined ? `${BASE}/courses/${id}` : `${BASE}/search?search_query=${encodeURIComponent(q)}`;
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), 8000);
  try {
    const r = await fetch(url, { headers: { Authorization: `Key ${key}`, Accept: 'application/json' }, signal: controller.signal });
    if (r.status === 401) return reply(502, { error: 'The course service rejected the API key. Check GOLFCOURSE_API_KEY in Netlify.', code: 'provider_auth' });
    if (r.status === 404) return reply(404, { error: 'That course was not found.' });
    if (r.status === 429) return reply(429, { error: 'Course search limit reached for today. Use a saved course or enter it manually.', code: 'provider_limit' });
    if (!r.ok) return reply(502, { error: 'The course service is unavailable. Try again later.', code: 'provider_error' });
    const raw = await r.json();
    if (id !== undefined) return reply(200, mapCourse(raw), 'public, max-age=3600');
    return reply(200, { courses: mapSearch(raw) });
  } catch (e) {
    return reply(e.name === 'AbortError' ? 504 : 502, { error: 'Could not reach the course service. Check your connection or use a saved course.' });
  } finally {
    clearTimeout(timer);
  }
};

exports._test = { mapCourse, mapSearch, mapTee };
