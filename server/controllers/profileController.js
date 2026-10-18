const Profile = require("../models/Profile");
const Application = require("../models/Application");
const Job = require("../models/Job");

const getProfile = async (req, res) => {
    try {
        let profile = await Profile.findOne({
            clerkId: req.clerkId
        });

        if (!profile) {
            profile = await Profile.create({
                clerkId: req.clerkId
            });
        }

        res.json({
            success: true,
            profile
        });
    } catch (error) {
        res.status(500).json({
            success: false,
            message: error.message
        });
    }
};

/**
 * GET /api/dashboard/stats
 *
 * Return real dashboard statistics for the authenticated user:
 *  - jobsFound:       total jobs currently in the database
 *  - applications:    this user's application count
 *  - interviews:      this user's applications with status "Interview"
 *  - profileComplete: boolean
 *  - profileStrength: percentage of optional profile fields filled (0–100)
 */
const getDashboardStats = async (req, res) => {
    try {
        const profile = await Profile.findOne({
            clerkId: req.clerkId
        }).lean();

        // Count this user's applications
        const applicationCount = await Application.countDocuments({
            clerkId: req.clerkId
        });

        // Count applications in "Interview" stage
        const interviewCount = await Application.countDocuments({
            clerkId: req.clerkId,
            status: "Interview"
        });

        // Count total jobs stored in DB
        const jobCount = await Job.countDocuments();

        // Profile completion: count filled optional fields
        let profileStrength = 0;
        if (profile) {
            const fields = [
                "fullName",
                "email",
                "phone",
                "location",
                "headline",
                "summary"
            ];
            const filled = fields.filter(
                (f) => profile[f] && String(profile[f]).trim().length > 0
            ).length;
            const arrayFields = [
                "skills",
                "keywords",
                "experience",
                "education",
                "projects"
            ];
            const filledArrays = arrayFields.filter(
                (f) => Array.isArray(profile[f]) && profile[f].length > 0
            ).length;
            profileStrength = Math.round(
                ((filled + filledArrays) /
                    (fields.length + arrayFields.length)) *
                100
            );
        }

        res.json({
            success: true,
            stats: {
                jobsFound: jobCount,
                applications: applicationCount,
                interviews: interviewCount,
                profileComplete: !!profile?.profileComplete,
                profileStrength
            }
        });
    } catch (error) {
        console.error("Dashboard stats error:", error.message);
        res.status(500).json({
            success: false,
            message: "Failed to load dashboard stats."
        });
    }
};

const updateProfile = async (req, res) => {
    try {
        const profile = await Profile.findOneAndUpdate(
            {
                clerkId: req.clerkId
            },
            req.body,
            {
                new: true,
                upsert: true
            }
        );

        res.json({
            success: true,
            profile
        });
    } catch (error) {
        res.status(500).json({
            success: false,
            message: error.message
        });
    }
};

module.exports = {
    getProfile,
    getDashboardStats,
    updateProfile
};