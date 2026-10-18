import {
    useEffect,
    useState
} from "react";

import {
    Link
} from "react-router-dom";

import {
    getDashboardStats
} from "../services/api";

import Layout from "../components/Layout";
import StatCard from "../components/StatCard";

import {
    Briefcase,
    FileText,
    CalendarDays,
    TrendingUp
} from "lucide-react";

export default function Dashboard() {
    const [stats, setStats] = useState(null);
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState(null);

    useEffect(() => {
        const loadStats = async () => {
            try {
                const data = await getDashboardStats();
                setStats(data.stats);
            } catch (err) {
                console.error("Failed to load dashboard stats:", err);
                setError("Failed to load dashboard stats.");
            } finally {
                setLoading(false);
            }
        };

        loadStats();
    }, []);

    const statCards = [
        {
            label: "Jobs Found",
            value: stats?.jobsFound || 0,
            icon: <Briefcase size={18} />,
            trend: "neutral"
        },
        {
            label: "Applications",
            value: stats?.applications || 0,
            icon: <FileText size={18} />,
            trend: "neutral"
        },
        {
            label: "Interviews",
            value: stats?.interviews || 0,
            icon: <CalendarDays size={18} />,
            trend: "neutral"
        },
        {
            label: "Profile Strength",
            value: typeof stats?.profileStrength === "number"
                ? stats.profileStrength + "%"
                : "0%",
            icon: <TrendingUp size={18} />,
            trend: "neutral"
        }
    ];

        return (
        <Layout>
            <div className="page-header">
                <div>
                    <h1 className="page-title">
                        Welcome back
                    </h1>
                    <p className="page-subtitle">
                        Your job search command center.
                    </p>
                </div>

                <Link
                    className="btn"
                    to="/jobs"
                >
                    Search Jobs
                </Link>
            </div>

            <section className="stats">
                {loading ? (
                    <p className="loading-spinner">
                        Loading dashboard stats...
                    </p>
                ) : error ? (
                    <p className="error-msg">{error}</p>
                ) : (
                    statCards.map((stat) => (
                        <StatCard
                            key={stat.label}
                            label={stat.label}
                            value={stat.value}
                            icon={stat.icon}
                            trend={stat.trend}
                        />
                    ))
                )}
            </section>

            <section className="panel">
                <h2>Find your next opportunity</h2>

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
        </Layout>
    );
}