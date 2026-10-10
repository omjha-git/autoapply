const normalize = (value = "") => {
    return value
        .toString()
        .toLowerCase()
        .replace(/[^a-z0-9+#. ]/g, " ")
        .replace(/\s+/g, " ")
        .trim();
};


const getProfileSkills = (profile) => {
    return [
        ...(profile.skills || []),
        ...(profile.keywords || [])
    ]
        .map(normalize)
        .filter(Boolean);
};


const getProfileRoles = (profile) => {
    return [
        ...(profile.preferences?.roles || [])
    ]
        .map(normalize)
        .filter(Boolean);
};


const skillMatchesText = (
    skill,
    text
) => {

    const normalizedSkill =
        normalize(skill);

    const normalizedText =
        normalize(text);

    if (!normalizedSkill) {
        return false;
    }

    return (
        normalizedText.includes(
            normalizedSkill
        ) ||
        normalizedSkill
            .split(" ")
            .every((word) =>
                normalizedText.includes(word)
            )
    );
};


const calculateMatchScore = (
    profile,
    job
) => {

    if (!profile || !job) {
        return 0;
    }


    const profileSkills =
        getProfileSkills(profile);

    const profileRoles =
        getProfileRoles(profile);


    const jobTitle =
        normalize(job.title || "");


    const jobDescription =
        normalize(
            job.description || ""
        );


    const jobSkills =
        (job.skills || [])
            .map(normalize)
            .filter(Boolean);


    /*
     * --------------------------------
     * 1. SKILL MATCH — 50%
     * --------------------------------
     */

    let skillScore = 0;

    if (profileSkills.length > 0) {

        let matchedSkills = 0;

        if (jobSkills.length > 0) {

            for (const jobSkill of jobSkills) {

                const matched =
                    profileSkills.some(
                        (profileSkill) =>
                            skillMatchesText(
                                profileSkill,
                                jobSkill
                            )
                    );

                if (matched) {
                    matchedSkills++;
                }
            }

            skillScore =
                (matchedSkills /
                    jobSkills.length) *
                100;

        } else {

            /*
             * Greenhouse currently doesn't
             * provide structured skills.
             *
             * Search the description instead.
             */

            let matchedSkills = 0;

            for (const skill of profileSkills) {

                if (
                    skillMatchesText(
                        skill,
                        jobDescription
                    )
                ) {
                    matchedSkills++;
                }
            }

            skillScore =
                profileSkills.length > 0
                    ? (matchedSkills /
                        profileSkills.length) *
                        100
                    : 0;
        }
    }


    /*
     * --------------------------------
     * 2. ROLE MATCH — 30%
     * --------------------------------
     */

    let roleScore = 0;

    if (
        profileRoles.length > 0 &&
        jobTitle
    ) {

        let bestRoleScore = 0;

        for (const role of profileRoles) {

            if (
                jobTitle.includes(role) ||
                role.includes(jobTitle)
            ) {
                bestRoleScore = 100;
                break;
            }


            const roleWords =
                role
                    .split(" ")
                    .filter(
                        (word) =>
                            word.length > 2
                    );

            if (roleWords.length > 0) {

                const matchedWords =
                    roleWords.filter(
                        (word) =>
                            jobTitle.includes(
                                word
                            )
                    ).length;

                const score =
                    (matchedWords /
                        roleWords.length) *
                    100;

                bestRoleScore =
                    Math.max(
                        bestRoleScore,
                        score
                    );
            }
        }

        roleScore =
            bestRoleScore;
    }


    /*
     * --------------------------------
     * 3. DESCRIPTION MATCH — 20%
     * --------------------------------
     */

    let descriptionScore = 0;

    if (
        profileSkills.length > 0 &&
        jobDescription
    ) {

        const matched =
            profileSkills.filter(
                (skill) =>
                    skillMatchesText(
                        skill,
                        jobDescription
                    )
            ).length;

        descriptionScore =
            (matched /
                profileSkills.length) *
            100;
    }


    /*
     * --------------------------------
     * FINAL SCORE
     * --------------------------------
     */

    const finalScore =
        (skillScore * 0.50) +
        (roleScore * 0.30) +
        (descriptionScore * 0.20);


    return Math.min(
        100,
        Math.max(
            0,
            Math.round(finalScore)
        )
    );
};


module.exports = {
    calculateMatchScore
};