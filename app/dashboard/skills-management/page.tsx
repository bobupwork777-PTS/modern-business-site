"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import type { FormEvent } from "react";
import Navbar from "@/components/Navbar";
import Footer from "@/components/Footer";

type SkillRow = { _id: string; name: string; normalizedName: string; active: boolean; notificationOn: boolean };
const API = "/api/skills";

function Icon({ kind }: { kind: "plus" | "search" | "code" | "edit" | "trash" | "refresh" }) {
    const paths = {
        plus: <path d="M12 5v14M5 12h14" />,
        search: <><circle cx="10.5" cy="10.5" r="6.5" /><path d="m16 16 4 4" /></>,
        code: <><path d="m8 7-5 5 5 5m8-10 5 5-5 5m-3-13-2 20" /></>,
        edit: <><path d="m16 3 5 5-12 12-6 1 1-6L16 3Zm-2 2 5 5" /></>,
        trash: <><path d="M3 6h18M9 6V3h6v3M5 6l1 15h12l1-15M10 10v7M14 10v7" /></>,
        refresh: <><path d="M20 7v5h-5M4 17v-5h5" /><path d="M6 6a8 8 0 0 1 14 6M18 18a8 8 0 0 1-14-6" /></>,
    };
    return <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">{paths[kind]}</svg>;
}

async function api(url: string, options?: RequestInit) {
    const response = await fetch(url, { ...options, cache: "no-store", credentials: "same-origin" });
    if (response.redirected) throw new Error("Your session may have expired. Please sign in again.");
    let data;
    try { data = await response.json(); }
    catch { throw new Error(`Server returned an invalid response (${response.status}).`); }
    if (!response.ok || data?.success !== true) throw new Error(data?.error || `Request failed (${response.status}).`);
    return data;
}

export default function SkillsManagementPage() {
    const operationRef = useRef(false);
    const formRef = useRef<HTMLFormElement>(null);
    const [skills, setSkills] = useState<SkillRow[]>([]);
    const [loading, setLoading] = useState(true);
    const [busy, setBusy] = useState(false);
    const [error, setError] = useState("");
    const [message, setMessage] = useState("");
    const [search, setSearch] = useState("");
    const [editingId, setEditingId] = useState<string | null>(null);
    const [name, setName] = useState("");
    const [active, setActive] = useState(true);
    const [notificationOn, setNotificationOn] = useState(false);

    const load = useCallback(async (signal?: AbortSignal) => {
        const data = await api(`${API}?manage=true`, { signal });
        if (!Array.isArray(data.skills) || !data.skills.every((row: unknown) => {
            if (!row || typeof row !== "object") return false;
            const s = row as Partial<SkillRow>;
            return typeof s._id === "string" && typeof s.name === "string" && typeof s.normalizedName === "string" && typeof s.active === "boolean" && typeof s.notificationOn === "boolean";
        })) throw new Error("Server returned an invalid skills list.");
        if (!signal?.aborted) setSkills(data.skills);
    }, []);

    useEffect(() => {
        const controller = new AbortController();
        void load(controller.signal).catch(err => {
            if (!controller.signal.aborted) setError(err instanceof Error ? err.message : "Unable to load skills.");
        }).finally(() => {
            if (!controller.signal.aborted) setLoading(false);
        });
        return () => controller.abort();
    }, [load]);

    useEffect(() => {
        if (editingId) {
            formRef.current?.querySelector<HTMLInputElement>("#skill-name")?.focus({ preventScroll: true });
        }
    }, [editingId]);

    function reset() {
        setEditingId(null); setName(""); setActive(true); setNotificationOn(false);
    }
    function edit(skill: SkillRow) {
        if (operationRef.current || loading) return;
        setEditingId(skill._id); setName(skill.name); setActive(skill.active); setNotificationOn(skill.active && skill.notificationOn);
        setMessage(""); setError("");
        formRef.current?.scrollIntoView({ behavior: window.matchMedia("(prefers-reduced-motion: reduce)").matches ? "auto" : "smooth", block: "center" });
    }
    async function mutate(method: string, body: object, successMessage: string, resetForm = false) {
        if (operationRef.current || loading) return;
        operationRef.current = true;
        setBusy(true); setError(""); setMessage("");
        try {
            await api(API, { method, headers: { "Content-Type": "application/json" }, body: JSON.stringify(body) });
            if (resetForm) reset();
            setMessage(successMessage);
            try { await load(); }
            catch { setError("Saved successfully, but the list could not refresh. Click Refresh to reload it."); }
        } catch (err) {
            setError(err instanceof Error ? err.message : "Unable to save changes.");
        } finally { operationRef.current = false; setBusy(false); }
    }
    async function submit(event: FormEvent<HTMLFormElement>) {
        event.preventDefault();
        if (operationRef.current || loading) return;
        if (editingId) {
            const trimmed = name.trim().replace(/\s+/g, " ");
            if (!trimmed) { setError("Enter a skill name."); return; }
            if (trimmed.length > 120) { setError("Each skill name must be 120 characters or fewer."); return; }
            await mutate("PUT", { id: editingId, name: trimmed, active, notificationOn: active && notificationOn }, "Skill updated successfully.", true);
            return;
        }
        const names = [...new Map(name.split(/[,\n\r]+/).map(n => n.trim().replace(/\s+/g, " ")).filter(Boolean).map(n => [n.toLowerCase(), n])).values()];
        if (!names.length) { setError("Enter at least one skill name."); return; }
        if (names.some(n => n.length > 120)) { setError("Each skill name must be 120 characters or fewer."); return; }
        operationRef.current = true;
        setBusy(true); setError(""); setMessage("");
        let added = 0;
        let skipped = 0;
        const failed: string[] = [];
        const details: string[] = [];
        const existing = new Set(skills.filter(s => s.active).map(s => s.normalizedName.trim().replace(/\s+/g, " ").toLowerCase()));
        try {
            for (const skillName of names) {
                if (existing.has(skillName.toLowerCase())) { skipped++; continue; }
                try {
                    await api(API, { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ name: skillName, notificationOn }) });
                    added++;
                    existing.add(skillName.toLowerCase());
                } catch (err) {
                    failed.push(skillName);
                    details.push(`${skillName}: ${err instanceof Error ? err.message : "Unable to add skill."}`);
                }
            }
            setName(failed.join("\n"));
            setMessage(`${added} skill${added === 1 ? "" : "s"} added${skipped ? `; ${skipped} already saved` : ""}.`);
            if (details.length) setError(details.join(" "));
            try { await load(); }
            catch { setError([...details, "The list could not refresh. Click Refresh to reload it."].join(" ")); }
        } finally { operationRef.current = false; setBusy(false); }
    }
    async function remove(skill: SkillRow) {
        if (operationRef.current || loading || !skill.active) return;
        if (!window.confirm(`Deactivate “${skill.name}” and turn off its notifications? You can restore it by editing it.`)) return;
        await mutate("DELETE", { id: skill._id }, "Skill deactivated and notifications turned off.", editingId === skill._id);
    }
    async function refresh() {
        if (operationRef.current || loading) return;
        operationRef.current = true;
        setLoading(true); setError(""); setMessage("");
        try { await load(); }
        catch (err) { setError(err instanceof Error ? err.message : "Unable to refresh skills."); }
        finally { operationRef.current = false; setLoading(false); }
    }

    const filtered = skills.filter(s => `${s.name} ${s.normalizedName}`.toLowerCase().includes(search.trim().toLowerCase()));
    const locked = busy || loading;

    return (
        <div className="skills-page">
            <div className="site-header">
                <Navbar />
            </div>
            <main className="page-content">
                <div className="management-panel">
                    <div className="page-header">
                        <div><span className="page-kicker">WORKSPACE SETTINGS</span><h1>Skills Management</h1><p>Organize your skills and choose what shows up in your job alerts.</p></div>
                        <button type="button" className="refresh-button" onClick={() => void refresh()} disabled={locked}><Icon kind="refresh" />Refresh</button>
                    </div>
                    <div className="summary-bar">
                        <div className="summary-item"><span className="summary-dot blue" /><strong>{skills.length}</strong><span>Saved skills</span></div>
                        <div className="summary-item"><span className="summary-dot green" /><strong>{skills.filter(s => s.active).length}</strong><span>Active</span></div>
                        <div className="summary-item"><span className="summary-dot purple" /><strong>{skills.filter(s => s.active && s.notificationOn).length}</strong><span>Notifications on</span></div>
                    </div>
                    {error && <p role="alert" className="notice error">{error}</p>}
                    {message && <p role="status" className="notice success">{message}</p>}
                    <div className="workspace">
                        <section className="add-panel">
                            <div className="add-heading"><span className="plus-icon"><Icon kind={editingId ? "edit" : "plus"} /></span><div><h2>{editingId ? "Edit skill" : "Add skills"}</h2><p>{editingId ? "Update this skill’s settings." : "Add one or several at once."}</p></div></div>
                            <form ref={formRef} onSubmit={submit}>
                                <fieldset disabled={locked}>
                                    <label className="field-label" htmlFor="skill-name">{editingId ? "Skill name" : "Skills to add"}</label>
                                    {editingId ? <input id="skill-name" value={name} onChange={e => setName(e.target.value)} maxLength={120} required /> : <textarea id="skill-name" value={name} onChange={e => setName(e.target.value)} placeholder={"Wix\nWebflow\nShopify"} rows={4} required />}
                                    <p className="form-hint">{editingId ? "Changes are saved when you click Update skill." : "Separate names with commas or new lines."}</p>
                                    <div className="form-options">
                                        {editingId && <label className="checkbox"><input type="checkbox" checked={active} onChange={e => { setActive(e.target.checked); if (!e.target.checked) setNotificationOn(false); }} />Active</label>}
                                        <label className="checkbox"><input type="checkbox" checked={notificationOn} disabled={editingId !== null && !active} onChange={e => setNotificationOn(e.target.checked)} />Enable job notifications</label>
                                    </div>
                                    <button type="submit" className="submit-button" disabled={locked || !name.trim()}>{busy ? "Saving..." : editingId ? "Update skill" : "Add all skills"}</button>
                                    {editingId && <button type="button" className="cancel-button" onClick={reset}>Cancel editing</button>}
                                </fieldset>
                            </form>
                        </section>
                        <section className="saved-panel">
                            <div className="saved-heading"><h2>Your skills</h2><span>{filtered.length} of {skills.length} skills</span></div>
                            <label className="search-field"><span className="sr-only">Find a skill</span><Icon kind="search" /><input type="search" value={search} onChange={e => setSearch(e.target.value)} placeholder="Find a skill..." /></label>
                            <div className="skills-table-wrap" role="region" aria-label="Saved skills table" aria-busy={loading} tabIndex={0}>
                                <table className="skills-table">
                                    <caption className="sr-only">Saved skills and notification settings</caption>
                                    <thead>
                                        <tr>
                                            <th scope="col" className="number-cell">#</th>
                                            <th scope="col">Skill name</th>
                                            <th scope="col">Search term</th>
                                            <th scope="col">Status</th>
                                            <th scope="col">Notifications</th>
                                            <th scope="col" className="actions-heading">Actions</th>
                                        </tr>
                                    </thead>
                                    <tbody>
                                        {loading ? (
                                            <tr><td colSpan={6} className="table-empty">Loading skills...</td></tr>
                                        ) : filtered.length === 0 ? (
                                            <tr><td colSpan={6} className="table-empty">{search.trim() ? "No matching skills." : "No skills yet. Add your first skill."}</td></tr>
                                        ) : filtered.map((skill, index) => (
                                            <tr key={skill._id} className={!skill.active ? "inactive-row" : ""}>
                                                <td className="number-cell">{index + 1}</td>
                                                <th scope="row"><div className="table-skill-name"><span className="code-icon"><Icon kind="code" /></span><span>{skill.name}</span></div></th>
                                                <td className="search-term-cell">{skill.normalizedName}</td>
                                                <td><span className={`status-badge ${skill.active ? "status-active" : "status-inactive"}`}>{skill.active ? "Active" : "Inactive"}</span></td>
                                                <td>
                                                    <div className="table-notifications">
                                                        <button type="button" role="switch" aria-checked={skill.notificationOn} aria-label={`Job notifications for ${skill.name}`} title={skill.active ? "Toggle job notifications" : "Edit this skill to reactivate it"} className={`notification-toggle ${skill.notificationOn ? "on" : ""}`} disabled={locked || !skill.active} onClick={() => void mutate("PATCH", { id: skill._id, notificationOn: !skill.notificationOn }, `Notifications ${skill.notificationOn ? "disabled" : "enabled"} for ${skill.name}.`)}><span /></button>
                                                        <span className={`notification-text ${skill.notificationOn ? "enabled-text" : ""}`}>{skill.notificationOn ? "On" : "Off"}</span>
                                                    </div>
                                                </td>
                                                <td>
                                                    <div className="table-actions">
                                                        <button type="button" className="table-action edit-action" aria-label={`Edit ${skill.name}`} disabled={locked} onClick={() => edit(skill)}><Icon kind="edit" /><span>Edit</span></button>
                                                        <button type="button" className="table-action delete-action" aria-label={`Deactivate ${skill.name}`} disabled={locked || !skill.active} onClick={() => void remove(skill)}><Icon kind="trash" /><span>Deactivate</span></button>
                                                    </div>
                                                </td>
                                            </tr>
                                        ))}
                                    </tbody>
                                </table>
                            </div>
                        </section>
                    </div>
                </div>
            </main>
            <div className="site-footer">
                <Footer />
            </div>
            <style jsx>{`
                .skills-page { min-height: 100dvh; display: flex; flex-direction: column; background: #0D163F; color: #18243b; }
                .site-header { position: relative; isolation: isolate; z-index: 10; width: 100%; min-height: 64px; background: #0D163F; color: #fff; }
                .site-header > :global(*) { position: relative !important; inset: auto !important; width: 100%; }
                .site-header :global(nav), .site-header :global(header) { position: relative !important; inset: auto !important; width: 100%; background: #0D163F; color: #fff; }
                .site-footer { width: 100%; margin-top: auto; }
                .page-content { flex: 1; width: 100%; padding: 24px 20px 32px; box-sizing: border-box; }
                .management-panel { max-width: 1280px; margin: 0 auto; background: #fff; border: 1px solid #e2e8f0; border-radius: 12px; box-shadow: 0 12px 32px #050a231f; }
                .page-header { display: flex; align-items: center; justify-content: space-between; gap: 16px; padding: 20px 24px 16px; }
                .page-kicker { display: block; color: #64748b; font-size: 10px; font-weight: 700; letter-spacing: 1px; margin-bottom: 5px; }
                h1 { margin: 0 0 5px; font-size: 23px; line-height: 1.25; font-weight: 700; letter-spacing: -.5px; }
                .page-header p { margin: 0; font-size: 13px; color: #66768d; line-height: 1.5; }
                button { position: relative; inset: auto; display: inline-flex; align-items: center; justify-content: center; font-family: inherit; cursor: pointer; box-sizing: border-box; appearance: none; margin: 0; line-height: 1.3; transition: background .15s, color .15s; }
                button:disabled { cursor: not-allowed; opacity: .5; }
                button::before, button::after { content: none; }
                .refresh-button { gap: 6px; flex-shrink: 0; border: 1px solid #dce4f0; background: #fff; color: #3a5072; border-radius: 7px; padding: 9px 12px; font-weight: 600; font-size: 12px; min-height: 36px; }
                .refresh-button:hover:not(:disabled) { background: #f3f7fd; }
                .refresh-button :global(svg) { position: static; width: 15px; height: 15px; }
                .summary-bar { display: flex; flex-wrap: wrap; gap: 12px 22px; background: #f8faff; border-top: 1px solid #edf1f7; border-bottom: 1px solid #edf1f7; padding: 11px 24px; }
                .summary-item { display: flex; align-items: center; gap: 6px; color: #66768d; font-size: 12px; }
                .summary-item strong { color: #253450; font-size: 13px; }
                .summary-dot { width: 6px; height: 6px; display: block; border-radius: 50%; }
                .blue { background: #2b63ef; } .green { background: #10b981; } .purple { background: #9561e8; }
                .workspace { display: grid; grid-template-columns: 250px minmax(0,1fr); gap: 20px; padding: 20px 24px 24px; align-items: start; }
                .add-panel { min-width: 0; background: #f8faff; border: 1px solid #e0e7f2; border-radius: 10px; padding: 15px; }
                .add-heading { display: flex; align-items: center; gap: 9px; min-height: 32px; margin-bottom: 12px; }
                .plus-icon { display: flex; align-items: center; justify-content: center; width: 32px; height: 32px; flex-shrink: 0; background: #e6eeff; color: #2860ed; border-radius: 8px; }
                .plus-icon :global(svg) { position: static; width: 17px; height: 17px; }
                h2 { font-size: 15px; line-height: 1.4; margin: 0; font-weight: 600; }
                .add-heading p { margin: 3px 0 0; color: #64748b; font-size: 11px; line-height: 1.4; }
                fieldset { border: 0; padding: 0; margin: 0; min-width: 0; }
                .field-label { display: block; color: #425471; font-size: 12px; font-weight: 600; margin-bottom: 6px; }
                textarea, input:not([type="checkbox"]) { box-sizing: border-box; width: 100%; background: #fff; color: #18243b; font-family: inherit; font-size: 13px; border: 1px solid #dce4ef; border-radius: 7px; padding: 9px 10px; line-height: 20px; }
                textarea { min-height: 104px; resize: vertical; display: block; }
                textarea::placeholder, input::placeholder { color: #7b889e; opacity: 1; }
                .form-hint { color: #64748b; font-size: 11px; line-height: 1.5; margin: 7px 0 12px; }
                .form-options { display: flex; flex-wrap: wrap; gap: 9px; margin-bottom: 12px; padding: 9px; background: #edf2fb; border-radius: 7px; }
                .checkbox { display: inline-flex; align-items: center; gap: 7px; color: #526583; font-size: 12px; line-height: 1.5; cursor: pointer; }
                .checkbox input { accent-color: #2860ed; width: 15px; height: 15px; margin: 0; appearance: auto; }
                .submit-button { width: 100%; min-height: 36px; border: 0; background: #2860ed; color: #fff; border-radius: 7px; padding: 9px; font-size: 12px; font-weight: 600; }
                .submit-button:hover:not(:disabled) { background: #1d4ed8; }
                .submit-button:disabled { background: #e1e7f0; color: #6b7b92; opacity: 1; }
                .cancel-button { width: 100%; margin-top: 7px; background: #fff; border: 1px solid #dce4ef; border-radius: 7px; padding: 8px; color: #526583; font-size: 12px; }
                .saved-panel { min-width: 0; }
                .saved-heading { display: flex; align-items: center; justify-content: space-between; gap: 10px; margin-bottom: 10px; min-height: 32px; }
                .saved-heading span { background: #f1f5fb; color: #60728d; font-size: 11px; padding: 4px 8px; border-radius: 12px; }
                .search-field { position: relative; display: flex; align-items: center; color: #7b889e; margin-bottom: 10px; }
                .search-field :global(svg) { position: absolute; left: 11px; top: 50%; transform: translateY(-50%); width: 15px; height: 15px; pointer-events: none; }
                .search-field input { height: 36px; padding: 7px 10px 7px 34px; font-size: 12px; }
                .code-icon { flex-shrink: 0; width: 25px; height: 25px; display: flex; align-items: center; justify-content: center; border-radius: 6px; color: #8054c9; background: #f5f0ff; }
                .code-icon :global(svg) { position: static; width: 14px; height: 14px; }
                .notification-toggle { position: relative; display: block; padding: 0; width: 34px; min-width: 34px; height: 20px; min-height: 20px; border: 0; border-radius: 20px; flex-shrink: 0; background: #cbd5e1; overflow: hidden; }
                .notification-toggle.on { background: #2860ed; }
                .notification-toggle span { position: absolute; display: block; inset: auto; top: 3px; left: 3px; width: 14px; height: 14px; border-radius: 50%; background: #fff; margin: 0; padding: 0; transition: transform .15s; }
                .notification-toggle.on span { transform: translateX(14px); }
                .skills-table-wrap { border: 1px solid #e0e6f0; border-radius: 8px; overflow: auto; max-height: min(520px, 62dvh); scrollbar-width: thin; scrollbar-color: #c7d1e2 #f5f7fb; }
                .skills-table { width: 100%; min-width: 680px; border-collapse: separate; border-spacing: 0; text-align: left; font-size: 12px; }
                .skills-table thead th { position: sticky; top: 0; z-index: 1; background: #f5f7fc; color: #61718a; padding: 10px; font-size: 11px; font-weight: 600; white-space: nowrap; border-bottom: 1px solid #e0e6f0; }
                .skills-table tbody td, .skills-table tbody th { padding: 8px 10px; border-bottom: 1px solid #edf1f7; vertical-align: middle; background: #fff; }
                .skills-table tbody tr:last-child td, .skills-table tbody tr:last-child th { border-bottom: 0; }
                .skills-table tbody tr:hover td, .skills-table tbody tr:hover th { background: #f8faff; }
                .skills-table tbody .inactive-row td, .skills-table tbody .inactive-row th { background: #fafbfd; }
                .skills-table .number-cell { width: 28px; color: #64748b; text-align: center; }
                .table-skill-name { display: flex; align-items: center; gap: 7px; min-width: 120px; font-weight: 600; line-height: 1.4; overflow-wrap: anywhere; }
                .search-term-cell { color: #64748b; font-size: 11px; overflow-wrap: anywhere; max-width: 160px; }
                .status-badge { display: inline-block; font-size: 10px; font-weight: 600; padding: 3px 7px; border-radius: 12px; white-space: nowrap; }
                .status-active { color: #13754f; background: #e9f8f0; } .status-inactive { color: #64748b; background: #eef1f6; }
                .table-notifications { display: flex; align-items: center; gap: 7px; }
                .notification-text { font-size: 11px; color: #64748b; min-width: 20px; }
                .enabled-text { color: #2860ed; }
                .table-actions { display: flex; align-items: center; justify-content: flex-end; gap: 5px; }
                .skills-table thead .actions-heading { text-align: right; }
                .table-action { gap: 4px; padding: 6px 7px; border: 1px solid #dfe7f4; border-radius: 6px; font-size: 11px; font-weight: 500; background: #fff; color: #4f6e9e; white-space: nowrap; min-height: 28px; }
                .table-action :global(svg) { position: static; width: 13px; height: 13px; }
                .edit-action:hover:not(:disabled) { color: #2860ed; background: #edf3ff; }
                .delete-action { color: #ad4056; border-color: #f0dce1; }
                .delete-action:hover:not(:disabled) { color: #bd2845; background: #fff1f3; }
                .skills-table .table-empty { text-align: center; color: #64748b; padding: 28px 15px; }
                .saved-hint { font-size: 11px; color: #64748b; line-height: 1.5; margin: 10px 0 0; }
                .notice { margin: 12px 24px 0; padding: 9px 12px; border-radius: 7px; font-size: 12px; line-height: 1.5; overflow-wrap: anywhere; }
                .error { color: #be123c; background: #fff1f2; } .success { color: #166534; background: #ecfdf5; }
                .sr-only { position: absolute; width: 1px; height: 1px; overflow: hidden; clip-path: inset(50%); }
                input:focus-visible, textarea:focus-visible, button:focus-visible, .skills-table-wrap:focus-visible { outline: 2px solid #8eb4ff; outline-offset: 3px; }
                @media(max-width: 1024px) { .workspace { grid-template-columns: 220px minmax(0,1fr); gap: 14px; } }
                @media(max-width: 800px) { .page-content { padding: 18px 14px 24px; } .workspace { grid-template-columns: 1fr; gap: 16px; padding: 18px; } .page-header { padding: 18px; } .summary-bar { padding: 10px 18px; } textarea { min-height: 90px; } .skills-table-wrap { max-height: 460px; } }
                @media(max-width: 520px) { .page-content { padding: 12px 10px 18px; } .page-header { align-items: flex-start; padding: 14px; gap: 10px; } h1 { font-size: 20px; } .page-header p { font-size: 12px; } .refresh-button { padding: 8px; } .summary-bar { padding: 10px 14px; gap: 9px 14px; } .summary-item { font-size: 11px; } .workspace { padding: 14px; } .notice { margin: 10px 14px 0; } }
                @media(pointer: coarse) { .table-action { min-height: 40px; } .notification-toggle { width: 40px; min-width: 40px; height: 28px; } .notification-toggle span { width: 20px; height: 20px; left: 4px; top: 4px; } .notification-toggle.on span { transform: translateX(12px); } }
                @media(prefers-reduced-motion: reduce) { button, .notification-toggle span { transition: none; } }
            `}</style>
        </div>
    );
}
