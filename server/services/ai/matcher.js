const normalize = (value = "") => {
    return value
        .toString()
        .toLowerCase()
        .replace(/[^a-z0-9+#.]/g, " ")
        .replace(/\s+/g, " ")
        .trim();
};

// ==========================================
// PROFILE SKILLS
// ==========================================

const getProfileSkills = (profile) => {
    if (!profile) {
        return [];
    }

    const skills = Array.isArray(profile.skills)
        ? profile.skills
        : [];

    const keywords = Array.isArray(profile.keywords)
        ? profile.keywords
        : [];

    return [
        ...skills,
        ...keywords
    ]
        .map(normalize)
        .filter(Boolean);
};

// ==========================================
// PROFILE ROLES
// ==========================================

const getProfileRoles = (profile) => {
    if (!profile) {
        return [];
    }

    const roles =
        Array.isArray(profile.preferences?.roles)
            ? profile.preferences.roles
            : [];

    return roles
        .map(normalize)
        .filter(Boolean);
};

// ==========================================
// CHECK TEXT MATCH
// ==========================================

const textMatches = (
    keyword,
    text
) => {
    const a = normalize(keyword);
    const b = normalize(text);

    if (!a || !b) {
        return false;
    }

    // Exact phrase
    if (b.includes(a)) {
        return true;
    }

    // Handle things like:
    // React.js -> React
    // Node.js -> Node
    // JavaScript -> javascript

    const words = a
        .split(" ")
        .filter(
            word => word.length >= 2
        );

    if (words.length === 0) {
        return false;
    }

    let matched = 0;

    for (const word of words) {
        if (b.includes(word)) {
            matched++;
        }
    }

    return (
        matched / words.length >= 0.5
    );
};

// ==========================================
// CALCULATE MATCH
// ==========================================

const calculateMatchScore = (
    profile,
    job
) => {

    if (!profile || !job) {
        return 0;
    }

    const skills =
        getProfileSkills(profile);

    const roles =
        getProfileRoles(profile);

    const resumeText =
        normalize(
            profile.resumeText || ""
        );

    const title =
        normalize(
            job.title || ""
        );

    const description =
        normalize(
            job.description || ""
        );

    const completeJobText =
        `${title} ${description}`;

    console.log(
        "\n--------------------------------"
    );

    console.log(
        "MATCHING:",
        job.title
    );

    console.log(
        "Skills:",
        skills.length
    );

    console.log(
        "Roles:",
        roles.length
    );

    console.log(
        "Resume chars:",
        resumeText.length
    );

    // ======================================
    // 1. SKILL MATCH — 50%
    // ======================================

    let skillScore = 0;

    if (skills.length > 0) {

        let matchedSkills = 0;

        for (const skill of skills) {

            const found =
                textMatches(
                    skill,
                    completeJobText
                );

            if (found) {
                matchedSkills++;
            }
        }

        skillScore =
            (
                matchedSkills /
                skills.length
            ) * 100;

        console.log(
            "Matched skills:",
            matchedSkills,
            "/",
            skills.length
        );
    }

    // ======================================
    // FALLBACK:
    // USE RESUME TEXT
    // ======================================

    if (
        skills.length === 0 &&
        resumeText.length > 0
    ) {

        const commonTech = [
            "javascript",
            "typescript",
            "react",
            "react.js",
            "next.js",
            "node.js",
            "node",
            "express",
            "mongodb",
            "mysql",
            "postgresql",
            "sql",
            "java",
            "python",
            "c++",
            "c#",
            "html",
            "css",
            "tailwind",
            "git",
            "github",
            "docker",
            "aws",
            "azure",
            "machine learning",
            "artificial intelligence",
            "ai",
            "rest api",
            "api",
            "mern",
            "full stack",
            "frontend",
            "backend"
        ];

        const resumeTech =
            commonTech.filter(
                tech =>
                    resumeText.includes(
                        normalize(tech)
                    )
            );

        let matchedTech = 0;

        for (const tech of resumeTech) {

            if (
                textMatches(
                    tech,
                    completeJobText
                )
            ) {
                matchedTech++;
            }
        }

        if (
            resumeTech.length > 0
        ) {
            skillScore =
                (
                    matchedTech /
                    resumeTech.length
                ) * 100;
        }

        console.log(
            "Fallback resume technologies:",
            resumeTech
        );

        console.log(
            "Fallback matched:",
            matchedTech,
            "/",
            resumeTech.length
        );
    }

    // ======================================
    // 2. ROLE MATCH — 30%
    // ======================================

    let roleScore = 0;

    if (
        roles.length > 0 &&
        title
    ) {

        let bestRoleScore = 0;

        for (const role of roles) {

            if (
                title.includes(role) ||
                role.includes(title)
            ) {
                bestRoleScore = 100;
                break;
            }

            const roleWords =
                role
                    .split(" ")
                    .filter(
                        word =>
                            word.length > 2
                    );

            if (
                roleWords.length === 0
            ) {
                continue;
            }

            const matchedWords =
                roleWords.filter(
                    word =>
                        title.includes(word)
                ).length;

            const currentScore =
                (
                    matchedWords /
                    roleWords.length
                ) * 100;

            bestRoleScore =
                Math.max(
                    bestRoleScore,
                    currentScore
                );
        }

        roleScore =
            bestRoleScore;
    }

    console.log(
        "Role score:",
        Math.round(roleScore)
    );

    // ======================================
    // 3. DESCRIPTION MATCH — 20%
    // ======================================

    let descriptionScore = 0;

    if (
        skills.length > 0 &&
        description
    ) {

        let matched = 0;

        for (const skill of skills) {

            if (
                textMatches(
                    skill,
                    description
                )
            ) {
                matched++;
            }
        }

        descriptionScore =
            (
                matched /
                skills.length
            ) * 100;
    }

    // ======================================
    // FINAL SCORE
    // ======================================

    const finalScore =
        (
            skillScore * 0.50
        ) +
        (
            roleScore * 0.30
        ) +
        (
            descriptionScore * 0.20
        );

    const result =
        Math.round(
            Math.min(
                100,
                Math.max(
                    0,
                    finalScore
                )
            )
        );

    console.log(
        "Skill score:",
        Math.round(skillScore)
    );

    console.log(
        "Description score:",
        Math.round(descriptionScore)
    );

    console.log(
        "FINAL:",
        result + "%"
    );

    console.log(
        "--------------------------------"
    );

    return result;
};

module.exports = {
    calculateMatchScore
};