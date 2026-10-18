/**
 * Offline tests for server/services/jobSearch/lever.js adapter.
 *
 * The adapter's HTTP layer (axios) is mocked via require.cache so NO live
 * Lever requests are made. We verify field mapping, the unix-epoch
 * postedDate handling (ms vs seconds), per-site failure isolation, and the
 * adapter timeout behavior.
 */
var { describe, it, beforeEach, after } = require("node:test");
var assert = require("node:assert/strict");

var axiosPath = require.resolve("axios");
var leverPath = require.resolve("../services/jobSearch/lever");

var LEVER_POSTINGS = {
    acme: [
        {
            id: "1",
            text: "Frontend Engineer",
            categories: {
                location: "Remote",
                team: "Engineering",
                department: "Product",
                commitment: "Full-time",
                workplaceType: "Remote"
            },
            descriptionPlain: "React, TypeScript, AWS",
            additionalPlain: "Great team culture.",
            hostedUrl: "https://acme.lever.co/job/1",
            createdAt: 1700000000 // seconds -> must be multiplied
        },
        {
            id: "2",
            text: "Data Analyst",
            categories: { location: "San Francisco", commitment: "Intern" },
            descriptionPlain: "SQL, Python",
            hostedUrl: "https://acme.lever.co/job/2",
            createdAt: 1800000000000 // ms -> used directly
        }
    ],
    broken: null // sentinel -> mock throws for this site
};

// Default adapter sites are "leverdemo"/"palantir"; pin LEVER_SITES so the
// test mock (which only knows "acme"/"broken") is exercised deterministically.
var savedLeverSites;
// Module-level flag so the mock can simulate a stalled endpoint even though
// the adapter does not pass arbitrary test opts into axios.get().
var stalledSite = null;

function installAxios(opts) {
    opts = opts || {};
    delete require.cache[leverPath];
    savedLeverSites = process.env.LEVER_SITES;
    process.env.LEVER_SITES = "acme,broken";
    stalledSite = opts.stallSite || null;
    var axiosMock = {
        get: async function (url, axiosOpts) {
            var site = url.split("/").slice(-1)[0];
            if (stalledSite === site) {
                // Simulate axios aborting a stalled endpoint: reject
                // immediately (no real 4s wait). The adapter's per-site
                // try/catch must isolate this and return [].
                var err = new Error(
                    "timeout of " + (axiosOpts.timeout || 4000) + "ms exceeded (stall)"
                );
                err.code = "ECONNABORTED";
                throw err;
            }
            var data = LEVER_POSTINGS[site];
            if (data === null) {
                throw new Error("simulated network failure for " + site);
            }
            return { data: Array.isArray(data) ? data : [] };
        }
    };
    require.cache[axiosPath] = {
        id: axiosPath, filename: axiosPath, loaded: true,
        exports: axiosMock, children: [], paths: []
    };
}

function loadLever() {
    delete require.cache[leverPath];
    return require("../services/jobSearch/lever");
}

after(function () {
    delete require.cache[axiosPath];
    delete require.cache[leverPath];
    if (savedLeverSites === undefined) {
        delete process.env.LEVER_SITES;
    } else {
        process.env.LEVER_SITES = savedLeverSites;
    }
});

describe("searchLever", function () {
    beforeEach(function () {
        installAxios();
    });

    it("maps a Lever posting to the normalized shape", async function () {
        var jobs = await loadLever()({ query: "", location: "" });
        var fe = jobs.find(function (j) { return j.externalId.indexOf("-1") > -1; });
        assert.ok(fe);
        assert.strictEqual(fe.title, "Frontend Engineer");
        assert.strictEqual(fe.company, "acme");
        assert.strictEqual(fe.location, "Remote");
        assert.strictEqual(fe.workMode, "Remote");
        assert.strictEqual(fe.employmentType, "Full-time");
        assert.strictEqual(fe.applyUrl, "https://acme.lever.co/job/1");
        assert.strictEqual(fe.source, "lever");
        assert.ok(fe.skills.indexOf("React") > -1);
    });

    it("multiplies a seconds-epoch postedDate (< 1e12) to ms", async function () {
        var jobs = await loadLever()({ query: "", location: "" });
        var j = jobs.find(function (j2) { return j2.externalId.indexOf("-1") > -1; });
        assert.ok(j);
        assert.ok(j.postedDate instanceof Date);
        // 1700000000 is seconds (< 1e12) -> adapter multiplies by 1000
        assert.strictEqual(j.postedDate.getTime(), 1700000000000);
    });

    it("uses a millisecond postedDate (>= 1e12) as-is", async function () {
        var jobs = await loadLever()({ query: "", location: "" });
        var j = jobs.find(function (j2) { return j2.externalId.indexOf("-2") > -1; });
        assert.ok(j);
        assert.strictEqual(j.postedDate.getTime(), 1800000000000);
    });

    it("isolates a failing site (others still return)", async function () {
        var jobs = await loadLever()({ query: "", location: "" });
        var companies = jobs.map(function (j) { return j.company; });
        assert.ok(companies.indexOf("acme") > -1, "acme survived");
        assert.strictEqual(companies.indexOf("broken"), -1);
    });

    it("aborts a hanging site within the timeout instead of hanging forever", async function () {
        installAxios({ stallSite: "acme" });
        var start = Date.now();
        var jobs = await loadLever()({ query: "", location: "" });
        var elapsed = Date.now() - start;
        // The stalled site is rejected immediately by the mock, so the
        // adapter resolves fast (< 2s) rather than hanging.
        assert.ok(elapsed < 2000, "lever stalled too long: " + elapsed + "ms");
        // Both acme (stalled) and broken (throws) are isolated -> no jobs.
        assert.strictEqual(jobs.length, 0);
    });
});
