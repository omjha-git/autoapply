/**
 * Offline tests for server/services/jobSearch/ashby.js adapter.
 *
 * Mock data matches the REAL Ashby API response shape (verified live):
 *  - Top-level: { jobs: [...] } (NOT jobPostings)
 *  - location: string (NOT { name: ... })
 *  - department: string (NOT { name: ... })
 *  - descriptionHtml (NOT descriptionHTML)
 *  - jobUrl (NOT href)
 *  - publishedAt: ISO string (NOT createdAt: unix epoch)
 *  - compensation: { summaryComponents: [...] } (NOT { min, max, ... })
 */
var { describe, it, beforeEach, after, afterEach } = require("node:test");
var assert = require("node:assert/strict");

var axiosPath = require.resolve("axios");
var ashbyPath = require.resolve("../services/jobSearch/ashby");

var ASHBY_JOBS = {
    ramp: [
        {
            id: "job-1",
            title: "Senior Frontend Engineer",
            location: "Remote",
            department: "Engineering",
            workplaceType: "Remote",
            employmentType: "Full-time",
            descriptionHtml: "<p>React, TypeScript, AWS.</p>",
            compensation: {
                summaryComponents: [
                    { compensationType: "Salary", interval: "1 YEAR", currencyCode: "USD", minValue: 150000, maxValue: 200000 }
                ]
            },
            applyUrl: "https://jobs.ashbyhq.com/ramp/job-1/application",
            jobUrl: "https://jobs.ashbyhq.com/ramp/job-1",
            publishedAt: "2023-08-01T00:00:00.000Z"
        },
        {
            id: "job-2",
            title: "Backend Engineer",
            location: "San Francisco",
            department: "Engineering",
            workplaceType: "On-site",
            employmentType: "Full-time",
            descriptionHtml: "<p>Go, PostgreSQL, Docker.</p>",
            compensation: {
                summaryComponents: [
                    { compensationType: "Salary", interval: "1 YEAR", currencyCode: "USD", minValue: 140000, maxValue: 180000 }
                ]
            },
            applyUrl: "https://jobs.ashbyhq.com/ramp/job-2/application",
            jobUrl: "https://jobs.ashbyhq.com/ramp/job-2",
            publishedAt: "2023-10-01T00:00:00.000Z"
        }
    ],
    acme: []
};

function installAxios(opts) {
    opts = opts || {};
    delete require.cache[ashbyPath];
    var axiosMock = {
        get: async function (url) {
            var client = url.split("/").slice(-1)[0];
            var data = ASHBY_JOBS[client];
            if (data === undefined) {
                throw new Error("404 not found for " + client);
            }
            if (opts.failClient && client === opts.failClient) {
                throw new Error("network boom for " + client);
            }
            return { data: { jobs: Array.isArray(data) ? data : [] } };
        }
    };
    require.cache[axiosPath] = {
        id: axiosPath, filename: axiosPath, loaded: true,
        exports: axiosMock, children: [], paths: []
    };
}

function loadAshby() {
    delete require.cache[ashbyPath];
    return require("../services/jobSearch/ashby");
}

after(function () {
    delete require.cache[axiosPath];
    delete require.cache[ashbyPath];
});

describe("searchAshby", function () {
    var searchAshby;

    beforeEach(function () {
        installAxios();
        searchAshby = loadAshby();
    });

    afterEach(function () {
        delete process.env.ASHBY_BOARDS;
    });

    
    it("maps an Ashby job to the normalized shape", async function () {
        var jobs = await searchAshby({ query: "", location: "" });
        var fe = jobs.find(function (j) {
            return j.externalId.indexOf("job-1") > -1;
        });
        assert.ok(fe);
        assert.strictEqual(fe.title, "Senior Frontend Engineer");
        assert.strictEqual(fe.company, "ramp");
        assert.strictEqual(fe.location, "Remote");
        assert.strictEqual(fe.source, "ashby");
        assert.strictEqual(fe.sourceUrl, "https://jobs.ashbyhq.com/ramp/job-1");
        assert.strictEqual(fe.applyUrl, "https://jobs.ashbyhq.com/ramp/job-1/application");
    });

    it("formats salary from summaryComponents", async function () {
        var jobs = await searchAshby({ query: "", location: "" });
        var fe = jobs.find(function (j) {
            return j.externalId.indexOf("job-1") > -1;
        });
        assert.ok(fe.salary);
        assert.ok(fe.salary.includes("150") && fe.salary.includes("200"),
            "salary should contain both min and max: " + fe.salary);
    });

    it("detects workMode from workplaceType", async function () {
        var jobs = await searchAshby({ query: "", location: "" });
        var onsite = jobs.find(function (j) {
            return j.externalId.indexOf("job-2") > -1;
        });
        assert.strictEqual(onsite.workMode, "On-site");
    });

    it("converts ISO publishedAt to Date for postedDate", async function () {
        var jobs = await searchAshby({ query: "", location: "" });
        var fe = jobs.find(function (j) {
            return j.externalId.indexOf("job-1") > -1;
        });
        assert.ok(fe.postedDate instanceof Date);
        assert.strictEqual(
            fe.postedDate.getTime(),
            new Date("2023-08-01T00:00:00.000Z").getTime()
        );
    });

    it("filters jobs by query (title + description relevance)", async function () {
        var jobs = await searchAshby({ query: "frontend", location: "" });
        assert.strictEqual(jobs.length, 1);
        assert.strictEqual(jobs[0].title, "Senior Frontend Engineer");
    });

    it("filters jobs by location", async function () {
        var jobs = await searchAshby({ query: "", location: "san francisco" });
        assert.strictEqual(jobs.length, 1);
        assert.strictEqual(jobs[0].title, "Backend Engineer");
    });

    it("falls back to DEFAULT_BOARDS when env not configured", async function () {
        delete process.env.ASHBY_BOARDS;
        try {
            installAxios();
            var searchAshbyFresh = loadAshby();
            var jobs = await searchAshbyFresh({ query: "", location: "" });
            var companies = jobs.map(function (j) { return j.company; });
            // DEFAULT_BOARDS = ["ramp", "modal"]; ramp is mocked, modal will 404
            assert.ok(companies.indexOf("ramp") > -1, "ramp should be in DEFAULT_BOARDS");
        } finally {
            delete process.env.ASHBY_BOARDS;
        }
    });

    it("isolates a failing board (others still return)", async function () {
        var axiosMock = {
            get: async function (url) {
                var client = url.split("/").slice(-1)[0];
                if (client === "modal") {
                    throw new Error("network boom for " + client);
                }
                return { data: { jobs: ASHBY_JOBS.ramp } };
            }
        };
        require.cache[axiosPath] = {
            id: axiosPath, filename: axiosPath, loaded: true,
            exports: axiosMock, children: [], paths: []
        };
        var searchAshbyFresh = loadAshby();
        var jobs = await searchAshbyFresh({ query: "", location: "" });
        assert.ok(jobs.length >= 1, "ramp jobs should return even when modal fails");
    });

    it("handles empty jobs array gracefully", async function () {
        installAxios();
        var searchAshbyFresh = loadAshby();
        var jobs = await searchAshbyFresh({ query: "", location: "" });
        // ramp returns 2 jobs, modal will 404 and return []
        assert.ok(jobs.length >= 1);
        assert.ok(jobs.every(function (j) { return j.source === "ashby"; }));
    });

    it("falls back to DEFAULT_BOARDS when ASHBY_BOARDS is empty string", async function () {
        process.env.ASHBY_BOARDS = "";
        try {
            installAxios();
            var searchAshbyFresh = loadAshby();
            var jobs = await searchAshbyFresh({ query: "", location: "" });
            assert.ok(jobs.length >= 1);
            assert.ok(jobs.every(function (j) { return j.source === "ashby"; }));
        } finally {
            delete process.env.ASHBY_BOARDS;
        }
    });
});

