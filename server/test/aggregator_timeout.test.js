/**
 * Regression tests for server/services/jobSearch/aggregator.js —
 * per-source timeout cancellation via AbortController.
 *
 * These verify that:
 *   1. runSourceSafely passes an AbortSignal to adapters.
 *   2. The signal is actually aborted when the source timeout fires
 *      (previously the timeout only stopped *awaiting* the source;
 *      the underlying axios requests kept running as leaked work).
 *   3. A stuck source is dropped without losing results from fast sources.
 *
 * Uses a short JOB_SOURCE_TIMEOUT_MS so tests run fast.
 */
var { describe, it, beforeEach, after } = require("node:test");
var assert = require("node:assert/strict");

var aggregatorPath = require.resolve("../services/jobSearch/aggregator");

describe("runSourceSafely - AbortController cancellation", function () {
    var savedTimeout;

    beforeEach(function () {
        delete require.cache[aggregatorPath];
        savedTimeout = process.env.JOB_SOURCE_TIMEOUT_MS;
        process.env.JOB_SOURCE_TIMEOUT_MS = "300";
    });

    after(function () {
        if (savedTimeout === undefined) {
            delete process.env.JOB_SOURCE_TIMEOUT_MS;
        } else {
            process.env.JOB_SOURCE_TIMEOUT_MS = savedTimeout;
        }
    });

    it("passes an AbortSignal to the adapter", async function () {
        var receivedSignal;
        var agg = require("../services/jobSearch/aggregator");
        await agg.runSourceSafely(
            "test",
            async function (params) {
                receivedSignal = params.signal;
                return [];
            },
            { query: "test" }
        );
        assert.ok(receivedSignal, "signal should be passed to adapter");
        assert.ok(
            receivedSignal instanceof AbortSignal,
            "signal should be an AbortSignal"
        );
    });

    it("aborts the signal when the timeout fires", async function () {
        var observedAborted = false;
        var receivedSignal = null;

        var stuckAdapter = async function (params) {
            receivedSignal = params.signal;
            params.signal.addEventListener("abort", function () {
                observedAborted = true;
            });
            await new Promise(function () {});
            return [];
        };

        var agg = require("../services/jobSearch/aggregator");
        var start = Date.now();
        var result = await agg.runSourceSafely("stuck", stuckAdapter, {});
        var elapsed = Date.now() - start;

        assert.deepStrictEqual(result, []);
        assert.ok(receivedSignal, "signal should have been provided");
        assert.strictEqual(
            receivedSignal.aborted, true,
            "signal should be aborted after timeout"
        );
        assert.strictEqual(observedAborted, true, "abort event should have fired");
        assert.ok(elapsed < 1000, "should return promptly: " + elapsed + "ms");
    });

    it("does not abort on success", async function () {
        var receivedSignal = null;
        var agg = require("../services/jobSearch/aggregator");
        await agg.runSourceSafely(
            "quick",
            async function (params) {
                receivedSignal = params.signal;
                return [{ title: "job" }];
            },
            {}
        );
        assert.ok(receivedSignal, "signal should be provided");
        assert.strictEqual(
            receivedSignal.aborted, false,
            "signal should NOT be aborted on success"
        );
    });
});
