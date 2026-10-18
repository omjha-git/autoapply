const { GoogleGenAI } = require("@google/genai");
const { describeGeminiError } = require("./geminiError");

// Guard: if no API key is configured, fail fast with a clear
// error so callers can surface a graceful message instead of
// an opaque SDK error. Never expose the key value itself.
const GEMINI_API_KEY = process.env.GEMINI_API_KEY;
const GEMINI_MODEL =
    process.env.GEMINI_MODEL || "gemini-3.6-flash";

// Retry configuration — overridable via environment for ops tuning.
// These control retries for the Gemini *network* request only.
// Database writes (Profile.findOneAndUpdate) are never retried.
const MAX_RETRIES =
    parseInt(process.env.GEMINI_MAX_RETRIES, 10) || 3;
const RETRY_DELAY_MS =
    parseInt(process.env.GEMINI_RETRY_DELAY_MS, 10) || 2000;

if (!GEMINI_API_KEY || !GEMINI_API_KEY.trim()) {
    console.warn(
        "GEMINI_API_KEY is not set. Resume AI extraction is disabled."
    );
}

let ai = null;

if (GEMINI_API_KEY && GEMINI_API_KEY.trim()) {
    ai = new GoogleGenAI({
        apiKey: GEMINI_API_KEY
    });
}

/**
 * Build the prompt that is sent to Gemini for resume extraction.
 * Extracted into a pure function so it can be unit-tested.
 *
 * @param {string} resumeText - raw resume text extracted from the file.
 * @returns {string} the full prompt string.
 */
const buildResumePrompt = (resumeText) => `
You are an expert resume parser.

Analyze the following resume and extract structured information.

Return ONLY valid JSON.

Resume:
----------------
${resumeText}
----------------

Use exactly this JSON structure:

{
    "fullName": "",
    "email": "",
    "phone": "",
    "location": "",
    "headline": "",
    "summary": "",
    "skills": [],
    "education": [
        {
            "institution": "",
            "degree": "",
            "field": "",
            "startDate": "",
            "endDate": "",
            "cgpa": ""
        }
    ],
    "experience": [
        {
            "company": "",
            "role": "",
            "startDate": "",
            "endDate": "",
            "description": ""
        }
    ],
    "projects": [
        {
            "name": "",
            "description": "",
            "technologies": [],
            "url": ""
        }
    ],
    "recommendedRoles": [],
    "keywords": []
}

Rules:
- Extract only information supported by the resume.
- Do not invent missing information.
- skills should contain technical and relevant professional skills.
- recommendedRoles should contain suitable job roles based on the resume.
- keywords should contain important technologies, tools, domains and role-related terms.
- Keep arrays as arrays.
- If information is unavailable, use an empty string or empty array.
`;

/**
 * Default sleep implementation — returns a Promise that resolves after \`ms\`.
 * Provided as a named function so it can be replaced in tests.
 *
 * @param {number} ms
 * @returns {Promise<void>}
 */
const defaultSleep = (ms) =>
    new Promise((resolve) => setTimeout(resolve, ms));

/**
 * Default random implementation — returns Math.random().
 * Provided as a named function so it can be replaced in tests.
 *
 * @returns {number}
 */
const defaultRandom = () => Math.random();


/**
 * Call the Gemini \`generateContent\` endpoint with retry support.
 *
 * Retries are applied **only** to the Gemini network request.
 * JSON parsing happens outside this function and is never retried.
 *
 * Retry policy (mirrors coverLetterGenerator.js):
 *   - 404 / 401 / 403           → config error, fail immediately
 *   - 429 / 502 / 503 / 504     → transient, retry with jittered backoff
 *   - ConnectionError (network) → transient, retry
 *   - other errors              → non-retryable, surface distinct message
 *   - last attempt              → surface distinct message, no more retries
 *
 * @param {object} aiClient            - GoogleGenAI client (or a mock for tests).
 * @param {string} prompt              - The prompt string to send.
 * @param {object} [options]
 * @param {Function} [options.sleep]   - Injectable sleep(ms) -> Promise<void>.
 * @param {Function} [options.random]  - Injectable random() -> number in [0,1).
 * @param {number}   [options.maxRetries]   - Max retry attempts (default 3).
 * @param {number}   [options.retryDelayMs] - Base delay between retries (ms).
 * @returns {Promise<string>} The response text from Gemini.
 */
const callGeminiWithRetry = async (
    aiClient,
    prompt,
    options = {}
) => {
    const {
        sleep = defaultSleep,
        random = defaultRandom,
        maxRetries = MAX_RETRIES,
        retryDelayMs = RETRY_DELAY_MS,
    } = options;

    let lastError;

    for (let attempt = 1; attempt <= maxRetries; attempt++) {
        try {
            const response =
                await aiClient.models.generateContent({
                    model: GEMINI_MODEL,
                    contents: prompt,
                    config: {
                        responseMimeType: "application/json"
                    }
                });

            const text = response.text;

            if (!text || !text.trim()) {
                throw new Error(
                    "Gemini returned an empty response."
                );
            }

            return text;

        } catch (error) {
            lastError = error;

            const classified = describeGeminiError(
                error,
                GEMINI_MODEL,
                "resume extraction"
            );

                        // --- Retry transient errors (429, 502/503/504, ConnectionError) ---
            if (classified.retryable && attempt < maxRetries) {
                // Respect the Retry-After header from 429/503 responses
                // when the SDK exposes it (value in seconds).
                var delay;
                var retryAfter =
                    error && error.retryAfter
                        ? Number(error.retryAfter)
                        : undefined;
                if (
                    typeof retryAfter === "number" &&
                    !Number.isNaN(retryAfter) &&
                    retryAfter > 0
                ) {
                    delay = retryAfter * 1000;
                } else {
                    var jitter = random() * retryDelayMs;
                    delay = retryDelayMs + jitter;
                }

                if (attempt > 1) {
                    console.warn(
                        "Gemini " + (classified.status || "network") +
                        " on attempt " + attempt + "/" + maxRetries +
                        ", retrying in " + Math.round(delay) + "ms..."
                    );
                }
                await sleep(delay);
                continue;
            }

            // --- Fail-fast on configuration / auth errors ---
            // 404 = model not found, 401/403 = auth — retrying won't help.
            if (
                classified.status === 404 ||
                classified.status === 401 ||
                classified.status === 403
            ) {
                console.error("Gemini extraction error:", error.message);
                var thrown = new Error(classified.message);
                thrown.retryable = false;
                thrown.httpStatus = classified.status;
                throw thrown;
            }

            // Non-retryable error or last retry attempt exhausted.
            // Attach retryable/httpStatus so the controller can choose
            // between a transient 503 response and a permanent 206.
            console.error("Gemini extraction error:", error.message);
            thrown = new Error(classified.message);
            thrown.retryable = classified.retryable;
            thrown.httpStatus = classified.status;
            throw thrown;
        }
    }

    // Defensive: unreachable because the loop always returns or
    // throws, but satisfies exhaustiveness.
    var fallback = new Error("Gemini extraction failed.");
    fallback.retryable = true;
    fallback.httpStatus = 503;
    throw fallback;
};

/**
 * Extract structured profile data from resume text using Gemini.
 *
 * The retry loop wraps **only** the Gemini API call. JSON parsing
 * happens after the loop so that malformed JSON is not retried.
 *
 * @param {string} resumeText - The parsed resume text.
 * @param {object} [options]   - Optional injectable dependencies (see
 *                                \`callGeminiWithRetry\` for details).
 * @returns {Promise<object>} Parsed profile JSON.
 */
const extractProfileFromResume = async (
    resumeText,
    options = {}
) => {
    if (!ai) {
        throw new Error(
            "Gemini AI key is not configured. " +
            "Set GEMINI_API_KEY in server/.env."
        );
    }

    // Retry only the network request; parse JSON once and separately.
    const text = await callGeminiWithRetry(
        ai,
        buildResumePrompt(resumeText),
        options
    );

    let parsed;
    try {
        parsed = JSON.parse(text);
    } catch (parseError) {
        throw new Error(
            "Gemini returned invalid JSON. " +
            "Please try uploading a different resume."
        );
    }

    return parsed;
};

module.exports = {
    extractProfileFromResume,
    callGeminiWithRetry,
    buildResumePrompt,
    MAX_RETRIES,
    RETRY_DELAY_MS,
    defaultSleep,
    defaultRandom,
};