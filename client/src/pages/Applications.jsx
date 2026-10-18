import {
    useEffect,
    useState
} from "react";

import {
    getApplications,
    generateCoverLetter
} from "../services/api";

import Layout from "../components/Layout";

import {
    Link
} from "react-router-dom";

export default function Applications() {
    const [applications, setApplications] = useState([]);
    const [generatingId, setGeneratingId] = useState(null);
    const [expandedId, setExpandedId] = useState(null);
    const [errors, setErrors] = useState({});

    useEffect(() => {
        load();
    }, []);

    const load = async () => {
        try {
            const data = await getApplications();
            setApplications(data.applications || []);
        } catch (error) {
            console.error(error);
        }
    };

    const handleGenerate = async (applicationId) => {
        setGeneratingId(applicationId);
        setErrors((prev) => ({ ...prev, [applicationId]: "" }));
        try {
            const data = await generateCoverLetter(applicationId);
            setApplications((prev) =>
                prev.map((app) =>
                    app._id === applicationId
                        ? { ...app, coverLetter: data.coverLetter }
                        : app
                )
            );
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

    const handleCopy = (text) => {
        navigator.clipboard
            .writeText(text)
            .then(() => alert("Cover letter copied to clipboard!"))
            .catch(() => alert("Could not copy. Please select the text manually."));
    };

    return (
        <Layout
            title="Applications"
            subtitle="Track your saved jobs and applications."
        >
            {applications.length === 0 ? (
                <div className="empty">
                    <h3>No applications yet.</h3>
                    <p>
                        Jobs you save will appear
                        here. Start by searching
                        for jobs to apply.
                    </p>
                    <Link
                        to="/jobs"
                        className="btn"
                    >
                        Find Jobs
                    </Link>
                </div>
            ) : (
                <div className="applications">
                        {applications.map((application) => (
                            <div
                                className="application-row"
                                key={application._id}
                            >
                                <div className="job-header">
                                    <div>
                                        <p className="app-title">
                                            {application.job?.title}
                                        </p>
                                        <p className="app-company">
                                            {application.job?.company}
                                        </p>
                                    </div>
                                    <span
                                        className={
                                            "status " +
                                            (application.status || "")
                                                .toLowerCase()
                                        }
                                    >
                                        {application.status}
                                    </span>
                                </div>

                                <div className="job-actions">
                                    <button
                                        className="btn"
                                        onClick={() => handleGenerate(application._id)}
                                        disabled={generatingId === application._id}
                                    >
                                        {generatingId === application._id
                                            ? "Generating..."
                                            : application.coverLetter
                                                ? "Regenerate Letter"
                                                : "Generate Cover Letter"}
                                    </button>

                                    {application.coverLetter && (
                                        <button
                                            className="btn secondary"
                                            onClick={() =>
                                                setExpandedId(
                                                    expandedId === application._id
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

                                {errors[application._id] && (
                                    <p className="error-msg">
                                        {errors[application._id]}
                                    </p>
                                )}

                                {expandedId === application._id &&
                                    application.coverLetter && (
                                        <div className="panel">
                                            <button
                                                className="btn secondary"
                                                onClick={() => handleCopy(application.coverLetter)}
                                            >
                                                Copy
                                            </button>
                                            <pre className="cover-letter">
                                                {application.coverLetter}
                                            </pre>
                                        </div>
                                    )}
                            </div>
                        ))}
                    </div>
                )}
        </Layout>
    );
}
