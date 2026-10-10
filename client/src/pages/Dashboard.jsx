import {
    Link
} from "react-router-dom";

import {
    UserButton
} from "@clerk/react";

export default function Dashboard() {
    return (
        <div className="app">

            <aside className="sidebar">

                <h2>
                    AutoApply
                </h2>

                <Link to="/dashboard">
                    Dashboard
                </Link>

                <Link to="/jobs">
                    Find Jobs
                </Link>

                <Link to="/profile">
                    My Profile
                </Link>

                <Link to="/applications">
                    Applications
                </Link>

            </aside>

            <main className="content">

                <header className="topbar">

                    <div>
                        <h1>
                            Dashboard
                        </h1>

                        <p>
                            Your job search command center.
                        </p>
                    </div>

                    <UserButton />

                </header>

                <section className="stats">

                    <div className="stat">
                        <span>
                            Jobs Found
                        </span>

                        <strong>
                            0
                        </strong>
                    </div>

                    <div className="stat">
                        <span>
                            Applications
                        </span>

                        <strong>
                            0
                        </strong>
                    </div>

                    <div className="stat">
                        <span>
                            Interviews
                        </span>

                        <strong>
                            0
                        </strong>
                    </div>

                    <div className="stat">
                        <span>
                            Profile
                        </span>

                        <strong>
                            0%
                        </strong>
                    </div>

                </section>

                <section className="panel">

                    <h2>
                        Find your next opportunity
                    </h2>

                    <p>
                        Search jobs across supported
                        job platforms and ATS systems.
                    </p>

                    <Link
                        className="btn"
                        to="/jobs"
                    >
                        Search Jobs
                    </Link>

                </section>

            </main>

        </div>
    );
}