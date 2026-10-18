/**
 * build-fixtures.js  (lives in scripts/ so `node --test` does NOT treat it as
 * a test file — Node's default discovery picks up anything under test/**).
 *
 * Generates the test fixtures the offline suite depends on so tests do NOT
 * depend on live external files:
 *   - test/fixtures/sample.docx  (a minimal valid .docx)
 *   - test/fixtures/sample.txt   (plain text resume snippet)
 *
 * Wired as `pretest` in package.json so fixtures always exist before `npm test`.
 * Requires `jszip` (a transitive dep of mammoth, already in node_modules).
 */
var fs = require("fs");
var path = require("path");
var JSZip = require("jszip");

var fixturesDir = path.resolve(__dirname, "..", "test", "fixtures");
if (!fs.existsSync(fixturesDir)) {
    fs.mkdirSync(fixturesDir, { recursive: true });
}

var toXml = function (s) { return `<?xml version="1.0" encoding="UTF-8" standalone="yes"?>${s}`; };

var buildDocx = async function () {
    var contentTypes = toXml(
        `<Types xmlns="http://schemas.openxmlformats.org/package/2006/content-types">` +
        `<Default Extension="rels" ContentType="application/vnd.openxmlformats-package.relationships+xml"/>` +
        `<Default Extension="xml" ContentType="application/xml"/>` +
        `<Override PartName="/word/document.xml" ContentType="application/vnd.openxmlformats-officedocument.wordprocessingml.document.main+xml"/>` +
        `</Types>`
    );
    var rels = toXml(
        `<Relationships xmlns="http://schemas.openxmlformats.org/package/2006/relationships">` +
        `<Relationship Id="rId1" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/officeDocument" Target="word/document.xml"/>` +
        `</Relationships>`
    );
    var doc = toXml(
        `<w:document xmlns:w="http://schemas.openxmlformats.org/wordprocessingml/2006/main">` +
        `<w:body>` +
        `<w:p><w:r><w:t>Jane Doe</w:t></w:r></w:p>` +
        `<w:p><w:r><w:t>Frontend Developer</w:t></w:r></w:p>` +
        `<w:p><w:r><w:t>Skills: React, JavaScript, Node.js, MongoDB, Docker, AWS</w:t></w:r></w:p>` +
        `<w:p><w:r><w:t>Email: jane@example.com | Phone: +1 555-123-4567</w:t></w:r></w:p>` +
        `</w:body></w:document>`
    );

    var zip = new JSZip();
    zip.file("[Content_Types].xml", contentTypes);
    zip.file("_rels/.rels", rels);
    zip.file("word/document.xml", doc);

    var stream = zip.generateNodeStream({ type: "nodebuffer", compression: "DEFLATE" });
    var out = path.join(fixturesDir, "sample.docx");
    await new Promise(function (resolve, reject) {
        var chunks = [];
        stream.on("data", function (c) { chunks.push(c); });
        stream.on("end", function () {
            fs.writeFileSync(out, Buffer.concat(chunks));
            resolve();
        });
        stream.on("error", reject);
    });
    return out;
};

var buildTxt = function () {
    var out = path.join(fixturesDir, "sample.txt");
    fs.writeFileSync(
        out,
        "Jane Doe\nFrontend Developer\n\n" +
            "Email: jane@example.com | Phone: +1 555-123-4567\n\n" +
            "Skills: React, JavaScript, Node.js, MongoDB, Docker, AWS\n\n" +
            "Experience:\nSoftware Engineer at Acme Corp\nReact, Node.js, AWS, Docker\n"
    );
    return out;
};

(async function () {
    var docx = await buildDocx();
    var txt = buildTxt();
    console.log("Fixtures generated:");
    console.log("  " + docx);
    console.log("  " + txt);

    // Self-verify the docx parses with mammoth.
    try {
        var mammoth = require("mammoth");
        var res = await mammoth.extractRawText({ path: docx });
        console.log("docx parses OK (" + res.value.length + " chars)");
    } catch (e) {
        console.error("docx self-verify FAILED:", e.message);
        process.exit(1);
    }
})().catch(function (e) {
    console.error(e);
    process.exit(1);
});
