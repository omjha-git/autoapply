/**
 * Offline tests for server/controllers/resumeController.js
 *
 * Strategy: inject mock modules into require.cache BEFORE requiring the
 * controller, so it uses mocks instead of the real Profile model,
 * resumeParser, or resumeInfoExtractor. No live DB / API / file IO.
 *
 * These tests verify the Gemini-free resume workflow: local parse + local
 * info extraction -> profile persisted with resumeText + filename.
 */

var path = require("path");
var fs = require("fs");
var os = require("os");

var { describe, it, before, after, beforeEach } = require("node:test");
var assert = require("node:assert/strict");

var ctrlPath   = require.resolve("../controllers/resumeController");
var modelPath  = require.resolve("../models/Profile");
var parserPath = require.resolve("../services/resumeParser");
var infoPath   = require.resolve("../services/resumeInfoExtractor");

var mockFindOneAndUpdate = null;
var mockParseResume = null;
var mockExtractResumeInfo = null;

function installMock(fp, exports) {
    require.cache[fp] = {
        id: fp, filename: fp, loaded: true,
        exports: exports, children: [], paths: []
    };
}

function makeMockRes() {
    var res = {};
    res.statusCode = null;
    res.jsonData = null;
    res.status = function (code) { res.statusCode = code; return res; };
    res.json  = function (data) { res.jsonData = data; return res; };
    return res;
}

function makeFile(name) {
    return { path: tempFilePath, originalname: name || "resume.pdf" };
}

var tempFilePath;

before(function () {
    tempFilePath = path.join(os.tmpdir(), "aa-test-resume-" + process.pid + ".txt");
    fs.writeFileSync(tempFilePath, "Test resume content.");
});

after(function () {
    if (fs.existsSync(tempFilePath)) fs.unlinkSync(tempFilePath);
});

beforeEach(function () {
    mockFindOneAndUpdate = null;
    mockParseResume = null;
    mockExtractResumeInfo = null;
    delete require.cache[ctrlPath];
});

function loadController() {
    installMock(modelPath, { findOneAndUpdate: mockFindOneAndUpdate });
    installMock(parserPath, { parseResume: mockParseResume });
    installMock(infoPath, { extractResumeInfo: mockExtractResumeInfo });
    return require("../controllers/resumeController");
}

// ------------------------------------------------------------------
// buildProfileUpdate (pure helper)
// ------------------------------------------------------------------
describe("buildProfileUpdate", function () {
    var mod;
    before(function () { mod = loadController(); });

    it("always sets resumeText, resumeFileName, profileComplete, clerkId", function () {
        var info = { fullName: "Jane", email: "j@x.com", skills: ["Go"], keywords: ["go"], headline: "", phone: "" };
        var upd = mod.buildProfileUpdate("u1", info, "resume text", "r.pdf");
        assert.strictEqual(upd.$set.clerkId, "u1");
        assert.strictEqual(upd.$set.resumeText, "resume text");
        assert.strictEqual(upd.$set.resumeFileName, "r.pdf");
        assert.strictEqual(upd.$set.profileComplete, true);
    });

    it("profileComplete is false when no skills detected", function () {
        var info = { fullName: "", email: "", skills: [], keywords: [] };
        var upd = mod.buildProfileUpdate("u1", info, "text", "f.pdf");
        assert.strictEqual(upd.$set.profileComplete, false);
    });

    it("only $set fields the parser populated (preserves existing)", function () {
        var info = { fullName: "", email: "x@y.com", skills: ["React"], keywords: ["react"], phone: "", headline: "" };
        var upd = mod.buildProfileUpdate("u1", info, "text", "f.pdf");
        var keys = Object.keys(upd.$set).sort();
        assert.deepStrictEqual(keys, [
            "clerkId", "email", "keywords", "profileComplete",
            "resumeFileName", "resumeText", "skills"
        ]);
    });

    it("always provides defaults via $setOnInsert for new profiles", function () {
        var info = { fullName: "", email: "", skills: [], keywords: [] };
        var upd = mod.buildProfileUpdate("u1", info, "text", "f.pdf");
        assert.ok(upd.$setOnInsert);
        assert.deepStrictEqual(upd.$setOnInsert.skills, []);
        assert.deepStrictEqual(upd.$setOnInsert.keywords, []);
        assert.ok(upd.$setOnInsert.preferences);
    });

    it("handles non-array / malformed extracted fields defensively", function () {
        var info = { fullName: "J", email: "j@x.com", skills: "not-an-array", keywords: 42 };
        var upd = mod.buildProfileUpdate("u1", info, "text", "f.pdf");
        assert.ok(!upd.$set.skills);
        assert.ok(!upd.$set.keywords);
        assert.strictEqual(upd.$set.email, "j@x.com");
    });
});
// === SPLIT ===

// ------------------------------------------------------------------
// uploadResume (handler) — Gemini-free path
// ------------------------------------------------------------------
describe("uploadResume (Gemini-free path)", function () {
    it("returns 400 when no file is uploaded", async function () {
        var mod = loadController();
        var res = makeMockRes();
        await mod.uploadResume({ clerkId: "u1" }, res);
        assert.strictEqual(res.statusCode, 400);
        assert.strictEqual(res.jsonData.success, false);
    });

    it("returns 422 when the file cannot be parsed", async function () {
        mockParseResume = function () { throw new Error("Cannot parse file format."); };
        var mod = loadController();
        var res = makeMockRes();
                await mod.uploadResume({ clerkId: "u1", file: makeFile() }, res);
        assert.strictEqual(res.statusCode, 422);
        assert.strictEqual(res.jsonData.success, false);
        assert.ok(typeof res.jsonData.message === "string" && res.jsonData.message.length > 0);
    });

    it("returns 422 when parse yields empty text", async function () {
        mockParseResume = async () => "   ";
        var mod = loadController();
        var res = makeMockRes();
        await mod.uploadResume({ clerkId: "u1", file: makeFile() }, res);
        assert.strictEqual(res.statusCode, 422);
        assert.strictEqual(res.jsonData.success, false);
    });

    it("saves profile with resumeText + extracted skills and returns 200", async function () {
        mockParseResume = async () => "Resume text here";
        mockExtractResumeInfo = function () {
            return { fullName: "Jane", email: "j@x.com", skills: ["React", "Node.js"], keywords: ["react"], phone: "", headline: "Dev" };
        };
        var savedArg = null;
        mockFindOneAndUpdate = async function (query, update, opts) {
            savedArg = update;
            return { clerkId: "u1", resumeText: "Resume text here", skills: ["React", "Node.js"] };
        };
        var mod = loadController();
        var res = makeMockRes();
        await mod.uploadResume({ clerkId: "u1", file: makeFile("jane.pdf") }, res);

        assert.strictEqual(res.statusCode, 200);
        assert.strictEqual(res.jsonData.success, true);
        assert.strictEqual(res.jsonData.resumeFileName, "jane.pdf");
        assert.strictEqual(res.jsonData.resumeTextChars, "Resume text here".length);
        assert.strictEqual(res.jsonData.skillsDetected, 2);
        assert.strictEqual(res.jsonData.profileComplete, true);
        assert.ok(savedArg.$set.resumeText === "Resume text here");
        assert.ok(savedArg.$set.skills[0] === "React");
    });

    it("returns success even when no skills are detected (no Gemini)", async function () {
        mockParseResume = async () => "just some text without tech words";
        mockExtractResumeInfo = function () {
            return { fullName: "", email: "", skills: [], keywords: [], phone: "", headline: "" };
        };
        mockFindOneAndUpdate = async function () { return { clerkId: "u1", resumeText: "x" }; };
        var mod = loadController();
        var res = makeMockRes();
        await mod.uploadResume({ clerkId: "u1", file: makeFile() }, res);
        assert.strictEqual(res.statusCode, 200);
        assert.strictEqual(res.jsonData.success, true);
        assert.strictEqual(res.jsonData.profileComplete, false);
        assert.ok(res.jsonData.message.includes("Add skills manually"));
    });

    it("returns 500 when the database write fails", async function () {
        mockParseResume = async () => "text";
        mockExtractResumeInfo = function () { return { fullName: "", email: "", skills: [], keywords: [] }; };
        mockFindOneAndUpdate = async function () { throw new Error("MongoDB connection lost"); };
        var mod = loadController();
        var res = makeMockRes();
        await mod.uploadResume({ clerkId: "u1", file: makeFile() }, res);
        assert.strictEqual(res.statusCode, 500);
        assert.strictEqual(res.jsonData.success, false);
    });

    it("does not import or call the Gemini extractor (no Gemini in upload path)", function () {
        process.env.GEMINI_API_KEY = "";
        mockParseResume = async () => "text";
        mockExtractResumeInfo = function () { return { fullName: "", email: "", skills: [], keywords: [] }; };
        mockFindOneAndUpdate = async function () { return {}; };
        var mod = loadController();
        assert.strictEqual(typeof mod.uploadResume, "function");
        assert.strictEqual(mod.extractProfileFromResume, undefined);
        delete process.env.GEMINI_API_KEY;
    });
});

