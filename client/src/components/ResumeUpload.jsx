import { useState } from "react";

import { useAuth } from "@clerk/react";

import {
    FileText
} from "lucide-react";

import api from "../services/api";

export default function ResumeUpload({
    onComplete
}) {
    const { getToken } = useAuth();

    const [file, setFile] = useState(null);
    const [loading, setLoading] = useState(false);
    const [message, setMessage] = useState("");

    const upload = async () => {
        if (!file) {
            setMessage("Please select your resume.");
            return;
        }

        const MAX_FILE_SIZE = 10 * 1024 * 1024;

        if (file.size > MAX_FILE_SIZE) {
            setMessage("File too large. Maximum size is 10 MB.");
            return;
        }

        const allowedTypes = [
            "application/pdf",
            "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
            "text/plain"
        ];

        if (!allowedTypes.includes(file.type)) {
            setMessage(
                "Invalid file type. Only PDF, DOCX, and TXT files are allowed."
            );
            return;
        }

        try {
            setLoading(true);
            setMessage("Analyzing your resume...");

            const formData = new FormData();
            formData.append("resume", file);

            const token = await getToken();

            const response = await api.post(
                "/profile/resume",
                formData,
                {
                    headers: {
                        Authorization: `Bearer ${token}`
                    }
                }
            );

            if (response.data.partial) {
                setMessage("Resume saved, but AI analysis failed. You can edit your profile manually.");
            } else {
                setMessage("Resume analyzed successfully!");
            }

            if (onComplete && response.data.profile) {
                onComplete(response.data.profile);
            }
        } catch (error) {
            console.error(error);

            const errData = error.response?.data;

            if (errData?.partial) {
                if (errData?.retryable) {
                    setMessage("Resume saved, but AI analysis is temporarily unavailable. Please try again later.");
                } else {
                    setMessage("Resume saved, but AI analysis failed. You can edit your profile manually.");
                }
            } else {
                setMessage(
                    errData?.message ||
                    "Resume upload failed."
                );
            }
        } finally {
            setLoading(false);
        }
    };

    const getFileMessageClass = () => {
        if (message.includes("successfully")) {
            return "success";
        }
        if (
            message.includes("failed") ||
            message.includes("Error")
        ) {
            return "error";
        }
        if (
            message.includes("complete") ||
            message.includes("Analyzing")
        ) {
            return "warning";
        }
        return "";
    };

    return (
        <div className="resume-upload">

            <div className="upload-box">

                <div className="upload-icon">
                    <FileText size={44} />
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
                    <p className="file-name">
                        Selected:{" "}
                        <strong>
                            {file.name}
                        </strong>
                    </p>
                ) }

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
                    <p
                        className={
                            "upload-message " +
                            getFileMessageClass()
                        }
                    >
                        {message}
                    </p>
                ) }

            </div>

        </div>
    );
}
