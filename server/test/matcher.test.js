/**
 * Offline tests for server/services/ai/matcher.js
 *
 * Matching is fully local (no AI) — computed from the saved resume text and
 * the job's title/description/skills.
 */
var { describe, it } = require("node:test");
var assert = require("node:assert/strict");

var matcher = require("../services/ai/matcher");
var calculateMatch = matcher.calculateMatch;
var calculateMatchScore = matcher.calculateMatchScore;

// A profile with a realistic saved resume.
var PROFILE = {
    fullName: "Jane Doe",
    skills: ["React", "JavaScript"],
    keywords: ["react", "docker", "aws"],
    resumeText:
        "Jane Doe. Full-Stack Developer. Skills: React, JavaScript, " +
        "Node.js, MongoDB, Docker, AWS. Experience with REST API and Git.",
    preferences: { roles: ["Frontend Developer"] }
};

describe("calculateMatch", function () {
    it("returns a structured result with all required fields", function () {
        var r = calculateMatch(PROFILE, {
            title: "Frontend Engineer",
            description: "React and JavaScript required. REST API experience."
        });
        assert.strictEqual(typeof r.matchPercentage, "number");
        assert.ok(Array.isArray(r.matchedSkills));
        assert.ok(Array.isArray(r.missingSkills));
        assert.strictEqual(typeof r.explanation, "string");
        assert.ok(typeof r.components === "object");
    });

    it("matchPercentage is bounded 0-100", function () {
        var r = calculateMatch(PROFILE, {
            title: "Senior Frontend Engineer",
            description: "React, TypeScript, Node.js, AWS, MongoDB, Docker."
        });
        assert.ok(r.matchPercentage >= 0 && r.matchPercentage <= 100);
    });

    it("returns 0 with a clear message when there is no profile", function () {
        var r = calculateMatch(null, { title: "Dev", description: "React" });
        assert.strictEqual(r.matchPercentage, 0);
        assert.ok(/no resume/i.test(r.explanation));
    });

    it("returns 0 with a clear message when profile has no resumeText", function () {
        var r = calculateMatch({ clerkId: "u", skills: [] }, {
            title: "Dev",
            description: "React"
        });
        assert.strictEqual(r.matchPercentage, 0);
        assert.ok(/upload your resume/i.test(r.explanation));
    });

    it("handles a job with an empty description gracefully", function () {
        var r = calculateMatch(PROFILE, {
            title: "Frontend Engineer",
            description: ""
        });
        assert.ok(r.matchPercentage >= 0 && r.matchPercentage <= 100);
        assert.strictEqual(r.missingSkills.length >= 0, true);
        assert.ok(r.explanation.length > 0);
    });

    it("does not award points when the job has no title/description/skills", function () {
        var r = calculateMatch(PROFILE, { title: "", description: "" });
        assert.strictEqual(r.matchPercentage, 0);
    });

    it("detects matched and missing skills from the job description", function () {
        var r = calculateMatch(PROFILE, {
            title: "Backend Engineer",
            description: "Need MongoDB and GraphQL. Also Docker." // GraphQL NOT in resume
        });
        assert.ok(r.matchedSkills.includes("MongoDB"));
        assert.ok(r.matchedSkills.includes("Docker"));
        assert.ok(r.missingSkills.includes("GraphQL"));
    });

    it("de-duplicates repeated keywords (no over-rewarding)", function () {
        var r1 = calculateMatch(
            PROFILE,
            { title: "Dev", description: "React React React React" }
        );
        var r2 = calculateMatch(
            PROFILE,
            { title: "Dev", description: "React" }
        );
        // Same skill detection regardless of how many times "React" repeats.
        assert.strictEqual(r1.matchedSkills.length, r2.matchedSkills.length);
    });

    it("role match boosts the score when roles align with the title", function () {
        var aligned = calculateMatch(PROFILE, { title: "Frontend Developer", description: "" });
        var unaligned = calculateMatch(PROFILE, { title: "Data Scientist", description: "" });
        assert.ok(aligned.components.role > unaligned.components.role);
    });

    it("calculateMatchScore alias returns the numeric percentage", function () {
        var r = calculateMatch(PROFILE, { title: "Frontend Engineer", description: "React" });
        assert.strictEqual(
            calculateMatchScore(PROFILE, { title: "Frontend Engineer", description: "React" }),
            r.matchPercentage
        );
    });

    it("a perfect skill + role match scores high (>=90)", function () {
        var perfect = calculateMatch(
            {
                resumeText: "React, JavaScript, TypeScript, Node.js, AWS, MongoDB",
                preferences: { roles: ["Frontend Developer"] }
            },
            { title: "Frontend Developer", description: "React JavaScript TypeScript Node.js AWS MongoDB" }
        );
        assert.ok(perfect.matchPercentage >= 90, "expected >=90 got " + perfect.matchPercentage);
    });
});
