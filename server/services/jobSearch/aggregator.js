/**
 * aggregator.js
 *
 * Combines results from all configured job sources, normalizes them into a
 * single consistent shape, de-duplicates, and caches the result so we do NOT
 * hammer external APIs on every request.
 *
 * Per-source caps keep response sizes sane (e.g. Greenhouse boards can
 * return hundreds of jobs). Search-link fallback cards (`isSearchLink`) are
 * passed through unchanged so the UI can render them honestly.
 *
 * --- Hardening (2026-10-17) ---
 *
 * - `normalizeJob` is now imported from the shared `normalizeJob.js` module
 *   instead of being defined inline. This ensures all adapters and the
 *   aggregator apply identical default/fallback logic.
 *
 * - `fetchFromSource` is exported as `runSourceSafely` so tests and admin
 *   endpoints can exercise per-source isolation directly.
 *
 * - `deduplicateJobs` is exported as a named function, reusing the same
 *   deduplication algorithm used internally.
 *
 * - New sources `ashby` (public JSON API) and `wellfound` (Selenium +
 *   search-link fallback) are registered.
 */

const greenhouse = require("./greenhouse");
const lever = require("./lever");
const ashby = require("./ashby");
const wellfound = require("./wellfound");
const internshala = require("./internshala");
const linkedin = require("./linkedin");
const indeed = require("./indeed");
const normalizeJob = require("./normalizeJob");

const MAX_PER_SOURCE =
    parseInt(process.env.JOB_MAX_PER_SOURCE, 10) || 20;

const sources = {
    greenhouse,
    lever,
    ashby,
    wellfound,
    internshala,
    linkedin,
    indeed
};

// ---- In-memory result cache (TTL) ----
// Avoids re-fetching from external APIs on repeated searches.
// Keyed by JSON.stringify({ query, location, source }).
const CACHE_TTL_MS =
    parseInt(process.env.JOB_CACHE_TTL_MS, 10) || 300_000; // 5 min
const cache = new Map();

/**
 * Per-source timeout (ms). No single source should block the whole search;
 * slow/hanging adapters (e.g. a non-responsive board) are allowed up to this
 * much wall-clock time before being dropped. Must stay safely above each
 * adapter's per-request axios timeout so slow-but-valid sources are not
 * prematurely aborted by the race. Override with JOB_SOURCE_TIMEOUT_MS.
 */
const SOURCE_TIMEOUT_MS =
    parseInt(process.env.JOB_SOURCE_TIMEOUT_MS, 10) || 15000;

/**
 * Run a single source with isolation and a hard timeout. If it throws,
 * returns non-array data, or takes too long, log and return `[]` so one
 * broken/slow source never breaks or blocks the whole aggregation.
 *
 * An AbortController is created per call and its signal is passed to the
 * adapter via params.signal so that HTTP-level requests (axios) can be
 * truly cancelled when the timeout fires - preventing leaked background
 * work.
 *
 * @param {string} name  Source name (e.g. "greenhouse").
 * @param {function} fn  Source search function.
 * @param {object} params  { query, location }
 * @returns {Promise<array>} Jobs from this source (always an array).
 */
const runSourceSafely = async (name, fn, params) => {
    const controller = new AbortController();
    const timer = setTimeout(() => controller.abort(), SOURCE_TIMEOUT_MS);

    try {
        const jobs = await Promise.race([
            fn({ ...params, signal: controller.signal }),
            new Promise((_, reject) =>
                setTimeout(
                    () =>
                        reject(
                            new Error(
                                `timeout after ${SOURCE_TIMEOUT_MS}ms`
                            )
                        ),
                    SOURCE_TIMEOUT_MS
                )
            )
        ]);
        clearTimeout(timer);
        if (!Array.isArray(jobs)) {
            console.warn(
                `${name} returned non-array data; ignoring.`
            );
            return [];
        }
        return jobs;
    } catch (error) {
        clearTimeout(timer);
        controller.abort();
        console.error(
            `${name} search failed:`,
            error.message
        );
        return [];
    }
};

/**
 * De-duplicate a list of normalized jobs.
 *
 * Deduplication key strategy:
 *   1. `externalId` — the preferred unique identifier across sources.
 *   2. Fallback: `${company}-${title}-${applyUrl}` for jobs that
 *      lack an externalId (e.g. some search-link cards).
 *
 * The first occurrence wins; later duplicates are dropped.
 *
 * @param {object[]} jobs  Normalized job objects.
 * @returns {object[]} Deduplicated job objects (same order, first wins).
 */
const deduplicateJobs = (jobs) => {
    const unique = new Map();
    for (const job of jobs) {
        const key =
            job.externalId ||
            `${job.company}-${job.title}-${job.applyUrl}`;
        if (!unique.has(key)) {
            unique.set(key, job);
        }
    }
    return Array.from(unique.values());
};

/**
 * Search all (or a single) job source(s), normalize, cap, de-dupe, cache.
 *
 * @param {{ query?: string, location?: string, source?: string }} params
 * @returns {Promise<object[]>} All matching normalized, deduplicated jobs.
 */
const search = async ({
    query = "",
    location = "",
    source = ""
} = {}) => {
    const selected = source && sources[source]
        ? { [source]: sources[source] }
        : sources;

    // Cache key includes the selected source set so a single-source
    // search doesn't reuse an all-sources result.
    const cacheKey = JSON.stringify({
        query,
        location,
        source: source || "all"
    });

    const cached = cache.get(cacheKey);
    if (cached && Date.now() - cached.ts < CACHE_TTL_MS) {
        return cached.jobs;
    }

    // Fetch all selected sources in parallel. allSettled guarantees one
    // broken/slow source (already guarded by runSourceSafely) can never
    // reject the whole aggregation; anything that didn't fulfill resolves []
    // in the loop below.
    const perSourceResults = await Promise.allSettled(
        Object.entries(selected).map(([name, fn]) =>
            runSourceSafely(name, fn, { query, location })
        )
    );

    // Normalize + cap each source.
    let jobs = [];
    for (const result of perSourceResults) {
        const sourceJobs =
            result.status === "fulfilled" &&
            Array.isArray(result.value)
                ? result.value
                : [];
        const normalized = sourceJobs.map(normalizeJob);
        // Cap real jobs; keep search-link cards (cheap, one per source).
        const real = normalized
            .filter((j) => !j.isSearchLink)
            .slice(0, MAX_PER_SOURCE);
        const links = normalized.filter((j) => j.isSearchLink);
        jobs.push(...real, ...links);
    }

    const result = deduplicateJobs(jobs);
    cache.set(cacheKey, { jobs: result, ts: Date.now() });
    return result;
};

/** Clear the cache (used by tests and a future admin endpoint). */
const clearCache = () => {
    cache.clear();
};

module.exports = {
    search,
    normalizeJob,
    runSourceSafely,
    deduplicateJobs,
    clearCache,
    MAX_PER_SOURCE,
    sources
};
