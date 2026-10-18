import {
    useState
} from "react";

import {
    searchJobs,
    createApplication
} from "../services/api";

import Layout from "../components/Layout";

import {
    Link
} from "react-router-dom";

import {
    MapPin,
    Briefcase,
    Clock,
    AlertCircle
} from "lucide-react";


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

            // Distinguish failure modes so the UI can surface a precise
            // state (auth / server / network-CORS) instead of a generic
            // "nothing happened" message.
            if (!error.response) {
                // No response => network failure or CORS blocking the
                // request (browsers hide detail on cross-origin failures).
                setError(
                    "Network/CORS error \u2014 could not reach the AutoApply API. " +
                    "Make sure the server is running and CLIENT_URL permits " +
                    "this browser origin (http://localhost:5173 in dev)."
                );
            } else if (error.response.status === 401) {
                setError(
                    "Authentication required \u2014 please sign in to search jobs."
                );
            } else if (error.response.status >= 500) {
                setError(
                    error.response?.data?.message ||
                    "Server error while searching jobs. Please try again."
                );
            } else {
                setError(
                    error.response?.data?.message ||
                    "Unable to search jobs."
                );
            }

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
        <Layout
            title="Find Jobs"
            subtitle="Search opportunities based on your skills, role and preferred location."
        >


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

                        <div className="results-header">

                            <h2 className="results-heading">

                                Found{" "}

                                <strong>
                                    {jobs.length}
                                </strong>{" "}

                                jobs

                            </h2>

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
                            <p className="loading-spinner">
                                Searching available
                                opportunities...
                            </p>
                        </div>

                    )}


                    {/* NO RESULTS */}

                    {searched &&
                        !loading &&
                        !error &&
                        jobs.length === 0 && (

                            <div className="empty">
                                <h3>
                                    No jobs found
                                </h3>
                                <p>
                                    We could not find any jobs
                                    matching your search criteria.
                                </p>
                                <button
                                    className="btn secondary"
                                    onClick={() => {
                                        setQuery("");
                                        setLocation("");
                                    }}
                                >
                                    Clear Search
                                </button>
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
                                    className={"job-card" + (job.isSearchLink ? " search-link-card" : "")}
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
                                                {job.isSearchLink && (
                                                    <span
                                                        className="search-link-badge"
                                                        title="Search link — not a live listing"
                                                    >
                                                        Search link
                                                    </span>
                                                )}

                                            </span>


                                            {job.isSearchLink ? (
                                                <span className="match-score match-na">
                                                    N/A
                                                </span>
                                            ) : (
                                                <span className={"match-score " + (score >= 80 ? "high" : score >= 50 ? "medium" : "low")}>
                                                    {score}%
                                                    Match
                                                </span>
                                            )}

                                        </div>


                                        {/* TITLE */}

                                        <h3 className="job-title">
                                            {job.title || "Unknown Position"}
                                        </h3>


                                        {/* COMPANY */}

                                        <p className="job-company">
                                            {job.company || "Unknown Company"}
                                        </p>


                                        {/* LOCATION */}

                                        <p>

                                            <MapPin size={16} />
                                            {job.location ||
                                                "Location not specified"}

                                        </p>


                                        {/* WORK MODE */}

                                        {job.workMode &&
                                            job.workMode !==
                                                "Unknown" && (

                                                <p>

                                                    <Briefcase size={14} />
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

                                                    <Clock size={14} />
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


                                    {job.isSearchLink && job.unavailableReason && (
                                                <p className="unavailable-note">
                                                    <AlertCircle size={14} />
                                                    {job.unavailableReason}
                                                </p>
                                            )}


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

                                                <div className="job-skills">

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


                                        {!job.isSearchLink && (
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
                                        )}


                                        {job.applyUrl && (

                                            <a
                                                className="btn"
                                                href={
                                                    job.applyUrl
                                                }
                                                target="_blank"
                                                rel="noreferrer"
                                            >

                                                {job.isSearchLink
                                                    ? "Browse results"
                                                    : "Apply"}

                                            </a>

                                        )}

                                    </div>


                                </div>

                            );

                        })}

                </div>

        </Layout>

    );

}