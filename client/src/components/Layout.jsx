import Sidebar from "./Sidebar";

/**
 * Layout — shared shell for authenticated pages.
 *
 * Renders the Sidebar + main content area.
 * Preserves all existing navigation and user flows.
 *
 * Props:
 *   - children: ReactNode — page content rendered inside <main>
 *   - title?: string — page heading
 *   - subtitle?: string — page subtitle
 */
export default function Layout({
    children,
    title,
    subtitle
}) {
    return (
        <div className="app">
            <Sidebar />

            <main className="content">
                {title && (
                    <>
                        <h1 className="page-title">
                            {title}
                        </h1>
                        {subtitle && (
                            <p className="page-subtitle">
                                {subtitle}
                            </p>
                        )}
                    </>
                )}

                {children}
            </main>
        </div>
    );
}
