/**
 * Tests for server/services/jobSearch/normalizeJob.js
 *
 * The shared normalizeJob function is the single source of truth for the
 * canonical job shape. These tests verify default assignment, type coercion,
 * and that every field is always present (never undefined).
 */
var { describe, it } = require("node:test");
var assert = require("node:assert/strict");

var normalizeJob = require("../services/jobSearch/normalizeJob");

describe("normalizeJob", function () {
    it("produces a consistent shape with defaults", function () {
        var j = normalizeJob({
            title: "X",
            source: "greenhouse"
        });
        assert.strictEqual(j.title, "X");
        assert.strictEqual(j.company, "Unknown Company");
        assert.strictEqual(j.location, "Unknown");
        assert.strictEqual(j.workMode, "Unknown");
        assert.strictEqual(j.employmentType, "Unknown");
        assert.strictEqual(j.description, "");
        assert.deepEqual(j.skills, []);
        assert.strictEqual(j.salary, "");
        assert.strictEqual(j.source, "greenhouse");
        assert.strictEqual(j.sourceUrl, "");
        assert.strictEqual(j.applyUrl, "");
        assert.strictEqual(j.postedDate, null);
        assert.strictEqual(j.isSearchLink, false);
        assert.strictEqual(j.requiresAuth, false);
        assert.strictEqual(j.unavailableReason, "");
        assert.strictEqual(j.resultType, "job");
    });

    it("defaults resultType to 'search_link' for search-link cards", function () {
        var j = normalizeJob({ isSearchLink: true });
        assert.strictEqual(j.resultType, "search_link");
    });

    it("preserves provided resultType", function () {
        var j = normalizeJob({ resultType: "search_link", title: "X" });
        assert.strictEqual(j.resultType, "search_link");
    });

    it("preserves all provided fields", function () {
        var d = new Date("2024-06-01T12:00:00Z");
        var j = normalizeJob({
            externalId: "ext-1",
            title: "Sr Engineer",
            company: "Acme",
            location: "Remote",
            workMode: "Remote",
            employmentType: "Full-time",
            description: "Build things.",
            skills: ["Go", "Docker"],
            salary: "$150k",
            source: "ashby",
            sourceUrl: "https://acme.com/jobs/1",
            applyUrl: "https://apply.acme.com/1",
                        postedDate: d,
            isSearchLink: false,
            requiresAuth: true,
            unavailableReason: "none",
            resultType: "job"
        });
        assert.strictEqual(j.externalId, "ext-1");
        assert.strictEqual(j.title, "Sr Engineer");
        assert.strictEqual(j.company, "Acme");
        assert.strictEqual(j.location, "Remote");
        assert.strictEqual(j.workMode, "Remote");
        assert.strictEqual(j.employmentType, "Full-time");
        assert.strictEqual(j.description, "Build things.");
        assert.deepEqual(j.skills, ["Go", "Docker"]);
        assert.strictEqual(j.salary, "$150k");
        assert.strictEqual(j.source, "ashby");
        assert.strictEqual(j.sourceUrl, "https://acme.com/jobs/1");
        assert.strictEqual(j.applyUrl, "https://apply.acme.com/1");
        assert.strictEqual(j.postedDate, d);
        assert.strictEqual(j.isSearchLink, false);
        assert.strictEqual(j.requiresAuth, true);
        assert.strictEqual(j.unavailableReason, "none");
        assert.strictEqual(j.resultType, "job");
    });

    it("never emits undefined for any field", function () {
        var j = normalizeJob({});
        var keys = [
            "externalId", "title", "company", "location",
            "workMode", "employmentType", "description",
            "skills", "salary", "source", "sourceUrl",
                        "applyUrl", "postedDate", "isSearchLink",
            "requiresAuth", "unavailableReason", "resultType"
        ];
        for (var i = 0; i < keys.length; i++) {
            var k = keys[i];
            assert.ok(
                k in j,
                "missing key: " + k
            );
            assert.notStrictEqual(
                j[k], undefined,
                "undefined for key: " + k
            );
        }
    });

    it("coerces isSearchLink and requiresAuth to boolean", function () {
        var j1 = normalizeJob({ isSearchLink: "yes", requiresAuth: 1 });
        assert.strictEqual(j1.isSearchLink, true);
        assert.strictEqual(j1.requiresAuth, true);

        var j2 = normalizeJob({ isSearchLink: undefined, requiresAuth: undefined });
        assert.strictEqual(j2.isSearchLink, false);
        assert.strictEqual(j2.requiresAuth, false);

        var j3 = normalizeJob({ isSearchLink: 0, requiresAuth: "" });
        assert.strictEqual(j3.isSearchLink, false);
        assert.strictEqual(j3.requiresAuth, false);
    });

    it("normalizes postedDate to null when not a Date", function () {
        var j = normalizeJob({ postedDate: "not-a-date" });
        assert.strictEqual(j.postedDate, null);
    });

    it("keeps postedDate when it is a valid Date", function () {
        var d = new Date();
        var j = normalizeJob({ postedDate: d });
        assert.strictEqual(j.postedDate, d);
    });

    it("coerces non-array skills to empty array", function () {
        var j = normalizeJob({ skills: "React, Python" });
        assert.deepEqual(j.skills, []);
    });

    it("generates externalId from source+applyUrl when absent", function () {
        var j = normalizeJob({ source: "lever", applyUrl: "https://x.com" });
        assert.ok(j.externalId.includes("lever"));
    });
});
