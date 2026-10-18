/**
 * Offline tests for the search-link fallback adapters:
 *   - indeed.js  (Indeed)
 *   - internshala.js (Internshala)
 *   - linkedin.js (LinkedIn)
 *
 * These portals have NO public job-listings API and must return exactly ONE
 * honestly-labeled fallback card (isSearchLink: true) with NO fabricated
 * live fields (no postedDate, salary, skills, match score).
 */
var { describe, it } = require("node:test");
var assert = require("node:assert/strict");

var searchIndeed = require("../services/jobSearch/indeed");
var searchInternshala = require("../services/jobSearch/internshala");
var searchLinkedIn = require("../services/jobSearch/linkedin");

describe("indeed fallback", () => {
    it("returns one search-link card, no auth required", async () => {
        var jobs = await searchIndeed({ query: "react", location: "berlin" });
        assert.strictEqual(jobs.length, 1);
        assert.strictEqual(jobs[0].isSearchLink, true);
        assert.strictEqual(jobs[0].requiresAuth, false);
    });

    it("URL preserves query+location with no stray '?' when empty", async () => {
        var jobs = await searchIndeed({ query: "data scientist", location: "New York" });
        var url = jobs[0].applyUrl;
        assert.match(url, /^https:\/\/www\.indeed\.com\/jobs\?/);
        assert.ok(url.includes("q=data+scientist"));
        assert.ok(url.includes("l=New+York"));

        var empty = await searchIndeed({});
        assert.strictEqual(empty[0].applyUrl, "https://www.indeed.com/jobs");
    });

    it("never emits fabricated live fields", async () => {
        var card = (await searchIndeed({ query: "x" }))[0];
        assert.strictEqual(card.postedDate, null);
        assert.strictEqual(card.salary, "");
        assert.deepEqual(card.skills, []);
        assert.ok(card.unavailableReason);
    });
});

describe("internshala fallback", () => {
    it("returns one search-link card, employmentType = Internship", async () => {
        var jobs = await searchInternshala({ query: "python", location: "bangalore" });
        assert.strictEqual(jobs.length, 1);
        assert.strictEqual(jobs[0].isSearchLink, true);
        assert.strictEqual(jobs[0].employmentType, "Internship");
        assert.strictEqual(jobs[0].requiresAuth, false);
    });

    it("URL preserves keyword+location with no stray '?' when empty", async () => {
        var jobs = await searchInternshala({ query: "ml", location: "Delhi" });
        var url = jobs[0].applyUrl;
        assert.match(url, /^https:\/\/internshala\.com\/internships\?/);
        assert.ok(url.includes("keyword=ml"));
        assert.ok(url.includes("location=Delhi"));

        var empty = await searchInternshala({});
        assert.strictEqual(empty[0].applyUrl, "https://internshala.com/internships");
    });

    it("never emits fabricated live fields", async () => {
        var card = (await searchInternshala({ query: "x" }))[0];
        assert.strictEqual(card.postedDate, null);
        assert.strictEqual(card.salary, "");
        assert.deepEqual(card.skills, []);
        assert.ok(card.unavailableReason);
    });
});

describe("linkedin fallback", () => {
    it("returns one search-link card, requiresAuth = true", async () => {
        var jobs = await searchLinkedIn({ query: "engineer", location: "sf" });
        assert.strictEqual(jobs.length, 1);
        assert.strictEqual(jobs[0].isSearchLink, true);
        assert.strictEqual(jobs[0].requiresAuth, true);
    });

    it("URL preserves keywords+location with no stray '?' when empty", async () => {
        var jobs = await searchLinkedIn({ query: "devops", location: "Austin" });
        var url = jobs[0].applyUrl;
        assert.match(url, /^https:\/\/www\.linkedin\.com\/jobs\/search\/\?/);
        assert.ok(url.includes("keywords=devops"));
        assert.ok(url.includes("location=Austin"));

        var empty = await searchLinkedIn({});
        assert.strictEqual(
            empty[0].applyUrl,
            "https://www.linkedin.com/jobs/search/"
        );
    });

    it("never emits fabricated live fields", async () => {
        var card = (await searchLinkedIn({ query: "x" }))[0];
        assert.strictEqual(card.postedDate, null);
        assert.strictEqual(card.salary, "");
        assert.deepEqual(card.skills, []);
        assert.ok(card.unavailableReason);
    });
});
