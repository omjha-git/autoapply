import { Link } from "react-router-dom";

import {
    Show,
    UserButton
} from "@clerk/react";

export default function Landing() {
    return (
        <div className="landing">

            <nav className="navbar">

                <div className="navbar-brand">
                    AutoApply
                </div>

                <div>
                    <Show when="signed-out">
                        <Link
                            className="btn secondary"
                            to="/sign-in"
                        >
                            Sign In
                        </Link>

                        <Link
                            className="btn"
                            to="/sign-up"
                        >
                            Get Started
                        </Link>
                    </Show>

                    <Show when="signed-in">
                        <UserButton />
                    </Show>
                </div>

            </nav>

            <main className="hero">

                <div className="badge">
                    AI-Powered Job Application Platform
                </div>

                <h1>
                    Find jobs.
                    <br />
                    Apply smarter.
                </h1>

                <p>
                    Search internships and jobs across
                    multiple platforms, find the best
                    matches, and manage your applications
                    from one dashboard.
                </p>

                <div className="hero-actions">

                    <Show when="signed-out">
                        <Link
                            className="btn large"
                            to="/sign-up"
                        >
                            Start Applying
                        </Link>
                    </Show>

                    <Show when="signed-in">
                        <Link
                            className="btn large"
                            to="/dashboard"
                        >
                            Open Dashboard
                        </Link>
                    </Show>

                </div>

            </main>

        </div>
    );
}
