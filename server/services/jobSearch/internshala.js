/**
 * Internshala adapter — search-link fallback (compliant).
 *
 * Internshala (internshala.com) does NOT publish a public REST API for
 * programmatic internship listings, and its site actively blocks automated
 * access (scraping / headless browsers / anti-bot controls).
 *
 * Per the project's honesty policy, this adapter does NOT pretend to be a
 * live job feed. Instead it returns a SINGLE clearly-labeled card that links
 * to Internshala's public search page, pre-filled with the caller's query
 * and location. The user clicks "Apply" to browse real listings directly on
 * Internshala.
 *
 * The returned object carries `isSearchLink: true` and
 * `unavailableReason` so the frontend can render it distinctly from live
 * jobs and never present it as a specific, scraped listing.
 *
 * If Internshala ever publishes an official API, replace this body with a
 * real HTTP call to that endpoint.
 */

const buildInternshalaUrl = (query, location) => {
    var params = new URLSearchParams();
    if (query && query.trim()) {
        params.set("keyword", query.trim());
    }
    if (location && location.trim()) {
        params.set("location", location.trim());
    }
    var qs = params.toString();
    return "https://internshala.com/internships" + (qs ? "?" + qs : "");
};

const searchInternshala = async ({ query = "", location = "" }) => {
    const searchUrl = buildInternshalaUrl(query, location);
    const label = [query, location].filter(Boolean).join(" in ") || "all categories";

    return [
        {
            externalId:
                "internshala-search-" +
                Buffer.from(searchUrl).toString("base64"),

            title: query
                ? `Internshala: "${query}" internships`
                : "Internshala internship listings",

            company: "Internshala",
            location: location || "All India",
            workMode: "Unknown",
            employmentType: "Internship",

            description:
                `Browse "${label}" internships on Internshala. ` +
                `Internshala does not provide a public API and blocks ` +
                `automated scraping, so this is a direct search link rather ` +
                `than a live feed. Click "Apply" to view real, current ` +
                `listings on Internshala.`,

            skills: [],
            salary: "",
            source: "internshala",
            sourceUrl: searchUrl,
            applyUrl: searchUrl,
            requiresAuth: false,
            postedDate: null,
            // IMPORTANT: marks this as a search link, NOT a scraped job.
            isSearchLink: true,
            unavailableReason:
                "Internshala has no public API and blocks automated access; showing a search link."
        }
    ];
};

module.exports = searchInternshala;
