/**
 * Indeed adapter — offline unit tests (no network).
 *
 * Indeed has no public seeker-facing listings API and its robots.txt /
 * ToS prohibit automated scraping, so the adapter returns an honest
 * search-link fallback card. These tests verify the fallback contract:
 *   - returns exactly ONE search-link card
 *   - preserves the query + location in the public URL
 *   - never invents live job fields
 *   - no credentials are required
 */
var { describe, it } = require("node:test");
var assert = require("node:assert/strict");

var searchIndeed = require("../services/jobSearch/indeed");

describe("searchIndeed", () => {
    describe("search-link fallback contract", () => {
        it("returns exactly one card flagged as a search link", async () => {
            var jobs = await searchIndeed({
                query: "software engineer",
                location: "san francisco"
            });
            assert.strictEqual(jobs.length, 1);
            assert.strictEqual(jobs[0].isSearchLink, true);
            assert.strictEqual(jobs[0].requiresAuth, false);
        });

        it("marks the card as unavailable (no live feed)", async () => {
            var jobs = await searchIndeed({ query: "python" });
            assert.ok(jobs[0].unavailableReason);
            assert.match(
                jobs[0].unavailableReason,
                /no public job-search API/i
            );
        });

        it("does NOT emit fake live job fields", async () => {
            var jobs = await searchIndeed({ query: "java" });
            var card = jobs[0];
            assert.strictEqual(card.postedDate, null);
            assert.strictEqual(card.salary, "");
            assert.deepEqual(card.skills, []);
                });

        it("carries resultType=search_link", async () => {
            var card = (await searchIndeed({ query: "java" }))[0];
            assert.strictEqual(card.resultType, "search_link");
        });
    });

    describe("URL / query handling", () => {
        it("builds a query-param URL preserving query and location", async () => {
            var jobs = await searchIndeed({
                query: "data scientist",
                location: "New York"
            });
            var url = jobs[0].sourceUrl;
            assert.match(url, /^https:\/\/www\.indeed\.com\/jobs\?/);
            assert.ok(url.includes("q=data+scientist"));
            assert.ok(url.includes("l=New+York"));
        });

        it("returns the bare page when no query/location provided (no stray '?')", async () => {
            var jobs = await searchIndeed({});
            assert.strictEqual(
                jobs[0].sourceUrl,
                "https://www.indeed.com/jobs"
            );
        });

        it("treats whitespace-only inputs as absent (no stray '?')", async () => {
            var jobs = await searchIndeed({ query: "  ", location: " " });
            assert.strictEqual(
                jobs[0].sourceUrl,
                "https://www.indeed.com/jobs"
            );
        });
    });

    describe("deduplication & identity", () => {
        it("produces a stable externalId for the same search", async () => {
            var a = await searchIndeed({ query: "dev", location: "austin" });
            var b = await searchIndeed({ query: "dev", location: "austin" });
            assert.strictEqual(a[0].externalId, b[0].externalId);
        });

        it("produces a different externalId for different queries", async () => {
            var a = await searchIndeed({ query: "dev", location: "austin" });
            var b = await searchIndeed({ query: "qa", location: "austin" });
            assert.notStrictEqual(a[0].externalId, b[0].externalId);
        });
    });
});
