/**
 * Offline tests for server/services/resumeInfoExtractor.js
 *
 * All extraction is local (regex + skillsDb) — no AI. These tests assert the
 * ACTUAL heuristic behavior of the extractor (which never invents data).
 */
var { describe, it } = require("node:test");
var assert = require("node:assert/strict");

var ext = require("../services/resumeInfoExtractor");

var BLOCK = [
    "Jane Doe",
    "Senior Frontend Developer",
    "Email: jane@example.com | Phone: +1 555-123-4567",
    "Skills: React, JavaScript, Node.js, MongoDB, Docker, AWS",
    "Summary: Building web applications."
].join("\n");

describe("extractResumeInfo", function () {
    it("extracts an email", function () {
        var info = ext.extractResumeInfo(BLOCK);
        assert.strictEqual(info.email, "jane@example.com");
    });

    it("extracts a phone number (includes the area code)", function () {
        var info = ext.extractResumeInfo(BLOCK);
        assert.ok(info.phone.includes("555"));
    });

    it("extracts skills from the known skill dictionary", function () {
        var info = ext.extractResumeInfo(BLOCK);
        assert.ok(info.skills.includes("React"));
        assert.ok(info.skills.includes("JavaScript"));
        assert.ok(info.skills.includes("MongoDB"));
        assert.ok(info.skills.includes("Docker"));
    });

    it("populates keywords equal to detected skills", function () {
        var info = ext.extractResumeInfo(BLOCK);
        assert.ok(info.keywords.length > 0);
        assert.deepStrictEqual(info.keywords, info.skills);
    });

    it("returns a non-empty headline (first capitalized line)", function () {
        var info = ext.extractResumeInfo(BLOCK);
        assert.ok(typeof info.headline === "string");
        assert.ok(info.headline.length > 0);
    });

    it("extracts the full name from the first capitalized 2-4 word line", function () {
        var info = ext.extractResumeInfo(BLOCK);
        assert.strictEqual(info.fullName, "Jane Doe");
    });

    it("returns empty fields (no inventions) for empty input", function () {
        var info = ext.extractResumeInfo("");
        assert.strictEqual(info.email, "");
        assert.strictEqual(info.phone, "");
        assert.deepStrictEqual(info.skills, []);
        assert.deepStrictEqual(info.keywords, []);
        assert.strictEqual(info.headline, "");
        assert.strictEqual(info.fullName, "");
    });

    it("never throws on null / undefined input", function () {
        assert.doesNotThrow(function () { ext.extractResumeInfo(null); });
        assert.doesNotThrow(function () { ext.extractResumeInfo(undefined); });
    });

    it("does not invent an email when none is present", function () {
        var info = ext.extractResumeInfo("John Smith\nBackend Engineer");
        assert.strictEqual(info.email, "");
    });
});

describe("extractors (targeted)", function () {
    it("extractEmail finds only a real email", function () {
        assert.strictEqual(ext.extractEmail("no email here"), "");
        assert.strictEqual(ext.extractEmail("a.b+c@d.io is valid"), "a.b+c@d.io");
    });

    it("extractPhone returns empty for non-phone digit runs", function () {
        assert.strictEqual(ext.extractPhone("zip 90210 only digits"), "");
        assert.ok(ext.extractPhone("Call 555-867-5309").includes("555"));
    });

    it("extractHeadline returns a role line", function () {
        assert.strictEqual(ext.extractHeadline("Senior Frontend Engineer\nJane Doe").toLowerCase().includes("frontend"), true);
    });

    it("extractFullName returns a two-capitalized-word name", function () {
        assert.strictEqual(ext.extractFullName("Jane Doe\nEngineer"), "Jane Doe");
    });
});
