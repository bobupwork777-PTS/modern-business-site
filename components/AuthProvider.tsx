"use client";

import { createContext, useCallback, useContext, useEffect, useRef, useState } from "react";
import type { ReactNode } from "react";

type User = {
    _id: string;
    name: string;
    email?: string;
    role: string;
};

type AuthContextType = {
    user: User | null;
    loading: boolean;
    setUser: (user: User | null) => void;
};

const AuthContext = createContext<AuthContextType | undefined>(undefined);

function formatUser(data: unknown): User | null {
    if (!data || typeof data !== "object") return null;
    const value = data as Record<string, unknown>;
    const id = value._id || value.id;
    if (typeof id !== "string" || !id || value.active === false) return null;
    return {
        _id: id,
        name: typeof value.name === "string" ? value.name : "",
        email: typeof value.email === "string" ? value.email : undefined,
        role: typeof value.role === "string" ? value.role : "user",
    };
}

function cacheUser(user: User | null) {
    try {
        if (user) localStorage.setItem("user", JSON.stringify(user));
        else localStorage.removeItem("user");
    } catch {
        // Authentication is determined by the server, not browser storage.
    }
}

export function AuthProvider({ children }: { children: ReactNode }) {
    const [user, updateUser] = useState<User | null>(null);
    const [loading, setLoading] = useState(true);
    const loadController = useRef<AbortController | null>(null);

    useEffect(() => {
        const controller = new AbortController();
        loadController.current = controller;

        const loadUser = async () => {
            try {
                const response = await fetch("/api/login", {
                    credentials: "same-origin",
                    cache: "no-store",
                    signal: controller.signal,
                });
                if (controller.signal.aborted) return;

                if (response.status === 401 || response.status === 403) {
                    updateUser(null);
                    cacheUser(null);
                    return;
                }
                if (!response.ok) throw new Error("Session check failed");

                const data = await response.json();
                if (controller.signal.aborted) return;
                const authenticatedUser = formatUser(data.user);
                updateUser(authenticatedUser);
                cacheUser(authenticatedUser);
            } catch {
                if (!controller.signal.aborted) {
                    updateUser(null);
                    console.error("Unable to load the current session");
                }
            } finally {
                if (!controller.signal.aborted) setLoading(false);
            }
        };

        void loadUser();
        return () => controller.abort();
    }, []);

    const setUser = useCallback((nextUser: User | null) => {
        // Prevent an older session request from restoring a logged-out user.
        loadController.current?.abort();
        const formatted = formatUser(nextUser);
        updateUser(formatted);
        cacheUser(formatted);
        setLoading(false);

        if (nextUser === null) {
            // Navbar navigates immediately after setUser(null). keepalive lets
            // the logout request continue while the browser changes pages.
            void fetch("/api/login", {
                method: "DELETE",
                credentials: "same-origin",
                keepalive: true,
            }).then(response => {
                if (!response.ok) console.error("Server logout failed");
            }).catch(() => console.error("Unable to revoke the session"));
        }
    }, []);

    return (
        <AuthContext.Provider value={{ user, loading, setUser }}>
            {children}
        </AuthContext.Provider>
    );
}

export function useAuth(): AuthContextType {
    const context = useContext(AuthContext);
    if (!context) throw new Error("useAuth must be used inside AuthProvider");
    return context;
}
