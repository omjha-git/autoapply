const Profile = require("../models/Profile");
const { parseResume } = require("../services/resumeParser");
const {
    extractProfileFromResume
} = require("../services/ai/resumeExtractor");

const fs = require("fs");

const uploadResume = async (req, res) => {
    let filePath = null;

    try {
        if (!req.file) {
            return res.status(400).json({
                success: false,
                message: "Please upload a resume."
            });
        }

        filePath = req.file.path;

        console.log("Resume received:", req.file.originalname);

        // --------------------------------
        // 1. PARSE RESUME
        // --------------------------------

        const resumeText =
            await parseResume(filePath);

        console.log(
            "✓ Resume parsed. Characters:",
            resumeText.length
        );

        // --------------------------------
        // 2. AI EXTRACTION
        // --------------------------------

        const extracted =
            await extractProfileFromResume(
                resumeText
            );

        console.log("✓ AI extraction completed");

        console.log(
            "Recommended roles:",
            extracted.recommendedRoles
        );

        console.log(
            "Extracted skills:",
            extracted.skills
        );

        console.log(
            "Extracted keywords:",
            extracted.keywords
        );

        // --------------------------------
        // 3. SAVE PROFILE
        // --------------------------------

        const profileData = {
            clerkId: req.clerkId,

            fullName:
                extracted.fullName || "",

            email:
                extracted.email || "",

            phone:
                extracted.phone || "",

            location:
                extracted.location || "",

            headline:
                extracted.headline || "",

            summary:
                extracted.summary || "",

            skills:
                Array.isArray(extracted.skills)
                    ? extracted.skills
                    : [],

            education:
                Array.isArray(extracted.education)
                    ? extracted.education
                    : [],

            experience:
                Array.isArray(extracted.experience)
                    ? extracted.experience
                    : [],

            projects:
                Array.isArray(extracted.projects)
                    ? extracted.projects
                    : [],

            // IMPORTANT
            preferences: {
                roles:
                    Array.isArray(
                        extracted.recommendedRoles
                    )
                        ? extracted.recommendedRoles
                        : [],

                locations: [],

                remote: true,

                internship: true
            },

            keywords:
                Array.isArray(extracted.keywords)
                    ? extracted.keywords
                    : [],

            resumeFileName:
                req.file.originalname,

            resumeText,

            profileComplete: true
        };

        const profile =
            await Profile.findOneAndUpdate(
                {
                    clerkId: req.clerkId
                },
                profileData,
                {
                    returnDocument: "after",
                    upsert: true,
                    setDefaultsOnInsert: true
                }
            );

        console.log(
            "✓ Profile saved to MongoDB"
        );

        // --------------------------------
        // 4. DELETE TEMP FILE
        // --------------------------------

        if (
            filePath &&
            fs.existsSync(filePath)
        ) {
            fs.unlinkSync(filePath);

            console.log(
                "✓ Temporary resume deleted"
            );
        }

        // --------------------------------
        // 5. RESPONSE
        // --------------------------------

        res.json({
            success: true,
            message:
                "Resume uploaded and profile created successfully.",

            profile
        });

    } catch (error) {
        console.error(
            "Resume upload error:",
            error
        );

        if (
            filePath &&
            fs.existsSync(filePath)
        ) {
            try {
                fs.unlinkSync(filePath);
            } catch (cleanupError) {
                console.error(
                    "File cleanup error:",
                    cleanupError.message
                );
            }
        }

        res.status(500).json({
            success: false,
            message:
                error.message ||
                "Failed to process resume."
        });
    }
};

module.exports = {
    uploadResume
};