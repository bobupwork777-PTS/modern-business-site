"use client";

import Link from "next/link";
import { useAuth } from "./AuthProvider";

export default function Navbar() {
    const { user, loading, setUser } = useAuth();
    const isAdmin = user?.role?.toLowerCase() === "admin";

    const logout = () => {
        localStorage.removeItem("user");
        document.cookie = "token=; path=/; max-age=0";
        document.cookie = "role=; path=/; max-age=0";
        setUser(null);
        window.location.href = "/login";
    };

    if (loading) return null;

    return (
        <header className="absolute top-0 left-0 w-full z-50">
            <nav className="max-w-7xl mx-auto flex items-center justify-between px-6 py-6">

                <Link href="/" className="text-2xl font-bold text-white">
                    Phoenix<span className="text-blue-400">.</span>
                </Link>

                <div className="hidden md:flex items-center gap-8 text-white/80">
                    <Link href="/" className="hover:text-white transition">Home</Link>
                    {/* <Link href="/#services" className="hover:text-white transition">Services</Link>
                    <Link href="/#process" className="hover:text-white transition">Process</Link> */}

                    {isAdmin && (
                        <Link href="/dashboard" className="hover:text-blue-400 transition">
                            Dashboard
                        </Link>
                    )}

                    {isAdmin && (
                        <div className="relative group">
                            <div className="flex items-center gap-1">
                                    Upwork
                                <span className="text-xs transition-transform group-hover:rotate-180">▼</span>
                            </div>

                            <div className="absolute left-0 top-full pt-3 opacity-0 invisible group-hover:opacity-100 group-hover:visible transition z-[100]">
                                <div className="w-48 rounded-xl border border-white/10 bg-[#111B48] shadow-2xl py-2">
                                    <Link href="/upwork-jobs" className="block px-4 py-2.5 text-sm hover:bg-blue-600 hover:text-white">
                                        Proposal Gen
                                    </Link>
                                    <Link href="/trend-analysis" className="block px-4 py-2.5 text-sm hover:bg-blue-600 hover:text-white">
                                        Trend Analysis
                                    </Link>
                                    <Link href="/queue-list" className="block px-4 py-2.5 text-sm hover:bg-blue-600 hover:text-white">
                                        Queue List
                                    </Link>
                                </div>
                            </div>
                        </div>
                    )}
                    {isAdmin && (
                        <div className="relative group">
                            <div className="flex items-center gap-1">
                                    Freelancer
                                <span className="text-xs transition-transform group-hover:rotate-180">▼</span>
                            </div>

                            <div className="absolute left-0 top-full pt-3 opacity-0 invisible group-hover:opacity-100 group-hover:visible transition z-[100]">
                                <div className="w-48 rounded-xl border border-white/10 bg-[#111B48] shadow-2xl py-2">
                                    <Link href="/upwork-jobs" className="block px-4 py-2.5 text-sm hover:bg-blue-600 hover:text-white">
                                        Proposal Gen
                                    </Link>
                                    <Link href="/trend-analysis" className="block px-4 py-2.5 text-sm hover:bg-blue-600 hover:text-white">
                                        Trend Analysis
                                    </Link>
                                    <Link href="/queue-list" className="block px-4 py-2.5 text-sm hover:bg-blue-600 hover:text-white">
                                        Queue List
                                    </Link>
                                </div>
                            </div>
                        </div>
                    )}

                    {/* <Link href="/#contact" className="hover:text-white transition">Contact</Link> */}
                </div>

                <div className="flex items-center gap-5">
                    {user ? (
                        <>
                            <Link href="/profile" className="text-white hover:text-blue-400 transition">
                                Hi {user.name}
                            </Link>
                            <button onClick={logout} className="text-white hover:text-red-400 transition">
                                Logout
                            </button>
                        </>
                    ) : (
                        <>
                            <Link href="/login" className="text-white hover:text-blue-400 transition">Login</Link>
                            <Link href="/signup" className="text-white hover:text-blue-400 transition">Signup</Link>
                        </>
                    )}

                    <Link href="/#contact" className="rounded-full bg-blue-600 px-6 py-3 text-white hover:bg-blue-700 transition">
                        Get Started
                    </Link>
                </div>

            </nav>
        </header>
    );
}