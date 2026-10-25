import { test } from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import * as m from "./metrics.js";

const NOW = "2026-10-20T12:00:00";
const c = (o) => ({ owner: "Rep A", source: "Website", stage: "new", created_at: NOW, stage_since: NOW, ...o });

test("funnel counts every stage, including empty ones", () => {
  const f = m.funnel([c({ stage: "new" }), c({ stage: "new" }), c({ stage: "filed" })]);
  assert.equal(f.find((s) => s.key === "new").count, 2);
  assert.equal(f.find((s) => s.key === "paid").count, 0);
  assert.equal(f.length, m.STAGES.length);
});

test("bottlenecks flag cases stuck past the limit", () => {
  const b = m.bottlenecks([c({ stage: "waiting_docs", stage_since: "2026-09-01T00:00:00" }), c({ stage: "waiting_docs" })], NOW);
  assert.deepEqual(b, [{ stage: "waiting_docs", limit: 21, count: 1 }]);
});

test("response rate looks only at the last 7 days", () => {
  const cases = [
    c({ first_contact_at: NOW }),
    c({ first_contact_at: null }),
    c({ created_at: "2026-09-01T00:00:00", first_contact_at: null }),
  ];
  assert.equal(m.responseRate(cases, NOW), 0.5);
  assert.equal(m.responseRate([], NOW), null);
});

test("expected income weights fees by stage", () => {
  assert.equal(m.expectedIncome([c({ stage: "filed", expected_fee: 1000 }), c({ stage: "new", expected_fee: 1000 })]), 900);
});

test("closings by rep are sorted", () => {
  const r = m.closingsByRep([c({ signed_at: NOW, owner: "B" }), c({ signed_at: NOW, owner: "B" }), c({ signed_at: NOW, owner: "A" })], NOW);
  assert.deepEqual(r.map((x) => x.rep), ["B", "A"]);
});

test("data quality counts incomplete records", () => {
  assert.equal(m.dataQuality([c({}), c({ owner: null })]).missing, 1);
});

test("malformed dates are reported, never silently counted", () => {
  const bad = [c({ stage: "waiting_docs", stage_since: "20/10/2026" }), c({ created_at: "not a date", first_contact_at: NOW })];
  assert.deepEqual(m.bottlenecks(bad, NOW), []);
  assert.equal(m.responseRate(bad, NOW), 0); // only the valid-date case counts, and it has no first contact
  const q = m.dataQuality(bad);
  assert.equal(q.missing, 2);
  assert.equal(q.byField.stage_since, 1);
  assert.equal(q.byField.created_at, 1);
});

test("unknown stages are surfaced instead of vanishing from the funnel", () => {
  const cases = [c({ stage: "new" }), c({ stage: "on_hold" })];
  assert.equal(m.unknownStages(cases), 1);
  assert.equal(m.dataQuality(cases).byField.stage, 1);
});

test("toTime never returns NaN", () => {
  assert.equal(m.toTime("nope"), null);
  assert.equal(m.toTime(null), null);
  assert.equal(typeof m.toTime(NOW), "number");
});

test("sample data loads and produces a sane funnel", () => {
  const { cases, generated_at } = JSON.parse(readFileSync(new URL("./data/sample.json", import.meta.url)));
  assert.equal(m.funnel(cases).reduce((s, x) => s + x.count, 0), cases.length);
  assert.ok(m.bottlenecks(cases, generated_at).length > 0);
});
