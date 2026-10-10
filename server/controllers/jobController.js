const Job = require("../models/Job");
const Profile = require("../models/Profile");

const aggregator =
    require("../services/jobSearch/aggregator");

const {
    calculateMatchScore
} = require("../services/ai/matcher");

const searchJobs = async (req, res) => {
    try {
        const {
            query = "",
            location = "",
            source = ""
        } = req.query;

        // =====================================
        // GET USER PROFILE
        // =====================================

        const profile =
            await Profile.findOne({
                clerkId: req.clerkId
            }).lean();

        console.log("\n==============================");
        console.log("JOB MATCHING");
        console.log("==============================");

        console.log(
            "Clerk ID:",
            req.clerkId
        );

        console.log(
            "Profile found:",
            !!profile
        );

        // STOP if profile doesn't exist
        if (!profile) {
            return res.status(400).json({
                success: false,
                message:
                    "Profile not found. Please upload your resume first."
            });
        }

        console.log(
            "Profile name:",
            profile.fullName
        );

        console.log(
            "Profile skills:",
            profile.skills
        );

        console.log(
            "Profile keywords:",
            profile.keywords
        );

        console.log(
            "Profile roles:",
            profile.preferences?.roles
        );

        console.log(
            "Resume characters:",
            profile.resumeText?.length || 0
        );

        // =====================================
        // SEARCH JOBS
        // =====================================

        const jobs =
            await aggregator.search({
                query,
                location,
                source
            });

        console.log(
            "Jobs received:",
            jobs.length
        );

        // =====================================
        // UPSERT JOBS + CALCULATE MATCH SCORES
        //
        // matchScore is calculated fresh for the
        // CURRENT user's profile on every request.
        // It is NOT written to the shared Job doc
        // in MongoDB — that would overwrite scores
        // for every other user.
        //
        // Job metadata (title, company, etc.) IS
        // upserted so Applications can reference it.
        // =====================================

        const responseJobs = [];

        for (const job of jobs) {

            // Calculate per-user score
            const matchScore =
                calculateMatchScore(
                    profile,
                    job
                );

            console.log(
                `${job.title} -> ${matchScore}%`
            );

            // =================================
            // UPSERT JOB METADATA (no score)
            // =================================

            let savedJob;

            const existing =
                await Job.findOne({
                    externalId:
                        job.externalId,
                    source:
                        job.source
                });

            if (existing) {

                existing.title =
                    job.title;

                existing.company =
                    job.company;

                existing.location =
                    job.location;

                existing.workMode =
                    job.workMode;

                existing.employmentType =
                    job.employmentType;

                existing.description =
                    job.description;

                existing.skills =
                    job.skills;

                existing.salary =
                    job.salary;

                existing.sourceUrl =
                    job.sourceUrl;

                existing.applyUrl =
                    job.applyUrl;

                existing.postedDate =
                    job.postedDate;

                // Do NOT save matchScore to the
                // shared Job document.

                savedJob =
                    await existing.save();

            } else {

                // Create without persisting matchScore
                savedJob =
                    await Job.create({
                        ...job
                        // matchScore intentionally omitted
                    });
            }

            // Attach per-user score to the response
            // object only (not in the DB document).
            responseJobs.push({
                ...savedJob.toObject(),
                matchScore
            });
        }

        // =====================================
        // SORT BY MATCH
        // =====================================

        responseJobs.sort(
            (a, b) =>
                (b.matchScore || 0) -
                (a.matchScore || 0)
        );

        console.log(
            "Top scores:",
            responseJobs
                .slice(0, 10)
                .map(
                    (job) =>
                        `${job.title}: ${job.matchScore}%`
                )
        );

        console.log(
            "==============================\n"
        );

        res.json({
            success: true,
            count:
                responseJobs.length,
            jobs:
                responseJobs
        });

    } catch (error) {

        console.error(
            "Job search error:",
            error
        );

        res.status(500).json({
            success: false,
            message:
                error.message
        });
    }
};

const getJobs = async (req, res) => {
    try {

        const jobs =
            await Job.find()
                .sort({
                    matchScore: -1,
                    createdAt: -1
                })
                .limit(100);

        res.json({
            success: true,
            jobs
        });

    } catch (error) {

        res.status(500).json({
            success: false,
            message:
                error.message
        });
    }
};

module.exports = {
    searchJobs,
    getJobs
};
