const greenhouse = require("./greenhouse");
const lever = require("./lever");
const internshala = require("./internshala");
const linkedin = require("./linkedin");
const indeed = require("./indeed");

const sources = {
    greenhouse,
    lever,
    internshala,
    linkedin,
    indeed
};


const normalizeJob = (job) => {
    return {
        externalId:
            job.externalId ||
            `${job.source || "unknown"}-${job.applyUrl || ""}`,

        title:
            job.title ||
            "Unknown Position",

        company:
            job.company ||
            "Unknown Company",

        location:
            job.location ||
            "Unknown",

        workMode:
            job.workMode ||
            "Unknown",

        employmentType:
            job.employmentType ||
            "Internship",

        description:
            job.description ||
            "",

        skills:
            Array.isArray(job.skills)
                ? job.skills
                : [],

        salary:
            job.salary ||
            "",

        source:
            job.source ||
            "Unknown",

        sourceUrl:
            job.sourceUrl ||
            "",

        applyUrl:
            job.applyUrl ||
            "",

        postedDate:
            job.postedDate ||
            null
    };
};


const search = async ({
    query = "",
    location = "",
    source = ""
}) => {

    let selectedSources;

    if (
        source &&
        sources[source]
    ) {
        selectedSources = {
            [source]: sources[source]
        };
    } else {
        selectedSources = sources;
    }


    const results =
        await Promise.all(
            Object.entries(
                selectedSources
            ).map(
                async ([
                    name,
                    searchFunction
                ]) => {

                    try {

                        const jobs =
                            await searchFunction({
                                query,
                                location
                            });

                        if (
                            !Array.isArray(
                                jobs
                            )
                        ) {
                            console.warn(
                                `${name} returned invalid data`
                            );

                            return [];
                        }

                        return jobs.map(
                            (job) => ({
                                ...job,
                                source:
                                    job.source ||
                                    name
                            })
                        );

                    } catch (error) {

                        console.error(
                            `${name} search failed:`,
                            error.message
                        );

                        return [];
                    }
                }
            )
        );


    const jobs =
        results
            .flat()
            .filter(Boolean)
            .map(normalizeJob);


    // Remove duplicate jobs
    const unique =
        new Map();

    for (const job of jobs) {

        const key =
            job.externalId ||
            `${job.company}-${job.title}-${job.applyUrl}`;

        if (
            !unique.has(key)
        ) {
            unique.set(
                key,
                job
            );
        }
    }


    return [
        ...unique.values()
    ];
};


module.exports = {
    search
};