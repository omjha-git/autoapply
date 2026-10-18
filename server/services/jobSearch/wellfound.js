/**
 * wellfound.js
 *
 * Wellfound (formerly AngelList Talent) adapter.
 *
 * Wellfound's job listing pages are a JS-heavy Next.js SPA. Its
 * /company/{slug}/jobs pages are permitted by robots.txt but require
 * JavaScript rendering for job data to appear.
 *
 * Wellfound does NOT provide a public, unauthenticated job-listings API.
 *
 * Extraction strategy (two-tier, both via Selenium when available):
 *   1. Element-based extraction via extractListingCards (primary) —
 *      uses WebDriver CSS selectors on the rendered DOM.
 *   2. Regex-based HTML parsing via getPageSource (secondary) —
 *      parses the raw HTML source when element queries find nothing.
 *
 * If Selenium is unavailable, the page is blocked (403/CAPTCHA/anti-bot),
 * or no genuine listings are found, the adapter returns a clearly-labeled
 * search-link card with isSearchLink + resultType set so the frontend
 * renders it honestly.
 *
 * Compliance: we never bypass access controls. If automated access is
 * blocked, we link to the public search rather than fabricating listings.
 */

const normalizeJob = require("./normalizeJob");
const {
    launchBrowser,
    closeBrowser,
    waitForNetworkIdle
} = require("./browser/seleniumClient");
const { extractListingCards } = require("./browser/extractListingCards");

const WELLFOUND_BASE = "https://wellfound.com";

const DEFAULT_COMPANIES = ["stripe", "airbnb", "coinbase"];

const MAX_CONCURRENT =
    parseInt(process.env.WELLFOUND_MAX_CONCURRENT, 10) || 3;

let _activeBrowsers = 0;
let _queuedLaunches = [];

const acquireBrowserPermit = () => {
    return new Promise((resolve) => {
        if (_activeBrowsers < MAX_CONCURRENT) {
            _activeBrowsers++;
            resolve();
        } else {
            _queuedLaunches.push(resolve);
        }
    });
};

const releaseBrowserPermit = () => {
    _activeBrowsers = Math.max(0, _activeBrowsers - 1);
    if (_queuedLaunches.length > 0) {
        const next = _queuedLaunches.shift();
        _activeBrowsers++;
        next();
    }
};

const getCompanies = () => {
    const configured = (process.env.WELLFOUND_COMPANIES || "")
        .split(",")
        .map((c) => c.trim())
        .filter(Boolean);
    return configured.length ? configured : DEFAULT_COMPANIES;
};

/**
 * Validate and normalize a URL to an absolute http/https URL.
 * Returns null for invalid, non-HTTP URLs or empty input.
 */
const toAbsoluteHttpUrl = (value) => {
    if (typeof value !== "string" || !value.trim()) return null;
    try {
        const url = new URL(value.trim());
        if (!["http:", "https:"].includes(url.protocol)) return null;
        return url.toString();
    } catch {
        return null;
    }
};

const isValidHttpUrl = (url) => toAbsoluteHttpUrl(url) !== null;

/**
 * Wellfound-specific CSS selectors for Selenium element-based extraction.
 *
 * Derived from the Wellfound SPA's card structure:
 * - Job cards are <a> elements with href containing "/jobs/"
 * - Titles are in heading elements within each card.
 * - Company is page-level (known from the URL slug).
 * - Location appears in span elements within the card.
 *
 * NOTE: Selectors should be verified against the live page. If they
 * don't match, the regex-based parseJobsFromHtml fallback is used.
 */
const WELLFOUND_SELECTORS = {
    card: 'a[href*="/jobs/"]',
    title: "h3, h4, h2, h5, h6, [class*='title']",
    link: "a",
    company: "[class*='company'], [class*='meta']",
    location: "span, [class*='location']"
};

/**
 * Extract job cards from Wellfound's SSR HTML using regex parsing.
 * Secondary method used when Selenium element queries find nothing
 * but the page HTML is accessible via getPageSource.
 *
 * @param {string} html  Full page HTML
 * @param {string} companySlug
 * @returns {Array} Raw job objects { id, title, href, workMode, company }
 */
const parseJobsFromHtml = (html, companySlug) => {
    if (!html || typeof html !== "string") return [];

    const jobs = [];

    const cardRegex =
        /<a[^>]*href="([^"]*\/jobs\/[^"]*)"[^>]*>([\s\S]*?)<\/a>/gi;
    const titleRegex =
        /<h[1-3][^>]*>([^<]+)<\/h[1-3]>/i;

    let match;
    let count = 0;
    while (
        (match = cardRegex.exec(html)) !== null &&
        count < 50
    ) {
        const href = match[1] || "";
        const cardHtml = match[2] || "";

        const titleMatch = cardHtml.match(titleRegex);
        let title = titleMatch ? titleMatch[1].trim() : "";

        if (!title) {
            const text = cardHtml
                .replace(/<[^>]+>/g, " ")
                .replace(/\s+/g, " ")
                .trim();
            title = text.split(" ").slice(0, 5).join(" ");
        }

        const locMatch = cardHtml.match(
            /(Remote|Hybrid|On-site|Full-time|Part-time|Contract)[^<]*/gi
        );
        const workMode = locMatch ? locMatch[0].trim() : "Unknown";

        if (href && title) {
            jobs.push({
                id: "wellfound-" + companySlug + "-" + count,
                title,
                href,
                workMode,
                company: companySlug
            });
            count++;
        }
    }

    return jobs;
};

/**
 * Attempt element-based extraction using extractListingCards (primary).
 * Uses Selenium WebDriver CSS selectors on the fully rendered DOM.
 * Returns null if no valid cards are found.
 *
 * @param {object} driver  WebDriver instance
 * @param {string} companySlug
 * @param {string} query  Optional query filter
 * @returns {Promise<Array|null>}
 */
const extractWithSeleniumElements = async (driver, companySlug, query) => {
    try {
        const rawCards = await extractListingCards(
            driver,
            WELLFOUND_SELECTORS,
            10000,
            { company: companySlug }
        );

        if (!rawCards || rawCards.length === 0) {
            return null;
        }

        return rawCards.filter((card) => {
            if (!query) return true;
            const searchText = (card.title + " " + card.url).toLowerCase();
            return searchText.includes(query.toLowerCase());
        });
    } catch (error) {
        console.warn(
            "[wellfound] Element-based extraction failed for \"" +
                companySlug + "\":",
            error.message
        );
        return null;
    }
};

/**
 * Attempt HTML-source extraction using getPageSource + regex (secondary).
 * Used as a fallback when element-based extraction finds no cards but
 * the page HTML was accessible.
 *
 * @param {object} driver  WebDriver instance
 * @param {string} companySlug
 * @param {string} query  Optional query filter
 * @returns {Promise<Array|null>}
 */
const extractWithSeleniumHtml = async (driver, companySlug, query) => {
    try {
        const html = await driver.getPageSource();

        if (
            html.includes("403") ||
            html.includes("captcha") ||
            html.includes("blocked") ||
            html.length < 1000
        ) {
            console.warn(
                "[wellfound] \"" + companySlug + "\" appears blocked " +
                "(403/CAPTCHA/anti-bot). Falling back to search-link."
            );
            return null;
        }

        const jobs = parseJobsFromHtml(html, companySlug);

        if (!jobs || jobs.length === 0) {
            return null;
        }

        return jobs.filter((job) => {
            if (!query) return true;
            const searchText = (job.title + " " + job.href).toLowerCase();
            return searchText.includes(query.toLowerCase());
        });
    } catch (error) {
        console.warn(
            "[wellfound] HTML extraction failed for \"" +
                companySlug + "\":",
            error.message
        );
        return null;
    }
};

/**
 * Render a Wellfound jobs page with Selenium and extract individual
 * job postings using both element-based and regex-based methods.
 *
 * Tries extractListingCards (element-based) first, then falls back to
 * parseJobsFromHtml (regex-based HTML parsing) if the first method
 * finds no cards.
 *
 * @param {string} companySlug
 * @param {string} query
 * @returns {Promise<Array|null>} Job objects or null on failure/blocked
 */
const fetchJobsWithSelenium = async (companySlug, query) => {
    const browser = await launchBrowser();
    if (!browser) return null;

    try {
        await browser.manage().setTimeouts({
            pageLoad: 15000,
            script: 10000
        });
    } catch (timeoutError) {
        console.warn(
            "[wellfound] Could not set timeouts:",
            timeoutError.message
        );
    }

    const url = WELLFOUND_BASE + "/company/" + companySlug + "/jobs";

    try {
        await browser.get(url);
        await waitForNetworkIdle(browser, 8000, 2000);

        // Method 1: Element-based extraction (preferred)
        const elementJobs = await extractWithSeleniumElements(
            browser,
            companySlug,
            query
        );
        if (elementJobs && elementJobs.length > 0) {
            return elementJobs;
        }

        // Method 2: Regex-based HTML extraction (fallback)
        const htmlJobs = await extractWithSeleniumHtml(
            browser,
            companySlug,
            query
        );
        if (htmlJobs && htmlJobs.length > 0) {
            return htmlJobs;
        }

        console.warn(
            "[wellfound] No jobs found for \"" + companySlug +
            "\" via either method."
        );
        return null;
    } catch (error) {
        console.warn(
            "[wellfound] Selenium render failed for \"" +
                companySlug + "\":",
            error.message
        );
        return null;
    } finally {
        await closeBrowser(browser);
    }
};

/**
 * Build a clearly-labeled search-link card for Wellfound.
 *
 * Used when Selenium is unavailable or the page blocks automated access.
 * Always marked isSearchLink=true, resultType="search_link".
 *
 * Each company gets a distinct URL so fallback cards for different
 * companies are NOT collapsed by aggregator deduplication.
 *
 * @param {string} companySlug
 * @param {string} query
 * @param {string} location
 * @returns {object} Normalized search-link card
 */
const buildSearchLinkCard = (companySlug, query, location) => {
    const params = new URLSearchParams();
    if (query && query.trim()) {
        params.set("q", query.trim());
    }
    if (location && location.trim()) {
        params.set("l", location.trim());
    }

    const qs = params.toString();
    const searchUrl = qs
        ? WELLFOUND_BASE + "/company/" + companySlug + "/jobs?" + qs
        : WELLFOUND_BASE + "/company/" + companySlug + "/jobs";

    const label =
        [query, location].filter(Boolean).join(" in ") ||
        "all categories";

    return normalizeJob({
        externalId:
            "wellfound-search-" + companySlug + "-" +
            Buffer.from(searchUrl).toString("base64").slice(0, 32),
        title: query
            ? 'Wellfound: "' + query + '" jobs at ' + companySlug
            : "Wellfound jobs at " + companySlug,
        company: "Wellfound",
        location: location || "Worldwide",
        workMode: "Unknown",
        employmentType: "Unknown",
        description:
            'Browse "' + label + '" jobs on Wellfound for ' +
            companySlug + ". Wellfound is a JS-heavy SPA with no " +
            "public listings API, so this is a direct search link " +
            "rather than a live feed. Click \"Apply\" to view real, " +
            "current listings on Wellfound.",
        skills: [],
        salary: "",
        source: "wellfound",
        sourceUrl: searchUrl,
        applyUrl: searchUrl,
        postedDate: null,
        isSearchLink: true,
        resultType: "search_link",
        requiresAuth: false,
        unavailableReason:
            "Wellfound is a JS-heavy SPA with no public job API; " +
            "showing a search link. Install selenium-webdriver + " +
            "Chrome and set SELENIUM_ENABLED=true for live jobs."
    });
};

/**
 * Render a Wellfound jobs page with Selenium, extract jobs, and map
 * them to the canonical normalized shape.
 *
 * @param {string} companySlug
 * @param {string} query
 * @param {string} location
 * @returns {Promise<Array>} Normalized job objects
 */
const fetchAndNormalizeJobs = async (
    companySlug,
    query,
    location
) => {
    const rawJobs = await fetchJobsWithSelenium(companySlug, query);

    if (!rawJobs || rawJobs.length === 0) {
        return [buildSearchLinkCard(companySlug, query, location)];
    }

    return rawJobs
        .map((job) => {
            // Handle both element-based results (card.url) and
            // regex-based results (job.href).
            const rawUrl = job.url || job.href || "";
            const applyUrl = rawUrl.startsWith("http")
                ? rawUrl
                : WELLFOUND_BASE + rawUrl;

            // Validate URL before creating the job record.
            if (!isValidHttpUrl(applyUrl)) return null;

            return normalizeJob({
                externalId:
                    "wellfound-" + companySlug + "-" +
                    (job.id || job.url),
                title: job.title || "Unknown Position",
                company: companySlug,
                location: job.location || "Unknown",
                workMode: job.workMode || "Unknown",
                employmentType: "Unknown",
                description: "",
                skills: [],
                salary: "",
                source: "wellfound",
                // sourceUrl and applyUrl both point to the individual
                // job listing page.
                sourceUrl: applyUrl,
                applyUrl: applyUrl,
                postedDate: null
            });
        })
        .filter(Boolean);
};

/**
 * Fetch all jobs from configured Wellfound companies.
 *
 * Attempts Selenium rendering with bounded concurrency; falls back to
 * search-link cards for companies where Selenium is unavailable or
 * access is blocked.
 *
 * @param {{ query?: string, location?: string }} params
 * @returns {Promise<object[]>} Normalized job objects.
 */
const searchWellfound = async ({
    query = "",
    location = "",
    signal
} = {}) => {
    const companies = getCompanies();
    if (companies.length === 0) {
        console.warn("No WELLFOUND_COMPANIES configured.");
        return [];
    }

    const results = await Promise.all(
        companies.map(async (companySlug) => {
            let permitAcquired = false;
            try {
                await acquireBrowserPermit();
                permitAcquired = true;

                return await fetchAndNormalizeJobs(
                    companySlug,
                    query,
                    location
                );
            } catch (error) {
                console.error(
                    'Wellfound company "' + companySlug + '" failed:',
                    error.message
                );
                return [
                    buildSearchLinkCard(
                        companySlug,
                        query,
                        location
                    )
                ];
            } finally {
                if (permitAcquired) {
                    releaseBrowserPermit();
                }
            }
        })
    );

    return results.flat();
};

module.exports = searchWellfound;
