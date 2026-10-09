"use client";

import Link from "next/link";
import { useEffect, useState } from "react";
import { useAuth } from "./AuthProvider";
import JobAutoScheduler from "./JobAutoScheduler";

type PermissionPage = {
    _id: string;
    name: string;
    path: string;
    group?: string;
};

export default function Navbar() {
    const { user, loading, setUser } = useAuth();
    const [pages, setPages] = useState<PermissionPage[]>([]);

    const userId = user?._id;

    useEffect(() => {
        const controller = new AbortController();

        setPages([]);

        if (!userId) return;

        async function getPermissions() {
            try {
                const response = await fetch("/api/my-permissions", {
                    method: "POST",
                    headers: {
                        "Content-Type": "application/json",
                    },
                    body: JSON.stringify({ userId }),
                    signal: controller.signal,
                });

                if (!response.ok) {
                    throw new Error(
                        `Unable to load permissions (${response.status}).`
                    );
                }

                const data = await response.json();

                if (!controller.signal.aborted) {
                    setPages(
                        Array.isArray(data.pages) ? data.pages : []
                    );
                }
            } catch (error) {
                if (!controller.signal.aborted) {
                    console.error("Permission Error:", error);
                }
            }
        }

        void getPermissions();

        return () => {
            controller.abort();
        };
    }, [userId]);

    const logout = () => {
        localStorage.removeItem("user");
        document.cookie = "token=; path=/; max-age=0";
        setUser(null);
        window.location.href = "/login";
    };

    if (loading) return null;

    const groupedPages = pages.reduce<
        Record<string, PermissionPage[]>
    >((groups, page) => {
        if (!page?.group || page.group === "Main") {
            return groups;
        }

        if (!groups[page.group]) {
            groups[page.group] = [];
        }

        groups[page.group].push(page);

        return groups;
    }, {});

    const renderMenu = () =>
        Object.entries(groupedPages).map(([group, items]) => (
            <div
                key={group}
                className="group relative flex items-center"
            >
                {items.length > 1 ? (
                    <>
                        <button
                            type="button"
                            className="flex items-center gap-1 text-sm font-semibold"
                        >
                            <span>{group}</span>
                            <span className="relative top-[1px] text-[10px] leading-none">
                                ▼
                            </span>
                        </button>

                        <div className="absolute left-0 top-full hidden pt-3 group-hover:block group-focus-within:block">
                            <div className="w-52 overflow-hidden rounded-xl bg-[#111B48] py-2 shadow-xl">
                                {items.map((page) => (
                                    <Link
                                        key={page._id}
                                        href={page.path}
                                        className="block px-4 py-2 text-sm text-white transition hover:bg-blue-600 focus:bg-blue-600"
                                    >
                                        {page.name}
                                    </Link>
                                ))}
                            </div>
                        </div>
                    </>
                ) : (
                    <Link
                        href={items[0].path}
                        className="text-sm font-semibold"
                    >
                        {items[0].name}
                    </Link>
                )}
            </div>
        ));

    return (
        <header className="absolute top-0 z-50 w-full">
            <nav className="mx-auto flex max-w-7xl flex-wrap items-center justify-between gap-3 px-5 py-5">
                {/* Logo and navigation */}
                <div className="flex items-center gap-10">
                    <Link
                        href="/"
                        className="text-2xl font-bold text-white"
                    >
                        Phoenix
                        <span className="text-blue-400">.</span>
                    </Link>

                    <div className="hidden items-center gap-8 text-white md:flex">
                        <Link
                            href="/"
                            className="text-sm font-semibold"
                        >
                            Home
                        </Link>

                        {renderMenu()}
                    </div>
                </div>

                {/* User controls and notification toggle */}
                <div className="ml-auto flex items-center gap-3 text-white md:gap-5">
                    {user ? (
                        <>
                            <Link
                                href="/profile"
                                className="hidden text-sm font-semibold md:block"
                            >
                                Hi {user.name}
                            </Link>

                            <button
                                type="button"
                                onClick={logout}
                                className="text-sm font-semibold"
                            >
                                Logout
                            </button>

                            {user && (
                                <div className="relative flex shrink-0 items-center border-l border-white/25 pl-3 md:pl-5">
                                    <JobAutoScheduler
                                        key={user._id}
                                        userId={user._id}
                                    />
                                </div>
                            )}
                        </>
                    ) : (
                        <>
                            <Link
                                href="/login"
                                className="text-sm font-semibold"
                            >
                                Login
                            </Link>

                            <Link
                                href="/signup"
                                className="text-sm font-semibold"
                            >
                                Signup
                            </Link>
                        </>
                    )}
                </div>
            </nav>
        </header>
    );
}