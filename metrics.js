// Pure metric functions. No DOM here, so they run in the browser and in Node tests.

export const STAGES = [
  { key: "new", label: "Open leads" },
  { key: "contacted", label: "In conversation" },
  { key: "signed", label: "Signed" },
  { key: "waiting_docs", label: "Collecting docs" },
  { key: "filed", label: "Filed, waiting" },
  { key: "paid", label: "Money received" },
];

const DAY = 86_400_000;
const days = (a, b) => (new Date(a) - new Date(b)) / DAY;

/** How many cases sit in each stage right now. */
export function funnel(cases) {
  const counts = Object.fromEntries(STAGES.map((s) => [s.key, 0]));
  for (const c of cases) if (c.stage in counts) counts[c.stage]++;
  return STAGES.map((s) => ({ ...s, count: counts[s.key] }));
}

/** Cases stuck in one stage longer than its limit (in days). */
export function bottlenecks(cases, now, limits = { new: 2, contacted: 7, waiting_docs: 21, filed: 120 }) {
  const out = [];
  for (const [stage, limit] of Object.entries(limits)) {
    const stuck = cases.filter((c) => c.stage === stage && days(now, c.stage_since) > limit);
    if (stuck.length) out.push({ stage, limit, count: stuck.length });
  }
  return out.sort((a, b) => b.count - a.count);
}

/** Share of leads created in the last 7 days that got a first response. */
export function responseRate(cases, now) {
  const recent = cases.filter((c) => days(now, c.created_at) <= 7);
  if (!recent.length) return null;
  return recent.filter((c) => c.first_contact_at).length / recent.length;
}

export function closedThisWeek(cases, now) {
  return cases.filter((c) => c.signed_at && days(now, c.signed_at) <= 7).length;
}

/** Expected income from signed / in-progress cases (fee × probability by stage). */
export function expectedIncome(cases, probability = { signed: 0.6, waiting_docs: 0.7, filed: 0.9 }) {
  return Math.round(
    cases.reduce((sum, c) => sum + (probability[c.stage] ?? 0) * (c.expected_fee ?? 0), 0)
  );
}

export function closingsByRep(cases, now, windowDays = 30) {
  const map = {};
  for (const c of cases) {
    if (c.signed_at && days(now, c.signed_at) <= windowDays) { const k = c.owner ?? "Unassigned"; map[k] = (map[k] ?? 0) + 1; }
  }
  return Object.entries(map)
    .map(([rep, count]) => ({ rep, count }))
    .sort((a, b) => b.count - a.count);
}

export function leadSources(cases) {
  const map = {};
  for (const c of cases) map[c.source] = (map[c.source] ?? 0) + 1;
  const total = cases.length || 1;
  return Object.entries(map)
    .map(([source, count]) => ({ source, count, share: count / total }))
    .sort((a, b) => b.count - a.count);
}

/** Data quality: the dashboard is only as good as the data behind it. */
export function dataQuality(cases) {
  const missing = cases.filter((c) => !c.owner || !c.stage_since || !c.source).length;
  return { total: cases.length, missing, ok: cases.length ? 1 - missing / cases.length : 1 };
}
