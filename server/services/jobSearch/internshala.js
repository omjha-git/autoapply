/**
 * Internshala adapter — search-link fallback.
 *
 * Internshala does NOT provide a public REST API for
 * programmatic job/internship listings. Their site blocks
 * automated access (scraping, headless browsers, etc.).
 *
 * This adapter returns a single result linking to the
 * Internshala public search page pre-filled with the
 * caller's query and location. The user can click "Apply"
 * to browse real listings directly on Internshala.
 *
 * If Internshala publishes an official API or approved
 * data feed in the future, replace this body with a real
 * HTTP call to that endpoint.
 */
const searchInternshala = async ({
    query = "",
    location = ""
}) => {

    // Build a public Internshala search URL.
    // Their URL format: /internships/keywords-{query}/location-{location}
    // Fall back to the bare search page when fields are empty.

    let searchUrl = "https://internshala.com/internships";

    const parts = [];

    if (query.trim()) {
        parts.push(
            "keywords-" +
            encodeURIComponent(
                query.trim().replace(/\s+/g, "-").toLowerCase()
            )
        );
    }

    if (location.trim()) {
        parts.push(
            "location-" +
            encodeURIComponent(
                location.trim().replace(/\s+/g, "-").toLowerCase()
            )
        );
    }

    if (parts.length > 0) {
        searchUrl += "/" + parts.join("/");
    }

    // Return a single normalized result so the UI
    // shows an actionable card instead of nothing.
    const label = [query, location]
        .filter(Boolean)
        .join(" in ") || "all categories";

    return [
        {
            externalId:
                "internshala-search-" +
                Buffer.from(searchUrl).toString("base64").slice(0, 32),

            title:
                query
                    ? `Internshala: "${query}" internships`
                    : "Internshala internship listings",

            company:
                "Internshala",

            location:
                location || "All India",

            workMode:
                "Unknown",

            employmentType:
                "Internship",

            description:
                `Browse ${label} internships on Internshala. ` +
                "Internshala does not provide a public API. " +
                "Click Apply to search real listings on their platform.",

            skills: [],

            salary: "",

            source: "internshala",

            sourceUrl: searchUrl,

            applyUrl: searchUrl,

            postedDate: null
        }
    ];
};

module.exports = searchInternshala;