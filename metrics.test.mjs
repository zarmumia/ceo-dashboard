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

test("sample data loads and produces a sane funnel", () => {
  const { cases, generated_at } = JSON.parse(readFileSync(new URL("./data/sample.json", import.meta.url)));
  assert.equal(m.funnel(cases).reduce((s, x) => s + x.count, 0), cases.length);
  assert.ok(m.bottlenecks(cases, generated_at).length > 0);
});
