/**
 * ashby.js
 *
 * Ashby Job Board API adapter.
 *
 * Ashby (ashbyhq.com) is a recruiting platform that exposes a public,
 * unauthenticated JSON API for each company's career board:
 *
 *   GET https://api.ashbyhq.com/posting-api/job-board/{clientname}?includeCompensation=true
 *
 * This endpoint returns real, individual job postings (not search results).
 *
 * Docs: https://www.ashbyhq.com/careers
 * API: https://www.notion.so/as/87b96d99d5d74f9d8a9742315c527d16
 *
 * Example response shape:
 *   {
 *     "jobs": [
 *       {
 *         "id": "b6e1b7a9-1234-4abc-9def-123456789abc",
 *         "title": "Senior Frontend Engineer",
  *         "location": "Remote",
  *         "department": "Engineering",
 *         "workplaceType": "Remote",         // "Remote", "Hybrid", "On-site"
 *         "employmentType": "Full-time",      // "Full-time", "Part-time", etc.
 *         "descriptionHtml": "<h2>About the role</h2>...",
 *         "compensation": { "summaryComponents": [{"compensationType":"Salary","interval":"1 YEAR","currencyCode":"USD","minValue":150000,"maxValue":200000}] },
 *         "applyUrl": "https://ashbyhq.com/company/jobs/apply?...id=...",
 *         "jobUrl": "https://jobs.ashbyhq.com/ramp/job-1234",
 *         "publishedAt": "2023-08-01T00:00:00.000Z"
 *       }
 *     ]
 *   }
 */

const axios = require("axios");
const { extractSkillsFromText } = require("../skillsDb");
const normalizeJob = require("./normalizeJob");

const ASHBY_API = "https://api.ashbyhq.com/posting-api/job-board";

/**
 * Public, unauthenticated Ashby company boards used as defaults.
 * These are real, official Ashby-powered career boards (the API requires
 * no auth). Each is wrapped in per-board try/catch below.
 */
const DEFAULT_BOARDS = ["ramp", "modal"];

const getBoardTokens = () => {
    const configured = (process.env.ASHBY_BOARDS || "")
        .split(",")
        .map((token) => token.trim())
        .filter(Boolean);
    return configured.length ? configured : DEFAULT_BOARDS;
};

/** Strip HTML tags and decode entities into readable plain text. */
const cleanHtml = (html = "") => {
    return html
        .replace(/<script[^>]*>.*?<\/script>/gi, "")
        .replace(/<style[^>]*>.*?<\/style>/gi, "")
        .replace(/<br\s*\/?>/gi, "\n")
        .replace(/<\/p>/gi, "\n")
        .replace(/<\/li>/gi, "\n")
        .replace(/<\/h[1-6]>/gi, "\n")
        .replace(/<[^>]*>/g, " ")
        .replace(/&nbsp;/gi, " ")
        .replace(/&amp;/gi, "&")
        .replace(/&lt;/gi, "<")
        .replace(/&gt;/gi, ">")
        .replace(/&quot;/gi, '"')
        .replace(/&#39;/gi, "'")
        .replace(/&#x27;/gi, "'")
        .replace(/\s+/g, " ")
        .trim();
};

/** Format compensation range into a human-readable string. */
const formatSalary = (comp) => {
    if (!comp) return "";
    if (typeof comp === "string" && comp.trim()) return comp.trim();
    var comps = comp.summaryComponents ||
        (comp.compensationTiers && comp.compensationTiers[0] && comp.compensationTiers[0].components);
    if (!comps || comps.length === 0) {
        if (comp.scrapeableCompensationSalarySummary) return comp.scrapeableCompensationSalarySummary;
        if (comp.compensationTierSummary) return comp.compensationTierSummary;
        return "";
    }
    var s = comps.find(function(c) { return c.compensationType === "Salary"; }) || comps[0];
    if (!s || (!s.minValue && !s.maxValue)) {
        if (comp.scrapeableCompensationSalarySummary) return comp.scrapeableCompensationSalarySummary;
        return "";
    }
    var min = Math.round(s.minValue);
    var max = s.maxValue ? Math.round(s.maxValue) : null;
    var cur = (s.currencyCode || "USD").toUpperCase();
    var int = s.interval || "";
    var per = "year";
    if (/month/i.test(int)) per = "month";
    else if (/week/i.test(int)) per = "week";
    var fc = function(n) { return cur === "USD" ? "$" + n.toLocaleString() : cur + " " + n.toLocaleString(); };
    if (max && max !== min) return fc(min) + " - " + fc(max) + "/" + per;
    return fc(min) + "/" + per;
};

/** Determine work mode from Ashby workplaceType or location name. */
const determineWorkMode = (job) => {
    const workplace = job.workplaceType || "";
    if (workplace) {
        return workplace;
    }
    const locationName = job.location || "";
    return locationName.toLowerCase().includes("remote")
        ? "Remote"
        : "Unknown";
};

/** Case-insensitive substring match for multi-word queries. */
const matchesQuery = (job, query) => {
    if (!query) return true;
    const searchText = [
        job.title,
        job.location,
        job.department,
        cleanHtml(job.descriptionHtml || "")
    ]
        .filter(Boolean)
        .join(" ")
        .toLowerCase();
    const words = query.toLowerCase().split(/\s+/).filter(Boolean);
    return words.some((word) => searchText.includes(word));
};

/** Map a raw Ashby job to the canonical normalized shape. */
const mapAshbyJob = (job, boardToken) => {
    const description = cleanHtml(job.descriptionHtml || "");

    return normalizeJob({
        externalId: `ashby-${boardToken}-${job.id}`,
        title: job.title || "Unknown Position",
        company: boardToken,
        location: job.location || "Unknown",
        workMode: determineWorkMode(job),
        employmentType: job.employmentType || "Unknown",
        description,
        skills: extractSkillsFromText(
            `${job.title || ""} ${description}`
        ),
        salary: formatSalary(job.compensation),
        source: "ashby",
        sourceUrl: job.jobUrl || "",
        applyUrl: job.applyUrl || job.jobUrl || "",
        postedDate: job.publishedAt
            ? new Date(job.publishedAt)
            : null
    });
};

/**
 * Fetch all jobs from configured Ashby company boards.
 *
 * @param {{ query?: string, location?: string }} params
 * @returns {Promise<object[]>} Normalized job objects.
 */
const searchAshby = async ({ query = "", location = "", signal } = {}) => {
    const boardTokens = getBoardTokens();
    if (boardTokens.length === 0) {
        console.warn("No ASHBY_BOARDS configured.");
        return [];
    }

    const results = await Promise.all(
        boardTokens.map(async (boardToken) => {
            try {
                const response = await axios.get(
                    `${ASHBY_API}/${encodeURIComponent(boardToken)}`,
                    {
                        params: { includeCompensation: true },
                        signal,
                        timeout: 10000,
                        headers: {
                            Accept: "application/json",
                            "User-Agent": "AutoApplyJobSearch/1.0"
                        }
                    }
                );

                const jobs = Array.isArray(
                    response.data?.jobs
                )
                    ? response.data.jobs
                    : [];

                return jobs
                    .filter((job) => matchesQuery(job, query))
                    .filter((job) => {
                        if (!location) return true;
                        const jobLocation =
                            job.location || "";
                        return jobLocation
                            .toLowerCase()
                            .includes(
                                location.toLowerCase()
                            );
                    })
                    .map((job) =>
                        mapAshbyJob(job, boardToken)
                    );
            } catch (error) {
                console.error(
                    `Ashby board "${boardToken}" failed:`,
                    error.response?.status || error.message
                );
                return [];
            }
        })
    );
    return results.flat();
};

module.exports = searchAshby;
