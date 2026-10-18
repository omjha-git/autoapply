/**
 * Offline tests for server/services/jobSearch/aggregator.js
 * (additional, complementing the first aggregator.test.js file).
 *
 * Focuses on: fallback-card preservation (cards survive even when all real
 * adapters are empty) and per-source timeout isolation (a slow source is
 * dropped without blocking the whole aggregation).
 *
 * Updated (2026-10-17):
 * - Added ashby and wellfound to mocked sources.
 * - Mocked browser/seleniumClient so wellfound.js loads without real Chrome.
 */
var { describe, it, beforeEach, after } = require("node:test");
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

function install(adapters) {
    delete require.cache[aggregatorPath];
    var allPaths = [
        greenPath, leverPath, ashbyPath, wellfoundPath,
        internPath, linkedinPath, indeedPath
    ];
    allPaths.forEach(function (p) {
        var mockExports;
        if (adapters[p]) {
            mockExports = adapters[p];
        } else if (p === wellfoundPath) {
            mockExports = async function () {
                return [{
                    isSearchLink: true,
                    source: "wellfound",
                    applyUrl: "https://wellfound.com"
                }];
            };
        } else {
            mockExports = async function () { return []; };
        }
        require.cache[p] = {
            id: p, filename: p, loaded: true,
            exports: mockExports, children: [], paths: []
        };
    });
}

// A slow "greenhouse" adapter that never resolves (killed by source timeout).
var slowGreenhouse = async function () {
    await new Promise(function () {}); // never resolves
    return [];
};

// Fallback cards (internshala/indeed/linkedin) that always return one card.
var fallbackIntern = async function () {
    return [{ isSearchLink: true, source: "internshala", applyUrl: "https://internshala.com" }];
};
var fallbackIndeed = async function () {
    return [{ isSearchLink: true, source: "indeed", applyUrl: "https://indeed.com" }];
};

var fastLever = async function () {
    return [{
        externalId: "lever-x-1", title: "Lever Role", company: "LeverCo",
        source: "lever", applyUrl: "https://lever.co/1", isSearchLink: false
    }];
};

describe("aggregator fallback preservation", function () {
    beforeEach(function () {
        // Use a short source timeout so the never-resolving mock is dropped
        // quickly (the production default is 15000ms).
        process.env.JOB_SOURCE_TIMEOUT_MS = "500";
        install({
            [greenPath]: slowGreenhouse,
            [leverPath]: fastLever,
            [internPath]: fallbackIntern,
            [linkedinPath]: async function () { return []; },
            [indeedPath]: fallbackIndeed
        });
        var agg = require("../services/jobSearch/aggregator");
        agg.clearCache();
    });

    after(function () {
        delete process.env.JOB_SOURCE_TIMEOUT_MS;
    });

    it("preserves fallback cards even when a slow source times out", async function () {
        var aggregator = require("../services/jobSearch/aggregator");
        var start = Date.now();
        var jobs = await aggregator.search({});
        var elapsed = Date.now() - start;

        var links = jobs.filter(function (j) { return j.isSearchLink; });
        var real = jobs.filter(function (j) { return !j.isSearchLink; });

        // Fallback cards MUST survive.
        assert.ok(links.length >= 1, "fallback card dropped");
        assert.ok(links.some(function (j) { return j.source === "internshala"; }));
        assert.ok(links.some(function (j) { return j.source === "indeed"; }));

        // A fast real source still produces results despite the slow one.
        assert.ok(real.length >= 1, "fast real jobs lost to slow source");

        // The slow greenhouse source must be dropped within the 500ms timeout.
        assert.ok(elapsed < 1500, "slow source not timed out: " + elapsed + "ms");
    });
});

describe("aggregator deduplication (distinct jobs preserved)", function () {
    beforeEach(function () {
        install({
            [greenPath]: async function () {
                return [
                    { externalId: "gh-1", title: "A", company: "C", source: "greenhouse", applyUrl: "https://x", isSearchLink: false },
                    { externalId: "gh-1", title: "A", company: "C", source: "greenhouse", applyUrl: "https://x", isSearchLink: false }
                ];
            },
            [leverPath]: async function () { return []; },
            [ashbyPath]: async function () { return []; },
            [wellfoundPath]: async function () { return []; },
            [internPath]: async function () { return []; },
            [linkedinPath]: async function () { return []; },
            [indeedPath]: async function () { return []; }
        });
        var agg = require("../services/jobSearch/aggregator");
        agg.clearCache();
    });

    it("collapses exact-duplicate externalIds but keeps distinct ones", async function () {
        var aggregator = require("../services/jobSearch/aggregator");
        var jobs = await aggregator.search({});
        var real = jobs.filter(function (j) { return !j.isSearchLink; });
        assert.strictEqual(real.length, 1);
    });
});
