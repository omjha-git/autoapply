const { GoogleGenAI } = require("@google/genai");
const { describeGeminiError } = require("./geminiError");

// Reuse the same client pattern as resumeExtractor.js.
// Guard: if no API key is configured, fail fast with a clear
// error instead of constructing a client with an empty key.
const GEMINI_API_KEY = process.env.GEMINI_API_KEY;
const GEMINI_MODEL =
    process.env.GEMINI_MODEL ||
    "gemini-3.6-flash";

if (!GEMINI_API_KEY || !GEMINI_API_KEY.trim()) {
    console.warn(
        "GEMINI_API_KEY is not set. AI cover-letter generation is disabled."
    );
}

let ai = null;

if (GEMINI_API_KEY && GEMINI_API_KEY.trim()) {
    ai = new GoogleGenAI({
        apiKey: GEMINI_API_KEY
    });
}

/**
 * Build a compact, structured summary of the user's
 * profile. Only fields present in the profile are
 * included — nothing is invented.
 */
const buildProfileSummary = (profile) => {

    const lines = [];

    if (profile.fullName) {
        lines.push(`Name: ${profile.fullName}`);
    }

    if (profile.headline) {
        lines.push(`Headline: ${profile.headline}`);
    }

    if (profile.summary) {
        lines.push(`Summary: ${profile.summary}`);
    }

    const skills = Array.isArray(profile.skills)
        ? profile.skills.filter(Boolean)
        : [];

    if (skills.length > 0) {
        lines.push(`Skills: ${skills.join(", ")}`);
    }

    const experience = Array.isArray(profile.experience)
        ? profile.experience.filter(
              (e) => e.company || e.role
          )
        : [];

    if (experience.length > 0) {
        lines.push("\nWork Experience:");
        experience.forEach((e) => {
            const period = [e.startDate, e.endDate]
                .filter(Boolean)
                .join(" – ");

            lines.push(
                `  • ${e.role || "Role"} at ${e.company || "Company"}${period ? ` (${period})` : ""}${e.description ? `: ${e.description}` : ""}`
            );
        });
    }

    const education = Array.isArray(profile.education)
        ? profile.education.filter(
              (e) => e.institution || e.degree
          )
        : [];

    if (education.length > 0) {
        lines.push("\nEducation:");
        education.forEach((e) => {
            const deg = [e.degree, e.field]
                .filter(Boolean)
                .join(" in ");

            const period = [e.startDate, e.endDate]
                .filter(Boolean)
                .join(" – ");

            lines.push(
                `  • ${deg || "Degree"}${e.institution ? ` — ${e.institution}` : ""}${period ? ` (${period})` : ""}${e.cgpa ? `, CGPA: ${e.cgpa}` : ""}`
            );
        });
    }

    const projects = Array.isArray(profile.projects)
        ? profile.projects.filter((p) => p.name)
        : [];

    if (projects.length > 0) {
        lines.push("\nProjects:");
        projects.forEach((p) => {
            const tech = Array.isArray(p.technologies)
                ? p.technologies.join(", ")
                : "";

            lines.push(
                `  • ${p.name}${tech ? ` (${tech})` : ""}${p.description ? `: ${p.description}` : ""}`
            );
        });
    }

    return lines.join("\n");
};


/**
 * Generate a personalised cover letter using the
 * user's saved profile and a specific job.
 *
 * @param {Object} profile  - Mongoose Profile document (lean)
 * @param {Object} job      - Mongoose Job document (lean or populated)
 * @returns {string}        - Generated cover letter text
 * @throws {Error}          - If profile/job info is insufficient or Gemini fails
 */
const generateCoverLetter = async (profile, job) => {

    // ── Guards ──────────────────────────────────────────

    if (!ai) {
        throw new Error(
            "Gemini AI key is not configured. Set GEMINI_API_KEY in server/.env."
        );
    }

    if (!profile) {
        throw new Error(
            "Profile not found. Please upload your resume first."
        );
    }

    if (!job) {
        throw new Error(
            "Job information is missing."
        );
    }

    const profileSummary = buildProfileSummary(profile);

    if (!profileSummary.trim()) {
        throw new Error(
            "Your profile does not contain enough information to generate a cover letter. Please upload your resume."
        );
    }

    const jobTitle   = job.title   || "this position";
    const jobCompany = job.company || "your company";

    // Trim description to keep prompt within token limits
    const jobDescription = (job.description || "")
        .slice(0, 1500);

    // ── Prompt ──────────────────────────────────────────

    const prompt = `
You are a professional career coach writing a cover letter.

IMPORTANT RULES:
- Use ONLY the information provided in the candidate's profile below.
- Do NOT invent work experience, qualifications, achievements, or personal details.
- Do NOT exaggerate or embellish any information.
- If the profile lacks specific experience for the role, write honestly about transferable skills and eagerness to learn.
- Keep the letter concise: 3–4 short paragraphs, professional tone.
- Use plain text only — no markdown formatting, no bullet points.
- Do not include a date. Do not include placeholder fields like [Your Name] or [Address].
- End with "Sincerely," followed by the candidate's name.

CANDIDATE PROFILE:
${profileSummary}

JOB:
Title: ${jobTitle}
Company: ${jobCompany}
${jobDescription ? `Description:\n${jobDescription}` : ""}

Write a professional cover letter for this candidate applying to this role.
`.trim();

        // ── Call Gemini: fail-fast on 404/401/403, retry transient 429/5xx ──

        const MODEL = GEMINI_MODEL;

    const MAX_RETRIES = 3;
    const RETRY_DELAY_MS = 2000;

    let text;
    let lastError;

    for (let attempt = 1; attempt <= MAX_RETRIES; attempt++) {

        try {
            const response =
                await ai.models.generateContent({
                    model: MODEL,
                    contents: prompt
                });

            text = response.text;
            break; // success — exit retry loop

        } catch (error) {

            lastError = error;

            const classified = describeGeminiError(
                error,
                MODEL,
                "cover letter generation"
            );

            // Model and auth errors are configuration problems that will
            // NOT be fixed by retrying — fail fast with a distinct message.
            if (
                classified.status === 404 ||
                classified.status === 401 ||
                classified.status === 403
            ) {
                console.error(
                    "Gemini cover letter error:",
                    error.message
                );
                throw new Error(classified.message);
            }

            // Transient errors (429 quota, 502/503/504) may succeed on retry.
            if (classified.retryable && attempt < MAX_RETRIES) {
                console.warn(
                    `Gemini ${classified.status} on attempt ${attempt}/${MAX_RETRIES}, retrying in ${RETRY_DELAY_MS}ms...`
                );

                await new Promise((resolve) =>
                    setTimeout(resolve, RETRY_DELAY_MS)
                );

                continue;
            }

            // Non-retriable error or last attempt: surface the distinct
            // classification message.
            console.error(
                "Gemini cover letter error:",
                error.message
            );

            throw new Error(classified.message);
        }
    }

    if (!text || !text.trim()) {
        throw new Error(
            "Gemini returned an empty response. Please try again."
        );
    }

    return text.trim();
};



module.exports = {
    generateCoverLetter
};
