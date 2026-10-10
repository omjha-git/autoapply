import { useState } from "react";

import { useAuth } from "@clerk/react";

import api from "../services/api";

export default function ResumeUpload({
    onComplete
}) {
    const { getToken } = useAuth();

    const [file, setFile] =
        useState(null);

    const [loading, setLoading] =
        useState(false);

    const [message, setMessage] =
        useState("");

    const upload = async () => {
        if (!file) {
            setMessage(
                "Please select your resume."
            );

            return;
        }

        try {
            setLoading(true);
            setMessage(
                "Analyzing your resume..."
            );

            const formData =
                new FormData();

            formData.append(
                "resume",
                file
            );

            const token =
                await getToken();

            const response =
                await api.post(
                    "/profile/resume",
                    formData,
                    {
                        headers: {
                            Authorization:
                                `Bearer ${token}`
                        }
                    }
                );

            setMessage(
                "✓ Resume analyzed successfully!"
            );

            if (onComplete) {
                onComplete(
                    response.data.profile
                );
            }
        } catch (error) {
            console.error(error);

            setMessage(
                error.response?.data
                    ?.message ||
                    "Resume upload failed."
            );
        } finally {
            setLoading(false);
        }
    };

    return (
        <div className="resume-upload">

            <div className="upload-box">

                <div className="upload-icon">
                    📄
                </div>

                <h2>
                    Upload your resume
                </h2>

                <p>
                    We'll analyze your resume
                    and find suitable jobs
                    for you.
                </p>

                <input
                    type="file"
                    accept=".pdf,.docx,.txt"
                    onChange={(e) =>
                        setFile(
                            e.target.files[0]
                        )
                    }
                />

                {file && (
                    <p>
                        Selected:{" "}
                        <strong>
                            {file.name}
                        </strong>
                    </p>
                )}

                <button
                    className="btn"
                    onClick={upload}
                    disabled={loading}
                >
                    {loading
                        ? "Analyzing..."
                        : "Upload & Find Jobs"}
                </button>

                {message && (
                    <p className="upload-message">
                        {message}
                    </p>
                )}

            </div>

        </div>
    );
}