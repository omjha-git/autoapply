/**
 * matcher.js
 *
 * Deterministic, explainable job-resume matching — NO AI / API keys.
 *
 * Reads from:
 *   - profile.resumeText            (saved plain-text resume)
 *   - profile.skills / .keywords    (parsed or manually entered)
 *   - profile.preferences.roles     (preferred roles)
 *   - job.title + job.description + job.skills
 *
 * All skill detection goes through skillsDb so matching is canonical and
 * case-insensitive, and repeated keywords are de-duplicated (never rewarded).
 *
 * Output per job:
 *   {
 *     matchPercentage: 0-100,
 *     matchedSkills: [...],
 *     missingSkills: [...],
 *     explanation: "...",
 *     components: { skills: 0-100, role: 0-100, description: 0-100 }
 *   }
 */

const {
    extractSkillsFromText,
    dedupeSkills,
    canonicalizeSkill,
    normalizeToken
} = require("../skillsDb");

// Weighting for the composite score.
const WEIGHTS = { skills: 0.5, role: 0.3, description: 0.2 };

/**
 * Build the canonical, de-duplicated skill set for the user.
 * Combines explicitly-saved skills/keywords with skills extracted from the
 * saved resume text (so matching works even without AI extraction).
 */
const getUserSkills = (profile) => {
    if (!profile) return [];
    const saved = Array.isArray(profile.skills) ? profile.skills : [];
    const keywords = Array.isArray(profile.keywords) ? profile.keywords : [];
    const fromText = extractSkillsFromText(profile.resumeText || "");
    return dedupeSkills([...saved, ...keywords, ...fromText]);
};

/**
 * Build the set of skills the job is asking for:
 *   1. adapter-supplied job.skills (if any)
 *   2. skills detected in the job title + description
 */
const getJobSkills = (job) => {
    if (!job) return [];
    const supplied = Array.isArray(job.skills) ? job.skills.filter(Boolean) : [];
    const fromText = extractSkillsFromText(
        `${job.title || ""} ${job.description || ""}`
    );
    return dedupeSkills([...supplied, ...fromText]);
};

/** Case-insensitive substring match (normalized). */
const termInText = (term, text) => {
    if (!term || !text) return false;
    const a = normalizeToken(term);
    const b = normalizeToken(text);
    return a ? b.includes(a) : false;
};

/**
 * Role relevance (0-100): how well the user's preferred roles / title-relevant
 * skills match the job title.
 */
const getRoleScore = (profile, job) => {
    const title = job && job.title ? job.title : "";
    if (!title) return 0;

    const roles = Array.isArray(profile?.preferences?.roles)
        ? profile.preferences.roles
        : [];
    const userSkills = getUserSkills(profile);
    let best = 0;

    for (const role of roles) {
        const r = normalizeToken(role);
        if (!r) continue;
        const titleNorm = normalizeToken(title);
        if (titleNorm.includes(r)) {
            best = Math.max(best, 100);
            break;
        }
        const words = r.split(/\s+/).filter((w) => w.length > 2);
        if (words.length) {
            const hit = words.filter((w) => titleNorm.includes(w)).length;
            best = Math.max(best, (hit / words.length) * 100);
        }
    }

    const titleLower = normalizeToken(title);
    const techHits = userSkills.filter((s) =>
        normalizeToken(s)
            .split(/\s+/)
            .some((w) => w.length > 2 && titleLower.includes(w))
    ).length;
    if (userSkills.length) {
        best = Math.max(best, (techHits / userSkills.length) * 100);
    }

    return best;
};
/**
 * Skills component (0-100): fraction of the JOB's required skills the user
 * actually has. Returns { score, matched, missing }.
 */
const getSkillComponent = (userSkills, jobSkills) => {
    if (!jobSkills.length) {
        return { score: 0, matched: [], missing: [] };
    }
    const matched = [];
    const missing = [];
    for (const skill of jobSkills) {
        const canon = canonicalizeSkill(skill);
        const has = userSkills.some(
            (u) => canonicalizeSkill(u) === canon || termInText(u, canon)
        );
        if (has) matched.push(skill);
        else missing.push(skill);
    }
    const score = (matched.length / jobSkills.length) * 100;
    return { score, matched, missing };
};

/**
 * Composite match score + explanation.
 */
const calculateMatch = (profile, job) => {
    if (!profile || !job) {
        return {
            matchPercentage: 0,
            matchedSkills: [],
            missingSkills: [],
            explanation:
                "No resume on file. Upload your resume to see a match score.",
            components: { skills: 0, role: 0, description: 0 }
        };
    }

    const resumeText = profile.resumeText || "";
    const hasResume = typeof resumeText === "string" && resumeText.trim().length > 0;

    if (!hasResume) {
        return {
            matchPercentage: 0,
            matchedSkills: [],
            missingSkills: [],
            explanation:
                "No resume text on file. Upload your resume on the Profile page to see a match score.",
            components: { skills: 0, role: 0, description: 0 }
        };
    }

    const userSkills = getUserSkills(profile);
    const jobSkills = getJobSkills(job);
    const jobTitle = job.title || "";
    const jobDescription = job.description || "";

    // 1) SKILLS (50%)
    const {
        score: skillScore,
        matched: matchedSkills,
        missing: missingSkills
    } = getSkillComponent(userSkills, jobSkills);

    // 2) ROLE MATCH (30%)
    const roleScore = getRoleScore(profile, job);

    // 3) DESCRIPTION MATCH (20%) — fraction of the user's skills present in
    //    the job title + description.
    let descriptionScore = 0;
    if (userSkills.length && jobDescription) {
        let hit = 0;
        for (const skill of userSkills) {
            if (termInText(skill, `${jobTitle} ${jobDescription}`)) hit++;
        }
        descriptionScore = (hit / userSkills.length) * 100;
    }

    const finalScore = Math.min(
        100,
        Math.max(
            0,
            skillScore * WEIGHTS.skills +
                roleScore * WEIGHTS.role +
                descriptionScore * WEIGHTS.description
        )
    );
    const matchPercentage = Math.round(finalScore);

    const parts = [];
    if (jobSkills.length) {
        if (matchedSkills.length === jobSkills.length) {
            parts.push(`You match all ${matchedSkills.length} detected required skill(s).`);
        } else if (matchedSkills.length > 0) {
            parts.push(
                `You match ${matchedSkills.length} of ${jobSkills.length} detected required skill(s).`
            );
        } else {
            parts.push("No overlap on detected required skills.");
        }
        if (missingSkills.length) {
            parts.push(`Consider gaining: ${missingSkills.slice(0, 6).join(", ")}.`);
        }
    }
    if (roleScore >= 80) {
        parts.push("Your role/skills align well with the job title.");
    } else if (roleScore > 0) {
        parts.push("Partial role relevance with the job title.");
    }
    if (skillScore === 0 && roleScore === 0 && descriptionScore === 0) {
        parts.push("Insufficient overlap to score — add skills or upload a detailed resume.");
    }

    return {
        matchPercentage,
        matchedSkills,
        missingSkills,
        explanation: parts.join(" "),
        components: {
            skills: Math.round(skillScore),
            role: Math.round(roleScore),
            description: Math.round(descriptionScore)
        }
    };
};

/** Backward-compatible numeric accessor (0-100). */
const calculateMatchScore = (profile, job) =>
    calculateMatch(profile, job).matchPercentage;

module.exports = {
    calculateMatch,
    calculateMatchScore,
    getUserSkills,
    getJobSkills
};

