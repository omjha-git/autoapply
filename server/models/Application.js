const mongoose = require("mongoose");

const applicationSchema = new mongoose.Schema(
    {
        clerkId: {
            type: String,
            required: true
        },

        job: {
            type: mongoose.Schema.Types.ObjectId,
            ref: "Job",
            required: true
        },

        status: {
            type: String,
            enum: [
                "Saved",
                "Queued",
                "Applying",
                "Applied",
                "Interview",
                "Rejected",
                "Offer"
            ],
            default: "Saved"
        },

        appliedAt: Date,

        notes: String,

        answers: [
            {
                question: String,
                answer: String
            }
        ],

        // AI-generated cover letter.
        // Stored per-application, never on the shared Job document.
        // Empty string means no letter has been generated yet.
        coverLetter: {
            type: String,
            default: ""
        }

    },
    {
        timestamps: true
    }
);

module.exports = mongoose.model(
    "Application",
    applicationSchema
);