import {
    BrowserRouter,
    Routes,
    Route,
    Navigate
} from "react-router-dom";

import {
    Show,
    SignIn,
    SignUp,
    useAuth
} from "@clerk/react";

import { useEffect } from "react";

import { setTokenGetter } from "./services/api";

import Landing from "./pages/Landing";
import Dashboard from "./pages/Dashboard";
import Profile from "./pages/Profile";
import Jobs from "./pages/Jobs";
import Applications from "./pages/Applications";


function AuthTokenBridge() {
    const { getToken } = useAuth();

    useEffect(() => {
        setTokenGetter(getToken);

        return () => {
            setTokenGetter(null);
        };
    }, [getToken]);

    return null;
}


function ProtectedRoute({ children }) {
    return (
        <Show
            when="signed-in"
            fallback={<Navigate to="/sign-in" replace />}
        >
            {children}
        </Show>
    );
}


export default function App() {
    return (
        <BrowserRouter>

            <AuthTokenBridge />

            <Routes>

                <Route
                    path="/"
                    element={<Landing />}
                />

                <Route
                    path="/sign-in"
                    element={
                        <div className="auth-page">
                            <SignIn />
                        </div>
                    }
                />

                <Route
                    path="/sign-up"
                    element={
                        <div className="auth-page">
                            <SignUp />
                        </div>
                    }
                />

                <Route
                    path="/dashboard"
                    element={
                        <ProtectedRoute>
                            <Dashboard />
                        </ProtectedRoute>
                    }
                />

                <Route
                    path="/jobs"
                    element={
                        <ProtectedRoute>
                            <Jobs />
                        </ProtectedRoute>
                    }
                />

                <Route
                    path="/profile"
                    element={
                        <ProtectedRoute>
                            <Profile />
                        </ProtectedRoute>
                    }
                />

                <Route
                    path="/applications"
                    element={
                        <ProtectedRoute>
                            <Applications />
                        </ProtectedRoute>
                    }
                />

                <Route
                    path="*"
                    element={
                        <Navigate
                            to="/"
                            replace
                        />
                    }
                />

            </Routes>

        </BrowserRouter>
    );
}