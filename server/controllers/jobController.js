/**
 * jobController.js
 *
 * GET /api/jobs/search  (protected)
 *   - Searches configured job sources via the aggregator (cached).
 *   - For each job, computes a per-user "Estimated Match" score from the
 *     authenticated user's saved resume text + skills (NO AI needed).
 *   - Returns real jobs even when the user has no resume yet: the match
 *     score is null and `profileReady` is false so the frontend can prompt
 *     the user to upload a resume.
 *   - Search-link fallback cards (`isSearchLink`) are returned but NOT
 *     persisted to the shared Job collection, so dashboard "jobs found"
 *     counts only reflect real listings.
 */

const Job = require("../models/Job");
const Profile = require("../models/Profile");
const aggregator = require("../services/jobSearch/aggregator");
const { calculateMatch } = require("../services/ai/matcher");

/**
 * Upsert a real (non-search-link) job's metadata into the shared Job
 * collection so Applications can reference it. Never stores the per-user
 * match score on the shared doc (scores are user-specific).
 * Returns the saved doc as a plain object.
 */
const upsertJobMeta = async (job) => {
    const existing = await Job.findOne({
        externalId: job.externalId,
        source: job.source
    });

    if (existing) {
        existing.title = job.title;
        existing.company = job.company;
        existing.location = job.location;
        existing.workMode = job.workMode;
        existing.employmentType = job.employmentType;
        existing.description = job.description;
        existing.skills = job.skills;
        existing.salary = job.salary;
        existing.sourceUrl = job.sourceUrl;
        existing.applyUrl = job.applyUrl;
        existing.postedDate = job.postedDate;
        await existing.save();
        return existing.toObject();
    }

    const created = await Job.create({ ...job });
    return created.toObject();
};

const searchJobs = async (req, res) => {
    try {
        const { query = "", location = "", source = "" } = req.query;

        // Fetch the user's profile. A DB read blip must NOT prevent the search
        // from running: degrade gracefully (no profile → 0% match, but live
        // jobs AND search-link fallback cards still surface to the UI).
        let profile = null;
        let profileReady = false;
        try {
            profile = await Profile.findOne({ clerkId: req.clerkId }).lean();
            profileReady =
                !!(profile &&
                    profile.resumeText &&
                    String(profile.resumeText).trim());
        } catch (dbError) {
            console.error(
                "Profile lookup failed during job search (continuing):",
                dbError.message
            );
        }

        // Search external sources (cached inside the aggregator).
        const jobs = await aggregator.search({ query, location, source });

        const responseJobs = [];

        for (const job of jobs) {
            // Compute a per-user match only for REAL listings. Search-link
            // cards carry no real data and must never claim a match score.
            let matchResult;
            if (job.isSearchLink) {
                matchResult = {
                    matchPercentage: 0,
                    matchedSkills: [],
                    missingSkills: [],
                    explanation:
                        "Search-link result — no match score computed.",
                    components: {
                        skills: 0,
                        role: 0,
                        description: 0
                    }
                };
            } else {
                matchResult = calculateMatch(profile, job);
            }

            // Persist real jobs only (search-link cards are NOT real listings).
            let saved = job;
            if (!job.isSearchLink) {
                try {
                    saved = await upsertJobMeta(job);
                } catch (persistError) {
                    // A DB hiccup for one job must not break the whole response.
                    console.error("Job upsert failed:", persistError.message);
                    saved = job;
                }
            }

            responseJobs.push({
                ...(typeof saved === "object" ? saved : job),
                // Ensure a stable object id for React keys even for search-link cards.
                _id: saved && saved._id ? String(saved._id) : job.externalId,
                matchScore: matchResult.matchPercentage ?? 0,
                profileReady,
                matchResult
            });
        }

        // Sort by resume-match score (desc). Jobs with null scores sink to top
        // only when everything is null; otherwise they sort lowest.
        responseJobs.sort((a, b) =>
            (b.matchResult?.matchPercentage ?? -1) -
            (a.matchResult?.matchPercentage ?? -1)
        );

        // Return only non-sensitive profile fields the frontend needs.
        const profileSummary = profile
            ? {
                  fullName: profile.fullName || "",
                  skills: Array.isArray(profile.skills) ? profile.skills : [],
                  resumeFileName: profile.resumeFileName || "",
                  resumeTextChars: profile.resumeText ? String(profile.resumeText).length : 0
              }
            : null;

        res.json({
            success: true,
            count: responseJobs.length,
            profileReady,
            profile: profileSummary,
            jobs: responseJobs
        });
    } catch (error) {
        console.error("Job search error:", error);
        res.status(500).json({
            success: false,
            message: error.message || "Failed to search jobs."
        });
    }
};

/**
 * GET /api/jobs
 * Return jobs currently persisted in the DB (used for saved-job reference).
 * Sorted by most recently created.
 */
const getJobs = async (req, res) => {
    try {
        const jobs = await Job.find()
            .sort({ createdAt: -1 })
            .limit(100);
        res.json({ success: true, jobs });
    } catch (error) {
        res.status(500).json({
            success: false,
            message: error.message
        });
    }
};

module.exports = {
    searchJobs,
    getJobs,
    upsertJobMeta
};
