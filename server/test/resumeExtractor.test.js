/**
 * Offline tests for server/services/ai/resumeExtractor.js
 *
 * All tests use dependency injection -- no live Gemini API calls.
 * The sleep and random functions are injected so every test
 * is fully deterministic (no real timers, no Math.random).
 */
var { describe, it, mock } = require("node:test");
var assert = require("node:assert/strict");

var extractor = require("../services/ai/resumeExtractor");

var callGeminiWithRetry = extractor.callGeminiWithRetry;
var buildResumePrompt = extractor.buildResumePrompt;
var MAX_RETRIES = extractor.MAX_RETRIES;
var RETRY_DELAY_MS = extractor.RETRY_DELAY_MS;

// ------------------------------------------------------------------
// Mock factories
// ------------------------------------------------------------------

/** Create a mock ApiError with a numeric HTTP status. */
function makeApiError(status, message) {
    var err = new Error(message);
    err.status = status;
    return err;
}

/** Create a mock ConnectionError (network, name = "ConnectionError"). */
function makeConnectionError(message) {
    var err = new Error(message);
    err.name = "ConnectionError";
    Object.defineProperty(err, "status", { value: undefined });
    return err;
}

/**
 * Build a mock aiClient with a mockable generateContent.
 * @param {Function} impl - async implementation for generateContent.
 */
function makeMockAiClient(impl) {
    var mockFn = mock.fn(impl);
    return {
        aiClient: { models: { generateContent: mockFn } },
        mockFn: mockFn
    };
}

/**
 * Deterministic sleep + random factory.
 * sleep collects delays; random always returns 0.5.
 */
function makeDeterministicDelay() {
    var delays = [];
    var sleep = function (ms) { delays.push(ms); return Promise.resolve(); };
    var random = function () { return 0.5; };
    return { sleep: sleep, random: random, delays: delays };
}

var PROMPT = "test prompt";
var VALID_JSON = JSON.stringify({ fullName: "John Doe", email: "john@test.com" });
var VALID_RESPONSE = { text: VALID_JSON };

// ------------------------------------------------------------------
// success
// ------------------------------------------------------------------
describe("callGeminiWithRetry -- success", function () {
    it("returns text on first attempt, no sleep, no retries", async function () {
        var mc = makeMockAiClient(async () => VALID_RESPONSE);
        var dd = makeDeterministicDelay();

        var result = await callGeminiWithRetry(mc.aiClient, PROMPT,
            { sleep: dd.sleep, random: dd.random, maxRetries: 3, retryDelayMs: 1000 });

        assert.strictEqual(result, VALID_JSON);
        assert.strictEqual(mc.mockFn.mock.callCount(), 1);
        assert.strictEqual(dd.delays.length, 0);
    });
});

// ------------------------------------------------------------------
// transient retry
// ------------------------------------------------------------------
describe("callGeminiWithRetry -- transient retry", function () {
    it("retries on 503 and succeeds on second attempt", async function () {
        var callNum = 0;
        var mc = makeMockAiClient(async function () {
            callNum++;
            if (callNum === 1) throw makeApiError(503, "503 UNAVAILABLE");
            return VALID_RESPONSE;
        });
        var dd = makeDeterministicDelay();

        var result = await callGeminiWithRetry(mc.aiClient, PROMPT,
            { sleep: dd.sleep, random: dd.random, maxRetries: 3, retryDelayMs: 1000 });

        assert.strictEqual(result, VALID_JSON);
        assert.strictEqual(mc.mockFn.mock.callCount(), 2);
        assert.strictEqual(dd.delays.length, 1);
        assert.strictEqual(dd.delays[0], 1500);
    });

    it("retries on 429 and succeeds on third attempt", async function () {
        var callNum = 0;
        var mc = makeMockAiClient(async function () {
            callNum++;
            if (callNum < 3) throw makeApiError(429, "429 RATE_LIMITED");
            return VALID_RESPONSE;
        });
        var dd = makeDeterministicDelay();

        var result = await callGeminiWithRetry(mc.aiClient, PROMPT,
            { sleep: dd.sleep, random: dd.random, maxRetries: 5, retryDelayMs: 500 });

        assert.strictEqual(result, VALID_JSON);
        assert.strictEqual(mc.mockFn.mock.callCount(), 3);
        assert.strictEqual(dd.delays.length, 2);
        assert.strictEqual(dd.delays[0], 750);
        assert.strictEqual(dd.delays[1], 750);
    });

    it("retries on ConnectionError and succeeds on retry", async function () {
        var callNum = 0;
        var mc = makeMockAiClient(async function () {
            callNum++;
            if (callNum === 1) throw makeConnectionError("ECONNREFUSED");
            return VALID_RESPONSE;
        });
        var dd = makeDeterministicDelay();

        var result = await callGeminiWithRetry(mc.aiClient, PROMPT,
            { sleep: dd.sleep, random: dd.random, maxRetries: 3, retryDelayMs: 1000 });

        assert.strictEqual(result, VALID_JSON);
        assert.strictEqual(mc.mockFn.mock.callCount(), 2);
                assert.strictEqual(dd.delays.length, 1);
    });
});

// ------------------------------------------------------------------
// fail-fast on non-retryable
// ------------------------------------------------------------------
describe("callGeminiWithRetry -- fail-fast", function () {
    it("404 model-not-found fails immediately (no retry)", async function () {
        var mc = makeMockAiClient(async () => {
            throw makeApiError(404, "404 NOT_FOUND: model not found");
        });
        var dd = makeDeterministicDelay();

        await assert.rejects(
            function () {
                return callGeminiWithRetry(mc.aiClient, PROMPT,
                    { sleep: dd.sleep, random: dd.random, maxRetries: 3, retryDelayMs: 1000 });
            },
            /Gemini model/
        );
        assert.strictEqual(mc.mockFn.mock.callCount(), 1);
        assert.strictEqual(dd.delays.length, 0);
    });

    it("401 auth-failed fails immediately (no retry)", async function () {
        var mc = makeMockAiClient(async () => {
            throw makeApiError(401, "401 UNAUTHENTICATED");
        });
        var dd = makeDeterministicDelay();

        await assert.rejects(
            function () {
                return callGeminiWithRetry(mc.aiClient, PROMPT,
                    { sleep: dd.sleep, random: dd.random, maxRetries: 3, retryDelayMs: 1000 });
            },
            /authentication failed/
        );
        assert.strictEqual(mc.mockFn.mock.callCount(), 1);
        assert.strictEqual(dd.delays.length, 0);
    });

    it("403 permission-denied fails immediately (no retry)", async function () {
        var mc = makeMockAiClient(async () => {
            throw makeApiError(403, "403 PERMISSION_DENIED");
        });
        var dd = makeDeterministicDelay();

        await assert.rejects(
            function () {
                return callGeminiWithRetry(mc.aiClient, PROMPT,
                    { sleep: dd.sleep, random: dd.random, maxRetries: 3, retryDelayMs: 1000 });
            },
            /authentication failed/
        );
        assert.strictEqual(mc.mockFn.mock.callCount(), 1);
        assert.strictEqual(dd.delays.length, 0);
    });
});


// ------------------------------------------------------------------
// retry exhaustion
// ------------------------------------------------------------------
describe("callGeminiWithRetry -- retry exhaustion", function () {
    it("exhausts retries on persistent 503", async function () {
        var mc = makeMockAiClient(async () => {
            throw makeApiError(503, "503 UNAVAILABLE");
        });
        var dd = makeDeterministicDelay();

        await assert.rejects(
            function () {
                return callGeminiWithRetry(mc.aiClient, PROMPT,
                    { sleep: dd.sleep, random: dd.random, maxRetries: 3, retryDelayMs: 1000 });
            },
            /temporarily unavailable/
        );
        assert.strictEqual(mc.mockFn.mock.callCount(), 3);
        assert.strictEqual(dd.delays.length, 2);
        assert.strictEqual(dd.delays[0], 1500);
        assert.strictEqual(dd.delays[1], 1500);
    });

    it("exhausts retries on persistent ConnectionError", async function () {
        var mc = makeMockAiClient(async () => {
            throw makeConnectionError("timeout");
        });
        var dd = makeDeterministicDelay();

        await assert.rejects(
            function () {
                return callGeminiWithRetry(mc.aiClient, PROMPT,
                    { sleep: dd.sleep, random: dd.random, maxRetries: 3, retryDelayMs: 1000 });
            },
            /Network error/
        );
        assert.strictEqual(mc.mockFn.mock.callCount(), 3);
        assert.strictEqual(dd.delays.length, 2);
    });
});



// ------------------------------------------------------------------
// empty response
// ------------------------------------------------------------------
describe("callGeminiWithRetry -- empty response", function () {
    it("throws on empty text without retrying", async function () {
        var mc = makeMockAiClient(async () => { return { text: "" }; });
        var dd = makeDeterministicDelay();

        await assert.rejects(
            function () {
                return callGeminiWithRetry(mc.aiClient, PROMPT,
                    { sleep: dd.sleep, random: dd.random, maxRetries: 3, retryDelayMs: 1000 });
            },
            /empty response/
        );
        assert.strictEqual(mc.mockFn.mock.callCount(), 1);
        assert.strictEqual(dd.delays.length, 0);
    });

    it("throws on undefined text without retrying", async function () {
        var mc = makeMockAiClient(async () => { return { text: undefined }; });
        var dd = makeDeterministicDelay();

        await assert.rejects(
            function () {
                return callGeminiWithRetry(mc.aiClient, PROMPT,
                    { sleep: dd.sleep, random: dd.random, maxRetries: 3, retryDelayMs: 1000 });
            },
            /empty response/
        );
        assert.strictEqual(mc.mockFn.mock.callCount(), 1);
        assert.strictEqual(dd.delays.length, 0);
    });
});

// ------------------------------------------------------------------
// invalid JSON (valid API call, non-JSON body)
// ------------------------------------------------------------------
describe("callGeminiWithRetry -- invalid JSON", function () {
    it("returns raw text even if it is not valid JSON", async function () {
        var mc = makeMockAiClient(async () => { return { text: "not json" }; });
        var dd = makeDeterministicDelay();

        var result = await callGeminiWithRetry(mc.aiClient, PROMPT,
            { sleep: dd.sleep, random: dd.random, maxRetries: 3, retryDelayMs: 1000 });

        assert.strictEqual(result, "not json");
        assert.strictEqual(mc.mockFn.mock.callCount(), 1);
        assert.strictEqual(dd.delays.length, 0);
    });
});

// ------------------------------------------------------------------
// maxRetries enforcement
// ------------------------------------------------------------------
describe("callGeminiWithRetry -- maxRetries", function () {
    it("with maxRetries=1 makes exactly 1 call on failure", async function () {
        var mc = makeMockAiClient(async () => {
            throw makeApiError(503, "503");
        });
        var dd = makeDeterministicDelay();

        await assert.rejects(
            function () {
                return callGeminiWithRetry(mc.aiClient, PROMPT,
                    { sleep: dd.sleep, random: dd.random, maxRetries: 1, retryDelayMs: 1000 });
            }
        );

        assert.strictEqual(mc.mockFn.mock.callCount(), 1);
        assert.strictEqual(dd.delays.length, 0);
    });

    it("defaults to MAX_RETRIES constant", async function () {
        var mc = makeMockAiClient(async () => {
            throw makeApiError(503, "503");
        });
        var dd = makeDeterministicDelay();

        await assert.rejects(
            function () {
                return callGeminiWithRetry(mc.aiClient, PROMPT,
                    { sleep: dd.sleep, random: dd.random, retryDelayMs: 0 });
            }
        );

                assert.strictEqual(mc.mockFn.mock.callCount(), MAX_RETRIES);
        assert.strictEqual(dd.delays.length, MAX_RETRIES - 1);
    });
});

// ------------------------------------------------------------------
// error properties on thrown error
// ------------------------------------------------------------------
describe("callGeminiWithRetry -- error properties", function () {
    it("thrown error has retryable=true and httpStatus=503 on exhaustion", async function () {
        var mc = makeMockAiClient(async () => {
            throw makeApiError(503, "503 UNAVAILABLE");
        });
        var dd = makeDeterministicDelay();

        try {
            await callGeminiWithRetry(mc.aiClient, PROMPT,
                { sleep: dd.sleep, random: dd.random, retryDelayMs: 0 });
            assert.fail("should have thrown");
        } catch (err) {
            assert.strictEqual(err.retryable, true);
            assert.strictEqual(err.httpStatus, 503);
        }
    });

    it("thrown error has retryable=false and httpStatus=404 on fail-fast", async function () {
        var mc = makeMockAiClient(async () => {
            throw makeApiError(404, "404 NOT_FOUND: model not found");
        });
        var dd = makeDeterministicDelay();

        try {
            await callGeminiWithRetry(mc.aiClient, PROMPT,
                { sleep: dd.sleep, random: dd.random, retryDelayMs: 0 });
            assert.fail("should have thrown");
        } catch (err) {
            assert.strictEqual(err.retryable, false);
            assert.strictEqual(err.httpStatus, 404);
            // Should not have retried
            assert.strictEqual(mc.mockFn.mock.callCount(), 1);
            assert.strictEqual(dd.delays.length, 0);
        }
    });

    it("thrown error has retryable=true for ConnectionError", async function () {
        var mc = makeMockAiClient(async () => {
            throw makeConnectionError("timeout");
        });
        var dd = makeDeterministicDelay();

        try {
            await callGeminiWithRetry(mc.aiClient, PROMPT,
                { sleep: dd.sleep, random: dd.random, maxRetries: 1, retryDelayMs: 0 });
            assert.fail("should have thrown");
        } catch (err) {
            assert.strictEqual(err.retryable, true);
            assert.strictEqual(err.httpStatus, undefined);
        }
    });
});

// ------------------------------------------------------------------
// Retry-After header
// ------------------------------------------------------------------
describe("callGeminiWithRetry -- Retry-After", function () {
    it("respects Retry-After header when present on 503", async function () {
        var callNum = 0;
        var mc = makeMockAiClient(async function () {
            callNum++;
            if (callNum === 1) {
                var err = makeApiError(503, "503 UNAVAILABLE");
                err.retryAfter = 5; // SDK would expose this from the header
                throw err;
            }
            return VALID_RESPONSE;
        });
        var dd = makeDeterministicDelay();

        var result = await callGeminiWithRetry(mc.aiClient, PROMPT,
            { sleep: dd.sleep, random: dd.random, maxRetries: 3, retryDelayMs: 1000 });

        assert.strictEqual(result, VALID_JSON);
        // First delay should be Retry-After * 1000 = 5000ms,
        // NOT the exponential backoff (retryDelayMs + jitter).
        assert.strictEqual(dd.delays[0], 5000);
    });

    it("falls back to exponential backoff when Retry-After absent", async function () {
        var callNum = 0;
        var mc = makeMockAiClient(async function () {
            callNum++;
            if (callNum === 1) throw makeApiError(503, "503 UNAVAILABLE");
            return VALID_RESPONSE;
        });
        var dd = makeDeterministicDelay(); // random() = 0.5

        await callGeminiWithRetry(mc.aiClient, PROMPT,
            { sleep: dd.sleep, random: dd.random, maxRetries: 3, retryDelayMs: 1000 });

        // retryDelayMs (1000) + jitter (0.5 * 1000) = 1500
        assert.strictEqual(dd.delays[0], 1500);
    });

    it("uses Retry-After for ConnectionError too", async function () {
        var callNum = 0;
        var mc = makeMockAiClient(async function () {
            callNum++;
            if (callNum === 1) {
                var err = makeConnectionError("timeout");
                err.retryAfter = 2;
                throw err;
            }
            return VALID_RESPONSE;
        });
        var dd = makeDeterministicDelay();

        await callGeminiWithRetry(mc.aiClient, PROMPT,
            { sleep: dd.sleep, random: dd.random, maxRetries: 3, retryDelayMs: 1000 });

        assert.strictEqual(dd.delays[0], 2000); // 2 * 1000
    });
});
// ------------------------------------------------------------------
describe("buildResumePrompt", function () {
    it("includes resume text and required JSON fields", function () {
        var prompt = buildResumePrompt("John Doe, Engineer");
        assert.match(prompt, /John Doe, Engineer/);
        assert.match(prompt, /fullName/);
        assert.match(prompt, /email/);
        assert.match(prompt, /skills/);
        assert.match(prompt, /education/);
        assert.match(prompt, /experience/);
        assert.match(prompt, /projects/);
        assert.match(prompt, /recommendedRoles/);
        assert.match(prompt, /keywords/);
    });
});
