/**
 * Offline tests for server/services/jobSearch/aggregator.js
 *
 * Tests that Selenium-dependent sources (wellfound) are properly isolated:
 *   - When selenium-webdriver is unavailable, wellfound returns search-link
 *     cards (honest fallback).
 *   - When the source adapter itself throws, it is caught and returns []
 *     without breaking the whole aggregation.
 *
 * All adapters are mocked via require.cache so NO live network requests
 * are made.
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

// Mock seleniumClient: launchBrowser returns null (Selenium unavailable)
var mockSelenium = {
    launchBrowser: async function () { return null; },
    closeBrowser: async function () {},
    waitForNetworkIdle: async function () { return true; },
    SELENIUM_ENABLED: false
};
require.cache[seleniumPath] = {
    id: seleniumPath, filename: seleniumPath, loaded: true,
    exports: mockSelenium, children: [], paths: []
};

function noopAdapter() {
    return async function () { return []; };
}

function install(adapters) {
    delete require.cache[aggregatorPath];
    var allPaths = [
        greenPath, leverPath, ashbyPath, wellfoundPath,
        internPath, linkedinPath, indeedPath
    ];
    allPaths.forEach(function (p) {
        require.cache[p] = {
            id: p, filename: p, loaded: true,
            exports: adapters[p] || noopAdapter(),
            children: [], paths: []
        };
    });
}

after(function () {
    [aggregatorPath, greenPath, leverPath, ashbyPath,
     wellfoundPath, internPath, linkedinPath, indeedPath,
     seleniumPath].forEach(function (p) {
        delete require.cache[p];
    });
});

describe("aggregator — selenium-dependent source isolation", function () {
    beforeEach(function () {
        install({
            [greenPath]: async function () {
                return [
                    {
                        externalId: "gh-1", title: "Frontend",
                        company: "Stripe", source: "greenhouse",
                        applyUrl: "https://a", isSearchLink: false
                    }
                ];
            },
            [wellfoundPath]: async function () {
                // Simulate wellfound with Selenium unavailable -> returns
                // search-link cards.
                return [
                    {
                        isSearchLink: true, source: "wellfound",
                        applyUrl: "https://wellfound.com/jobs?q=engineer"
                    }
                ];
            }
        });
        var agg = require("../services/jobSearch/aggregator");
        agg.clearCache();
    });

    it("wellfound returns search-link cards when Selenium is unavailable", async function () {
        var aggregator = require("../services/jobSearch/aggregator");
        var jobs = await aggregator.search({});
        var wf = jobs.filter(function (j) {
            return j.source === "wellfound";
        });
        assert.ok(wf.length >= 1, "wellfound should return search-link cards");
        assert.ok(
            wf.every(function (j) { return j.isSearchLink; }),
            "all wellfound cards should be search links"
        );
        assert.ok(wf[0].applyUrl.includes("wellfound.com"));
    });

    it("wellfound search-link cards survive alongside real jobs", async function () {
        var aggregator = require("../services/jobSearch/aggregator");
        var jobs = await aggregator.search({});
        var real = jobs.filter(function (j) {
            return !j.isSearchLink;
        });
        var links = jobs.filter(function (j) {
            return j.isSearchLink;
        });
        assert.ok(real.length >= 1, "real greenhouse job should be present");
        assert.ok(links.length >= 1, "search-link card should be present");
        assert.ok(
            links.some(function (j) {
                return j.source === "wellfound";
            }),
            "wellfound search-link should be present"
        );
    });

    it("a throwing wellfound adapter is isolated via runSourceSafely", async function () {
        install({
            [greenPath]: async function () {
                return [
                    {
                        externalId: "gh-1", title: "X",
                        company: "C", source: "greenhouse",
                        applyUrl: "https://a", isSearchLink: false
                    }
                ];
            },
            [wellfoundPath]: async function () {
                throw new Error("selenium crashed");
            }
        });
        var aggregator = require("../services/jobSearch/aggregator");
        aggregator.clearCache();
        var jobs = await aggregator.search({});
        var real = jobs.filter(function (j) {
            return !j.isSearchLink;
        });
        assert.ok(real.length >= 1, "greenhouse job should survive wellfound failure");
        var wf = jobs.filter(function (j) {
            return j.source === "wellfound";
        });
        assert.strictEqual(wf.length, 0, "broken wellfound should produce nothing");
    });

    it("single-source search for wellfound returns only its cards", async function () {
        var aggregator = require("../services/jobSearch/aggregator");
        aggregator.clearCache();
        var jobs = await aggregator.search({ source: "wellfound" });
        assert.ok(jobs.length >= 1);
        assert.ok(
            jobs.every(function (j) { return j.source === "wellfound"; })
        );
        assert.ok(
            jobs.every(function (j) { return j.isSearchLink; })
        );
    });
});
