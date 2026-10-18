/**
 * greenhouse.js
 *
 * Greenhouse Job Board API adapter.
 *
 * Greenhouse exposes a public, unauthenticated JSON API for each company's
 * career board:
 *
 *   GET https://boards-api.greenhouse.io/v1/boards/{board_token}/jobs?content=true
 *
 * This endpoint returns real, individual job postings (not search results).
 * Each job includes an `absolute_url` that links directly to the company's
 * hosted job page, used as both sourceUrl and applyUrl.
 *
 * Docs: https://docs.greenhouse.io/job-board.html
 */

const axios = require("axios");
const { extractSkillsFromText } = require("../skillsDb");
const normalizeJob = require("./normalizeJob");

const GREENHOUSE_API =
    "https://boards-api.greenhouse.io/v1/boards";

/**
 * Public, unauthenticated Greenhouse boards used as defaults when no
 * GREENHOUSE_BOARD_TOKENS are configured.
 */
const DEFAULT_BOARDS = ["stripe", "airbnb", "coinbase"];

const getBoardTokens = () => {
    const configured = (process.env.GREENHOUSE_BOARD_TOKENS || "")
        .split(",")
        .map((token) => token.trim())
        .filter(Boolean);
    return configured.length ? configured : DEFAULT_BOARDS;
};

/** Convert HTML into readable plain text. */
const cleanHtml = (html = "") => {
    return html
        .replace(/<br\s*\/?>/gi, "\n")
        .replace(/<\/p>/gi, "\n")
        .replace(/<\/li>/gi, "\n")
        .replace(/<[^>]*>/g, " ")
        .replace(/&nbsp;/gi, " ")
        .replace(/&amp;/gi, "&")
        .replace(/&lt;/gi, "<")
        .replace(/&gt;/gi, ">")
        .replace(/&quot;/gi, '"')
        .replace(/&#39;/gi, "'")
        .replace(/&#x27;/gi, "'")
        .replace(/&lt;\/?[a-z0-9]+[^&]*&gt;/gi, " ")
        .replace(/\s+/g, " ")
        .trim();
};

/** Case-insensitive substring match for multi-word queries. */
const matchesQuery = (job, query) => {
    if (!query) return true;
    const searchText = [
        job.title,
        job.location?.name,
        cleanHtml(job.content || "")
    ]
        .filter(Boolean)
        .join(" ")
        .toLowerCase();
    const words = query.toLowerCase().split(/\s+/).filter(Boolean);
    return words.some((word) => searchText.includes(word));
};

const matchesLocation = (job, location) => {
    if (!location) return true;
    const jobLocation = job.location?.name || "";
    return jobLocation.toLowerCase().includes(location.toLowerCase());
};

/**
 * Map a raw Greenhouse API job to the canonical normalized shape.
 *
 * BUG FIX: The previous version had `employmentType: "Unknown"` immediately
 * followed by a dangling `description,` expression � description was never
 * assigned. Now properly set and passed through the shared normalizeJob().
 */
const mapGreenhouseJob = (job, boardToken) => {
    const location = job.location?.name || "Unknown";
    const description = cleanHtml(job.content || "");
    return normalizeJob({
        externalId: `greenhouse-${boardToken}-${job.id}`,
        title: job.title || "Unknown Position",
        company: boardToken,
        location,
        workMode: location.toLowerCase().includes("remote")
            ? "Remote" : "Unknown",
        employmentType: "Unknown",
        description,
        skills: extractSkillsFromText(
            `${job.title || ""} ${description}`
        ),
        salary: "",
        source: "greenhouse",
        sourceUrl: job.absolute_url || "",
        applyUrl: job.absolute_url || "",
        postedDate: job.updated_at ? new Date(job.updated_at) : null
    });
};

/**
 * Fetch all jobs from configured Greenhouse boards.
 *
 * @param {{ query?: string, location?: string }} params
 * @returns {Promise<object[]>} Normalized job objects.
 */
const searchGreenhouse = async ({ query = "", location = "", signal } = {}) => {
    const boardTokens = getBoardTokens();
    if (boardTokens.length === 0) {
        console.warn("No GREENHOUSE_BOARD_TOKENS configured.");
        return [];
    }

    const results = await Promise.all(
        boardTokens.map(async (boardToken) => {
            try {
                const response = await axios.get(
                    `${GREENHOUSE_API}/${encodeURIComponent(boardToken)}/jobs`,
                    {
                        params: { content: true },
                        signal,
                        timeout: 10000,
                        headers: {
                            Accept: "application/json",
                            "User-Agent": "AutoApplyJobSearch/1.0"
                        }
                    }
                );
                const jobs = Array.isArray(response.data?.jobs)
                    ? response.data.jobs : [];
                return jobs
                    .filter((job) => matchesQuery(job, query))
                    .filter((job) => matchesLocation(job, location))
                    .map((job) => mapGreenhouseJob(job, boardToken));
            } catch (error) {
                console.error(
                    `Greenhouse board "${boardToken}" failed:`,
                    error.response?.status || error.message
                );
                return [];
            }
        })
    );
    return results.flat();
};

module.exports = searchGreenhouse;
