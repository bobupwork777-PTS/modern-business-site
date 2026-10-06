"use client";
import { useCallback, useEffect, useRef, useState, type FormEvent } from "react";
import Navbar from "@/components/Navbar";
import Footer from "@/components/Footer";
type User = Partial<Omit<NewUser, "password">> & { _id: string; active?: boolean };
type EditProfile = NewUser;
type Page = { _id: string; name: string };
type Permission = { userId: string; pageId: string; access: boolean };
type NewUser = {
    name: string; email: string; phone: string; dob: string; address: string;
    state: string; pin: string; password: string; gender: string; role: "user" | "admin";
};
const emptyNewUser: NewUser = {
    name: "", email: "", phone: "", dob: "", address: "", state: "",
    pin: "", password: "", gender: "", role: "user",
};
const accountFields: { key: Exclude<keyof NewUser, "gender" | "role">; label: string; type: string; autocomplete: string }[] = [
    { key: "name", label: "Full Name", type: "text", autocomplete: "name" },
    { key: "email", label: "Email", type: "email", autocomplete: "email" },
    { key: "phone", label: "Phone Number", type: "tel", autocomplete: "tel" },
    { key: "dob", label: "Date of Birth", type: "date", autocomplete: "bday" },
    { key: "address", label: "Address", type: "text", autocomplete: "street-address" },
    { key: "state", label: "State", type: "text", autocomplete: "address-level1" },
    { key: "pin", label: "PIN Code", type: "text", autocomplete: "postal-code" },
    { key: "password", label: "Password", type: "password", autocomplete: "new-password" },
];
async function readResponse(res: Response) {
    const text = await res.text();
    let data: any = {};
    if (text) {
        try { data = JSON.parse(text); }
        catch { throw new Error(`Invalid API response (${res.status}).`); }
    }
    if (!res.ok || data?.success === false || data?.error) {
        throw new Error(data?.error || data?.message || `Request failed (${res.status}).`);
    }
    return data;
}
export default function UserPage() {
    const [users, setUsers] = useState<User[]>([]);
    const [pages, setPages] = useState<Page[]>([]);
    const [permissions, setPermissions] = useState<Permission[]>([]);
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState("");
    const [savingUsers, setSavingUsers] = useState<string[]>([]);
    const [savingPermissions, setSavingPermissions] = useState<string[]>([]);
    const [showCreateModal, setShowCreateModal] = useState(false);
    const [newUser, setNewUser] = useState<NewUser>(emptyNewUser);
    const [creating, setCreating] = useState(false);
    const [createError, setCreateError] = useState("");
    const [success, setSuccess] = useState("");
    const dialogRef = useRef<HTMLDialogElement>(null);
    const createLock = useRef(false);
    const [editingUserId, setEditingUserId] = useState<string | null>(null);
    const [editProfile, setEditProfile] = useState<EditProfile>({ ...emptyNewUser });
    const [editing, setEditing] = useState(false);
    const [editError, setEditError] = useState("");
    const editDialogRef = useRef<HTMLDialogElement>(null);
    const editLock = useRef(false);
    useEffect(() => {
        const dialog = editDialogRef.current;
        if (!dialog) return;
        if (editingUserId && !dialog.open) dialog.showModal();
        if (!editingUserId && dialog.open) dialog.close();
        if (!editingUserId) return;
        const previousOverflow = document.body.style.overflow;
        document.body.style.overflow = "hidden";
        return () => { document.body.style.overflow = previousOverflow; };
    }, [editingUserId]);
    function openEditModal(user: User) {
        setEditProfile({
            password: "",
            name: user.name ?? "",
            email: user.email ?? "",
            phone: user.phone ?? "",
            dob: user.dob ? user.dob.slice(0, 10) : "",
            address: user.address ?? "",
            state: user.state ?? "",
            pin: user.pin ?? "",
            gender: user.gender ?? "",
            role: user.role === "admin" ? "admin" : "user",
        });
        setEditError("");
        setSuccess("");
        setEditingUserId(user._id);
    }
    function closeEditModal() {
        if (editLock.current) return;
        setEditingUserId(null);
        setEditProfile({ ...emptyNewUser });
        setEditError("");
    }
    async function saveProfile(event: FormEvent<HTMLFormElement>) {
        event.preventDefault();
        if (!editingUserId || editLock.current) return;
        setEditError("");
        if (!editProfile.name.trim() || !editProfile.email.trim()) {
            setEditError("Full name and email are required.");
            return;
        }
        if (editProfile.password && (
            editProfile.password.length < 8 ||
            new TextEncoder().encode(editProfile.password).length > 72
        )) {
            setEditError("Password must contain at least 8 characters and be at most 72 bytes.");
            return;
        }
        const userId = editingUserId;
        const profile = {
            ...editProfile,
            name: editProfile.name.trim(),
            email: editProfile.email.trim(),
        };
        editLock.current = true;
        setEditing(true);
        try {
            const res = await fetch("/api/user-management", {
                method: "PUT",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify({ userId, ...profile, password: profile.password || undefined }),
            });
            const data = await readResponse(res);
            if (!data.user?._id) throw new Error("The API did not return the updated user.");
            setUsers(current => current.map(user =>
                String(user._id) === String(userId) ? data.user : user
            ));
            setSuccess("Profile updated successfully.");
            setEditingUserId(null);
            setEditProfile({ ...emptyNewUser });
        } catch (err) {
            setEditError(err instanceof Error ? err.message : "Unable to update profile.");
        } finally {
            editLock.current = false;
            setEditing(false);
        }
    }
    useEffect(() => {
        const dialog = dialogRef.current;
        if (!dialog) return;
        if (showCreateModal && !dialog.open) dialog.showModal();
        if (!showCreateModal && dialog.open) dialog.close();
        if (!showCreateModal) return;
        const previousOverflow = document.body.style.overflow;
        document.body.style.overflow = "hidden";
        return () => { document.body.style.overflow = previousOverflow; };
    }, [showCreateModal]);
    function openCreateModal() {
        setNewUser({ ...emptyNewUser });
        setCreateError("");
        setSuccess("");
        setShowCreateModal(true);
    }
    function closeCreateModal() {
        if (createLock.current) return;
        setShowCreateModal(false);
        setCreateError("");
        setNewUser({ ...emptyNewUser });
    }
    async function createUser(event: FormEvent<HTMLFormElement>) {
        event.preventDefault();
        if (createLock.current) return;
        setCreateError("");
        if (!newUser.name.trim() || !newUser.email.trim()) {
            setCreateError("Full name and email are required.");
            return;
        }
        if (new TextEncoder().encode(newUser.password).length > 72) {
            setCreateError("Password is too long. Use at most 72 bytes.");
            return;
        }
        createLock.current = true;
        setCreating(true);
        try {
            const res = await fetch("/api/user-management", {
                method: "POST",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify({ ...newUser, name: newUser.name.trim(), email: newUser.email.trim(), active: true }),
            });
            const data = await readResponse(res);
            if (!data.user?._id) throw new Error("The API did not return the created user.");
            setUsers(current => [data.user, ...current.filter(user => String(user._id) !== String(data.user._id))]);
            setSuccess("New account created successfully.");
            setNewUser({ ...emptyNewUser });
            setShowCreateModal(false);
        } catch (err) {
            setCreateError(err instanceof Error ? err.message : "Unable to create account.");
        } finally {
            createLock.current = false;
            setCreating(false);
        }
    }
    const loadData = useCallback(async (signal?: AbortSignal) => {
        setLoading(true);
        setError("");
        try {
            const res = await fetch("/api/user-management", { cache: "no-store", signal });
            const data = await readResponse(res);
            if (signal?.aborted) return;
            setUsers(Array.isArray(data.users) ? data.users : []);
            setPages(Array.isArray(data.pages) ? data.pages : []);
            setPermissions(Array.isArray(data.permissions) ? data.permissions : []);
        } catch (err) {
            if (!signal?.aborted) setError(err instanceof Error ? err.message : "Unable to load users.");
        } finally {
            if (!signal?.aborted) setLoading(false);
        }
    }, []);
    useEffect(() => {
        const controller = new AbortController();
        void loadData(controller.signal);
        return () => controller.abort();
    }, [loadData]);
    const checkPermission = (userId: string, pageId: string) =>
        permissions.some(p => String(p.userId) === String(userId) && String(p.pageId) === String(pageId) && p.access === true);
    async function updateActive(userId: string, active: boolean) {
        if (savingUsers.includes(userId)) return;
        setSavingUsers(current => [...current, userId]);
        setError("");
        try {
            const res = await fetch("/api/user-management", {
                method: "PUT",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify({ userId, active }),
            });
            await readResponse(res);
            setUsers(current => current.map(user =>
                String(user._id) === String(userId) ? { ...user, active } : user
            ));
        } catch (err) {
            setError(err instanceof Error ? err.message : "Unable to update user status.");
        } finally {
            setSavingUsers(current => current.filter(id => id !== userId));
        }
    }
    async function updatePermission(userId: string, pageId: string, access: boolean) {
        const key = `${userId}:${pageId}`;
        if (savingPermissions.includes(key)) return;
        setSavingPermissions(current => [...current, key]);
        setError("");
        try {
            const res = await fetch("/api/user-management", {
                method: "PUT",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify({ userId, pageId, access }),
            });
            await readResponse(res);
            setPermissions(current => [
                ...current.filter(p => !(String(p.userId) === String(userId) && String(p.pageId) === String(pageId))),
                { userId, pageId, access },
            ]);
        } catch (err) {
            setError(err instanceof Error ? err.message : "Unable to update permission.");
        } finally {
            setSavingPermissions(current => current.filter(item => item !== key));
        }
    }
    return (
        <div className="min-h-screen bg-[#0D163F]">
            <Navbar />
            <main className="px-5 pb-10 pt-24">
                <div className="overflow-hidden rounded-xl bg-white shadow-xl">
                    <div className="flex flex-wrap items-center justify-between gap-3 border-b p-5">
                        <div>
                            <h1 className="text-xl font-bold text-gray-900">User Management</h1>
                            <p className="mt-1 text-sm text-gray-500">Manage user status and page permissions.</p>
                        </div>
                        <button type="button" onClick={openCreateModal}
                            className="rounded-lg bg-blue-600 px-4 py-2 text-sm font-semibold text-white hover:bg-blue-700">
                            Create New Account
                        </button>
                    </div>
                    {success && <p role="status" className="mx-5 mt-4 rounded-lg border border-emerald-200 bg-emerald-50 p-3 text-sm text-emerald-700">{success}</p>}
                    {error && <div role="alert" className="mx-5 mt-4 rounded-lg border border-red-200 bg-red-50 p-3 text-sm text-red-700">{error}</div>}
                    {loading ? <div role="status" className="p-5 text-gray-500">Loading...</div> : (
                        <div className="overflow-x-auto">
                            <table className="w-full">
                                <thead className="bg-gray-100 text-sm text-gray-600">
                                    <tr>
                                        <th scope="col" className="w-40 p-3 text-left">Active</th>
                                        <th scope="col" className="w-36 p-3 text-center">Edit Profile</th>
                                        <th scope="col" className="p-3 text-left">User</th>
                                        {pages.map(page => <th scope="col" key={page._id} className="p-3 text-center">{page.name}</th>)}
                                    </tr>
                                </thead>
                                <tbody>
                                    {!users.length && <tr><td colSpan={pages.length + 3} className="p-8 text-center text-sm text-gray-500">No users found.</td></tr>}
                                    {users.map(user => {
                                        // Existing accounts without the new field remain active.
                                        const active = user.active !== false;
                                        const saving = savingUsers.includes(user._id);
                                        return (
                                            <tr key={user._id} className={`border-b transition ${active ? "hover:bg-gray-50" : "bg-slate-50"}`}>
                                                <td className="p-3">
                                                    <div className="flex items-center gap-2.5">
                                                        <button type="button" role="switch" aria-checked={active}
                                                            aria-label={`Active status for ${user.name || user.email || "user"}`}
                                                            aria-busy={saving} disabled={saving}
                                                            onClick={() => void updateActive(user._id, !active)}
                                                            className={`relative inline-flex h-6 w-11 shrink-0 items-center rounded-full transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-blue-500 focus-visible:ring-offset-2 disabled:cursor-wait disabled:opacity-50 ${active ? "bg-emerald-500" : "bg-gray-300"}`}>
                                                            <span aria-hidden="true" className={`h-4 w-4 rounded-full bg-white shadow transition-transform ${active ? "translate-x-6" : "translate-x-1"}`} />
                                                        </button>
                                                        <span className={`text-xs font-semibold ${active ? "text-emerald-600" : "text-gray-500"}`}>
                                                            {saving ? "Saving..." : active ? "Active" : "Inactive"}
                                                        </span>
                                                    </div>
                                                </td>
                                                <td className="p-3 text-center">
                                                    <button type="button" onClick={() => openEditModal(user)}
                                                        disabled={saving || editing}
                                                        aria-label={`Edit profile for ${user.name || user.email || "user"}`}
                                                        className="whitespace-nowrap rounded-lg border border-blue-200 bg-blue-50 px-3 py-2 text-xs font-semibold text-blue-600 hover:bg-blue-100 disabled:opacity-50">
                                                        Edit Profile
                                                    </button>
                                                </td>
                                                <td className="p-3">
                                                    <p className="font-medium text-gray-900">{user.name || "Unnamed user"}</p>
                                                    <p className="text-sm text-gray-500">{user.email || "-"}</p>
                                                </td>
                                                {pages.map(page => (
                                                    <td key={page._id} className="p-3 text-center">
                                                        <input type="checkbox" aria-label={`${page.name} access for ${user.name || user.email || "user"}`}
                                                            checked={checkPermission(user._id, page._id)}
                                                            disabled={savingPermissions.includes(`${user._id}:${page._id}`)}
                                                            onChange={e => void updatePermission(user._id, page._id, e.target.checked)}
                                                            className="h-4 w-4 cursor-pointer accent-blue-600 disabled:cursor-wait disabled:opacity-50" />
                                                    </td>
                                                ))}
                                            </tr>
                                        );
                                    })}
                                </tbody>
                            </table>
                        </div>
                    )}
                </div>
            </main>
            <dialog ref={dialogRef} aria-labelledby="create-account-heading"
                onCancel={event => { event.preventDefault(); closeCreateModal(); }}
                onClick={event => { if (event.target === event.currentTarget) closeCreateModal(); }}
                className="m-auto max-h-[90dvh] w-[calc(100%_-_2rem)] max-w-[660px] overflow-y-auto rounded-2xl bg-white p-0 text-[#0D163F] shadow-2xl backdrop:bg-[#0D163F]/70 backdrop:backdrop-blur-sm">
                <div className="relative p-6 sm:p-8">
                    <button type="button" aria-label="Close create account" onClick={closeCreateModal} disabled={creating}
                        className="absolute right-4 top-4 flex h-8 w-8 items-center justify-center rounded-full text-2xl text-slate-500 hover:bg-slate-100 disabled:opacity-40">×</button>
                    <h2 id="create-account-heading" className="mb-6 text-center text-3xl font-bold">Create Account</h2>
                    {createError && <p role="alert" className="mb-4 rounded-lg bg-red-50 p-3 text-sm text-red-700">{createError}</p>}
                    <form onSubmit={createUser} aria-busy={creating}>
                        <fieldset disabled={creating} className="min-w-0 border-0 p-0">
                            <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
                                {accountFields.map(({ key, label, type, autocomplete }) => (
                                    <div key={key} className={key === "address" ? "sm:col-span-2" : ""}>
                                        <label htmlFor={`new-user-${key}`} className="mb-2 block text-sm font-semibold text-[#0D163F]">
                                            {label}{["name", "email", "password"].includes(key) && <span className="ml-1 text-red-500">*</span>}
                                        </label>
                                        <input id={`new-user-${key}`} name={key} type={type} autoComplete={autocomplete}
                                            placeholder={label} value={newUser[key]} required={["name", "email", "password"].includes(key)}
                                            minLength={key === "password" ? 8 : undefined}
                                            onChange={event => setNewUser(current => ({ ...current, [key]: event.target.value }))}
                                            className="h-[50px] w-full min-w-0 rounded border border-[#0D163F] bg-white px-3 text-sm outline-none placeholder:text-slate-400 focus:border-blue-600 focus:ring-2 focus:ring-blue-100 disabled:opacity-60" />
                                    </div>
                                ))}
                            </div>
                            <p className="mt-2 text-xs text-slate-500">Password must contain at least 8 characters.</p>
                            <fieldset className="mt-6">
                                <legend className="mb-2 text-sm font-semibold">Gender</legend>
                                <div className="flex gap-5">
                                    {["Male", "Female"].map(gender => <label key={gender} className="flex cursor-pointer items-center gap-1.5 text-sm">
                                        <input type="radio" name="new-user-gender" value={gender} checked={newUser.gender === gender}
                                            onChange={() => setNewUser(current => ({ ...current, gender }))} className="accent-blue-600" />{gender}
                                    </label>)}
                                </div>
                            </fieldset>
                            <fieldset className="mt-6">
                                <legend className="mb-2 text-sm font-semibold">Account Type</legend>
                                <div className="flex gap-5">
                                    {(["user", "admin"] as const).map(role => <label key={role} className="flex cursor-pointer items-center gap-1.5 text-sm">
                                        <input type="radio" name="new-user-role" value={role} checked={newUser.role === role}
                                            onChange={() => setNewUser(current => ({ ...current, role }))} className="accent-blue-600" />{role === "admin" ? "Admin" : "User"}
                                    </label>)}
                                </div>
                            </fieldset>
                            <button type="submit" className="mt-7 h-12 w-full rounded-lg bg-[#1959FF] text-sm font-semibold text-white transition hover:bg-blue-700 disabled:cursor-wait disabled:opacity-60">
                                {creating ? "Creating account..." : "Create Account"}
                            </button>
                        </fieldset>
                    </form>
                </div>
            </dialog>
            <dialog ref={editDialogRef} aria-labelledby="edit-profile-heading"
                onCancel={event => { event.preventDefault(); closeEditModal(); }}
                onClick={event => { if (event.target === event.currentTarget) closeEditModal(); }}
                className="m-auto max-h-[90dvh] w-[calc(100%_-_2rem)] max-w-[660px] overflow-y-auto rounded-2xl bg-white p-0 text-[#0D163F] shadow-2xl backdrop:bg-[#0D163F]/70 backdrop:backdrop-blur-sm">
                <div className="relative p-6 sm:p-8">
                    <button type="button" aria-label="Close edit profile" onClick={closeEditModal} disabled={editing}
                        className="absolute right-4 top-4 flex h-8 w-8 items-center justify-center rounded-full text-2xl text-slate-500 hover:bg-slate-100 disabled:opacity-40">×</button>
                    <h2 id="edit-profile-heading" className="mb-6 text-center text-3xl font-bold">Edit Profile</h2>
                    {editError && <p role="alert" className="mb-4 rounded-lg bg-red-50 p-3 text-sm text-red-700">{editError}</p>}
                    <form onSubmit={saveProfile} aria-busy={editing}>
                        <fieldset disabled={editing} className="min-w-0 border-0 p-0">
                            <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
                                {accountFields.map(({ key, label, type, autocomplete }) => (
                                    <div key={key} className={key === "address" ? "sm:col-span-2" : ""}>
                                        <label htmlFor={`edit-user-${key}`} className="mb-2 block text-sm font-semibold text-[#0D163F]">
                                            {key === "password" ? "New Password (optional)" : label}{["name", "email"].includes(key) && <span className="ml-1 text-red-500">*</span>}
                                        </label>
                                        <input id={`edit-user-${key}`} name={key} type={type} autoComplete={autocomplete}
                                            placeholder={key === "password" ? "Leave blank to keep current password" : label} value={editProfile[key]} required={["name", "email"].includes(key)}
                                            minLength={key === "password" ? 8 : undefined}
                                            onChange={event => setEditProfile(current => ({ ...current, [key]: event.target.value }))}
                                            className="h-[50px] w-full min-w-0 rounded border border-[#0D163F] bg-white px-3 text-sm outline-none placeholder:text-slate-400 focus:border-blue-600 focus:ring-2 focus:ring-blue-100 disabled:opacity-60" />
                                    </div>
                                ))}
                            </div>
                            <p className="mt-2 text-xs text-slate-500">Leave the password blank to keep it unchanged. A new password needs at least 8 characters.</p>
                            <fieldset className="mt-6">
                                <legend className="mb-2 text-sm font-semibold">Gender</legend>
                                <div className="flex gap-5">
                                    {["Male", "Female"].map(gender => <label key={gender} className="flex cursor-pointer items-center gap-1.5 text-sm">
                                        <input type="radio" name="edit-user-gender" value={gender} checked={editProfile.gender === gender}
                                            onChange={() => setEditProfile(current => ({ ...current, gender }))} className="accent-blue-600" />{gender}
                                    </label>)}
                                </div>
                            </fieldset>
                            <fieldset className="mt-6">
                                <legend className="mb-2 text-sm font-semibold">Account Type</legend>
                                <div className="flex gap-5">
                                    {(["user", "admin"] as const).map(role => <label key={role} className="flex cursor-pointer items-center gap-1.5 text-sm">
                                        <input type="radio" name="edit-user-role" value={role} checked={editProfile.role === role}
                                            onChange={() => setEditProfile(current => ({ ...current, role }))} className="accent-blue-600" />{role === "admin" ? "Admin" : "User"}
                                    </label>)}
                                </div>
                            </fieldset>
                            <button type="submit" className="mt-7 h-12 w-full rounded-lg bg-[#1959FF] text-sm font-semibold text-white transition hover:bg-blue-700 disabled:cursor-wait disabled:opacity-60">
                                {editing ? "Saving changes..." : "Save Changes"}
                            </button>
                        </fieldset>
                    </form>
                </div>
            </dialog>
            <Footer />
        </div>
    );
}