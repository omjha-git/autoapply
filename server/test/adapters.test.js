/**
 * Offline tests for server/services/jobSearch/greenhouse.js adapter.
 *
 * The adapter's HTTP layer (axios) is mocked via require.cache so NO live
 * Greenhouse requests are made. We verify field mapping, query/location
 * filtering, DEFAULT_BOARDS fallback, per-board failure isolation, and
 * non-array response handling.
 */
var { describe, it, beforeEach, after } = require("node:test");
var assert = require("node:assert/strict");

var axiosPath = require.resolve("axios");
var greenhousePath = require.resolve("../services/jobSearch/greenhouse");

var GH_JOBS = {
    stripe: [
        {
            id: "1",
            title: "Frontend Engineer",
            location: { name: "Remote" },
            content: "React, TypeScript, AWS",
            absolute_url: "https://stripe.com/jobs/1",
            updated_at: "2024-05-01T10:00:00Z"
        },
        {
            id: "2",
            title: "Backend Engineer",
            location: { name: "San Francisco" },
            content: "Go, PostgreSQL",
            absolute_url: "https://stripe.com/jobs/2",
            updated_at: null
        }
    ],
    airbnb: [],
    coinbase: [
        {
            id: "a1",
            title: "Smart Contract Engineer",
            location: { name: "New York" },
            content: "Solidity, Blockchain",
            absolute_url: "https://coinbase.com/jobs/a1",
            updated_at: "2023-01-01T00:00:00Z"
        }
    ]
};

var axiosMock;
function installAxios(extra) {
    extra = extra || {};
    // remove cached adapter so it picks up the new axios mock
    delete require.cache[greenhousePath];
    axiosMock = {
        get: async function (url) {
            // url: https://boards-api.greenhouse.io/v1/boards/<token>/jobs
            var token = url.split("/").slice(-2)[0];
            if (extra.failBoard && token === extra.failBoard) {
                throw new Error("network boom for " + token);
            }
            if (extra.badShape && token === extra.badShape) {
                return { data: { jobs: "not-an-array" } };
            }
            var jobs = GH_JOBS[token] || [];
            return { data: { jobs: jobs } };
        }
    };
    require.cache[axiosPath] = {
        id: axiosPath,
        filename: axiosPath,
        loaded: true,
        exports: axiosMock,
        children: [],
        paths: []
    };
}

after(function () {
    delete require.cache[axiosPath];
    delete require.cache[greenhousePath];
});

function loadGreenhouse() {
    delete require.cache[greenhousePath];
    return require("../services/jobSearch/greenhouse");
}

describe("searchGreenhouse", function () {
    var searchGreenhouse;

    beforeEach(function () {
        installAxios();
        searchGreenhouse = loadGreenhouse();
    });

    it("maps a Greenhouse job to the normalized shape", async function () {
        var jobs = await searchGreenhouse({ query: "", location: "" });
        var fe = jobs.find(function (j) { return j.externalId.indexOf("1") > -1; });
        assert.ok(fe);
        assert.strictEqual(fe.title, "Frontend Engineer");
        assert.strictEqual(fe.company, "stripe");
        assert.strictEqual(fe.location, "Remote");
        assert.strictEqual(fe.workMode, "Remote");
        assert.ok(fe.postedDate instanceof Date);
        assert.strictEqual(fe.applyUrl, "https://stripe.com/jobs/1");
        assert.ok(fe.skills.indexOf("React") > -1);
    });

    it("uses the board token as the company", async function () {
        var jobs = await searchGreenhouse({ query: "", location: "" });
        var sc = jobs.find(function (j) { return j.company === "coinbase"; });
        assert.ok(sc);
    });

    it("filters jobs by query (description/title relevance)", async function () {
        var jobs = await searchGreenhouse({ query: "frontend", location: "" });
        assert.strictEqual(jobs.length, 1);
        assert.strictEqual(jobs[0].title, "Frontend Engineer");
    });

    it("filters jobs by location", async function () {
        var jobs = await searchGreenhouse({ query: "", location: "San Francisco" });
        assert.strictEqual(jobs.length, 1);
        assert.strictEqual(jobs[0].title, "Backend Engineer");
        assert.strictEqual(jobs[0].workMode, "Unknown");
    });

    it("falls back to DEFAULT_BOARDS when env not configured", async function () {
        var saved = process.env.GREENHOUSE_BOARD_TOKENS;
        delete process.env.GREENHOUSE_BOARD_TOKENS;
        try {
            var jobs = await searchGreenhouse({ query: "", location: "" });
            var companies = jobs.map(function (j) { return j.company; });
            assert.ok(companies.indexOf("stripe") > -1);
            assert.ok(companies.indexOf("coinbase") > -1);
        } finally {
            if (saved !== undefined) process.env.GREENHOUSE_BOARD_TOKENS = saved;
        }
    });

    it("isolates a failing board (others still return)", async function () {
        installAxios({ failBoard: "airbnb" });
        searchGreenhouse = loadGreenhouse();
        var jobs = await searchGreenhouse({ query: "", location: "" });
        var companies = jobs.map(function (j) { return j.company; });
        assert.ok(companies.indexOf("stripe") > -1, "stripe survived");
        assert.ok(companies.indexOf("coinbase") > -1, "coinbase survived");
        assert.strictEqual(companies.indexOf("airbnb"), -1);
    });

    it("ignores a board whose response has no jobs array", async function () {
        installAxios({ badShape: "stripe" });
        searchGreenhouse = loadGreenhouse();
        var jobs = await searchGreenhouse({ query: "", location: "" });
        var companies = jobs.map(function (j) { return j.company; });
        assert.strictEqual(companies.indexOf("stripe"), -1);
        assert.ok(companies.indexOf("coinbase") > -1);
    });
});
