import {
    NavLink
} from "react-router-dom";

import {
    LayoutDashboard,
    Search,
    FileText,
    User
} from "lucide-react";

/**
 * Sidebar — vertical navigation for the main layout.
 *
 * Props (optional):
 *   - collapsed: boolean — when true, shows icons only
 */
export default function Sidebar({
    collapsed = false
}) {
    const links = [
        {
            to: "/dashboard",
            label: "Dashboard",
            icon: <LayoutDashboard size={18} />
        },
        {
            to: "/jobs",
            label: "Find Jobs",
            icon: <Search size={18} />
        },
        {
            to: "/applications",
            label: "Applications",
            icon: <FileText size={18} />
        },
        {
            to: "/profile",
            label: "My Profile",
            icon: <User size={18} />
        }
    ];

    return (
        <aside
            className={
                "sidebar " +
                (collapsed ? "collapsed" : "")
            }
        >
            <h2>
                {collapsed
                    ? "AA"
                    : "AutoApply"}
            </h2>

            {links.map((link) => (
                <NavLink
                    key={link.to}
                    to={link.to}
                    className={({ isActive }) =>
                        isActive
                            ? "sidebar-link active"
                            : "sidebar-link"
                    }
                    title={link.label}
                >
                    <span className="sidebar-icon">
                        {link.icon}
                    </span>
                    {!collapsed && (
                        <span>{link.label}</span>
                    )}
                </NavLink>
            ))}
        </aside>
    );
}


