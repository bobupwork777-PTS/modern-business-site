"use client";
import { useEffect, useRef, useState, type ChangeEvent, type FormEvent } from "react";
import { useRouter } from "next/navigation";
type EditableProfile = {
    name: string;
    email: string;
    phone: string;
    dob: string;
    address: string;
    state: string;
    pin: string;
    gender: string;
};
type UserProfile = Partial<EditableProfile> & {
    id?: string;
    _id?: string;
    role?: string;
    profileImage?: string;
};
const emptyForm: EditableProfile = {
    name: "", email: "", phone: "", dob: "",
    address: "", state: "", pin: "", gender: "",
};
const fields: { key: keyof EditableProfile; label: string; type?: string }[] = [
    { key: "name", label: "Name" },
    { key: "email", label: "Email", type: "email" },
    { key: "phone", label: "Phone", type: "tel" },
    { key: "dob", label: "DOB", type: "date" },
    { key: "address", label: "Address" },
    { key: "state", label: "State" },
    { key: "pin", label: "PIN" },
    { key: "gender", label: "Gender" },
];
const autocomplete: Record<keyof EditableProfile, string> = {
    name: "name", email: "email", phone: "tel", dob: "bday",
    address: "street-address", state: "address-level1", pin: "postal-code", gender: "sex",
};

function toForm(profile: UserProfile): EditableProfile {
    return Object.fromEntries(
        fields.map(({ key }) => [key, String(profile[key] ?? "")])
    ) as EditableProfile;
}
function readProfile(data: any): UserProfile {
    const profile = data?.user ?? data?.profile ?? data;
    if (!profile || typeof profile !== "object" || Array.isArray(profile) ||
        (!profile.id && !profile._id && typeof profile.name !== "string")) {
        throw new Error("The server returned an invalid profile.");
    }
    return profile;
}
export default function Profile() {
    const router = useRouter();
    const [user, setUser] = useState<UserProfile | null>(null);
    const [form, setForm] = useState<EditableProfile>(emptyForm);
    const [editing, setEditing] = useState(false);
    const [saving, setSaving] = useState(false);
    const [error, setError] = useState("");
    const [message, setMessage] = useState("");
    const [reloadKey, setReloadKey] = useState(0);
    const [photo, setPhoto] = useState("");
    const [imageLoading, setImageLoading] = useState(false);
    const imageReader = useRef<FileReader | null>(null);

    useEffect(() => () => imageReader.current?.abort(), []);

    function choosePhoto(event: ChangeEvent<HTMLInputElement>) {
        const file = event.target.files?.[0];
        event.target.value = "";
        if (!file) return;
        setError("");
        if (!["image/jpeg", "image/png", "image/webp"].includes(file.type)) {
            setError("Choose a JPG, PNG, or WebP image.");
            return;
        }
        if (file.size > 1024 * 1024) {
            setError("Your photo must be 1 MB or smaller.");
            return;
        }
        imageReader.current?.abort();
        const reader = new FileReader();
        imageReader.current = reader;
        setImageLoading(true);
        reader.onload = () => {
            if (imageReader.current !== reader) return;
            setPhoto(typeof reader.result === "string" ? reader.result : "");
            setImageLoading(false);
        };
        reader.onerror = () => {
            if (imageReader.current !== reader) return;
            setError("Unable to read that image. Please try another photo.");
            setImageLoading(false);
        };
        reader.readAsDataURL(file);
    }
    useEffect(() => {
        setError("");
        const controller = new AbortController();
        async function getProfile() {
            try {
                const stored = localStorage.getItem("user");
                let localUser: UserProfile | null = null;
                try { localUser = stored ? JSON.parse(stored) : null; }
                catch { localStorage.removeItem("user"); }
                const id = localUser?.id || localUser?._id;
                if (!id) { router.replace("/login"); return; }
                const res = await fetch(`/api/profile/${encodeURIComponent(id)}`, {
                    cache: "no-store", signal: controller.signal,
                });
                if (res.status === 401) {
                    localStorage.removeItem("user");
                    router.replace("/login");
                    return;
                }
                const data = await res.json();
                if (!res.ok || data?.success === false || data?.error) {
                    throw new Error(data?.error || data?.message || "Unable to load profile.");
                }
                const profile = { ...readProfile(data), id };
                if (controller.signal.aborted) return;
                setUser(profile);
                setForm(toForm(profile));
                try { localStorage.setItem("user", JSON.stringify(profile)); } catch { /* The server profile is already loaded. */ }
            } catch (err) {
                if (!controller.signal.aborted) {
                    setError(err instanceof Error ? err.message : "Unable to load profile.");
                }
            }
        }
        void getProfile();
        return () => controller.abort();
    }, [router, reloadKey]);
    function startEditing() {
        if (!user) return;
        const values = toForm(user);
        // A date input requires YYYY-MM-DD rather than a full ISO timestamp.
        values.dob = /^\d{4}-\d{2}-\d{2}/.test(values.dob) ? values.dob.slice(0, 10) : "";
        setForm(values);
        setPhoto(user.profileImage || "");
        setError("");
        setMessage("");
        setEditing(true);
    }
    async function saveProfile(event: FormEvent<HTMLFormElement>) {
        event.preventDefault();
        if (!user || saving || imageLoading) return;
        const id = user.id || user._id;
        if (!id) { setError("Missing profile ID. Please log in again."); return; }
        setSaving(true);
        setError("");
        setMessage("");
        try {
            // Explicit editable-field allowlist. Role and ID are never submitted.
            const payload = Object.fromEntries(
                fields.map(({ key }) => [key, form[key].trim()])
            ) as EditableProfile;
            if (!payload.name || !payload.email) {
                throw new Error("Please enter your name and email.");
            }
            const res = await fetch(`/api/profile/${encodeURIComponent(id)}`, {
                method: "PUT",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify({ ...payload, profileImage: photo }),
            });
            if (res.status === 401) {
                localStorage.removeItem("user");
                router.replace("/login");
                return;
            }
            const text = await res.text();
            let data: any = null;
            if (text) {
                try { data = JSON.parse(text); }
                catch { throw new Error("The update API returned an invalid response."); }
            }
            if (!res.ok || data?.success === false || data?.error) {
                throw new Error(data?.error || data?.message || "Unable to save profile.");
            }
            const returned = data?.user ?? data?.profile ?? data;
            const updated: UserProfile = { ...user, ...payload, profileImage: photo };
            // Respect server-normalized values, preserving the existing role and ID.
            if (returned && typeof returned === "object") {
                if (typeof returned.profileImage === "string") updated.profileImage = returned.profileImage;
                fields.forEach(({ key }) => {
                    if (typeof returned[key] === "string") updated[key] = returned[key];
                });
            }
            setUser(updated);
            setForm(toForm(updated));
            setEditing(false);
            setMessage("Profile updated successfully.");
            try { localStorage.setItem("user", JSON.stringify(updated)); }
            catch { setMessage("Profile saved. Your browser could not refresh its cached profile."); }
        } catch (err) {
            setError(err instanceof Error ? err.message : "Unable to save profile.");
        } finally {
            setSaving(false);
        }
    }
    function logout() {
        localStorage.removeItem("user");
        router.replace("/login");
    }
    const inputClass = "w-full min-w-0 rounded-xl border border-slate-200 bg-white px-3.5 py-3 text-sm text-slate-900 outline-none transition focus:border-blue-500 focus:ring-4 focus:ring-blue-50 disabled:bg-slate-50 disabled:opacity-60";
    const buttonClass = "inline-flex items-center justify-center gap-2 rounded-xl px-5 py-3 text-sm font-semibold transition focus-visible:outline-none focus-visible:ring-4 focus-visible:ring-blue-200 disabled:cursor-not-allowed disabled:opacity-50";

    function displayValue(key: keyof EditableProfile) {
        const value = user?.[key];
        if (!value) return "Not provided";
        if (key === "dob") {
            const match = String(value).match(/^\d{4}-\d{2}-\d{2}/);
            if (match) {
                const date = new Date(`${match[0]}T00:00:00`);
                if (!Number.isNaN(date.getTime())) {
                    return date.toLocaleDateString("en-GB", { day: "numeric", month: "short", year: "numeric" });
                }
            }
        }
        return String(value);
    }

    if (!user) {
        return (
            <main className="flex min-h-screen items-center justify-center bg-[#0D163F] px-5">
                <div className="w-full max-w-sm rounded-3xl border border-white/10 bg-white/5 p-8 text-center text-white">
                    {error ? <>
                        <h1 className="text-lg font-semibold">Unable to load your profile</h1>
                        <p role="alert" className="mt-3 text-sm text-red-200">{error}</p>
                        <button type="button" onClick={() => setReloadKey(key => key + 1)} className={`${buttonClass} mt-6 bg-blue-600 text-white hover:bg-blue-500`}>Try again</button>
                    </> : <>
                        <div aria-hidden="true" className="mx-auto h-9 w-9 animate-spin rounded-full border-2 border-white/20 border-t-blue-400 motion-reduce:animate-none" />
                        <p role="status" className="mt-4 text-sm text-slate-200">Loading your profile...</p>
                    </>}
                </div>
            </main>
        );
    }

    const initials = (user.name || "User").trim().split(/\s+/).filter(Boolean).slice(0, 2).map(part => part[0]).join("").toUpperCase();

    return (
        <main className="flex min-h-screen items-center justify-center bg-[#0D163F] px-4 py-8 sm:px-6 sm:py-12 lg:py-16">
            <div className="w-full max-w-5xl">
                <header className="mb-7 flex flex-wrap items-end justify-between gap-4">
                    <div>
                        <p className="text-xs font-semibold uppercase tracking-[0.2em] text-blue-300">Your account</p>
                        <h1 className="mt-2 text-3xl font-semibold tracking-tight text-white sm:text-4xl">My profile</h1>
                        <p className="mt-2 text-sm text-slate-300">Keep your personal and contact details up to date.</p>
                    </div>
                    <span className="rounded-full border border-white/15 bg-white/5 px-4 py-2 text-xs font-medium text-slate-200">Account settings</span>
                </header>

                <div className="overflow-hidden rounded-3xl bg-white shadow-2xl shadow-black/20 lg:grid lg:grid-cols-[280px_1fr]">
                    <aside className="flex flex-col border-b border-slate-200 bg-slate-50 p-6 sm:p-8 lg:border-b-0 lg:border-r">
                        <div className="flex items-center gap-4 lg:flex-col lg:items-start">
                            <div className="flex h-24 w-24 shrink-0 items-center justify-center overflow-hidden rounded-2xl bg-[#0D163F] text-2xl font-semibold text-white shadow-lg shadow-blue-900/15">
                                {(editing ? photo : user.profileImage) ? <img src={editing ? photo : user.profileImage} alt={`${user.name || "User"}'s profile photo`} className="h-full w-full object-cover" /> : initials || "U"}
                            </div>
                            <div className="min-w-0">
                                <h2 className="break-words text-xl font-semibold text-slate-900">{user.name || "Your profile"}</h2>
                                <p className="mt-1 break-all text-sm text-slate-500">{user.email || "No email provided"}</p>
                            </div>
                        </div>
                        <div className="mt-7 rounded-2xl border border-slate-200 bg-white p-4">
                            <div className="flex items-center justify-between gap-2">
                                <p className="text-xs font-semibold uppercase tracking-wider text-slate-500">Account role</p>
                                <Icon name="lock" className="h-4 w-4 text-slate-400" />
                            </div>
                            <span className="mt-3 inline-flex max-w-full break-all rounded-lg bg-blue-50 px-3 py-1.5 text-sm font-semibold text-blue-700">{user.role || "Not assigned"}</span>
                            <p className="mt-3 text-xs leading-5 text-slate-500">Your role is managed by your administrator.</p>
                        </div>
                        <button type="button" onClick={logout} disabled={saving || imageLoading} className={`${buttonClass} mt-6 w-full border border-red-100 bg-white text-red-600 hover:border-red-200 hover:bg-red-50 lg:mt-auto lg:translate-y-2`}>
                            <Icon name="logout" className="h-4 w-4" />Log out
                        </button>
                    </aside>

                    <section className="min-w-0 p-6 sm:p-8" aria-labelledby="details-heading">
                        <div className="flex flex-wrap items-start justify-between gap-4 border-b border-slate-100 pb-6">
                            <div>
                                <h2 id="details-heading" className="text-xl font-semibold text-slate-900">Personal details</h2>
                                <p className="mt-1 text-sm text-slate-500">{editing ? "Update your details and save your changes." : "Your profile and contact information."}</p>
                            </div>
                            {editing && <div className="mt-5">
                            <label htmlFor="profile-photo" className="mb-2 block text-xs font-semibold uppercase tracking-wider text-slate-500">Profile photo</label>
                            <input id="profile-photo" type="file" accept="image/jpeg,image/png,image/webp" onChange={choosePhoto} disabled={saving || imageLoading}
                                className="block w-full text-xs text-slate-500 file:mr-2 file:rounded-lg file:border-0 file:bg-blue-50 file:px-3 file:py-2 file:font-semibold file:text-blue-700 hover:file:bg-blue-100 disabled:opacity-50" />
                            <p className="mt-2 text-xs text-slate-400">{imageLoading ? "Reading photo..." : "JPG, PNG, or WebP. Maximum 1 MB."}</p>
                            {photo && <button type="button" onClick={() => setPhoto("")} disabled={saving || imageLoading} className="mt-3 text-xs font-medium text-red-600 hover:text-red-700 disabled:opacity-50">Remove photo</button>}
                        </div>}
                            {!editing && <button type="button" onClick={startEditing} className={`${buttonClass} bg-blue-600 text-white hover:bg-blue-700`}>
                                <Icon name="edit" className="h-4 w-4" />Edit profile
                            </button>}
                        </div>

                        {error && <p role="alert" className="mt-5 rounded-xl border border-red-100 bg-red-50 px-4 py-3 text-sm text-red-700">{error}</p>}
                        {message && <p role="status" className="mt-5 rounded-xl border border-emerald-100 bg-emerald-50 px-4 py-3 text-sm text-emerald-700">{message}</p>}

                        <form onSubmit={saveProfile} aria-busy={saving}>
                            <div className="grid grid-cols-1 gap-x-6 gap-y-6 py-7 sm:grid-cols-2">
                                {fields.map(({ key, label, type }) => (
                                    <div key={key} className={key === "address" ? "sm:col-span-2" : ""}>
                                        {editing ? <>
                                            <label htmlFor={`profile-${key}`} className="mb-2 block text-xs font-semibold uppercase tracking-wider text-slate-500">{label}{(key === "name" || key === "email") && <span className="ml-1 text-blue-600">*</span>}</label>
                                            {key === "address" ? <textarea
                                                id={`profile-${key}`} name={key} value={form[key]} disabled={saving || imageLoading} rows={3} autoComplete="street-address"
                                                onChange={e => setForm(current => ({ ...current, [key]: e.target.value }))}
                                                className={`${inputClass} resize-y`} placeholder="Enter your address"
                                            /> : <input
                                                id={`profile-${key}`} name={key} type={type || "text"} value={form[key]} disabled={saving || imageLoading}
                                                required={key === "name" || key === "email"}
                                                autoComplete={autocomplete[key]}
                                                onChange={e => setForm(current => ({ ...current, [key]: e.target.value }))}
                                                className={inputClass} placeholder={`Enter ${label.toLowerCase()}`}
                                            />}
                                        </> : <>
                                            <p className="text-xs font-semibold uppercase tracking-wider text-slate-400">{label}</p>
                                            <p className={`mt-2 whitespace-pre-wrap break-words text-sm leading-6 ${user[key] ? "font-medium text-slate-900" : "text-slate-400"}`}>{displayValue(key)}</p>
                                        </>}
                                    </div>
                                ))}
                            </div>
                            <div className="flex flex-wrap items-center justify-between gap-4 border-t border-slate-100 pt-5">
                                {editing && <div className="flex w-full gap-3 sm:w-auto">
                                    <button type="button" disabled={saving || imageLoading} onClick={() => { setForm(toForm(user)); setPhoto(user.profileImage || ""); setEditing(false); setError(""); }} className={`${buttonClass} flex-1 border border-slate-200 text-slate-600 hover:bg-slate-50 sm:flex-none`}>Cancel</button>
                                    <button type="submit" disabled={saving || imageLoading} className={`${buttonClass} flex-1 bg-blue-600 text-white hover:bg-blue-700 sm:flex-none`}>{saving ? "Saving..." : "Save changes"}</button>
                                </div>}
                            </div>
                        </form>
                    </section>
                </div>
            </div>
        </main>
    );
}

function Icon({ name, className }: { name: "lock" | "edit" | "logout"; className?: string }) {
    const paths = {
        lock: "M7 11V7a5 5 0 0 1 10 0v4M5 11h14v10H5zM12 15v2",
        edit: "m15 5 4 4M4 20l4-1L20 7a2.8 2.8 0 0 0-4-4L4 15z",
        logout: "M9 4H4v16h5M14 8l4 4-4 4M8 12h11",
    };
    return <svg aria-hidden="true" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.7" strokeLinecap="round" strokeLinejoin="round" className={className}><path d={paths[name]} /></svg>;
}
