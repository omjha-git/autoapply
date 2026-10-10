const mongoose = require("mongoose");

const jobSchema = new mongoose.Schema(
    {
        externalId: {
            type: String,
            index: true
        },

        title: {
            type: String,
            required: true
        },

        company: {
            type: String,
            required: true
        },

        location: String,

        workMode: {
            type: String,
            enum: ["Remote", "Hybrid", "On-site", "Unknown"],
            default: "Unknown"
        },

        employmentType: String,

        description: String,

        skills: [String],

        salary: String,

        source: {
            type: String,
            required: true
        },

        sourceUrl: String,

        applyUrl: String,

        postedDate: Date,

        matchScore: {
            type: Number,
            default: 0
        }
    },
    {
        timestamps: true
    }
);

jobSchema.index(
    {
        title: "text",
        company: "text",
        description: "text",
        skills: "text"
    }
);

module.exports = mongoose.model("Job", jobSchema);