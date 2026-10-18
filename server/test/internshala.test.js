/**
 * Internshala adapter — offline unit tests (no network).
 *
 * Internshala has no public API, so the adapter returns an honest
 * search-link fallback card. These tests pin the adapter's contract:
 *   - always returns exactly ONE clearly-labeled search-link card
 *   - the source URL preserves query + location filters
 *   - the card is flagged isSearchLink / requiresAuth: false
 *   - the adapter is idempotent and never invents live listings
 */
var { describe, it } = require("node:test");
var assert = require("node:assert/strict");

var searchInternshala = require("../services/jobSearch/internshala");

describe("searchInternshala", () => {
    describe("search-link fallback contract", () => {
        it("returns exactly one card flagged as a search link", async () => {
            var jobs = await searchInternshala({
                query: "react developer",
                location: "bangalore"
            });
            assert.strictEqual(jobs.length, 1);
            assert.strictEqual(jobs[0].isSearchLink, true);
            assert.strictEqual(jobs[0].requiresAuth, false);
        });

        it("marks the card as unavailable (no live feed)", async () => {
            var jobs = await searchInternshala({ query: "python" });
            assert.ok(jobs[0].unavailableReason);
            assert.match(
                jobs[0].unavailableReason,
                /Internshala.*has no public API/i
            );
        });

        it("does NOT emit fake live job fields (postedDate/salary/skills)", async () => {
            var jobs = await searchInternshala({ query: "java" });
            var card = jobs[0];
            // A real listing would carry a postedDate or stipend; a fallback
            // must not invent them.
            assert.strictEqual(card.postedDate, null);
            assert.strictEqual(card.salary, "");
            assert.deepEqual(card.skills, []);
        });
    });

    describe("URL / query handling", () => {
        it("builds a query-param URL preserving query and location", async () => {
            var jobs = await searchInternshala({
                query: "data science",
                location: "Delhi"
            });
            var url = jobs[0].sourceUrl;
            assert.match(
                url,
                /^https:\/\/internshala\.com\/internships\?/
            );
            // URLSearchParams encodes spaces as '+' by default
            assert.ok(url.includes("keyword=data+science"));
            assert.ok(url.includes("location=Delhi"));
        });

        it("returns the bare page when no query/location provided", async () => {
            var jobs = await searchInternshala({});
            assert.strictEqual(
                jobs[0].sourceUrl,
                "https://internshala.com/internships"
            );
        });

        it("treats whitespace-only inputs as absent", async () => {
            var jobs = await searchInternshala({
                query: "   ",
                location: "  "
            });
            assert.strictEqual(
                jobs[0].sourceUrl,
                "https://internshala.com/internships"
            );
        });
    });

    describe("deduplication & identity", () => {
        it("produces a stable externalId for the same search", async () => {
            var a = await searchInternshala({ query: "python", location: "mumbai" });
            var b = await searchInternshala({ query: "python", location: "mumbai" });
            assert.strictEqual(a[0].externalId, b[0].externalId);
        });

        it("produces a different externalId for different locations", async () => {
            var a = await searchInternshala({ query: "python", location: "mumbai" });
            var b = await searchInternshala({ query: "python", location: "chennai" });
            assert.notStrictEqual(a[0].externalId, b[0].externalId);
        });
    });
});

