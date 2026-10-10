const mongoose = require("mongoose");

const profileSchema =
    new mongoose.Schema(
        {
            clerkId: {
                type: String,
                required: true,
                unique: true
            },

            fullName: {
                type: String,
                default: ""
            },

            email: {
                type: String,
                default: ""
            },

            phone: {
                type: String,
                default: ""
            },

            location: {
                type: String,
                default: ""
            },

            headline: {
                type: String,
                default: ""
            },

            summary: {
                type: String,
                default: ""
            },

            skills: {
                type: [String],
                default: []
            },

            education: {
                type: [
                    {
                        institution: String,
                        degree: String,
                        field: String,
                        startDate: String,
                        endDate: String,
                        cgpa: String
                    }
                ],
                default: []
            },

            experience: {
                type: [
                    {
                        company: String,
                        role: String,
                        startDate: String,
                        endDate: String,
                        description: String
                    }
                ],
                default: []
            },

            projects: {
                type: [
                    {
                        name: String,
                        description: String,
                        technologies: [String],
                        url: String
                    }
                ],
                default: []
            },

            preferences: {
                roles: {
                    type: [String],
                    default: []
                },

                locations: {
                    type: [String],
                    default: []
                },

                remote: {
                    type: Boolean,
                    default: true
                },

                internship: {
                    type: Boolean,
                    default: true
                }
            },

            keywords: {
                type: [String],
                default: []
            },

            resumeFileName: {
                type: String,
                default: ""
            },

            resumeText: {
                type: String,
                default: ""
            },

            profileComplete: {
                type: Boolean,
                default: false
            }
        },
        {
            timestamps: true
        }
    );

module.exports =
    mongoose.model(
        "Profile",
        profileSchema
    );