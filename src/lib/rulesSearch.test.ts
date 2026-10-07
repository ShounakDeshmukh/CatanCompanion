import test from "node:test";
import assert from "node:assert/strict";

import { baseRules } from "../data/rules/base";
import { citiesKnightsRules } from "../data/rules/citiesKnights";
import { seafarersRules } from "../data/rules/seafarers";
import { highlight, queryWords, searchRules } from "./rulesSearch";

const RULESETS = [baseRules, seafarersRules, citiesKnightsRules];

test("a search finds sections in every rule set, whatever the capitals", () => {
  const found = searchRules(RULESETS, "ROBBER");
  assert.ok(found.length > 0);
  assert.ok(found.some((match) => match.ruleset.id === "base"));
  for (const { section } of found) {
    assert.match(`${section.title} ${section.body.join(" ")}`, /robber/i);
  }
});

test("every word has to appear, in any order", () => {
  const both = searchRules(RULESETS, "longest road");
  assert.deepEqual(both, searchRules(RULESETS, "road  longest"));
  assert.ok(both.length <= searchRules(RULESETS, "road").length);
  assert.deepEqual(searchRules(RULESETS, "road zzzzqq"), []);
});

test("an empty search finds nothing", () => {
  assert.deepEqual(queryWords("   "), []);
  assert.deepEqual(searchRules(RULESETS, "  "), []);
});

test("highlighting marks the words and escapes everything else", () => {
  assert.equal(highlight("Move the Robber", ["rob"]), "Move the <mark>Rob</mark>ber");
  assert.equal(highlight("a < b & c", ["b"]), "a &lt; <mark>b</mark> &amp; c");
  assert.equal(highlight("1 (one) point", ["(one)"]), "1 <mark>(one)</mark> point");
  assert.equal(highlight("plain", []), "plain");
});

test("section ids are unique within a rule set, so links to them are unambiguous", () => {
  for (const ruleset of RULESETS) {
    const ids = ruleset.sections.map((section) => section.id);
    assert.equal(new Set(ids).size, ids.length, ruleset.id);
  }
});
