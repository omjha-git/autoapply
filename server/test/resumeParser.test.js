/**
 * Offline tests for server/services/resumeParser.js
 *
 * Uses the generated fixture files under test/fixtures/. No live calls.
 * - test/fixtures/sample.pdf   -> the real PDF shipped in uploads/ (copied in)
 * - test/fixtures/sample.docx  -> generated minimal .docx (see build-fixtures.js)
 * - test/fixtures/sample.txt   -> generated plain text
 */
var path = require("path");
var fs = require("fs");
var os = require("os");

var { describe, it, before, after } = require("node:test");
var assert = require("node:assert/strict");

var parseResume = require("../services/resumeParser").parseResume;

var fixtures = path.join(__dirname, "fixtures");

var pdfFixture = path.join(fixtures, "sample.pdf");

// Ensure a PDF fixture exists: if none in fixtures/, copy from uploads/.
before(function () {
    if (!fs.existsSync(pdfFixture)) {
        var src = path.join(__dirname, "..", "uploads", "1790163086992-928738693.pdf");
        if (fs.existsSync(src)) {
            fs.copyFileSync(src, pdfFixture);
        }
    }
});

describe("parseResume — supported formats", function () {
    it("extracts text from a PDF", async function () {
        if (!fs.existsSync(pdfFixture)) this.skip();
        var text = await parseResume(pdfFixture);
        assert.ok(text.length > 0, "PDF should yield non-empty text");
        assert.ok(typeof text === "string");
    });

    it("extracts text from a DOCX", async function () {
        var text = await parseResume(path.join(fixtures, "sample.docx"));
        assert.ok(text.length > 0);
        assert.ok(text.toLowerCase().includes("jane"));
    });

    it("extracts text from a TXT", async function () {
        var text = await parseResume(path.join(fixtures, "sample.txt"));
        assert.ok(text.length > 0);
                assert.ok(text.toLowerCase().includes("jane"));
    });
});

describe("parseResume — errors / invalid files", function () {
    it("throws when the file path is missing", async function () {
        await assert.rejects(
            async () => parseResume(null),
            /path is missing/i
        );
    });

    it("throws when the file does not exist", async function () {
        await assert.rejects(
            async () => parseResume(path.join(os.tmpdir(), "nope-does-not-exist.pdf")),
            /not found/i
        );
    });

    it("throws for an unsupported extension", async function () {
        var tmp = path.join(os.tmpdir(), "aa-badfile-" + process.pid + ".jpg");
        fs.writeFileSync(tmp, "not a resume");
        try {
            await assert.rejects(
                async () => parseResume(tmp),
                /unsupported resume format/i
            );
        } finally {
            fs.unlinkSync(tmp);
        }
    });
});
