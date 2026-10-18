import {
    TrendingUp,
    TrendingDown
} from "lucide-react";

/**
 * StatCard — reusable card that displays
 * a numeric stat with a label.
 *
 * Props:
 *   - label: string        — description text
 *   - value: string|number — value to display
 *   - icon?: string        — optional emoji/icon
 *   - trend?: "up"|"down"|"neutral"
 *   - trendValue?: string  — e.g. "+12%"
 */
export default function StatCard({
    label,
    value,
    icon,
    trend,
    trendValue
}) {
    const trendColors = {
        up: "#10b981",
        down: "#ef4444",
        neutral: "#6b7280"
    };

    const trendColor =
        trendColors[trend] ||
        "#6b7280";

    return (
        <div className="stat-card">
            <div className="stat-card-header">
                {icon && (
                    <span className="stat-icon">
                        {icon}
                    </span>
                )}
                <span className="stat-label">
                    {label}
                </span>
            </div>

            <div className="stat-value">
                <strong>{value}</strong>
            </div>

            {trend && trendValue && (
                <div
                    className="stat-trend"
                    style={{ color: trendColor }}
                >
                    {trend === "up" &&
                        <TrendingUp size={14} />}
                    {trend === "down" &&
                        <TrendingDown size={14} />}
                    {trendValue}
                </div>
            )}
        </div>
    );
}

