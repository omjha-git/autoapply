/**
 * Offline tests for server/services/jobSearch/aggregator.js
 *
 * The aggregator's source adapters are mocked via require.cache so NO live
 * external requests are made. We test normalization, de-duplication,
 * per-source capping, adapter-failure isolation, caching, and
 * search-link passthrough.
 *
 * Updated (2026-10-17):
 * - Added ashby and wellfound to mocked sources.
 * - Mocked browser/seleniumClient so wellfound.js loads without real Chrome.
 */
var { describe, it, beforeEach } = require("node:test");
var assert = require("node:assert/strict");

var aggregatorPath = require.resolve("../services/jobSearch/aggregator");
var greenPath = require.resolve("../services/jobSearch/greenhouse");
var leverPath = require.resolve("../services/jobSearch/lever");
var ashbyPath = require.resolve("../services/jobSearch/ashby");
var wellfoundPath = require.resolve("../services/jobSearch/wellfound");
var internPath = require.resolve("../services/jobSearch/internshala");
var linkedinPath = require.resolve("../services/jobSearch/linkedin");
var indeedPath = require.resolve("../services/jobSearch/indeed");
var seleniumPath = require.resolve(
    "../services/jobSearch/browser/seleniumClient"
);

// Mock seleniumClient so wellfound.js loads without real Chrome.
// launchBrowser returns null -> wellfound falls back to search-link.
require.cache[seleniumPath] = {
    id: seleniumPath, filename: seleniumPath, loaded: true,
    exports: {
        launchBrowser: async function () { return null; },
        closeBrowser: async function () {},
        waitForNetworkIdle: async function () { return true; },
        SELENIUM_ENABLED: false
    },
    children: [], paths: []
};

var callCounts = {};
function makeAdapter(name, fn) {
    return function (params) {
        callCounts[name] = (callCounts[name] || 0) + 1;
        return fn(params);
    };
}

// Default (mock) implementations.
var greenhouseImpl = async function () {
    return [
        {
            externalId: "gh-1", title: "Frontend Engineer",
            company: "Stripe", location: "Remote",
            description: "React, TypeScript",
            skills: ["React"], source: "greenhouse",
            applyUrl: "https://a",
            postedDate: new Date("2024-01-01")
        }
    ];
};
var leverImpl = async function () { return []; };
var ashbyImpl = async function () { return []; };
var wellfoundImpl = async function () {
    return [
        {
            isSearchLink: true, source: "wellfound",
            applyUrl: "https://wellfound.com"
        }
    ];
};
var internshalaImpl = async function () {
    return [
        {
            externalId: "is-1", title: "Internshala: frontend",
            company: "Internshala", isSearchLink: true,
            source: "internshala",
            applyUrl: "https://internshala.com"
        }
    ];
};
var linkedinImpl = async function () { return []; };
var indeedImpl = async function () { return []; };

function install() {
    delete require.cache[aggregatorPath];
    require.cache[greenPath]     = { id: greenPath, filename: greenPath, loaded: true, exports: makeAdapter("greenhouse", greenhouseImpl), children: [], paths: [] };
    require.cache[leverPath]     = { id: leverPath, filename: leverPath, loaded: true, exports: makeAdapter("lever", leverImpl), children: [], paths: [] };
    require.cache[ashbyPath]     = { id: ashbyPath, filename: ashbyPath, loaded: true, exports: makeAdapter("ashby", ashbyImpl), children: [], paths: [] };
    require.cache[wellfoundPath] = { id: wellfoundPath, filename: wellfoundPath, loaded: true, exports: wellfoundImpl, children: [], paths: [] };
    require.cache[internPath]    = { id: internPath, filename: internPath, loaded: true, exports: makeAdapter("internshala", internshalaImpl), children: [], paths: [] };
    require.cache[linkedinPath]  = { id: linkedinPath, filename: linkedinPath, loaded: true, exports: makeAdapter("linkedin", linkedinImpl), children: [], paths: [] };
    require.cache[indeedPath]    = { id: indeedPath, filename: indeedPath, loaded: true, exports: makeAdapter("indeed", indeedImpl), children: [], paths: [] };
}

// Install mocks BEFORE the first require of the aggregator.
install();
var aggregator = require("../services/jobSearch/aggregator");

beforeEach(function () {
    callCounts = {};
    install();
    var agg = require("../services/jobSearch/aggregator");
    agg.clearCache();
});

describe("normalizeJob (via aggregator export)", function () {
    it("produces a consistent shape with defaults", function () {
        var j = aggregator.normalizeJob({ title: "X", source: "greenhouse" });
        assert.strictEqual(j.title, "X");
        assert.strictEqual(j.company, "Unknown Company");
        assert.strictEqual(j.location, "Unknown");
        assert.strictEqual(j.isSearchLink, false);
        assert.deepEqual(j.skills, []);
    });

    it("preserves explicitly-set fields", function () {
        var d = new Date("2024-06-01");
        var j = aggregator.normalizeJob({
            title: "Y", company: "Acme", location: "NYC",
            workMode: "On-site", employmentType: "Full-time",
            description: "desc", skills: ["Go"], salary: "$100k",
            source: "ashby", sourceUrl: "https://a.com",
            applyUrl: "https://a.com/apply", postedDate: d,
            isSearchLink: false, requiresAuth: true,
            unavailableReason: "ok"
        });
        assert.strictEqual(j.title, "Y");
        assert.strictEqual(j.company, "Acme");
        assert.strictEqual(j.postedDate, d);
        assert.strictEqual(j.requiresAuth, true);
    });

    it("coerces booleans and arrays safely", function () {
        var j = aggregator.normalizeJob({});
        assert.strictEqual(j.isSearchLink, false);
        assert.strictEqual(j.requiresAuth, false);
        assert.deepEqual(j.skills, []);
        assert.strictEqual(j.description, "");
    });

    it("null-coerces a non-Date postedDate", function () {
        var j = aggregator.normalizeJob({ postedDate: "string" });
        assert.strictEqual(j.postedDate, null);
    });
});

describe("deduplicateJobs", function () {
    it("de-duplicates by externalId", async function () {
        greenhouseImpl = async function () {
            return [
                { externalId: "dup-1", title: "A", company: "C", source: "greenhouse", applyUrl: "https://x" },
                { externalId: "dup-1", title: "A", company: "C", source: "greenhouse", applyUrl: "https://x" }
            ];
        };
        install();
        var agg2 = require("../services/jobSearch/aggregator");
        agg2.clearCache();
        var jobs = await agg2.search({});
        var real = jobs.filter(function (j) { return !j.isSearchLink; });
        assert.strictEqual(real.length, 1);
    });

    it("de-duplicates by company+title+applyUrl when externalId missing", async function () {
        greenhouseImpl = async function () {
            return [
                { title: "A", company: "C", applyUrl: "https://x", source: "greenhouse" },
                { title: "A", company: "C", applyUrl: "https://x", source: "greenhouse" }
            ];
        };
        install();
        var agg2 = require("../services/jobSearch/aggregator");
        agg2.clearCache();
        var jobs = await agg2.search({});
        var real = jobs.filter(function (j) { return !j.isSearchLink; });
        assert.strictEqual(real.length, 1);
    });

    it("exports deduplicateJobs as a named function", function () {
        assert.strictEqual(typeof aggregator.deduplicateJobs, "function");
        var result = aggregator.deduplicateJobs([
            { externalId: "1", source: "x" },
            { externalId: "1", source: "x" }
        ]);
        assert.strictEqual(result.length, 1);
    });
});

describe("caps & source isolation", function () {
    it("caps each source at MAX_PER_SOURCE (real jobs)", async function () {
        var many = [];
        for (var i = 0; i < 50; i++) {
            many.push({ externalId: "gh-" + i, title: "Job " + i, company: "C", source: "greenhouse", applyUrl: "https://x" });
        }
        greenhouseImpl = async function () { return many; };
        install();
        var agg2 = require("../services/jobSearch/aggregator");
        agg2.clearCache();
        var jobs = await agg2.search({});
        var real = jobs.filter(function (j) { return !j.isSearchLink; });
        assert.strictEqual(real.length, aggregator.MAX_PER_SOURCE);
    });

    it("isolates a failing adapter (others still return)", async function () {
        greenhouseImpl = async function () { throw new Error("boom"); };
        install();
        var agg2 = require("../services/jobSearch/aggregator");
        agg2.clearCache();
        var jobs = await agg2.search({});
        var real = jobs.filter(function (j) { return !j.isSearchLink; });
        assert.strictEqual(real.length, 0);
        var links = jobs.filter(function (j) { return j.isSearchLink; });
        assert.ok(links.length >= 1);
    });

    it("ignores a source that returns non-array data", async function () {
        greenhouseImpl = async function () { return { not: "an array" }; };
        install();
        var agg2 = require("../services/jobSearch/aggregator");
        agg2.clearCache();
        var jobs = await agg2.search({});
        var real = jobs.filter(function (j) { return !j.isSearchLink; });
        assert.strictEqual(real.length, 0);
    });

    it("includes ashby and wellfound in the default source set", async function () {
        install();
        var agg2 = require("../services/jobSearch/aggregator");
        agg2.clearCache();
        // wellfound returns a search-link card by default
        var jobs = await agg2.search({});
        var wf = jobs.filter(function (j) { return j.source === "wellfound"; });
        assert.ok(wf.length >= 1);
    });
});

describe("runSourceSafely export & caching", function () {
    it("caches results: repeated searches do not re-invoke adapters", async function () {
        var agg2 = require("../services/jobSearch/aggregator");
        agg2.clearCache();
        await agg2.search({ query: "frontend" });
        await agg2.search({ query: "frontend" });
        assert.strictEqual(callCounts.greenhouse, 1);
    });

    it("returns a cached result for an isolated single source", async function () {
        var agg2 = require("../services/jobSearch/aggregator");
        agg2.clearCache();
        await agg2.search({ query: "x", source: "internshala" });
        assert.strictEqual(callCounts.internshala, 1);
        await agg2.search({ query: "x", source: "internshala" });
        assert.strictEqual(callCounts.internshala, 1);
    });

    it("exports runSourceSafely as a named function", function () {
        assert.strictEqual(typeof aggregator.runSourceSafely, "function");
    });

    it("runSourceSafely isolates a throwing source", async function () {
        var result = await aggregator.runSourceSafely(
            "test",
            async function () { throw new Error("fail"); },
            {}
        );
        assert.deepStrictEqual(result, []);
    });

    it("runSourceSafely handles non-array returns", async function () {
        var result = await aggregator.runSourceSafely(
            "test",
            async function () { return { not: "array" }; },
            {}
        );
        assert.deepStrictEqual(result, []);
    });
});
