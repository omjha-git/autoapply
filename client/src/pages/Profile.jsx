import {
    useEffect,
    useState
} from "react";

import {
    getProfile,
    updateProfile
} from "../services/api";

import ResumeUpload from "../components/ResumeUpload";

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
            <div className="content">
                Loading profile...
            </div>
        );
    }

    return (
        <div className="app">

            <aside className="sidebar">

                <h2>
                    AutoApply
                </h2>

                <a href="/dashboard">
                    Dashboard
                </a>

                <a href="/jobs">
                    Find Jobs
                </a>

                <a href="/profile">
                    My Profile
                </a>

                <a href="/applications">
                    Applications
                </a>

            </aside>

            <main className="content">

                <h1>
                    Build Your Profile
                </h1>

                <p>
                    Upload your resume and
                    AutoApply will automatically
                    extract your information.
                </p>

                <ResumeUpload
                    onComplete={
                        handleResumeComplete
                    }
                />

                <div className="form">

                    <h2>
                        Extracted Profile
                    </h2>

                    <label>
                        Full Name
                    </label>

                    <input
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

                    <label>
                        Email
                    </label>

                    <input
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

                    <label>
                        Phone
                    </label>

                    <input
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

                    <label>
                        Location
                    </label>

                    <input
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

                    <label>
                        Headline
                    </label>

                    <input
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

                    <label>
                        Skills
                    </label>

                    <input
                        value={skills}
                        onChange={(e) =>
                            setSkills(
                                e.target.value
                            )
                        }
                    />

                    <label>
                        Summary
                    </label>

                    <textarea
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

                    <button
                        className="btn"
                        onClick={save}
                    >
                        Save Profile
                    </button>

                </div>

                {profile.preferences
                    ?.roles?.length >
                    0 && (
                    <div className="panel">

                        <h2>
                            Recommended Roles
                        </h2>

                        <div>
                            {profile.preferences.roles.map(
                                (role) => (
                                    <span
                                        className="source"
                                        key={role}
                                        style={{
                                            marginRight:
                                                "8px"
                                        }}
                                    >
                                        {role}
                                    </span>
                                )
                            )}
                        </div>

                    </div>
                )}

            </main>

        </div>
    );
}