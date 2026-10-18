import {
    useEffect,
    useState
} from "react";

import {
    getProfile,
    updateProfile
} from "../services/api";

import ResumeUpload from "../components/ResumeUpload";

import Layout from "../components/Layout";

export default function Profile() {
    const [profile, setProfile] =
        useState(null);

    const [skills, setSkills] =
        useState("");

    useEffect(() => {
        loadProfile();
    }, []);

    const loadProfile =
        async () => {
            try {
                const data =
                    await getProfile();

                setProfile(
                    data.profile
                );

                setSkills(
                    (
                        data.profile
                            ?.skills || []
                    ).join(", ")
                );
            } catch (error) {
                console.error(
                    error
                );
            }
        };

    const handleResumeComplete =
        (newProfile) => {
            setProfile(
                newProfile
            );

            setSkills(
                (
                    newProfile.skills ||
                    []
                ).join(", ")
            );
        };

    const save = async () => {
        try {
            const data =
                await updateProfile({
                    ...profile,

                    skills: skills
                        .split(",")
                        .map(
                            (skill) =>
                                skill.trim()
                        )
                        .filter(Boolean)
                });

            setProfile(
                data.profile
            );

            alert(
                "Profile updated!"
            );
        } catch (error) {
            console.error(
                error
            );

            alert(
                "Profile update failed."
            );
        }
    };

    const change = (
        field,
        value
    ) => {
        setProfile({
            ...profile,
            [field]: value
        });
    };

    if (!profile) {
        return (
            <Layout title="Profile" subtitle="Build and manage your profile.">
                <p>Loading profile...</p>
            </Layout>
        );
    }

    return (
        <Layout
            title="Build Your Profile"
            subtitle="Upload your resume and AutoApply will automatically extract your information."
        >

                                            <div className="profile-grid">

                        <ResumeUpload
                            onComplete={
                                handleResumeComplete
                            }
                        />

                <div className="form">

                    <h3>
                        Extracted Profile
                    </h3>

                    <div className="form-field">
                            <label className="form-label">
                        Full Name
                    </label>

                    <input
                                className="form-input"
                        value={
                            profile.fullName ||
                            ""
                        }
                        onChange={(e) =>
                            change(
                                "fullName",
                                e.target.value
                            )
                        }
                    />
                        </div>

                    <div className="form-field">
                            <label className="form-label">
                        Email
                    </label>

                    <input
                                className="form-input"
                        value={
                            profile.email ||
                            ""
                        }
                        onChange={(e) =>
                            change(
                                "email",
                                e.target.value
                            )
                        }
                    />
                        </div>

                    <div className="form-field">
                            <label className="form-label">
                        Phone
                    </label>

                    <input
                                className="form-input"
                        value={
                            profile.phone ||
                            ""
                        }
                        onChange={(e) =>
                            change(
                                "phone",
                                e.target.value
                            )
                        }
                    />
                        </div>

                    <div className="form-field">
                            <label className="form-label">
                        Location
                    </label>

                    <input
                                className="form-input"
                        value={
                            profile.location ||
                            ""
                        }
                        onChange={(e) =>
                            change(
                                "location",
                                e.target.value
                            )
                        }
                    />
                        </div>

                    <div className="form-field">
                            <label className="form-label">
                        Headline
                    </label>

                    <input
                                className="form-input"
                        value={
                            profile.headline ||
                            ""
                        }
                        onChange={(e) =>
                            change(
                                "headline",
                                e.target.value
                            )
                        }
                    />
                        </div>

                    <div className="form-field">
                            <label className="form-label">
                        Skills
                    </label>

                    <input
                                className="form-input"
                        value={skills}
                        onChange={(e) =>
                            setSkills(
                                e.target.value
                            )
                        }
                    />
                        </div>

                    <div className="form-field form-field-full">
                            <label className="form-label">
                        Summary
                    </label>

                    <textarea
                                className="form-input form-textarea"
                        rows="6"
                        value={
                            profile.summary ||
                            ""
                        }
                        onChange={(e) =>
                            change(
                                "summary",
                                e.target.value
                            )
                        }
                    />
                        </div>

                    <button
                        className="btn"
                        onClick={save}
                    >
                        Save Profile
                    </button>

                </div>

                </div>

                {profile.preferences
                    ?.roles?.length >
                    0 && (
                    <div className="panel">

                        <h3>
                            Recommended Roles
                        </h3>

                        <div>
                            {profile.preferences.roles.map(
                                (role) => (
                                    <span
                                        className="skill-tag"
                                        key={role}
                                    >
                                        {role}
                                    </span>
                                )
                            )}
                        </div>

                    </div>
                )}

        </Layout>
    );
}