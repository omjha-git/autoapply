/**
 * LinkedIn Jobs adapter — search-link fallback (compliant).
 *
 * LinkedIn does not provide a public job-listings API and aggressively
 * blocks automated access (CAPTCHAs, login walls, anti-bot). This adapter
 * returns a SINGLE clearly-labeled card linking to LinkedIn's public job
 * search. It is NOT a live feed and the destination requires a LinkedIn
 * account to view listings.
 *
 * `isSearchLink: true` / `requiresAuth: true` let the frontend render it
 * honestly as an authenticated search link.
 */

const searchLinkedIn = async ({ query = "", location = "" }) => {
    const params = new URLSearchParams();
    if (query.trim()) params.set("keywords", query.trim());
    if (location.trim()) params.set("location", location.trim());

    const qs = params.toString();
    const searchUrl = qs
        ? `https://www.linkedin.com/jobs/search/?${qs}`
        : "https://www.linkedin.com/jobs/search/";
    const label = [query, location].filter(Boolean).join(" in ") || "all categories";

    return [
        {
            externalId:
                "linkedin-search-" +
                Buffer.from(searchUrl).toString("base64").slice(0, 32),

            title: query
                ? `LinkedIn: "${query}" jobs`
                : "LinkedIn job listings",

            company: "LinkedIn",
            location: location || "Worldwide",
            workMode: "Unknown",
            employmentType: "Unknown",

            description:
                `Browse "${label}" jobs on LinkedIn. LinkedIn has no public ` +
                `listings API, requires a login, and blocks automation, so ` +
                `this is a direct search link rather than a live feed. Click ` +
                `"Apply" to view real, current listings on LinkedIn ` +
                `(a LinkedIn account is required).`,

            skills: [],
            salary: "",
            source: "linkedin",
            sourceUrl: searchUrl,
            applyUrl: searchUrl,
            postedDate: null,
            isSearchLink: true,
            requiresAuth: true,
            unavailableReason:
                "LinkedIn has no public API, blocks scraping, and requires login; showing a search link."
        }
    ];
};

module.exports = searchLinkedIn;
