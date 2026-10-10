const fs = require("fs");
const path = require("path");
const pdfParse = require("pdf-parse");
const mammoth = require("mammoth");

const parseResume = async (filePath) => {
    if (!filePath) {
        throw new Error("Resume file path is missing.");
    }

    if (!fs.existsSync(filePath)) {
        throw new Error("Resume file not found.");
    }

    const extension =
        path.extname(filePath).toLowerCase();

    // =====================================
    // PDF
    // =====================================

    if (extension === ".pdf") {
        const buffer =
            fs.readFileSync(filePath);

        const data =
            await pdfParse(buffer);

        return (
            data.text || ""
        ).trim();
    }

    // =====================================
    // DOCX
    // =====================================

    if (extension === ".docx") {
        const result =
            await mammoth.extractRawText({
                path: filePath
            });

        return (
            result.value || ""
        ).trim();
    }

    // =====================================
    // TXT
    // =====================================

    if (extension === ".txt") {
        return fs
            .readFileSync(
                filePath,
                "utf8"
            )
            .trim();
    }

    throw new Error(
        "Unsupported resume format. Please upload PDF, DOCX or TXT."
    );
};

module.exports = {
    parseResume
};