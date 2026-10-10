
const axios = require("axios");

const LEVER_API =
    "https://api.lever.co/v0/postings";

const getLeverSites = () => {
    return (
        process.env.LEVER_SITES || ""
    )
        .split(",")
        .map((site) => site.trim())
        .filter(Boolean);
};

const normalizeText = (value = "") =>
    value.toLowerCase().trim();

const searchLever = async ({
    query = "",
    location = ""
}) => {
    const sites = getLeverSites();

    if (sites.length === 0) {
        console.warn(
            "No LEVER_SITES configured."
        );
        return [];
    }

    const results = await Promise.all(
        sites.map(async (site) => {
            try {
                const response =
                    await axios.get(
                        `${LEVER_API}/${encodeURIComponent(site)}`,
                        {
                            params: {
                                mode: "json"
                            },
                            timeout: 15000
                        }
                    );

                const postings =
                    Array.isArray(response.data)
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
                            normalizeText(text)
                                .includes(
                                    normalizeText(query)
                                )
                        );
                    })
                    .filter((job) => {
                        const jobLocation =
                            job.categories?.location ||
                            "";

                        return (
                            !location ||
                            normalizeText(
                                jobLocation
                            ).includes(
                                normalizeText(location)
                            )
                        );
                    })
                    .map((job) => {
                        const categories =
                            job.categories || {};

                        const description = [
                            job.descriptionPlain,
                            job.additionalPlain
                        ]
                            .filter(Boolean)
                            .join("\n\n");

                        return {
                            externalId:
                                `lever-${site}-${job.id}`,

                            title:
                                job.text ||
                                "Unknown Position",

                            company: site,

                            location:
                                categories.location ||
                                "Unknown",

                            workMode:
                                normalizeText(
                                    categories.location ||
                                    ""
                                ).includes("remote")
                                    ? "Remote"
                                    : "Unknown",

                            employmentType:
                                categories.commitment ||
                                "Unknown",

                            description,

                            skills: [],

                            salary: "",

                            source: "lever",

                            sourceUrl:
                                job.hostedUrl || "",

                            applyUrl:
                                job.applyUrl ||
                                job.hostedUrl ||
                                "",

                            postedDate: null
                        };
                    });
            } catch (error) {
                console.error(
                    `Lever site "${site}" failed:`,
                    error.response?.status ||
                    error.message
                );

                return [];
            }
        })
    );

    return results.flat();
};

module.exports = searchLever;