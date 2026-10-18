/**
 * Regression tests for server/services/jobSearch/lever.js — slow sources,
 * per-board timeouts, partial results, bounded concurrency, and parent-signal
 * propagation.
 *
 * Measured against the live public Lever API: axios's `timeout` does NOT cancel a
 * slow large-body stream (palantir ~8s/5.9MB completed with timeout:2000), but an
 * AbortController signal cancels promptly (ERR_CANCELED ~1.5s). These tests mock
 * axios (no live network) and use small LEVER_TIMEOUT_MS values.
 */
var { describe, it, before, after } = require("node:test");
var assert = require("node:assert/strict");

var axiosPath = require.resolve("axios");
var leverPath = require.resolve("../services/jobSearch/lever");

var SAMPLE = [
    { id: "1", text: "Frontend Engineer", categories: { location: "Remote", team: "Eng", department: "Product", commitment: "Full-time" }, descriptionPlain: "React, TypeScript", additionalPlain: "Nice team.", hostedUrl: "https://acme.lever.co/job/1", createdAt: 1700000000 },
    { id: "2", text: "Data Analyst", categories: { location: "San Francisco", commitment: "Intern" }, descriptionPlain: "SQL, Python", hostedUrl: "https://acme.lever.co/job/2", createdAt: 1800000000000 }
];

var axiosMockState;

function cancelError() {
    var e = new Error("canceled");
    e.code = "ERR_CANCELED";
    e.name = "CanceledError";
    return e;
}

/**
 * Mock axios.get that honors the per-board AbortController `signal`:
 *   - "slow" sites stay pending until the signal aborts (or `fallbackMs` fires,
 *     which would mean the abort did NOT work — a regression).
 *   - other sites resolve immediately with SAMPLE (or postings[site]).
 * In-flight axios.get calls are counted so bounded concurrency can be asserted.
 */
function installAxios(opts) {
    opts = opts || {};
    var slowSites = opts.slowSites || [];
    var postings = opts.postings || {};
    var fallbackMs = opts.fallbackMs || 5000;

    axiosMockState = { current: 0, max: 0 };

    var axiosMock = {
        get: function (url, axiosOpts) {
            axiosMockState.current++;
            if (axiosMockState.current > axiosMockState.max) {
                axiosMockState.max = axiosMockState.current;
            }
            var site = url.split("/").slice(-1)[0];
            var promise = new Promise(function (resolve, reject) {
                if (slowSites.indexOf(site) > -1) {
                    var fallback = setTimeout(function () {
                        var fe = new Error("fallback reached - abort did NOT fire");
                        fe.code = "ETIMEDOUT";
                        reject(fe);
                    }, fallbackMs);
                    var sig = axiosOpts && axiosOpts.signal;
                    var onAbort = function () {
                        clearTimeout(fallback);
                        reject(cancelError());
                    };
                    if (sig) {
                        if (sig.aborted) { onAbort(); }
                        else { sig.addEventListener("abort", onAbort, { once: true }); }
                    }
                } else {
                    var data = postings[site];
                    resolve({ data: Array.isArray(data) ? data : SAMPLE });
                }
            });
            promise.then(
                function () { axiosMockState.current--; },
                function () { axiosMockState.current--; }
            );
            return promise;
        }
    };
    delete require.cache[leverPath];
    require.cache[axiosPath] = {
        id: axiosPath, filename: axiosPath, loaded: true,
        exports: axiosMock, children: [], paths: []
    };
}

function loadLever() {
    delete require.cache[leverPath];
    return require("../services/jobSearch/lever");
}

function resetEnv() {
    delete process.env.LEVER_SITES;
    delete process.env.LEVER_TIMEOUT_MS;
    delete process.env.LEVER_MAX_CONCURRENT;
}

before(function () {
    resetEnv();
    process.env.LEVER_SITES = "slow,fast";
    process.env.LEVER_TIMEOUT_MS = "300";
});

after(function () {
    delete require.cache[axiosPath];
    delete require.cache[leverPath];
    resetEnv();
});

describe("searchLever - per-board timeout drops a slow board", function () {
    it("cuts slow board via per-board AbortController, preserves fast board (partial results)", async function () {
        process.env.LEVER_SITES = "slow,fast";
        process.env.LEVER_TIMEOUT_MS = "300";
        installAxios({ slowSites: ["slow"] });
        var searchLever = loadLever();
        var start = Date.now();
        var jobs = await searchLever({ query: "", location: "" });
        var elapsed = Date.now() - start;
        var companies = jobs.map(function (j) { return j.company; });
        assert.ok(elapsed < 1500, "slow board not cut promptly: " + elapsed + "ms");
        assert.strictEqual(companies.indexOf("slow"), -1, "slow board should be dropped");
        assert.ok(companies.indexOf("fast") > -1, "fast board results should survive");
        assert.ok(jobs.length >= 1, "partial results should be preserved");
    });

    it("fast board jobs are real and normalized (not fabricated)", async function () {
        process.env.LEVER_SITES = "slow,fast";
        process.env.LEVER_TIMEOUT_MS = "300";
        installAxios({ slowSites: ["slow"] });
        var jobs = await loadLever()({ query: "", location: "" });
        var fast = jobs.filter(function (j) { return j.company === "fast"; });
        assert.ok(fast.length >= 1, "fast board jobs present");
        assert.strictEqual(fast[0].title, "Frontend Engineer");
        assert.strictEqual(fast[0].source, "lever");
        assert.ok(fast[0].externalId.indexOf("-fast-") > -1, "externalId names the site");
        assert.strictEqual(fast[0].isSearchLink, false);
    });
});

describe("searchLever - parent signal propagation", function () {
    it("aborts an in-flight board when the upstream signal aborts", async function () {
        // Long per-board timeout so only the parent signal should end the board.
        process.env.LEVER_SITES = "slow";
        process.env.LEVER_TIMEOUT_MS = "5000";
        installAxios({ slowSites: ["slow"] });
        var searchLever = loadLever();
        var controller = new AbortController();
        setTimeout(function () { controller.abort(); }, 150);
        var start = Date.now();
        var jobs = await searchLever({ query: "", location: "", signal: controller.signal });
        var elapsed = Date.now() - start;
        assert.ok(elapsed < 1500, "parent abort not prompt: " + elapsed + "ms");
        assert.strictEqual(jobs.length, 0, "aborted board should yield no jobs");
    });
});

describe("searchLever - bounded concurrency", function () {
    it("does not exceed LEVER_MAX_CONCURRENT in-flight axios requests", async function () {
        process.env.LEVER_SITES = "slow,fast";
        process.env.LEVER_TIMEOUT_MS = "200";
        process.env.LEVER_MAX_CONCURRENT = "1";
        installAxios({ slowSites: ["slow", "fast"] }); // both stay pending until timeout
        var searchLever = loadLever();
        await searchLever({ query: "", location: "" });
        assert.ok(axiosMockState.max <= 1, "expected <=1 concurrent request, got " + axiosMockState.max);
    });
});

