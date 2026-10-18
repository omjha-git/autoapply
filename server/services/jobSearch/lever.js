/**
 * lever.js
 *
 * Lever Postings API adapter.
 *
 * Lever exposes a public, unauthenticated JSON API for each company's
 * career site:
 *
 *   GET https://api.lever.co/v0/postings/{company}?mode=json
 *
 * This endpoint returns real, individual job postings (not search results).
 *
 * Docs: https://github.com/lever/postings-api
 */

const axios = require("axios");
const { extractSkillsFromText } = require("../skillsDb");
const normalizeJob = require("./normalizeJob");

const LEVER_API = "https://api.lever.co/v0/postings";

/**
 * Public, unauthenticated Lever demo companies used as defaults when no
 * LEVER_SITES are configured.
 */
const DEFAULT_SITES = ["leverdemo", "palantir"];

const getLeverSites = () => {
    const configured = (process.env.LEVER_SITES || "")
        .split(",")
        .map((site) => site.trim())
        .filter(Boolean);
    return configured.length ? configured : DEFAULT_SITES;
};

const normalizeText = (value = "") =>
    value.toLowerCase().trim();

/**
 * Map a raw Lever posting to the canonical normalized shape.
 *
 * Lever fields used:
 *   - job.id          -> externalId (namespaced by site slug)
 *   - job.text        -> title
 *   - site slug       -> company
 *   - job.categories.location -> location
 *   - "remote" in location -> workMode: "Remote"
 *   - job.categories.commitment -> employmentType
 *   - job.descriptionPlain + additionalPlain -> description
 *   - job.hostedUrl   -> sourceUrl
 *   - job.applyUrl || job.hostedUrl -> applyUrl
 *   - job.createdAt   -> postedDate (unix epoch, seconds or ms)
 */
const mapLeverJob = (job, site) => {
    const categories = job.categories || {};

    const description = [
        job.descriptionPlain,
        job.additionalPlain
    ]
        .filter(Boolean)
        .join("\n\n");

    return normalizeJob({
        externalId: `lever-${site}-${job.id}`,
        title: job.text || "Unknown Position",
        company: site,
        location: categories.location || "Unknown",
        workMode: normalizeText(categories.location || "")
            .includes("remote") ? "Remote" : "Unknown",
        employmentType: categories.commitment || "Unknown",
        description,
        skills: extractSkillsFromText(
            `${job.text || ""} ${description}`
        ),
        salary: "",
        source: "lever",
        sourceUrl: job.hostedUrl || "",
        applyUrl: job.applyUrl || job.hostedUrl || "",
        postedDate: job.createdAt
            ? new Date(
                  typeof job.createdAt === "number" &&
                  job.createdAt < 1e12
                      ? job.createdAt * 1000
                      : job.createdAt
              )
            : null
    });
};

const createSemaphore = (limit) => {
    let active = 0;
    const queue = [];
    return {
        acquire: () =>
            new Promise((resolve) => {
                if (active < limit) {
                    active++;
                    resolve();
                } else {
                    queue.push(resolve);
                }
            }),
        release: () => {
            if (queue.length > 0) {
                queue.shift()();
            } else {
                active = Math.max(0, active - 1);
            }
        }
    };
};

/**
 * Per-board concurrency limit + reliable per-board timeout (AbortController).
 *
 * axios's `timeout` config only guards time-to-headers and does NOT abort a
 * slow large-body stream. Live measurement vs the public Lever API:
 *   leverdemo ~2.8s (10 postings); palantir ~7-8s (310 postings, ~5.9 MB).
 * An axios `timeout` of 2s returned palantir in full at ~8s (NOT cancelled);
 * an AbortController signal aborted it promptly at ~1.5s (ERR_CANCELED). So
 * each board is wrapped in its own AbortController timed at LEVER_TIMEOUT_MS,
 * dropping a slow/blocked board BEFORE the aggregator's 15s hard backstop can
 * kill the whole source — preserving results already fetched from other boards.
 * 12s gives palantir headroom while staying under 15s. The aggregator's
 * upstream signal is propagated too. No blanket timeout increases elsewhere.
 * Configurable via LEVER_MAX_CONCURRENT / LEVER_TIMEOUT_MS.
 */
const LEVER_MAX_CONCURRENT =
    parseInt(process.env.LEVER_MAX_CONCURRENT, 10) || 5;
const LEVER_TIMEOUT_MS =
    parseInt(process.env.LEVER_TIMEOUT_MS, 10) || 12000;
const boardSemaphore = createSemaphore(LEVER_MAX_CONCURRENT);

/**
 * Fetch one Lever board: bounded concurrency, a reliable per-board
 * AbortController timeout, propagated parent signal, and per-board try/catch
 * returning [] on failure (so a slow board never discards other boards'
 * results — partial results preserved). All timers, listeners, and permits
 * are released in `finally`.
 *
 * @param {string} site               Lever company slug.
 * @param {string} query              Optional query filter.
 * @param {string} location           Optional location filter.
 * @param {AbortSignal} [parentSignal] Aggregator-level abort signal.
 * @returns {Promise<object[]>} Normalized job objects from this board.
 */
const fetchLeverBoard = async (
    site,
    query,
    location,
    parentSignal
) => {
    const controller = new AbortController();
    const timer = setTimeout(() => controller.abort(), LEVER_TIMEOUT_MS);

    const onParentAbort = () => controller.abort();
    if (parentSignal) {
        if (parentSignal.aborted) {
            controller.abort();
        } else {
            parentSignal.addEventListener("abort", onParentAbort, {
                once: true
            });
        }
    }

    let permits = false;
    try {
        await boardSemaphore.acquire();
        permits = true;

        const response = await axios.get(
            `${LEVER_API}/${encodeURIComponent(site)}`,
            {
                params: { mode: "json" },
                signal: controller.signal,
                timeout: 4000,
                headers: {
                    Accept: "application/json",
                    "User-Agent": "AutoApplyJobSearch/1.0"
                }
            }
        );
        const postings = Array.isArray(response.data)
            ? response.data
            : [];
        return postings
            .filter((job) => {
                const text = [
                    job.text,
                    job.categories?.team,
                    job.categories?.department,
                    job.categories?.location
                ]
                    .filter(Boolean)
                    .join(" ");
                return (
                    !query ||
                    normalizeText(text).includes(normalizeText(query))
                );
            })
            .filter((job) => {
                const jobLocation =
                    job.categories?.location || "";
                return (
                    !location ||
                    normalizeText(jobLocation).includes(
                        normalizeText(location)
                    )
                );
            })
            .map((job) => mapLeverJob(job, site));
    } catch (error) {
        console.error(
            `Lever site "${site}" failed:`,
            error.response?.status || error.message
        );
        return [];
    } finally {
        clearTimeout(timer);
        if (parentSignal) {
            parentSignal.removeEventListener("abort", onParentAbort);
        }
        if (permits) {
            boardSemaphore.release();
        }
    }
};

/**
 * Fetch all jobs from configured Lever sites.
 *
 * Each board is fetched in isolation: a slow/failed board returns [] without
 * discarding results from other boards (partial results preserved).
 *
 * @param {{ query?: string, location?: string, signal?: AbortSignal }} params
 * @returns {Promise<object[]>} Normalized job objects.
 */
const searchLever = async ({ query = "", location = "", signal } = {}) => {
    const sites = getLeverSites();
    if (sites.length === 0) {
        console.warn("No LEVER_SITES configured.");
        return [];
    }

    const results = await Promise.all(
        sites.map((site) =>
            fetchLeverBoard(site, query, location, signal)
        )
    );
    return results.flat();
};

module.exports = searchLever;

