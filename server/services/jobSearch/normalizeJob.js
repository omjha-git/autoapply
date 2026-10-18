/**
 * normalizeJob.js
 *
 * Shared job-data contract for the AutoApply job-search pipeline.
 *
 * Every adapter (Greenhouse, Lever, Ashby, …) returns job objects in its own
 * raw shape. This function maps any such object into the single canonical
 * structure that the aggregator, controller, DB model, and frontend all expect.
 *
 * The canonical shape (see also server/models/Job.js):
 *
 *   {
 *     externalId:   string,   // unique across all sources
 *     title:        string,
 *     company:      string,
 *     location:     string,
 *     workMode:     "Remote" | "Hybrid" | "On-site" | "Unknown",
 *     employmentType: string,
 *     description:  string,   // plain text, HTML stripped
 *     skills:       string[], // canonical skill labels
 *     salary:       string,
 *     source:       string,   // "greenhouse" | "lever" | "ashby" | "wellfound" | …
 *     sourceUrl:    string,   // canonical job page (for attribution / bookmark)
 *     applyUrl:     string,   // deep-link the "Apply" button navigates to
  *     postedDate:   Date | null,
 *     isSearchLink: boolean,  // true for honest search-link fallbacks
 *     resultType:   "job" | "search_link", // classification of the result
 *     requiresAuth: boolean,   // true when the applyUrl needs a login
 *     unavailableReason: string // human-readable note for search-link cards
 *   }
 *
 * Defaults are chosen so that partial data (e.g. a job that only has a title)
 * never produces `undefined` fields — every string is at least "".
 */

/**
 * Normalize an arbitrary job-bearing object into the canonical contract.
 *
 * @param {object} job  Raw job object from any adapter.
 * @returns {object}    Canonical normalized job.
 */
const normalizeJob = (job) => ({
    externalId:
        job.externalId ||
        `${job.source || "unknown"}-${job.applyUrl || ""}`,
    title: job.title || "Unknown Position",
    company: job.company || "Unknown Company",
    location: job.location || "Unknown",
    workMode: job.workMode || "Unknown",
    employmentType: job.employmentType || "Unknown",
    description: job.description || "",
    skills: Array.isArray(job.skills) ? job.skills : [],
    salary: job.salary || "",
    source: job.source || "Unknown",
    sourceUrl: job.sourceUrl || "",
    applyUrl: job.applyUrl || "",
    postedDate: job.postedDate instanceof Date ? job.postedDate : null,
    isSearchLink: !!job.isSearchLink,
    resultType: job.resultType || (job.isSearchLink ? "search_link" : "job"),
    requiresAuth: !!job.requiresAuth,
    unavailableReason: job.unavailableReason || ""
});

module.exports = normalizeJob;
