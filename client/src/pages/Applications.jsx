import {
    useEffect,
    useState
} from "react";

import {
    getApplications,
    generateCoverLetter
} from "../services/api";

export default function Applications() {

    const [
        applications,
        setApplications
    ] = useState([]);

    // Track which application is currently generating
    const [generatingId, setGeneratingId] =
        useState(null);

    // Track which application's letter is expanded
    const [expandedId, setExpandedId] =
        useState(null);

    // Track error per application
    const [errors, setErrors] =
        useState({});

    useEffect(() => {
        load();
    }, []);

    const load = async () => {
        try {
            const data =
                await getApplications();

            setApplications(
                data.applications || []
            );
        } catch (error) {
            console.error(error);
        }
    };


    // =========================
    // GENERATE COVER LETTER
    // =========================

    const handleGenerate = async (applicationId) => {

        setGeneratingId(applicationId);
        setErrors((prev) => ({ ...prev, [applicationId]: "" }));

        try {

            const data = await generateCoverLetter(applicationId);

            // Update the application in local state
            setApplications((prev) =>
                prev.map((app) =>
                    app._id === applicationId
                        ? { ...app, coverLetter: data.coverLetter }
                        : app
                )
            );

            // Auto-expand the new letter
            setExpandedId(applicationId);

        } catch (error) {

            setErrors((prev) => ({
                ...prev,
                [applicationId]:
                    error.response?.data?.message ||
                    "Failed to generate cover letter."
            }));

        } finally {
            setGeneratingId(null);
        }
    };


    // =========================
    // COPY TO CLIPBOARD
    // =========================

    const handleCopy = (text) => {
        navigator.clipboard
            .writeText(text)
            .then(() => alert("Cover letter copied to clipboard!"))
            .catch(() => alert("Could not copy. Please select the text manually."));
    };


    return (
        <div className="app">

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

            <main className="content">

                <h1>
                    Applications
                </h1>

                {applications.length === 0 ? (
                    <div className="empty">
                        No applications yet.
                    </div>
                ) : (
                    <div className="applications">

                        {applications.map(
                            (application) => (

                                <div
                                    className="job-card"
                                    key={
                                        application._id
                                    }
                                    style={{ flexDirection: "column", gap: "12px" }}
                                >

                                    {/* ── Top row: title + status ── */}
                                    <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start" }}>

                                        <div>

                                            <h2>
                                                {
                                                    application
                                                        .job
                                                        ?.title
                                                }
                                            </h2>

                                            <h3>
                                                {
                                                    application
                                                        .job
                                                        ?.company
                                                }
                                            </h3>

                                        </div>

                                        <span className="status">
                                            {
                                                application
                                                    .status
                                            }
                                        </span>

                                    </div>


                                    {/* ── Cover letter action row ── */}
                                    <div className="job-actions">

                                        <button
                                            className="btn secondary"
                                            onClick={() =>
                                                handleGenerate(
                                                    application._id
                                                )
                                            }
                                            disabled={
                                                generatingId ===
                                                application._id
                                            }
                                        >
                                            {generatingId === application._id
                                                ? "Generating…"
                                                : application.coverLetter
                                                    ? "Regenerate Letter"
                                                    : "Generate Cover Letter"}
                                        </button>

                                        {application.coverLetter && (
                                            <button
                                                className="btn secondary"
                                                onClick={() =>
                                                    setExpandedId(
                                                        expandedId ===
                                                            application._id
                                                            ? null
                                                            : application._id
                                                    )
                                                }
                                            >
                                                {expandedId === application._id
                                                    ? "Hide Letter"
                                                    : "View Letter"}
                                            </button>
                                        )}

                                    </div>


                                    {/* ── Error message ── */}
                                    {errors[application._id] && (
                                        <p style={{ color: "#dc2626", margin: 0, fontSize: "14px" }}>
                                            {errors[application._id]}
                                        </p>
                                    )}


                                    {/* ── Expanded cover letter ── */}
                                    {expandedId === application._id &&
                                        application.coverLetter && (

                                        <div
                                            style={{
                                                background: "#f9fafb",
                                                border: "1px solid #e4e4e7",
                                                borderRadius: "10px",
                                                padding: "18px",
                                                position: "relative"
                                            }}
                                        >
                                            <button
                                                className="btn secondary"
                                                style={{ marginBottom: "12px", fontSize: "13px", padding: "7px 14px" }}
                                                onClick={() =>
                                                    handleCopy(
                                                        application.coverLetter
                                                    )
                                                }
                                            >
                                                Copy
                                            </button>

                                            <pre
                                                style={{
                                                    whiteSpace: "pre-wrap",
                                                    wordBreak: "break-word",
                                                    fontFamily: "inherit",
                                                    fontSize: "14px",
                                                    lineHeight: "1.7",
                                                    color: "#374151",
                                                    margin: 0
                                                }}
                                            >
                                                {application.coverLetter}
                                            </pre>

                                        </div>

                                    )}

                                </div>

                            )
                        )}

                    </div>
                )}

            </main>

        </div>
    );
}