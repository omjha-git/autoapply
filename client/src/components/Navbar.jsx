import {
    Link,
    NavLink
} from "react-router-dom";

import {
    UserButton
} from "@clerk/react";

import {
    LayoutDashboard,
    Search,
    FileText,
    User
} from "lucide-react";

/**
 * Navbar — top navigation bar.
 *
 * Displays the app logo, primary nav links,
 * and the Clerk user button. Uses NavLink
 * for active-link highlighting.
 */
export default function Navbar() {
    const links = [
        { to: "/dashboard", label: "Dashboard", icon: <LayoutDashboard size={16} /> },
        { to: "/jobs", label: "Find Jobs", icon: <Search size={16} /> },
        { to: "/applications", label: "Applications", icon: <FileText size={16} /> },
        { to: "/profile", label: "My Profile", icon: <User size={16} /> }
    ];

    return (
        <nav className="navbar">
            <div className="navbar-brand">
                <Link to="/dashboard">
                    AutoApply
                </Link>
            </div>

            <div className="navbar-links">
                {links.map((link) => (
                    <NavLink
                        key={link.to}
                        to={link.to}
                        className={({ isActive }) =>
                            isActive
                                ? "nav-link active"
                                : "nav-link"
                        }
                    >
                        {link.icon}
                        {link.label}
                    </NavLink>
                ))}
            </div>

            <div className="navbar-user">
                <UserButton />
            </div>
        </nav>
    );
}


