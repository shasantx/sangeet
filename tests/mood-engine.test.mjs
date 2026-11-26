import test from "node:test";
import assert from "node:assert/strict";
import {
  buildMoodProfile,
  classifyListen,
  discoveryQueries,
  familiarForSlot,
  inferTags,
  rankTracks,
  slotForDate,
  topTags
} from "../src/lib/mood-engine.ts";

const at = (day, hour) => new Date(2026, 10, day, hour, 15).getTime();
const track = (id, title, artist) => ({ id, title, artist, thumbnail: "", duration: 200 });
const ev = (t, ts, outcome, tags = []) => ({ track: t, ts, listened: outcome === "skip" ? 8 : 190, outcome, tags });

test("time slots cover the whole day", () => {
  assert.equal(slotForDate(new Date(2026, 10, 26, 7)), "morning");
  assert.equal(slotForDate(new Date(2026, 10, 26, 13)), "afternoon");
  assert.equal(slotForDate(new Date(2026, 10, 26, 18)), "evening");
  assert.equal(slotForDate(new Date(2026, 10, 26, 22)), "night");
  assert.equal(slotForDate(new Date(2026, 10, 26, 2)), "lateNight");
});

test("tags are inferred from titles, artists and queries", () => {
  assert.deepEqual(inferTags("lofi study beats").sort(), ["lofi"]);
  assert.ok(inferTags("Sajjan Raj Vaidya - Hataarindai").includes("nepali"));
  assert.ok(inferTags("Tum Hi Ho", "Arijit Singh").includes("hindi"));
  assert.ok(inferTags("Shiva Bhajan").includes("devotional"));
  assert.deepEqual(inferTags(""), []);
});

test("plays are classified as complete, partial, skip or ignored", () => {
  assert.equal(classifyListen(1, 200), null);
  assert.equal(classifyListen(10, 200), "skip");
  assert.equal(classifyListen(100, 200), "partial");
  assert.equal(classifyListen(170, 200), "complete");
  assert.equal(classifyListen(130, 0), "complete");
});

test("new listeners get time-of-day starter picks", () => {
  const late = buildMoodProfile([], new Date(2026, 10, 26, 2));
  assert.equal(topTags(late, 1)[0], "lofi");
  const afternoon = buildMoodProfile([], new Date(2026, 10, 26, 13));
  assert.equal(topTags(afternoon, 1)[0], "pop");
});

test("learned night taste overrides priors and stays out of the morning", () => {
  const nepaliLove = track("aaaaaaaaaaa", "Maya Nepali love song", "Sajjan Raj Vaidya");
  const events = [];
  for (let d = 10; d < 25; d++) events.push(ev(nepaliLove, at(d, 22), "complete", ["nepali", "romantic"]));

  const night = buildMoodProfile(events, new Date(2026, 10, 26, 22));
  assert.ok(night.evidence > 3);
  const nightTop = topTags(night, 2);
  assert.ok(nightTop.includes("nepali") && nightTop.includes("romantic"), nightTop.join(","));
  assert.ok(discoveryQueries(night).some((q) => q.includes("nepali")));

  const morning = buildMoodProfile(events, new Date(2026, 10, 26, 8));
  assert.equal(morning.evidence, 0, "night plays must not leak into the morning");
});

test("repeatedly skipped songs are dropped and liked artists rise in autoplay", () => {
  const liked = track("liked000001", "Song A", "Bipul Chettri");
  const skipped = track("skipped0001", "Song B", "Someone Else");
  const events = [
    ev(liked, at(24, 19), "complete"),
    ev(liked, at(25, 19), "complete"),
    ev(skipped, at(24, 19), "skip"),
    ev(skipped, at(25, 19), "skip")
  ];
  const profile = buildMoodProfile(events, new Date(2026, 10, 26, 19));
  const radio = [
    track("other000001", "Random", "Other"),
    skipped,
    track("newbipul001", "New Song", "Bipul Chettri")
  ];
  const ranked = rankTracks(radio, profile).map((t) => t.id);
  assert.ok(!ranked.includes("skipped0001"));
  assert.equal(ranked[0], "newbipul001");
  assert.deepEqual(familiarForSlot(events, profile).map((t) => t.id), ["liked000001"]);
});
