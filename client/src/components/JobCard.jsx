import {
    MapPin,
    Clock,
    Briefcase,
    AlertCircle
} from "lucide-react";

/**
 * JobCard — displays a single job listing.
 *
 * Expected props:
 *   - job: { externalId, title, company, location, workMode,
 *            employmentType, description, skills, salary,
 *            source, sourceUrl, applyUrl, postedDate, matchScore,
 *            isSearchLink, unavailableReason }
 *   - onSave?: (job) => void  — called when the user clicks "Save"
 */
export default function JobCard({ job, onSave }) {
    const matchScore = job?.matchScore || 0;

    const getMatchClass = (score) => {
        if (score >= 80) return "high";
        if (score >= 50) return "medium";
        return "low";
    };

    return (
        <div
            className={
                "job-card" +
                (job?.isSearchLink ? " search-link-card" : "")
            }
        >
            <div className="job-info">
                <div className="job-header">
                    <span className="source">
                        {job?.source || "Job Board"}
                        {job?.isSearchLink && (
                            <span
                                className="search-link-badge"
                                title="Search link — not a live listing"
                            >
                                Search link
                            </span>
                        )}
                    </span>

                    {job?.isSearchLink ? (
                        <span className="match-na">
                            N/A
                        </span>
                    ) : (
                        <span
                            className={
                                "match-score " + getMatchClass(matchScore)
                            }
                        >
                            {matchScore}%
                            {" "}
                            Match
                        </span>
                    )}
                </div>

                <h3 className="job-title">
                    {job?.title || "Untitled"}
                </h3>

                <p className="job-company">
                    {job?.company || "Unknown company"}
                </p>

                <p className="job-location">
                    <MapPin size={16} />
                    {" "}
                    {job?.location || "Location not specified"}
                </p>

                {job?.workMode && job.workMode !== "Unknown" && (
                    <p className="job-mode">
                        <Clock size={14} />
                        {" "}
                        {job.workMode}
                    </p>
                )}

                {job?.employmentType && job.employmentType !== "Unknown" && (
                    <p className="job-meta-line">
                                                <Briefcase size={14} />
                        {job.employmentType}
                    </p>
                )}

                {job?.isSearchLink && job.unavailableReason && (
                    <p className="unavailable-note">
                        <AlertCircle size={14} />
                        {" "}
                        {job.unavailableReason}
                    </p>
                )}

                {job?.description && (
                    <p className="job-description">
                        {job.description.length > 200
                            ? `${job.description.slice(0, 200)}…`
                            : job.description}
                    </p>
                )}

                {job?.skills?.length > 0 && (
                    <div className="job-skills">
                        {job.skills
                            .slice(0, 5)
                            .map((skill) => (
                                <span
                                    key={skill}
                                    className="skill-tag"
                                >
                                    {skill}
                                </span>
                            ))}
                    </div>
                )}
            </div>

            <div className="job-actions">
                {job?.applyUrl && (
                    <a
                        href={job.applyUrl}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="btn"
                    >
                        {job?.isSearchLink ? "Browse results" : "Apply"}
                    </a>
                )}

                {onSave && !job?.isSearchLink && (
                    <button
                        className="btn secondary"
                        onClick={() => onSave(job)}
                    >
                        Save
                    </button>
                )}
            </div>
        </div>
    );
}


