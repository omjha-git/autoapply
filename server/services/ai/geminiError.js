/**
 * Gemini error classification helpers.
 *
 * The `@google/genai` SDK (v2.21.0) throws:
 *   - `ApiError`            — HTTP API errors; has `status: number` (HTTP code)
 *   - `ConnectionError`     — network-level errors (DNS, refused, timeout);
 *                             has `name = "ConnectionError"`, NO `status`
 *   - `InvalidRequestError` — malformed request; also no `status`
 *
 * This module classifies those errors so that model, authentication, and
 * quota problems are reported with DISTINCT messages instead of a generic
 * "AI generation failed".
 *
 * No API key or secret material is ever logged here — only the (public) model
 * name and the HTTP status code shown by the API.
 */

/**
 * Resolve an HTTP-style status code from a Gemini error.
 *
 * Prefers the structured `error.status` exposed by `@google/genai`'s
 * `ApiError`. Falls back to parsing a leading status code from
 * `error.message`, which the SDK formats as e.g. "404 NOT_FOUND: ...".
 *
 * @param {unknown} error
 * @returns {number | undefined}
 */
function getGeminiStatus(error) {
    if (!error || typeof error !== "object") {
        return undefined;
    }

    // @google/genai ApiError exposes `status` as the HTTP status code.
    const raw = error.status;
    if (typeof raw === "number" && raw > 0) {
        return raw;
    }
    if (typeof raw === "string") {
        const parsed = Number(raw);
        if (!Number.isNaN(parsed) && parsed > 0) {
            return parsed;
        }
    }

    // Fallback: parse a leading HTTP status code from the message.
    if (typeof error.message === "string") {
        const match = error.message.match(/^\s*(\d{3})\b/);
        if (match) {
            const code = Number(match[1]);
            if (code > 0) {
                return code;
            }
        }
    }

    return undefined;
}

/**
 * Detect whether an error is a network-level `ConnectionError`
 * thrown by `@google/genai` (DNS failure, connection refused,
 * timeout, etc.).  These errors have *no* HTTP status code but are
 * typically transient and worth retrying.
 *
 * @param {unknown} error
 * @returns {boolean}
 */
function isConnectionError(error) {
    return Boolean(
        error &&
            typeof error === "object" &&
            error.name === "ConnectionError"
    );
}

/**
 * Whether a status code represents a transient error that may succeed on
 * retry: rate limiting (429) and temporary unavailability (502/503/504).
 *
 * @param {number | undefined} status
 * @returns {boolean}
 */
function isRetryableStatus(status) {
    return status === 429 || status === 502 || status === 503 || status === 504;
}

/**
 * Build a distinct, user-facing error message for a Gemini API error.
 *
 * 404              -> the configured model is not available / not supported
 * 401 / 403        -> authentication / permission problem with the API key
 * 429              -> quota / rate limit exceeded (transient)
 * 502 / 503 / 504  -> temporary unavailability (transient)
 * ConnectionError  -> network-level failure (DNS, refused, timeout) (transient)
 * other            -> a generic, still distinct, message with the raw status
 *
 * @param {unknown} error   - The original error thrown by the SDK.
 * @param {string} model    - The model name that was in use.
 * @param {string} feature  - Human label, e.g. "resume extraction".
 * @returns {{status: number | undefined, message: string, retryable: boolean}}
 */
function describeGeminiError(error, model, feature) {
    const status = getGeminiStatus(error);

    // Network-level errors (ConnectionError) have no HTTP status but
    // are transient — retry them just like 429/5xx.
    if (isConnectionError(error)) {
        const base =
            error && error.message
                ? error.message
                : "connection failed";
        return {
            status,
            message: `Network error during ${feature}: ${base}`,
            retryable: true,
        };
    }

    // Build a short `(HTTP <code>[: <REASON>)` suffix for diagnostics.
    let suffix = "";
    if (status) {
        suffix = ` (HTTP ${status})`;
        const reasonMatch =
            error && typeof error.message === "string"
                ? error.message.match(/^\s*\d{3}\s+([A-Z_]+)/)
                : null;
        if (reasonMatch) {
            suffix += `: ${reasonMatch[1]}`;
        }
    }

    let message;

    switch (status) {
        case 404:
            message =
                `Gemini model "${model}" is not available${suffix}. ` +
                `Update the GEMINI_MODEL environment variable to a supported ` +
                `model such as "gemini-3.6-flash" and try again.`;
            break;
        case 401:
        case 403:
            message =
                `Gemini authentication failed${suffix}. Verify the ` +
                `GEMINI_API_KEY is set correctly in server/.env.`;
            break;
        case 429:
            message =
                `Gemini quota/rate limit exceeded${suffix}. ` +
                `Please wait a moment and try again.`;
            break;
        case 502:
        case 503:
        case 504:
            message =
                `Gemini service is temporarily unavailable${suffix}. ` +
                `Please try again.`;
            break;
        default: {
            const base = error && error.message ? error.message : "unknown error";
            message = `Unexpected error during ${feature}${suffix}: ${base}`;
            break;
        }
    }

    return {
        status,
        message,
        retryable: isRetryableStatus(status),
    };
}

module.exports = {
    getGeminiStatus,
    isRetryableStatus,
    isConnectionError,
    describeGeminiError,
};
