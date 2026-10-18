import axios from "axios";

let tokenGetter = null;

export const setTokenGetter = (getter) => {
    tokenGetter = getter;
};

const api = axios.create({
    baseURL:
        import.meta.env.VITE_API_URL ||
        "http://localhost:5000/api",
    withCredentials: true
});

api.interceptors.request.use(
    async (config) => {
        if (tokenGetter) {
            try {
                const token = await tokenGetter();

                if (token) {
                    config.headers.Authorization =
                        `Bearer ${token}`;
                }
            } catch (error) {
                console.error(
                    "Failed to get Clerk token:",
                    error
                );
            }
        }

        return config;
    },
    (error) => {
        return Promise.reject(error);
    }
);

export const getJobs = async () => {
    const response = await api.get("/jobs");
    return response.data;
};

export const searchJobs = async (params) => {
    const response = await api.get(
        "/jobs/search",
        { params }
    );

    return response.data;
};

export const getProfile = async () => {
    const response = await api.get("/profile");
    return response.data;
};

/**
 * Fetch dashboard statistics for the authenticated user.
 * Returns real counts from the Application and Job models.
 */
export const getDashboardStats = async () => {
    const response = await api.get("/profile/dashboard-stats");
    return response.data;
};

/**
 * Upload a resume file.
 * The FormData must contain a "resume" field.
 */
export const uploadResume = async (formData) => {
    const response = await api.post("/profile/resume", formData, {
        headers: {
            "Content-Type": "multipart/form-data"
        }
    });
    return response.data;
};

export const updateProfile = async (data) => {
    const response = await api.put(
        "/profile",
        data
    );

    return response.data;
};

export const getApplications = async () => {
    const response = await api.get(
        "/applications"
    );

    return response.data;
};

export const createApplication = async (
    jobId,
    status = "Saved"
) => {
    const response = await api.post(
        "/applications",
        {
            jobId,
            status
        }
    );

    return response.data;
};

export const generateCoverLetter = async (applicationId) => {
    const response = await api.post(
        `/applications/${applicationId}/cover-letter`
    );

    return response.data;
};

export default api;