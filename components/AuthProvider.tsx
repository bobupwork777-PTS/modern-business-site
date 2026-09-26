"use client";

import { createContext, useContext, useEffect, useState } from "react";

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

export function AuthProvider({ children }: { children: React.ReactNode }) {
    const [user, setUser] = useState<User | null>(null);
    const [loading, setLoading] = useState(true);

    const formatUser = (data: any): User => ({
        _id: data._id || data.id,
        name: data.name,
        email: data.email,
        role: data.role,
    });

    useEffect(() => {
        const loadUser = () => {
            try {
                const storedUser = localStorage.getItem("user");
                console.log("LOCAL STORAGE USER:", storedUser);

                if (storedUser) {
                    setUser(formatUser(JSON.parse(storedUser)));
                } else {
                    const cookies = document.cookie.split("; ").reduce((acc: any, item) => {
                        const [key, value] = item.split("=");
                        acc[key] = value;
                        return acc;
                    }, {});

                    if (cookies.user) {
                        const cookieUser = JSON.parse(decodeURIComponent(cookies.user));
                        setUser(formatUser(cookieUser));
                    }
                }
            } catch (error) {
                console.log("Auth Error:", error);
                localStorage.removeItem("user");
                setUser(null);
            } finally {
                setLoading(false);
            }
        };

        loadUser();
    }, []);

    return (
        <AuthContext.Provider value={{ user, loading, setUser }}>
            {children}
        </AuthContext.Provider>
    );
}

export function useAuth(): AuthContextType {
    const context = useContext(AuthContext);
    if (!context) {
        throw new Error("useAuth must be used inside AuthProvider");
    }
    return context;
}