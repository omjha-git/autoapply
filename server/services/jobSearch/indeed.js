/**
 * Indeed adapter — search-link fallback (compliant).
 *
 * Indeed does not provide a public seeker-facing job-listings API and
 * its terms of service prohibit automated scraping/scraping. Live
 * testing confirms that indeed.com/jobs returns HTTP 403 to automated
 * HTTP requests (even with browser-like User-Agent headers), and Indeed's
 * anti-bot infrastructure (Akamai/Distil) would also block Selenium-
 * based browser automation.
 *
 * Per the project's honesty policy, this adapter does NOT attempt to
 * bypass these access controls. Instead it returns a SINGLE
 * clearly-labeled card linking to Indeed's public search results for
 * the user's query + location. It is NOT a live feed.
 *
 * `isSearchLink: true` + `resultType: "search_link"` lets the frontend
 * render it honestly and avoids persisting it as a real job in the DB.
 */

const searchIndeed = async ({ query = "", location = "" }) => {
    const params = new URLSearchParams();
    if (query && query.trim()) params.set("q", query.trim());
    if (location && location.trim()) params.set("l", location.trim());

    const qs = params.toString();
    const searchUrl = "https://www.indeed.com/jobs" + (qs ? "?" + qs : "");
    const label = [query, location].filter(Boolean).join(" in ") || "all categories";

    return [
        {
            externalId:
                "indeed-search-" +
                Buffer.from(searchUrl).toString("base64"),

            title: query
                ? `Indeed: "${query}" jobs`
                : "Indeed job listings",

            company: "Indeed",
            location: location || "Worldwide",
            workMode: "Unknown",
            employmentType: "Unknown",

            description:
                `Browse "${label}" jobs on Indeed. Indeed has no public ` +
                `listings API and prohibits automated scraping, so this is a ` +
                `direct search link rather than a live feed. Click "Apply" to ` +
                `view real, current listings on Indeed.`,

            skills: [],
            salary: "",
            source: "indeed",
            sourceUrl: searchUrl,
            applyUrl: searchUrl,
            postedDate: null,
            // No credentials are accepted or required for Indeed's public
            // search pages. This flag keeps the card honest on the frontend.
                        requiresAuth: false,
            isSearchLink: true,
            resultType: "search_link",
            unavailableReason:
                "Indeed has no public job-search API and blocks automated " +
                "access; showing a search link."
        }
    ];
};

module.exports = searchIndeed;
