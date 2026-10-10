const { GoogleGenAI } = require("@google/genai");

const ai = new GoogleGenAI({
    apiKey: process.env.GEMINI_API_KEY
});

const extractProfileFromResume = async (resumeText) => {
    try {
        const response = await ai.models.generateContent({
            model:
                process.env.GEMINI_MODEL ||
                "gemini-3.6-flash",

            contents: `
You are an expert resume parser.

Analyze the following resume and extract structured information.

Return ONLY valid JSON.

Resume:
----------------
${resumeText}
----------------

Use exactly this JSON structure:

{
    "fullName": "",
    "email": "",
    "phone": "",
    "location": "",
    "headline": "",
    "summary": "",
    "skills": [],
    "education": [
        {
            "institution": "",
            "degree": "",
            "field": "",
            "startDate": "",
            "endDate": "",
            "cgpa": ""
        }
    ],
    "experience": [
        {
            "company": "",
            "role": "",
            "startDate": "",
            "endDate": "",
            "description": ""
        }
    ],
    "projects": [
        {
            "name": "",
            "description": "",
            "technologies": [],
            "url": ""
        }
    ],
    "recommendedRoles": [],
    "keywords": []
}

Rules:
- Extract only information supported by the resume.
- Do not invent missing information.
- skills should contain technical and relevant professional skills.
- recommendedRoles should contain suitable job roles based on the resume.
- keywords should contain important technologies, tools, domains and role-related terms.
- Keep arrays as arrays.
- If information is unavailable, use an empty string or empty array.
`,

            config: {
                responseMimeType: "application/json"
            }
        });

        const text = response.text;

        if (!text) {
            throw new Error(
                "Gemini returned an empty response."
            );
        }

        return JSON.parse(text);

    } catch (error) {

        console.error(
            "Gemini extraction error:",
            error.message
        );

        throw new Error(
            "Failed to analyze resume with Gemini."
        );
    }
};

module.exports = {
    extractProfileFromResume
};