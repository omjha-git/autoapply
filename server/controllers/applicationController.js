const Application = require("../models/Application");
const Profile = require("../models/Profile");

const {
    generateCoverLetter: generateLetter
} = require("../services/ai/coverLetterGenerator");


const createApplication = async (req, res) => {
    try {
        const {
            jobId,
            status = "Saved"
        } = req.body;

        const existing = await Application.findOne({
            clerkId: req.clerkId,
            job: jobId
        });

        if (existing) {
            return res.status(400).json({
                success: false,
                message: "Application already exists"
            });
        }

        const application = await Application.create({
            clerkId: req.clerkId,
            job: jobId,
            status
        });

        const populated = await application.populate("job");

        res.status(201).json({
            success: true,
            application: populated
        });
    } catch (error) {
        res.status(500).json({
            success: false,
            message: error.message
        });
    }
};

const getApplications = async (req, res) => {
    try {
        const applications = await Application.find({
            clerkId: req.clerkId
        })
            .populate("job")
            .sort({ createdAt: -1 });

        res.json({
            success: true,
            applications
        });
    } catch (error) {
        res.status(500).json({
            success: false,
            message: error.message
        });
    }
};

const updateApplication = async (req, res) => {
    try {
        const application = await Application.findOneAndUpdate(
            {
                _id: req.params.id,
                clerkId: req.clerkId
            },
            req.body,
            {
                new: true
            }
        ).populate("job");

        if (!application) {
            return res.status(404).json({
                success: false,
                message: "Application not found"
            });
        }

        res.json({
            success: true,
            application
        });
    } catch (error) {
        res.status(500).json({
            success: false,
            message: error.message
        });
    }
};

// =====================================================
// GENERATE COVER LETTER
// POST /api/applications/:id/cover-letter
// =====================================================

const generateCoverLetter = async (req, res) => {
    try {

        // Find the application — clerkId in query enforces
        // ownership: users cannot access each other's apps.
        const application = await Application.findOne({
            _id: req.params.id,
            clerkId: req.clerkId
        }).populate("job");

        if (!application) {
            return res.status(404).json({
                success: false,
                message: "Application not found."
            });
        }

        if (!application.job) {
            return res.status(400).json({
                success: false,
                message: "Job details are missing from this application."
            });
        }

        // Load the authenticated user's profile
        const profile = await Profile.findOne({
            clerkId: req.clerkId
        }).lean();

        if (!profile) {
            return res.status(400).json({
                success: false,
                message:
                    "Profile not found. Please upload your resume first."
            });
        }

        // Generate via Gemini
        const letter = await generateLetter(
            profile,
            application.job
        );

        // Persist to this application only (not the shared Job)
        application.coverLetter = letter;
        await application.save();

        res.json({
            success: true,
            coverLetter: letter,
            applicationId: application._id
        });

    } catch (error) {

        // Do not leak stack traces or internal details
        console.error(
            "Cover letter generation error:",
            error.message
        );

        res.status(500).json({
            success: false,
            message: error.message || "Failed to generate cover letter."
        });
    }
};


module.exports = {
    createApplication,
    getApplications,
    updateApplication,
    generateCoverLetter
};