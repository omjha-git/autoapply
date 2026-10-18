/**
 * Offline tests for server/services/skillsDb.js
 */
var { describe, it } = require("node:test");
var assert = require("node:assert/strict");

var sdb = require("../services/skillsDb");

describe("extractSkillsFromText", function () {
    it("extracts known skills case-insensitively", function () {
        var skills = sdb.extractSkillsFromText("I know REACT and python and Docker.");
        assert.ok(skills.includes("React"));
        assert.ok(skills.includes("Python"));
        assert.ok(skills.includes("Docker"));
    });

    it("maps react.js alias to React", function () {
        var skills = sdb.extractSkillsFromText("react.js");
        assert.ok(skills.includes("React"));
    });

    it("de-duplicates repeated keywords", function () {
        var skills = sdb.extractSkillsFromText("React React React Node.js");
        assert.strictEqual(skills.filter(function (s) { return s === "React"; }).length, 1);
        assert.ok(skills.includes("Node.js"));
    });

    it("does not match skills inside unrelated words (boundary aware)", function () {
        var skills = sdb.extractSkillsFromText("maintain main going");
        assert.ok(!skills.includes("Go"));
        assert.ok(!skills.includes("AWS"));
    });

    it("returns [] for empty / null input", function () {
        assert.deepStrictEqual(sdb.extractSkillsFromText(""), []);
        assert.deepStrictEqual(sdb.extractSkillsFromText(null), []);
    });

    it("matches longer/more-specific skills before shorter substrings", function () {
        var skills = sdb.extractSkillsFromText("React Native and React");
        assert.ok(skills.includes("React Native"));
        assert.ok(skills.includes("React"));
    });

    it("detects multi-word skills", function () {
        var skills = sdb.extractSkillsFromText("machine learning and react native");
        assert.ok(skills.includes("Machine Learning"));
        assert.ok(skills.includes("React Native"));
    });
});

describe("canonicalizeSkill", function () {
    it("maps known aliases to canonical labels", function () {
        assert.strictEqual(sdb.canonicalizeSkill("react.js"), "React");
        assert.strictEqual(sdb.canonicalizeSkill("AWS"), "AWS");
        assert.strictEqual(sdb.canonicalizeSkill("typescript"), "TypeScript");
    });
    it("maps nodejs alias to JavaScript (per dictionary)", function () {
        assert.strictEqual(sdb.canonicalizeSkill("nodejs"), "JavaScript");
    });
    it("returns lowercased token for unknown skills", function () {
        assert.strictEqual(sdb.canonicalizeSkill("Cobol"), "cobol");
    });
    it("returns empty for null/undefined", function () {
        assert.strictEqual(sdb.canonicalizeSkill(null), "");
        assert.strictEqual(sdb.canonicalizeSkill(undefined), "");
    });
});

describe("dedupeSkills", function () {
    it("canonicalizes and removes duplicates", function () {
        assert.deepStrictEqual(
            sdb.dedupeSkills(["React", "react.js", "AWS", "aws", "TypeScript"]),
            ["React", "AWS", "TypeScript"]
        );
    });
    it("handles empty/null input", function () {
        assert.deepStrictEqual(sdb.dedupeSkills([]), []);
        assert.deepStrictEqual(sdb.dedupeSkills(null), []);
    });
});
