/**
 * Offline tests for server/services/jobSearch/wellfound.js adapter.
 *
 * The Wellfound adapter has two execution paths:
 *   1. Selenium rendering (if selenium-webdriver + Chrome available)
 *   2. Search-link fallback (always, when Selenium is unavailable or blocked)
 *
 * The browser/seleniumClient is mocked via require.cache so NO real
 * Chrome/Selenium interaction occurs. We verify:
 *   - Selenium unavailable (null) -> search-link fallback
 *   - Selenium returns blocked (403/empty) -> search-link fallback
 *   - Selenium returns HTML -> jobs parsed + normalized
 *   - Selenium returns HTML with no jobs -> search-link fallback
 *   - URL construction preserves query + location
 */
var { describe, it, beforeEach, after } = require("node:test");
var assert = require("node:assert/strict");

var wellfoundPath = require.resolve("../services/jobSearch/wellfound");
var seleniumPath = require.resolve(
    "../services/jobSearch/browser/seleniumClient"
);

function mockSelenium(browser) {
    require.cache[seleniumPath] = {
        id: seleniumPath,
        filename: seleniumPath,
        loaded: true,
        exports: {
            launchBrowser: async function () { return browser; },
            closeBrowser: async function () {},
            waitForNetworkIdle: async function () { return true; },
            SELENIUM_ENABLED: browser !== null
        },
        children: [],
        paths: []
    };
}

function loadWellfound() {
    delete require.cache[wellfoundPath];
    return require("../services/jobSearch/wellfound");
}

after(function () {
    delete require.cache[wellfoundPath];
    delete require.cache[seleniumPath];
    delete process.env.WELLFOUND_COMPANIES;
});

describe("searchWellfound - search-link fallback (Selenium unavailable)", function () {
    var searchWellfound;

    beforeEach(function () {
        mockSelenium(null);
        searchWellfound = loadWellfound();
    });

    it("returns search-link cards when Selenium is unavailable", async function () {
        var jobs = await searchWellfound({
            query: "engineer",
            location: "remote"
        });
        assert.ok(jobs.length >= 1);
        assert.ok(
            jobs.every(function (j) { return j.isSearchLink; })
        );
    });

    it("marks cards with unavailableReason and requiresAuth=false", async function () {
        var jobs = await searchWellfound({ query: "engineer" });
        var card = jobs[0];
        assert.strictEqual(card.isSearchLink, true);
        assert.strictEqual(card.requiresAuth, false);
        assert.ok(card.unavailableReason);
    });

    it("builds a search URL preserving query+location", async function () {
        var jobs = await searchWellfound({
            query: "python",
            location: "sf"
        });
        assert.ok(jobs[0].applyUrl.includes("q=python"));
        assert.ok(jobs[0].applyUrl.includes("l=sf"));
    });

        it("uses bare company URL when no query/location provided", async function () {
        var jobs = await searchWellfound({});
        // New behavior: each company gets a distinct fallback card with
        // a company-specific URL (not a single generic search link).
        assert.strictEqual(
            jobs[0].applyUrl,
            "https://wellfound.com/company/stripe/jobs"
        );
    });
});

describe("searchWellfound - Selenium rendering", function () {
    it("parses jobs from rendered HTML and maps to canonical shape", async function () {
        // Mock browser that returns page HTML with job cards.
        // HTML must be > 1000 chars to pass the "blocked page" length check.
        var padding = "<!-- nav sidebar footer -->" + "X".repeat(1200);
        var mockBrowser = {
            get: async function () {},
            getPageSource: async function () {
                return padding + "<html><body>" +
                    '<a href="/jobs/123" title="Job 123">' +
                    "<h3>Senior Software Engineer</h3>" +
                    "<div>Remote</div></a>" +
                    '<a href="/jobs/456" title="Job 456">' +
                    "<h3>Data Scientist</h3>" +
                    "<div>Full-time</div></a>" +
                    "</body></html>";
            },
            executeScript: async function () {
                return "complete";
            }
        };
        mockSelenium(mockBrowser);
        var searchWellfound = loadWellfound();

        var jobs = await searchWellfound({
            query: "",
            location: ""
        });

        var real = jobs.filter(function (j) {
            return !j.isSearchLink;
        });
        assert.ok(real.length >= 1, "expected real jobs from Selenium");
        assert.ok(
            real[0].source === "wellfound",
            "source should be wellfound"
        );
        assert.ok(real[0].applyUrl, "should have applyUrl");
    });

    it("falls back to search-link when page is blocked (403/HTML error)", async function () {
        var mockBrowser = {
            get: async function () {},
            getPageSource: async function () {
                return "<!-- padding -->" + "X".repeat(1200) +
                    "<html><body>403 Forbidden</body></html>";
            },
            executeScript: async function () {
                return "complete";
            }
        };
        mockSelenium(mockBrowser);
        var searchWellfound = loadWellfound();

        var jobs = await searchWellfound({
            query: "",
            location: ""
        });

        assert.ok(jobs.length >= 1);
        assert.ok(
            jobs.every(function (j) { return j.isSearchLink; })
        );
    });

    it("falls back to search-link when HTML has no job cards", async function () {
        var mockBrowser = {
            get: async function () {},
            getPageSource: async function () {
                return "<!-- padding -->" + "X".repeat(1200) +
                    "<html><body>No jobs here</body></html>";
            },
            executeScript: async function () {
                return "complete";
            }
        };
        mockSelenium(mockBrowser);
        var searchWellfound = loadWellfound();

        var jobs = await searchWellfound({
            query: "",
            location: ""
        });

        assert.ok(jobs.length >= 1);
        assert.ok(
            jobs.every(function (j) { return j.isSearchLink; })
        );
    });
});

describe("searchWellfound - error handling", function () {
    it("falls back to search-link when Selenium throws", async function () {
        var mockBrowser = {
            get: async function () {
                throw new Error("Chrome failed to launch");
            },
            getPageSource: async function () {},
            executeScript: async function () {}
        };
        mockSelenium(mockBrowser);
        var searchWellfound = loadWellfound();

        var jobs = await searchWellfound({
            query: "",
            location: ""
        });

        assert.ok(jobs.length >= 1);
        assert.ok(
            jobs.every(function (j) { return j.isSearchLink; })
        );
    });
});

describe("searchWellfound - distinct fallbacks & resultType", function () {
    var searchWellfound;

    beforeEach(function () {
        mockSelenium(null);
        searchWellfound = loadWellfound();
    });

    it("fallback cards for different companies have distinct URLs", async function () {
        var jobs = await searchWellfound({ query: "engineer" });
        var urls = jobs.map(function (j) { return j.applyUrl; });
        var unique = Array.from(new Set(urls));
        assert.strictEqual(
            unique.length,
            urls.length,
            "each company fallback should have a unique URL"
        );
    });

    it("fallback cards carry resultType=search_link", async function () {
        var jobs = await searchWellfound({ query: "engineer" });
        assert.ok(
            jobs.every(function (j) {
                return j.resultType === "search_link";
            })
        );
    });

    it("does not fabricate jobs when page has no card content", async function () {
        var mockBrowser = {
            get: async function () {},
            getPageSource: async function () {
                return "<!-- no content -->";
            },
            executeScript: async function () { return "complete"; }
        };
        mockSelenium(mockBrowser);
        searchWellfound = loadWellfound();

        var jobs = await searchWellfound({});
        assert.ok(
            jobs.every(function (j) { return j.isSearchLink; })
        );
    });
});

describe("searchWellfound - URL validation", function () {
    var searchWellfound;

    beforeEach(function () {
        mockSelenium(null);
        searchWellfound = loadWellfound();
    });

    it("fallback applyUrl is always a valid http(s) URL", async function () {
        var jobs = await searchWellfound({ query: "dev" });
        jobs.forEach(function (j) {
            var url = new URL(j.applyUrl);
            assert.ok(
                ["http:", "https:"].indexOf(url.protocol) > -1
            );
        });
    });
});
