const axios = require("axios");

const GREENHOUSE_API =
    "https://boards-api.greenhouse.io/v1/boards";


const getBoardTokens = () => {
    return (process.env.GREENHOUSE_BOARD_TOKENS || "")
        .split(",")
        .map((token) => token.trim())
        .filter(Boolean);
};


// Convert HTML into readable text
const cleanHtml = (html = "") => {
    return html
        .replace(/<br\s*\/?>/gi, "\n")
        .replace(/<\/p>/gi, "\n")
        .replace(/<\/li>/gi, "\n")
        .replace(/<[^>]*>/g, " ")

        // HTML entities
        .replace(/&nbsp;/gi, " ")
        .replace(/&amp;/gi, "&")
        .replace(/&lt;/gi, "<")
        .replace(/&gt;/gi, ">")
        .replace(/&quot;/gi, '"')
        .replace(/&#39;/gi, "'")
        .replace(/&#x27;/gi, "'")

        // Remove remaining encoded tags
        .replace(/&lt;\/?[a-z0-9]+[^&]*&gt;/gi, " ")

        .replace(/\s+/g, " ")
        .trim();
};


// Search primarily by job title/company.
// Description is used only when necessary.
const matchesQuery = (job, query) => {

    if (!query) {
        return true;
    }

    const searchText = [
        job.title,
        job.location?.name
    ]
        .filter(Boolean)
        .join(" ")
        .toLowerCase();

    const words = query
        .toLowerCase()
        .split(/\s+/)
        .filter(Boolean);

    return words.some((word) =>
        searchText.includes(word)
    );
};


const matchesLocation = (job, location) => {

    if (!location) {
        return true;
    }

    const jobLocation =
        job.location?.name || "";

    return jobLocation
        .toLowerCase()
        .includes(
            location.toLowerCase()
        );
};


const normalizeGreenhouseJob = (
    job,
    boardToken
) => {

    const location =
        job.location?.name ||
        "Unknown";

    const description =
        cleanHtml(
            job.content || ""
        );

    return {

        externalId:
            `greenhouse-${boardToken}-${job.id}`,

        title:
            job.title ||
            "Unknown Position",

        company:
            boardToken,

        location,

        workMode:
            location
                .toLowerCase()
                .includes("remote")
                ? "Remote"
                : "Unknown",

        employmentType:
            "Unknown",

        description,

        skills: [],

        salary: "",

        source:
            "greenhouse",

        sourceUrl:
            job.absolute_url ||
            "",

        applyUrl:
            job.absolute_url ||
            "",

        postedDate:
            job.updated_at
                ? new Date(
                    job.updated_at
                )
                : null
    };
};


const searchGreenhouse = async ({
    query = "",
    location = ""
}) => {

    const boardTokens =
        getBoardTokens();

    if (
        boardTokens.length === 0
    ) {

        console.warn(
            "No GREENHOUSE_BOARD_TOKENS configured."
        );

        return [];
    }


    const results =
        await Promise.all(

            boardTokens.map(
                async (boardToken) => {

                    try {

                        const response =
                            await axios.get(
                                `${GREENHOUSE_API}/${encodeURIComponent(
                                    boardToken
                                )}/jobs`,
                                {
                                    params: {
                                        content: true
                                    },
                                    timeout: 10000
                                }
                            );


                        const jobs =
                            Array.isArray(
                                response.data?.jobs
                            )
                                ? response.data.jobs
                                : [];


                        return jobs

                            .filter(
                                (job) =>
                                    matchesQuery(
                                        job,
                                        query
                                    )
                            )

                            .filter(
                                (job) =>
                                    matchesLocation(
                                        job,
                                        location
                                    )
                            )

                            .map(
                                (job) =>
                                    normalizeGreenhouseJob(
                                        job,
                                        boardToken
                                    )
                            );

                    } catch (error) {

                        console.error(
                            `Greenhouse board "${boardToken}" failed:`,
                            error.response?.status ||
                            error.message
                        );

                        return [];
                    }
                }
            )
        );


    return results.flat();
};


module.exports =
    searchGreenhouse;