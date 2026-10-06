"use client";

import { useRef, useState } from "react";
import type { ChangeEvent, FormEvent } from "react";
import Link from "next/link";

export default function Login() {
    const [form, setForm] = useState({ email: "", password: "" });
    const [loading, setLoading] = useState(false);
    const [error, setError] = useState("");
    const [redirecting, setRedirecting] = useState(false);
    const submitting = useRef(false);

    const handleChange = (event: ChangeEvent<HTMLInputElement>) => {
        const { name, value } = event.target;
        setForm(previous => ({ ...previous, [name]: value }));
        setError("");
    };

    const login = async (event: FormEvent<HTMLFormElement>) => {
        event.preventDefault();
        if (submitting.current || redirecting) return;

        const email = form.email.trim().toLowerCase();
        if (!email || !form.password) {
            setError("Enter your email and password.");
            return;
        }

        submitting.current = true;
        setLoading(true);
        setError("");
        let navigating = false;

        try {
            const response = await fetch("/api/login", {
                method: "POST",
                headers: { "Content-Type": "application/json" },
                credentials: "same-origin",
                body: JSON.stringify({ email, password: form.password }),
            });

            const data = await response.json().catch(() => null);
            if (!response.ok) {
                setError(
                    typeof data?.error === "string" ? data.error :
                    typeof data?.message === "string" ? data.message :
                    "Unable to log in. Please try again."
                );
                return;
            }

            const user = data?.user;
            const id = user?.id ?? user?._id;
            if (!user || typeof id !== "string" || !id) {
                setError("The server returned an invalid user. Please try again.");
                return;
            }
            if (user.active === false) {
                setError("Your account is inactive. Please contact the administrator.");
                return;
            }

            // Confirm the browser received a valid MongoDB session cookie.
            const sessionResponse = await fetch("/api/login", {
                method: "GET",
                credentials: "same-origin",
                cache: "no-store",
            });
            const sessionData = await sessionResponse.json().catch(() => null);
            if (!sessionResponse.ok || sessionData?.user?.id !== id) {
                setError("Unable to verify your session. Please try again or allow cookies for this site.");
                return;
            }

            // Cache public profile fields only. Authentication must use the
            // HttpOnly session cookie created and verified by /api/login.
            const profile = {
                id,
                _id: id,
                name: user.name,
                email: user.email,
                phone: user.phone,
                dob: user.dob,
                address: user.address,
                state: user.state,
                pin: user.pin,
                gender: user.gender,
                role: sessionData.user.role,
                active: sessionData.user.active,
            };
            try {
                localStorage.setItem("user", JSON.stringify(profile));
            } catch {
                setError("Allow browser storage to continue, then try again.");
                return;
            }

            navigating = true;
            setRedirecting(true);
            window.location.replace("/");
        } catch {
            setError("Unable to connect. Check your connection and try again.");
        } finally {
            if (!navigating) {
                submitting.current = false;
                setLoading(false);
            }
        }
    };

    const inputClass = "mt-2 w-full rounded-xl border border-gray-300 bg-white px-4 py-3 text-gray-900 outline-none transition focus:border-blue-600 focus:ring-2 focus:ring-blue-100 disabled:opacity-60";

    return (
        <main className="flex min-h-screen items-center justify-center bg-[#0D163F] px-5 py-10">
            <section className="w-full max-w-md rounded-3xl bg-white p-7 shadow-2xl sm:p-9">
                <div className="mb-7 text-center">
                    <h1 className="text-3xl font-bold text-gray-900">Welcome back</h1>
                    <p className="mt-2 text-sm text-gray-500">Sign in to access your account.</p>
                </div>

                <form onSubmit={login} className="space-y-5" aria-busy={loading}>
                    <div>
                        <label htmlFor="email" className="text-sm font-medium text-gray-700">Email address</label>
                        <input id="email" name="email" type="email" autoComplete="username"
                            required value={form.email} onChange={handleChange} disabled={loading}
                            placeholder="you@example.com" className={inputClass} />
                    </div>
                    <div>
                        <label htmlFor="password" className="text-sm font-medium text-gray-700">Password</label>
                        <input id="password" name="password" type="password" autoComplete="current-password"
                            required value={form.password} onChange={handleChange} disabled={loading}
                            placeholder="Enter your password" className={inputClass} />
                    </div>

                    {error && <p role="alert" className="rounded-xl bg-red-50 p-3 text-sm text-red-700">{error}</p>}

                    <button type="submit" disabled={loading}
                        className="w-full rounded-xl bg-blue-600 py-3 font-semibold text-white transition hover:bg-blue-700 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-blue-600 disabled:cursor-not-allowed disabled:opacity-60">
                        {redirecting ? "Opening dashboard..." : loading ? "Logging in..." : "Login"}
                    </button>
                </form>

                <div className="mt-6 flex flex-wrap justify-between gap-3 text-sm">
                    <Link href="/forgot-password" className="font-medium text-blue-600 hover:underline">Forgot password?</Link>
                    <Link href="/signup" className="font-medium text-blue-600 hover:underline">Create account</Link>
                </div>
            </section>
        </main>
    );
}
