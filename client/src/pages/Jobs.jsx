import {
    useState
} from "react";

import {
    searchJobs,
    createApplication
} from "../services/api";


export default function Jobs() {

    const [jobs, setJobs] =
        useState([]);

    const [query, setQuery] =
        useState("");

    const [location, setLocation] =
        useState("");

    const [loading, setLoading] =
        useState(false);

    const [searched, setSearched] =
        useState(false);

    const [error, setError] =
        useState("");


    // =========================
    // SEARCH JOBS
    // =========================

    const search = async () => {

        try {

            setLoading(true);
            setError("");
            setSearched(true);

            const data =
                await searchJobs({
                    query,
                    location,
                    source: ""
                });


            setJobs(
                Array.isArray(data.jobs)
                    ? data.jobs
                    : []
            );

        } catch (error) {

            console.error(
                "Job search error:",
                error
            );

            setJobs([]);

            setError(
                error.response?.data?.message ||
                "Unable to search jobs."
            );

        } finally {

            setLoading(false);

        }
    };


    // =========================
    // SAVE JOB
    // =========================

    const saveJob = async (jobId) => {

        try {

            await createApplication(
                jobId,
                "Saved"
            );

            alert(
                "Job saved successfully!"
            );

        } catch (error) {

            console.error(
                "Save job error:",
                error
            );

            alert(
                error.response?.data?.message ||
                "Could not save job."
            );
        }
    };


    // =========================
    // ENTER KEY SEARCH
    // =========================

    const handleKeyDown = (event) => {

        if (event.key === "Enter") {
            search();
        }

    };


    // =========================
    // CLEAN DESCRIPTION
    // =========================

    const cleanDescription = (
        description = ""
    ) => {

        return description

            // HTML tags
            .replace(
                /<br\s*\/?>/gi,
                " "
            )

            .replace(
                /<[^>]*>/g,
                " "
            )

            // HTML entities
            .replace(
                /&lt;/gi,
                "<"
            )

            .replace(
                /&gt;/gi,
                ">"
            )

            .replace(
                /&amp;/gi,
                "&"
            )

            .replace(
                /&nbsp;/gi,
                " "
            )

            .replace(
                /&quot;/gi,
                '"'
            )

            .replace(
                /&#39;/gi,
                "'"
            )

            .replace(
                /&#x27;/gi,
                "'"
            )

            // whitespace
            .replace(
                /\s+/g,
                " "
            )

            .trim();

    };


    // =========================
    // MATCH SCORE LABEL
    // =========================

    const getMatchLabel = (
        score
    ) => {

        if (score >= 80) {
            return "Excellent Match";
        }

        if (score >= 60) {
            return "Good Match";
        }

        if (score >= 40) {
            return "Possible Match";
        }

        return "Low Match";
    };


    return (

        <div className="app">


            {/* =========================
                SIDEBAR
            ========================= */}

            <aside className="sidebar">

                <h2>
                    AutoApply
                </h2>


                <a href="/dashboard">
                    Dashboard
                </a>


                <a href="/jobs">
                    Find Jobs
                </a>


                <a href="/profile">
                    My Profile
                </a>


                <a href="/applications">
                    Applications
                </a>

            </aside>


            {/* =========================
                MAIN CONTENT
            ========================= */}

            <main className="content">


                <h1>
                    Find Jobs
                </h1>


                <p>
                    Search opportunities based on
                    your skills, role and preferred
                    location.
                </p>


                {/* =========================
                    SEARCH BOX
                ========================= */}

                <div className="search-box">


                    <input
                        type="text"
                        placeholder="Job title, skill..."
                        value={query}
                        onChange={(e) =>
                            setQuery(
                                e.target.value
                            )
                        }
                        onKeyDown={
                            handleKeyDown
                        }
                    />


                    <input
                        type="text"
                        placeholder="Location"
                        value={location}
                        onChange={(e) =>
                            setLocation(
                                e.target.value
                            )
                        }
                        onKeyDown={
                            handleKeyDown
                        }
                    />


                    <button
                        className="btn"
                        onClick={search}
                        disabled={loading}
                    >

                        {loading
                            ? "Searching..."
                            : "Search"}

                    </button>

                </div>


                {/* =========================
                    ERROR
                ========================= */}

                {error && (

                    <div className="empty">

                        {error}

                    </div>

                )}


                {/* =========================
                    RESULT COUNT
                ========================= */}

                {!loading &&
                    !error &&
                    searched &&
                    jobs.length > 0 && (

                        <div className="job-count">

                            Found{" "}

                            <strong>
                                {jobs.length}
                            </strong>{" "}

                            jobs

                        </div>

                    )}


                {/* =========================
                    JOB LIST
                ========================= */}

                <div className="jobs">


                    {/* BEFORE SEARCH */}

                    {!searched &&
                        !loading && (

                            <div className="empty">

                                Search for jobs to see
                                opportunities here.

                            </div>

                        )}


                    {/* LOADING */}

                    {loading && (

                        <div className="empty">

                            Searching available
                            opportunities...

                        </div>

                    )}


                    {/* NO RESULTS */}

                    {searched &&
                        !loading &&
                        !error &&
                        jobs.length === 0 && (

                            <div className="empty">

                                No jobs found.

                                <br />

                                Try another job title
                                or location.

                            </div>

                        )}


                    {/* =========================
                        JOB CARDS
                    ========================= */}

                    {!loading &&
                        jobs.map((job) => {

                            const score =
                                Number(
                                    job.matchScore || 0
                                );


                            const description =
                                cleanDescription(
                                    job.description
                                );


                            return (

                                <div
                                    className="job-card"
                                    key={
                                        job._id ||
                                        job.externalId
                                    }
                                >


                                    {/* JOB INFORMATION */}

                                    <div className="job-info">


                                        {/* HEADER */}

                                        <div className="job-header">


                                            <span className="source">

                                                {job.source ||
                                                    "Job Board"}

                                            </span>


                                            <span className="match-score">

                                                {score}%
                                                Match

                                            </span>

                                        </div>


                                        {/* TITLE */}

                                        <h2>

                                            {job.title ||
                                                "Unknown Position"}

                                        </h2>


                                        {/* COMPANY */}

                                        <h3>

                                            {job.company ||
                                                "Unknown Company"}

                                        </h3>


                                        {/* LOCATION */}

                                        <p>

                                            📍{" "}

                                            {job.location ||
                                                "Location not specified"}

                                        </p>


                                        {/* WORK MODE */}

                                        {job.workMode &&
                                            job.workMode !==
                                                "Unknown" && (

                                                <p>

                                                    💼{" "}

                                                    {
                                                        job.workMode
                                                    }

                                                </p>

                                            )}


                                        {/* EMPLOYMENT TYPE */}

                                        {job.employmentType &&
                                            job.employmentType !==
                                                "Unknown" && (

                                                <p>

                                                    🕐{" "}

                                                    {
                                                        job.employmentType
                                                    }

                                                </p>

                                            )}


                                        {/* MATCH LABEL */}

                                        <p className="match-label">

                                            {getMatchLabel(
                                                score
                                            )}

                                        </p>


                                        {/* DESCRIPTION */}

                                        {description && (

                                            <p className="job-description">

                                                {description.slice(
                                                    0,
                                                    300
                                                )}

                                                {description.length >
                                                    300
                                                    ? "..."
                                                    : ""}

                                            </p>

                                        )}


                                        {/* SKILLS */}

                                        {Array.isArray(
                                            job.skills
                                        ) &&
                                            job.skills.length >
                                                0 && (

                                                <div className="skills">

                                                    {job.skills
                                                        .slice(
                                                            0,
                                                            8
                                                        )
                                                        .map(
                                                            (
                                                                skill
                                                            ) => (

                                                                <span
                                                                    key={
                                                                        skill
                                                                    }
                                                                >

                                                                    {
                                                                        skill
                                                                    }

                                                                </span>

                                                            )
                                                        )}

                                                </div>

                                            )}

                                    </div>


                                    {/* =========================
                                        ACTIONS
                                    ========================= */}

                                    <div className="job-actions">


                                        <button
                                            className="btn secondary"
                                            onClick={() =>
                                                saveJob(
                                                    job._id
                                                )
                                            }
                                        >

                                            Save

                                        </button>


                                        {job.applyUrl && (

                                            <a
                                                className="btn"
                                                href={
                                                    job.applyUrl
                                                }
                                                target="_blank"
                                                rel="noreferrer"
                                            >

                                                Apply

                                            </a>

                                        )}

                                    </div>


                                </div>

                            );

                        })}

                </div>

            </main>

        </div>

    );

}