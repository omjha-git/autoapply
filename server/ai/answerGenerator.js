const generateAnswer = async ({
    question,
    profile,
    job
}) => {
    /*
      Connect your preferred LLM here.

      The function intentionally receives structured
      profile + job information so generated answers
      can be grounded in the user's actual information.
    */

    return `I am interested in this opportunity because it aligns with my skills and experience in ${(
        profile?.skills || []
    ).slice(0, 5).join(", ")}.`;
};

module.exports = {
    generateAnswer
};