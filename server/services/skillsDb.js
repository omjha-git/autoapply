/**
 * skillsDb.js
 *
 * A small, deterministic, dependency-free skill dictionary used by the
 * resume parser and the job matcher. Nothing here calls any AI service —
 * skills are recognized purely by keyword matching so the whole pipeline
 * (resume upload -> match score) works with ZERO API keys.
 *
 * Design notes
 *  - Each skill has a canonical `key` (lowercased, used for matching),
 *    a display `label`, and optional `aliases`.
 *  - `extractSkillsFromText` dedupes so repeated keywords are NOT rewarded
 *    by the matcher (requirement: avoid rewarding repeated keywords).
 *  - `canonicalizeSkill` maps a raw token to a known label when possible so
 *    a resume that says "React.js" and a job that says "React" both map to
 *    the same canonical skill.
 */

const KNOWN_SKILLS = [
    { key: "javascript", label: "JavaScript", aliases: ["js", "es6", "es7", "es8", "nodejs"] },
    { key: "typescript", label: "TypeScript" },
    { key: "python", label: "Python" },
    { key: "java", label: "Java" },
    { key: "c++", label: "C++", aliases: ["cpp"] },
    { key: "c#", label: "C#" },
    { key: "go", label: "Go", aliases: ["golang"] },
    { key: "rust", label: "Rust" },
    { key: "php", label: "PHP" },
    { key: "ruby", label: "Ruby" },
    { key: "sql", label: "SQL" },
    { key: "mysql", label: "MySQL" },
    { key: "postgresql", label: "PostgreSQL", aliases: ["postgres"] },
    { key: "mongodb", label: "MongoDB" },
    { key: "redis", label: "Redis" },
    { key: "react", label: "React", aliases: ["react.js", "reactjs"] },
    { key: "next.js", label: "Next.js", aliases: ["nextjs", "next"] },
    { key: "vue", label: "Vue", aliases: ["vue.js", "vuejs"] },
    { key: "angular", label: "Angular" },
    { key: "svelte", label: "Svelte" },
    { key: "node.js", label: "Node.js", aliases: ["express"] },
    { key: "express", label: "Express" },
    { key: "html", label: "HTML" },
    { key: "css", label: "CSS" },
    { key: "tailwind", label: "Tailwind CSS", aliases: ["tailwindcss"] },
    { key: "sass", label: "Sass", aliases: ["scss"] },
    { key: "docker", label: "Docker" },
    { key: "kubernetes", label: "Kubernetes", aliases: ["k8s"] },
    { key: "aws", label: "AWS" },
    { key: "azure", label: "Azure" },
    { key: "gcp", label: "GCP", aliases: ["google cloud"] },
    { key: "git", label: "Git" },
    { key: "github", label: "GitHub" },
    { key: "gitlab", label: "GitLab" },
    { key: "ci/cd", label: "CI/CD" },
    { key: "jest", label: "Jest" },
    { key: "cypress", label: "Cypress" },
    { key: "tensorflow", label: "TensorFlow" },
    { key: "pytorch", label: "PyTorch" },
    { key: "machine learning", label: "Machine Learning", aliases: ["ml"] },
    { key: "flask", label: "Flask" },
    { key: "django", label: "Django" },
    { key: "rest api", label: "REST API", aliases: ["rest", "api"] },
    { key: "graphql", label: "GraphQL" },
    { key: "redux", label: "Redux" },
    { key: "mobx", label: "MobX" },
    { key: "rxjs", label: "RxJS" },
    { key: "pandas", label: "Pandas" },
    { key: "numpy", label: "NumPy" },
    { key: "react native", label: "React Native" },
    { key: "firebase", label: "Firebase" },
    { key: "supabase", label: "Supabase" },
    { key: "solidity", label: "Solidity" },
    { key: "blockchain", label: "Blockchain" },
    { key: "figma", label: "Figma" },
    { key: "linux", label: "Linux" },
    { key: "bash", label: "Bash" },
    { key: "terraform", label: "Terraform" },
    { key: "ansible", label: "Ansible" },
    { key: "jenkins", label: "Jenkins" },
    { key: "tableau", label: "Tableau" },
    { key: "power bi", label: "Power BI" },
    { key: "slack", label: "Slack" },
    { key: "jira", label: "Jira" },
    { key: "confluence", label: "Confluence" },
    { key: "postman", label: "Postman" },
];

// === HELPERS BELOW ===

/** Normalize a token for comparison: lowercase, collapse spaces. */
const normalizeToken = (value = "") =>
    String(value)
        .toLowerCase()
        .replace(/[^a-z0-9+#./ -]/g, " ")
        .replace(/\s+/g, " ")
        .trim();

/** Build a lookup from normalized token -> canonical skill label. */
const buildIndex = () => {
    const map = new Map();
    for (const skill of KNOWN_SKILLS) {
        const candidates = [skill.key, skill.label, ...(skill.aliases || [])];
        for (const c of candidates) {
            map.set(normalizeToken(c), skill.label);
        }
    }
    return map;
};

const INDEX = buildIndex();

/** Boundary check: a char is a boundary if it is not a letter/digit. */
const isBoundary = (c) => !/[a-z0-9]/.test(c);

/**
 * True if `needle` appears in `haystack` as a whole token unit (delimited by
 * non-word characters) so "ai" does not match inside "main", etc.
 */
const containsToken = (haystack, needle) => {
    if (!needle) return false;
    const idx = haystack.indexOf(needle);
    if (idx === -1) return false;
    const before = idx === 0 ? " " : haystack[idx - 1];
    const after =
        idx + needle.length >= haystack.length
            ? " "
            : haystack[idx + needle.length];
    return isBoundary(before) && isBoundary(after);
};

/**
 * Map a raw token (e.g. "react.js", "AWS", "node") to a canonical skill
 * label if recognized, otherwise return the lowercased token.
 */
const canonicalizeSkill = (token) => {
    if (!token) return "";
    const n = normalizeToken(token);
    if (!n) return "";
    return INDEX.get(n) || n;
};

/**
 * Extract the set of canonical skills mentioned in `text`.
 * - Case-insensitive, boundary aware.
 * - Longer/more specific skills matched before shorter substrings.
 * - Deduplicated — repeated mentions do not appear twice.
 *
 * @param {string} text
 * @returns {string[]} canonical skill labels
 */
const extractSkillsFromText = (text) => {
    if (!text) return [];

    const haystack = normalizeToken(text);
    if (!haystack) return [];

    const found = [];
    const seen = new Set();

    // Sort by label length DESC so "react native" is matched before "react".
    const sorted = [...KNOWN_SKILLS].sort(
        (a, b) => b.label.length - a.label.length
    );

    for (const skill of sorted) {
        const candidates = [skill.key, skill.label, ...(skill.aliases || [])];
        let matched = false;
        for (const c of candidates) {
            const needle = normalizeToken(c);
            if (!needle) continue;
            if (containsToken(haystack, needle)) {
                matched = true;
                break;
            }
        }
        if (matched && !seen.has(skill.label)) {
            seen.add(skill.label);
            found.push(skill.label);
        }
    }

    return found;
};

/**
 * Deduplicate an array of skill tokens, canonicalizing each.
 * @param {string[]} skills
 * @returns {string[]}
 */
const dedupeSkills = (skills) => {
    const seen = new Set();
    const out = [];
    for (const s of skills || []) {
        const label = canonicalizeSkill(s);
        if (label && !seen.has(label)) {
            seen.add(label);
            out.push(label);
        }
    }
    return out;
};

module.exports = {
    KNOWN_SKILLS,
    normalizeToken,
    canonicalizeSkill,
    extractSkillsFromText,
    dedupeSkills,
};

