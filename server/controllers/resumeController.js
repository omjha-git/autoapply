/**
 * resumeController.js
 *
 * POST /api/profile/resume  (protected)
 *
 * Resume-upload workflow — NO Gemini / AI required:
 *   1. Accept a PDF / DOCX / TXT file (validated by multer in the route).
 *   2. Extract plain text locally with pdf-parse / mammoth (resumeParser).
 *   3. Extract structured info locally (resumeInfoExtractor): name, email,
 *      phone, headline, skills, keywords.
 *   4. Persist resumeText + resumeFileName (always) and the discovered
 *      fields (only when non-empty, so manually-edited profile fields are
 *      preserved) to the authenticated user's Profile.
 *   5. Return a clear success / failure message.
 *
 * The whole flow works offline with zero API keys.
 */

const fs = require("fs");
const Profile = require("../models/Profile");
const { parseResume } = require("../services/resumeParser");
const { extractResumeInfo } = require("../services/resumeInfoExtractor");

/**
 * Default document shape applied to a profile on its first resume upload.
 * Extracted here so buildProfileUpdate can hand-picked defaults without ever
 * re-using a path that $set also targets (MongoDB forbids a field appearing
 * in both $set and $setOnInsert on an upsert — that was the upload bug).
 */
const SCHEMA_DEFAULTS = {
    fullName: "",
    email: "",
    phone: "",
    location: "",
    headline: "",
    summary: "",
    skills: [],
    education: [],
    experience: [],
    projects: [],
    preferences: { roles: [], locations: [], remote: true, internship: true },
    keywords: []
};

/**
 * Build the MongoDB update document for a resume upload.
 *
 * - `$set` always refreshes resumeText / resumeFileName / profileComplete
 *   and OVERWRITES any field the local parser actually populated (non-empty).
 * - Fields the parser could NOT populate are left out of `$set` so an
 *   existing Profile value (possibly hand-edited by the user) is preserved.
 * - `$setOnInsert` ensures a brand-new profile gets schema defaults, but
 *   ONLY for fields NOT in `$set`, so the two operators never overlap.
 *
 * @param {string} clerkId
 * @param {object} info  - output of extractResumeInfo
 * @param {string} resumeText
 * @param {string} resumeFileName
 * @returns {{ $set: object, $setOnInsert: object }}
 */
const buildProfileUpdate = (clerkId, info, resumeText, resumeFileName) => {
    const set = {
        clerkId,
        resumeText,
        resumeFileName,
        profileComplete:
            Array.isArray(info.skills) && info.skills.length > 0
    };

    if (info.fullName) set.fullName = info.fullName;
    if (info.email) set.email = info.email;
    if (info.phone) set.phone = info.phone;
    if (info.headline) set.headline = info.headline;
    if (Array.isArray(info.skills) && info.skills.length) {
        set.skills = info.skills;
    }
    if (Array.isArray(info.keywords) && info.keywords.length) {
        set.keywords = info.keywords;
    }

        // Defaults only for fields the parser did not just populate, so $set and
    // $setOnInsert never share a path (avoids Mongo "path conflict" on upsert).
    const setOnInsert = {};
    for (const [key, value] of Object.entries(SCHEMA_DEFAULTS)) {
        if (!(key in set)) {
            setOnInsert[key] = value;
        }
    }

    return {
        $set: set,
        $setOnInsert: setOnInsert
    };
};

/**
 * POST /api/profile/resume
 */
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

        // 1. LOCAL TEXT EXTRACTION
        let resumeText;
        try {
            resumeText = await parseResume(filePath);
        } catch (parseError) {
            // Unsupported / malformed file — clear, client-facing message.
            return res.status(422).json({
                success: false,
                message:
                    parseError.message ||
                    "Could not extract text from the uploaded file. Please upload a valid PDF, DOCX, or TXT resume."
            });
        }

        if (!resumeText || !resumeText.trim()) {
            return res.status(422).json({
                success: false,
                message:
                    "No readable text was found in this file. Please upload a resume that contains selectable text."
            });
        }

        // 2. LOCAL STRUCTURED EXTRACTION (no AI)
        const info = extractResumeInfo(resumeText);
        const skillsDetected = Array.isArray(info.skills) ? info.skills.length : 0;

        // 3. PERSIST
        const profile = await Profile.findOneAndUpdate(
            { clerkId: req.clerkId },
            buildProfileUpdate(
                req.clerkId,
                info,
                resumeText,
                req.file.originalname
            ),
            {
                returnDocument: "after",
                upsert: true,
                setDefaultsOnInsert: true
            }
        );

        // 4. RESPONSE
        res.status(200).json({
            success: true,
            resumeTextChars: resumeText.length,
            resumeFileName: req.file.originalname,
            skillsDetected,
            profileComplete: skillsDetected > 0,
            message:
                skillsDetected > 0
                    ? `Resume uploaded successfully. ${skillsDetected} skill(s) detected from your resume.`
                    : "Resume uploaded and saved. Add skills manually on your profile to improve match scores.",
            profile
        });
    } catch (error) {
        console.error("Resume upload error:", error);

        // Determine a sensible status code for DB failures etc.
        const status = error && error.status ? error.status : 500;
        res.status(status).json({
            success: false,
            message: error.message || "Failed to process resume."
        });
    } finally {
        // Always clean up the temp file.
        if (filePath && fs.existsSync(filePath)) {
            try {
                fs.unlinkSync(filePath);
            } catch (cleanupError) {
                console.error("File cleanup error:", cleanupError.message);
            }
        }
    }
};

module.exports = {
    uploadResume,
    buildProfileUpdate
};
