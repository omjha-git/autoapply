/**
 * Offline tests for server/services/ai/geminiError.js
 *
 * These tests do NOT make any live Gemini API calls.
 * They construct mock error objects that mimic the @google/genai SDK's
 * ApiError and ConnectionError shapes.
 */
var { describe, it } = require("node:test");
var assert = require("node:assert/strict");

var geminiError = require("../services/ai/geminiError");

// ------------------------------------------------------------------
// Helpers — build mock error objects that match SDK shapes
// ------------------------------------------------------------------
function makeApiError(status, message) {
    var err = new Error(message);
    err.status = status;
    return err;
}

function makeConnectionError(message) {
    var err = new Error(message);
    err.name = "ConnectionError";
    Object.defineProperty(err, "status", { value: undefined });
    return err;
}

function makeGenericError(message) {
    return new Error(message);
}

// ------------------------------------------------------------------
// getGeminiStatus
// ------------------------------------------------------------------
describe("getGeminiStatus", function () {
    it("returns the HTTP status from ApiError.status", function () {
        assert.strictEqual(geminiError.getGeminiStatus(makeApiError(404, "404 NOT_FOUND")), 404);
        assert.strictEqual(geminiError.getGeminiStatus(makeApiError(429, "429")), 429);
        assert.strictEqual(geminiError.getGeminiStatus(makeApiError(503, "503")), 503);
    });

    it("returns undefined for ConnectionError (no HTTP status)", function () {
        assert.strictEqual(geminiError.getGeminiStatus(makeConnectionError("ECONNREFUSED")), undefined);
    });

    it("returns undefined for null / non-object", function () {
        assert.strictEqual(geminiError.getGeminiStatus(null), undefined);
        assert.strictEqual(geminiError.getGeminiStatus(undefined), undefined);
        assert.strictEqual(geminiError.getGeminiStatus("string"), undefined);
    });
});

// ------------------------------------------------------------------
// isRetryableStatus
// ------------------------------------------------------------------
describe("isRetryableStatus", function () {
    it("returns true for 429, 502, 503, 504", function () {
        assert.strictEqual(geminiError.isRetryableStatus(429), true);
        assert.strictEqual(geminiError.isRetryableStatus(502), true);
        assert.strictEqual(geminiError.isRetryableStatus(503), true);
        assert.strictEqual(geminiError.isRetryableStatus(504), true);
    });

    it("returns false for 200, 400, 401, 403, 404, 500, undefined", function () {
        assert.strictEqual(geminiError.isRetryableStatus(200), false);
        assert.strictEqual(geminiError.isRetryableStatus(400), false);
        assert.strictEqual(geminiError.isRetryableStatus(401), false);
        assert.strictEqual(geminiError.isRetryableStatus(403), false);
        assert.strictEqual(geminiError.isRetryableStatus(404), false);
        assert.strictEqual(geminiError.isRetryableStatus(500), false);
        assert.strictEqual(geminiError.isRetryableStatus(undefined), false);
    });
});

// ------------------------------------------------------------------
// isConnectionError
// ------------------------------------------------------------------
describe("isConnectionError", function () {
    it("returns true for errors with name === 'ConnectionError'", function () {
        assert.strictEqual(geminiError.isConnectionError(makeConnectionError("ECONNREFUSED")), true);
    });

        it("returns false for ApiError, generic Error, null", function () {
        assert.strictEqual(geminiError.isConnectionError(makeApiError(404, "not found")), false);
        assert.strictEqual(geminiError.isConnectionError(makeGenericError("oops")), false);
        assert.strictEqual(geminiError.isConnectionError(null), false);
    });
});

// ------------------------------------------------------------------
// describeGeminiError
// ------------------------------------------------------------------
var MODEL = "gemini-3.6-flash";
var FEATURE = "resume extraction";

describe("describeGeminiError", function () {
    it("404 -> model-not-available message, not retryable", function () {
        var result = geminiError.describeGeminiError(makeApiError(404, "404 NOT_FOUND: model not found"), MODEL, FEATURE);
        assert.strictEqual(result.status, 404);
        assert.strictEqual(result.retryable, false);
        assert.match(result.message, /Gemini model/);
        assert.match(result.message, /gemini-3.6-flash/);
    });

    it("401 -> auth-failed message, not retryable", function () {
        var result = geminiError.describeGeminiError(makeApiError(401, "401 UNAUTHENTICATED: bad key"), MODEL, FEATURE);
        assert.strictEqual(result.status, 401);
        assert.strictEqual(result.retryable, false);
        assert.match(result.message, /authentication failed/);
        assert.match(result.message, /GEMINI_API_KEY/);
    });

    it("403 -> auth-failed message, not retryable", function () {
        var result = geminiError.describeGeminiError(makeApiError(403, "403 PERMISSION_DENIED"), MODEL, FEATURE);
        assert.strictEqual(result.status, 403);
        assert.strictEqual(result.retryable, false);
        assert.match(result.message, /authentication failed/);
    });

    it("429 -> quota message, retryable", function () {
        var result = geminiError.describeGeminiError(makeApiError(429, "429 RESOURCE_EXHAUSTED: rate limit"), MODEL, FEATURE);
        assert.strictEqual(result.status, 429);
        assert.strictEqual(result.retryable, true);
        assert.match(result.message, /quota\/rate limit/);
    });

    it("503 -> unavailable message, retryable", function () {
        var result = geminiError.describeGeminiError(makeApiError(503, "503 UNAVAILABLE"), MODEL, FEATURE);
        assert.strictEqual(result.status, 503);
        assert.strictEqual(result.retryable, true);
        assert.match(result.message, /temporarily unavailable/);
    });

    it("502/504 -> unavailable message, retryable", function () {
        assert.strictEqual(geminiError.describeGeminiError(makeApiError(502, ""), MODEL, FEATURE).retryable, true);
        assert.strictEqual(geminiError.describeGeminiError(makeApiError(504, ""), MODEL, FEATURE).retryable, true);
    });

    it("ConnectionError -> network-error message, retryable", function () {
        var result = geminiError.describeGeminiError(makeConnectionError("connect ECONNREFUSED 127.0.0.1:443"), MODEL, FEATURE);
        assert.strictEqual(result.status, undefined);
        assert.strictEqual(result.retryable, true);
        assert.match(result.message, /Network error/);
        assert.match(result.message, /resume extraction/);
        assert.match(result.message, /ECONNREFUSED/);
    });

    it("generic error -> unexpected message, not retryable", function () {
        var result = geminiError.describeGeminiError(makeGenericError("something went wrong"), MODEL, FEATURE);
        assert.strictEqual(result.status, undefined);
        assert.strictEqual(result.retryable, false);
        assert.match(result.message, /Unexpected error during resume extraction/);
    });

    it("never includes the API key in messages", function () {
        var fakeKey = "SUPER_SECRET_KEY_VALUE_12345";
        var err = new Error(fakeKey);
        err.status = 403;
        var result = geminiError.describeGeminiError(err, MODEL, FEATURE);
        assert.ok(!result.message.includes(fakeKey));
    });
});
