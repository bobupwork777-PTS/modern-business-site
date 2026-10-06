"use client";

import { useRef, useState } from "react";
import type { FormEvent } from "react";
import { useParams, useRouter } from "next/navigation";
import Link from "next/link";

export default function ResetPassword() {
    const params = useParams();
    const token = typeof params.token === "string" ? params.token : "";
    const router = useRouter();
    const [password, setPassword] = useState("");
    const [confirmPassword, setConfirmPassword] = useState("");
    const [loading, setLoading] = useState(false);
    const [error, setError] = useState("");
    const [success, setSuccess] = useState(false);
    const submitting = useRef(false);

    const reset = async (event: FormEvent<HTMLFormElement>) => {
        event.preventDefault();
        if (submitting.current || success) return;
        setError("");

        if (!token) {
            setError("Invalid reset link. Request a new link.");
            return;
        }
        if (password.length < 8 || new TextEncoder().encode(password).length > 72) {
            setError("Password must contain at least 8 characters and be at most 72 bytes.");
            return;
        }
        if (password !== confirmPassword) {
            setError("Passwords do not match.");
            return;
        }

        submitting.current = true;
        setLoading(true);
        try {
            const response = await fetch("/api/reset-password", {
                method: "POST",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify({ token, password }),
            });
            const data = await response.json().catch(() => null);
            if (!response.ok) {
                setError(typeof data?.error === "string" ? data.error : "Password reset failed. Please try again.");
                return;
            }
            setSuccess(true);
            setPassword("");
            setConfirmPassword("");
            router.replace("/login");
        } catch {
            setError("Unable to connect. Check your connection and try again.");
        } finally {
            submitting.current = false;
            setLoading(false);
        }
    };

    const disabled = loading || success || !token;
    const inputClass = "mt-2 w-full rounded-xl border border-gray-300 px-4 py-3 text-gray-900 outline-none focus:border-blue-600 focus:ring-2 focus:ring-blue-100 disabled:opacity-60";

    return (
        <main className="flex min-h-screen items-center justify-center bg-[#0D163F] px-5 py-10">
            <section className="w-full max-w-md rounded-3xl bg-white p-7 shadow-2xl sm:p-9">
                <h1 className="text-center text-3xl font-bold text-gray-900">Reset password</h1>
                <p className="mb-7 mt-2 text-center text-sm text-gray-500">Choose a new password for your account.</p>

                {!token && <p role="alert" className="mb-5 rounded-xl bg-red-50 p-3 text-sm text-red-700">Invalid reset link. Request a new link below.</p>}

                <form onSubmit={reset} className="space-y-5" aria-busy={loading}>
                    <div>
                        <label htmlFor="password" className="text-sm font-medium text-gray-700">New password</label>
                        <input id="password" type="password" autoComplete="new-password" required minLength={8}
                            value={password} disabled={disabled} aria-describedby="password-help"
                            onChange={event => { setPassword(event.target.value); setError(""); }}
                            placeholder="Enter new password" className={inputClass} />
                        <p id="password-help" className="mt-2 text-xs text-gray-500">Use at least 8 characters.</p>
                    </div>
                    <div>
                        <label htmlFor="confirm-password" className="text-sm font-medium text-gray-700">Confirm password</label>
                        <input id="confirm-password" type="password" autoComplete="new-password" required minLength={8}
                            value={confirmPassword} disabled={disabled}
                            onChange={event => { setConfirmPassword(event.target.value); setError(""); }}
                            placeholder="Re-enter new password" className={inputClass} />
                    </div>

                    {error && <p role="alert" className="rounded-xl bg-red-50 p-3 text-sm text-red-700">{error}</p>}
                    {success && <p role="status" className="rounded-xl bg-green-50 p-3 text-sm text-green-700">Password updated. Redirecting to login...</p>}

                    <button type="submit" disabled={disabled}
                        className="w-full rounded-xl bg-blue-600 py-3 font-semibold text-white hover:bg-blue-700 disabled:cursor-not-allowed disabled:opacity-60">
                        {success ? "Password updated" : loading ? "Updating..." : "Update password"}
                    </button>
                </form>

                <div className="mt-6 flex flex-wrap justify-between gap-3 text-sm">
                    <Link href="/login" className="font-medium text-blue-600 hover:underline">Back to login</Link>
                    <Link href="/forgot-password" className="font-medium text-blue-600 hover:underline">Request new link</Link>
                </div>
            </section>
        </main>
    );
}
