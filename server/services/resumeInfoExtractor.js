/**
 * resumeInfoExtractor.js
 *
 * Local, deterministic extraction of structured profile information from
 * resume TEXT. This replaces the Gemini-based extraction on the resume-upload
 * path so the application works with ZERO AI API keys.
 *
 * What it extracts (best-effort, never invents):
 *   - fullName      (heuristic: first non-heading line)
 *   - email         (regex)
 *   - phone         (regex)
 *   - headline      (first short non-empty line, heuristic)
 *   - skills        (from skillsDb.extractSkillsFromText)
 *   - keywords      (same as skills — used by the matcher)
 *
 * Missing fields are returned as empty strings/arrays — they are NOT
 * invented. The resumeController merges these into the user's existing
 * profile without overwriting manually-edited fields that the parser
 * could not populate.
 */

const {
    extractSkillsFromText
} = require("./skillsDb");

/** Extract the first email address found in `text`. */
const extractEmail = (text) => {
    if (!text) return "";
    // Match a reasonably strict email pattern.
    const m = text.match(
        /[A-Za-z0-9._%+-]+@[A-Za-z0-9.-]+\.[A-Za-z]{2,}/
    );
    return m ? m[0].trim() : "";
};

/** Extract the first plausible phone number found in `text`. */
const extractPhone = (text) => {
    if (!text) return "";
    // International-ish: optional +, groups of digits, spaces/dashes/dots,
    // 7-15 digits total. Avoid matching IDs / dates that are too short.
    const cleaned = (text || "").replace(/[^\d+]|[\u200b-\u200f]/g, " ");
    const m = cleaned.match(/\+?\d[\d\s().-]{6,}\d/);
    if (!m) return "";

    const digits = m[0].replace(/\D/g, "");
    // Keep only if it looks like a phone (7-15 digits).
    if (digits.length >= 7 && digits.length <= 15) {
        return m[0].trim();
    }
    return "";
};

/**
 * Extract a plausible full name: the first non-empty line that does NOT look
 * like a title/role, email, phone, address, skill list, or label.
 */
const extractFullName = (text) => {
    if (!text) return "";
    const lines = text
        .split(/\r?\n/)
        .map((l) => l.trim())
        .filter(Boolean)
        .slice(0, 8); // only scan the top of the resume

    for (const line of lines) {
        const lower = line.toLowerCase();
        // Skip obvious non-name lines
        if (lower.includes("@")) continue;
        if (extractPhone(line)) continue;
        if (/^[^\w]*[0-9]{5,}/.test(line)) continue; // addresses / pins
        if (/(skills?|experience|education|projects?|summary|objective|curriculum vit\wa?|cv|resume)/i.test(lower)) continue;
        // A name is usually 2-4 alphabetic words, mostly capitalized
        const words = line.split(/\s+/);
        if (words.length < 2 || words.length > 5) continue;
        if (words.every((w) => /^[A-Za-z]+$/.test(w) && /^[A-Z]/.test(w))) {
            return line;
        }
    }
    return "";
};

/**
 * Extract a headline: the first short, capitalized line that is likely a
 * role/title (e.g. "Full-Stack Developer"). Falls back to "".
 */
const extractHeadline = (text) => {
    if (!text) return "";
    const lines = text
        .split(/\r?\n/)
        .map((l) => l.trim())
        .filter(Boolean);

    for (const line of lines.slice(0, 8)) {
        const lower = line.toLowerCase();
        if (lower.includes("@")) continue;
        if (extractPhone(line)) continue;
        if (/^[^\w]*[0-9]{5,}/.test(line)) continue;
        if (/^(skills?|experience|education|projects?|summary|objective|tech)/i.test(lower)) continue;
        // 2-6 words, majority capitalized, contains a role keyword
        const words = line.split(/\s+/);
        if (words.length < 2 || words.length > 6) continue;
        if (words.every((w) => /^[^\W\d_]+$/.test(w))) {
            return line;
        }
    }
    return "";
};

/**
 * Local, AI-free resume extraction.
 *
 * @param {string} resumeText - plain text extracted from the resume file.
 * @returns {{fullName:string,email:string,phone:string,headline:string,skills:string[],keywords:string[]}}
 */
const extractResumeInfo = (resumeText) => {
    const text = (resumeText || "").trim();

    const skills = extractSkillsFromText(text);
    const keywords = skills.slice();

    return {
        fullName: extractFullName(text),
        email: extractEmail(text),
        phone: extractPhone(text),
        headline: extractHeadline(text),
        skills,
        keywords
    };
};

module.exports = {
    extractResumeInfo,
    extractEmail,
    extractPhone,
    extractFullName,
    extractHeadline
};
