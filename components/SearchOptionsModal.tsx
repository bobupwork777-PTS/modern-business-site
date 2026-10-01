"use client";

import { useRef, useState } from "react";

type OptionType = "country" | "skill";

export type SearchOptionChange = {

    type: OptionType;

    action: "add" | "update" | "delete";

    name: string;

    oldName?: string;

};

type Props = {

    countryOptions: string[];

    skillOptions: string[];

    onClose: () => void;

    onChanged: (change: SearchOptionChange) => void | Promise<void>;

};

export default function SearchOptionsModal({

    countryOptions,

    skillOptions,

    onClose,

    onChanged,

}: Props) {

    const [type, setType] = useState<OptionType>("country");

    const [newName, setNewName] = useState("");

    const [editingName, setEditingName] = useState<string | null>(null);

    const [editValue, setEditValue] = useState("");

    const [error, setError] = useState("");

    const [saving, setSaving] = useState(false);

    const [notice, setNotice] = useState("");

    const [search, setSearch] = useState("");
    const busyRef = useRef(false);

    const options = type === "country" ? countryOptions : skillOptions;
    const pluralLabel = type === "country" ? "Countries" : "Skills";
    const filteredOptions = options.filter(name =>
        name.toLowerCase().includes(search.trim().toLowerCase()) || name === editingName
    );
    const draftNames = [...new Map(newName.split(/[,\r\n]+/)
        .map(value => value.trim().replace(/\s+/g, " "))
        .filter(Boolean)
        .map(name => [name.toLowerCase(), name] as const)).values()];
    const existingNames = new Set(options.map(name => name.trim().toLowerCase()));
    const pendingCount = draftNames.filter(name => !existingNames.has(name.toLowerCase())).length;

    function validateName(value: string, original?: string) {

        const name = value.trim().replace(/\s+/g, " ");

        if (!name) throw new Error(`Please enter a ${type} name.`);

        if (name.includes(",")) {

            throw new Error("Names cannot contain commas because search filters use commas as separators.");

        }

        if (options.some(option =>

            option !== original && option.trim().toLowerCase() === name.toLowerCase()

        )) {

            throw new Error(`This ${type} already exists.`);

        }

        return name;

    }

    async function addMultipleOptions() {

        if (busyRef.current) return;

        setError("");

        setNotice("");

        const seen = new Set<string>();

        const entered = newName.split(/[,\r\n]+/)

            .map(value => value.trim().replace(/\s+/g, " "))

            .filter(value => {

                if (!value || seen.has(value.toLowerCase())) return false;

                seen.add(value.toLowerCase());

                return true;

            });

        if (!entered.length) {

            setError(`Please enter at least one ${type}.`);

            return;

        }

        const existing = new Set(options.map(value => value.trim().toLowerCase()));

        const pending = entered.filter(value => !existing.has(value.toLowerCase()));

        const skipped = entered.length - pending.length;

        if (!pending.length) {

            setNotice("All entered options already exist.");

            setNewName("");

            return;

        }

        busyRef.current = true;

        setSaving(true);

        const failed: string[] = [];

        const failures: string[] = [];

        let added = 0;

        let refreshFailed = false;

        try {

            for (const name of pending) {

                try {

                    const response = await fetch(

                        type === "country" ? "/api/upwork/countries" : "/api/upwork/skills",

                        {

                            method: "POST",

                            headers: { "Content-Type": "application/json" },

                            body: JSON.stringify({ name }),

                        }

                    );

                    const data = await response.json().catch(() => null);

                    if (!response.ok || data?.success !== true) {

                        throw new Error(data?.error || `Request failed (${response.status}).`);

                    }

                } catch (err) {

                    failed.push(name);

                    failures.push(`${name}: ${err instanceof Error ? err.message : "Unable to add option."}`);

                    continue;

                }

                added++;

                // A saved name is never retried, even if the page refresh callback fails.

                try {

                    await onChanged({ type, action: "add", name });

                } catch {

                    refreshFailed = true;

                }

            }

            setNewName(failed.join("\n"));

            setNotice(`Added ${added} ${type === "country" ? "countries" : "skills"}.${skipped ? ` Skipped ${skipped} existing options.` : ""}`);

            const messages = [

                ...failures,

                ...(refreshFailed ? ["Some saved options could not refresh. Reload the page to see them."] : []),

            ];

            setError(messages.join(" "));

        } finally {

            busyRef.current = false;

            setSaving(false);

        }

    }

    async function mutate(action: SearchOptionChange["action"], value: string, original?: string) {

        if (busyRef.current) return;

        setError("");

        setNotice("");

        let name: string;

        try {

            name = action === "delete" ? value : validateName(value, original);

        } catch (err) {

            setError(err instanceof Error ? err.message : "Invalid name.");

            return;

        }

        busyRef.current = true;

        setSaving(true);

        let persisted = false;

        try {

            const response = await fetch(

                type === "country" ? "/api/upwork/countries" : "/api/upwork/skills",

                {

                    method: action === "add" ? "POST" : action === "update" ? "PUT" : "DELETE",

                    headers: { "Content-Type": "application/json" },

                    body: JSON.stringify(action === "update" ? { oldName: original, name } : { name }),

                }

            );

            const data = await response.json().catch(() => null);

            if (!response.ok || data?.success !== true) {

                throw new Error(

                    data?.error ||

                    (response.status === 405

                        ? "This API route needs PUT and DELETE handlers to edit and delete options."

                        : `Unable to ${action} ${type}.`)

                );

            }

            persisted = true;

            if (action === "add") setNewName("");

            if (action === "update" || original === editingName || name === editingName) {

                setEditingName(null);

                setEditValue("");

            }

            await onChanged({ type, action, name, oldName: original });

        } catch (err) {

            setError(persisted

                ? "The change was saved, but the options could not refresh. Close this modal and reload the page."

                : err instanceof Error ? err.message : "Unable to save this change.");

        } finally {

            busyRef.current = false;

            setSaving(false);

        }

    }

    function close() {

        if (!busyRef.current) onClose();

    }

    return (
        <div
            className="fixed inset-0 z-[60] flex items-center justify-center bg-slate-950/65 p-3 backdrop-blur-sm sm:p-6"
            onClick={close}
            onKeyDown={event => {
                if (event.key === "Escape") { event.stopPropagation(); close(); }
            }}
        >
            <div
                role="dialog"
                aria-modal="true"
                aria-labelledby="search-options-title"
                aria-busy={saving}
                className="flex max-h-[90dvh] w-full max-w-4xl flex-col overflow-hidden rounded-2xl border border-white/20 bg-white shadow-[0_30px_100px_rgba(2,6,23,0.35)]"
                onClick={event => event.stopPropagation()}
            >
                <header className="flex shrink-0 items-start justify-between gap-4 border-b border-slate-100 px-5 py-5 sm:px-7 sm:py-6">
                    <div className="flex items-start gap-3">
                        <span className="flex h-11 w-11 shrink-0 items-center justify-center rounded-xl bg-slate-900 text-white">
                            <svg aria-hidden="true" width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.7" strokeLinecap="round"><path d="M4 7h16M4 17h16"/><circle cx="9" cy="7" r="3" fill="currentColor" stroke="none"/><circle cx="15" cy="17" r="3" fill="currentColor" stroke="none"/></svg>
                        </span>
                        <div>
                            <p className="mb-1 text-[10px] font-bold uppercase tracking-[0.16em] text-slate-500">Search preferences</p>
                            <h2 id="search-options-title" className="text-lg font-bold tracking-tight text-slate-900 sm:text-xl">Countries &amp; skills</h2>
                            <p className="mt-1 text-xs leading-5 text-slate-500">Keep your search options organized and up to date.</p>
                        </div>
                    </div>
                    <button type="button" onClick={close} disabled={saving} aria-label="Close modal"
                        className="flex h-9 w-9 shrink-0 items-center justify-center rounded-lg text-xl text-slate-400 transition hover:bg-slate-100 hover:text-slate-700 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-blue-500 disabled:opacity-40">×</button>
                </header>

                <div className="shrink-0 px-5 pt-5 sm:px-7">
                    <div className="grid grid-cols-2 gap-1 rounded-xl bg-slate-100 p-1">
                        {(["country", "skill"] as const).map(optionType => (
                            <button key={optionType} type="button" disabled={saving} aria-pressed={type === optionType}
                                onClick={() => {
                                    setType(optionType); setNewName(""); setEditingName(null);
                                    setEditValue(""); setError(""); setNotice(""); setSearch("");
                                }}
                                className={`flex items-center justify-center gap-2 rounded-lg px-3 py-3 text-xs font-semibold transition focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-blue-500 disabled:opacity-50 ${type === optionType ? "bg-white text-slate-900 shadow-sm" : "text-slate-500 hover:text-slate-800"}`}>
                                <OptionIcon type={optionType} />
                                {optionType === "country" ? "Countries" : "Skills"}
                                <span className={`rounded-md px-1.5 py-0.5 text-[10px] ${type === optionType ? "bg-blue-50 text-blue-700" : "bg-slate-200/70 text-slate-500"}`}>
                                    {optionType === "country" ? countryOptions.length : skillOptions.length}
                                </span>
                            </button>
                        ))}
                    </div>
                </div>

                <div className="min-h-0 overflow-y-auto px-5 pb-6 pt-5 sm:px-7">
                    {notice && <div role="status" className="mb-4 rounded-xl border border-emerald-200 bg-emerald-50 px-4 py-3 text-xs leading-5 text-emerald-800">{notice}</div>}
                    {error && <div role="alert" className="mb-4 rounded-xl border border-red-200 bg-red-50 px-4 py-3 text-xs leading-5 text-red-700">{error}</div>}
                    <div className="grid items-start gap-5 md:grid-cols-[minmax(0,0.9fr)_minmax(0,1.1fr)]">
                        <form onSubmit={event => { event.preventDefault(); void addMultipleOptions(); }}
                            className="rounded-xl border border-slate-200 bg-slate-50/70 p-4 sm:p-5">
                            <div className="mb-4 flex items-center gap-2.5">
                                <span className="flex h-8 w-8 items-center justify-center rounded-lg bg-blue-100 text-blue-700"><svg aria-hidden="true" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round"><path d="M12 5v14M5 12h14"/></svg></span>
                                <div>
                                    <h3 className="text-sm font-semibold text-slate-900">Add {pluralLabel.toLowerCase()}</h3>
                                    <p className="mt-0.5 text-[11px] text-slate-500">Add one or several at once.</p>
                                </div>
                            </div>
                            <label htmlFor="new-search-option" className="mb-2 block text-xs font-semibold text-slate-700">{pluralLabel} to add</label>
                            <textarea id="new-search-option" autoFocus rows={5} value={newName} disabled={saving}
                                aria-describedby="search-options-input-hint"
                                onChange={event => { setNewName(event.target.value); setError(""); setNotice(""); }}
                                placeholder={type === "country" ? "Brazil\nCanada\nAustralia" : "Wix\nWebflow\nShopify"}
                                className="w-full resize-y rounded-xl border border-slate-200 bg-white px-3.5 py-3 text-sm leading-6 text-slate-900 outline-none transition placeholder:text-slate-400 focus:border-blue-400 focus:ring-4 focus:ring-blue-50 disabled:opacity-60" />
                            <p id="search-options-input-hint" className="mt-2 text-[11px] leading-5 text-slate-500">Separate names with commas or new lines. Existing options are skipped.</p>

                            {draftNames.length > 0 && (
                                <div className="mt-4 border-t border-slate-200 pt-3">
                                    <div className="mb-2 flex items-center justify-between text-[11px]">
                                        <span className="font-semibold text-slate-600">Ready to add</span>
                                        <span className="font-semibold text-blue-600">{pendingCount} new</span>
                                    </div>
                                    <div className="flex flex-wrap gap-1.5">
                                        {draftNames.slice(0, 8).map(name => {
                                            const exists = existingNames.has(name.toLowerCase());
                                            return <span key={name.toLowerCase()} className={`max-w-full break-words rounded-md border px-2 py-1 text-[10px] ${exists ? "border-slate-200 bg-slate-100 text-slate-500" : "border-blue-100 bg-blue-50 text-blue-700"}`}>{name}{exists ? " · exists" : ""}</span>;
                                        })}
                                        {draftNames.length > 8 && <span className="px-1 py-1 text-[10px] text-slate-500">+{draftNames.length - 8} more</span>}
                                    </div>
                                </div>
                            )}
                            <button type="submit" disabled={saving || !newName.trim()}
                                className="mt-5 flex h-11 w-full items-center justify-center gap-2 rounded-xl bg-blue-600 px-4 text-xs font-semibold text-white shadow-sm transition hover:bg-blue-700 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-blue-500 focus-visible:ring-offset-2 disabled:cursor-not-allowed disabled:bg-slate-200 disabled:text-slate-500 disabled:shadow-none">
                                {saving ? <><span className="h-3.5 w-3.5 animate-spin rounded-full border-2 border-white/40 border-t-white" />Saving...</> : <>Add {pendingCount > 0 ? pendingCount : "all"} {pluralLabel.toLowerCase()}</>}
                            </button>
                        </form>

                        <section className="min-w-0" aria-labelledby="saved-options-title">
                            <div className="mb-3 flex items-center justify-between">
                                <h3 id="saved-options-title" className="text-sm font-semibold text-slate-900">Saved {pluralLabel.toLowerCase()}</h3>
                                <span className="text-[11px] text-slate-500">{options.length} total</span>
                            </div>
                            <div className="relative mb-3">
                                <svg aria-hidden="true" className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8"><circle cx="10.5" cy="10.5" r="6.5"/><path d="m16 16 4 4"/></svg>
                                <input value={search} disabled={saving} aria-label={`Search ${pluralLabel.toLowerCase()}`}
                                    onChange={event => setSearch(event.target.value)} placeholder={`Find a ${type}...`}
                                    className="h-10 w-full rounded-lg border border-slate-200 bg-white pl-9 pr-3 text-xs text-slate-800 outline-none transition placeholder:text-slate-400 focus:border-blue-400 focus:ring-2 focus:ring-blue-50 disabled:opacity-60" />
                            </div>
                            <ul className="max-h-[320px] space-y-2 overflow-y-auto pr-1">
                                {filteredOptions.map(name => (
                                    <li key={name} className={`rounded-xl border p-3 transition ${editingName === name ? "border-blue-200 bg-blue-50/40" : "border-slate-200 bg-white hover:border-slate-300"}`}>
                                        {editingName === name ? (
                                            <form onSubmit={event => { event.preventDefault(); void mutate("update", editValue, name); }}>
                                                <label className="mb-2 block text-[10px] font-semibold uppercase tracking-wide text-blue-700" htmlFor="edit-search-option">Edit {type}</label>
                                                <input id="edit-search-option" value={editValue} autoFocus disabled={saving}
                                                    onChange={event => { setEditValue(event.target.value); setError(""); }}
                                                    className="h-10 w-full rounded-lg border border-blue-200 bg-white px-3 text-sm text-slate-900 outline-none focus:border-blue-400 focus:ring-2 focus:ring-blue-100" />
                                                <div className="mt-2 flex justify-end gap-2">
                                                    <button type="button" disabled={saving} onClick={() => { setEditingName(null); setEditValue(""); setError(""); }} className="rounded-lg px-3 py-2 text-xs font-medium text-slate-600 hover:bg-slate-100 disabled:opacity-50">Cancel</button>
                                                    <button type="submit" disabled={saving || !editValue.trim()} className="rounded-lg bg-blue-600 px-3 py-2 text-xs font-semibold text-white hover:bg-blue-700 disabled:opacity-50">Save changes</button>
                                                </div>
                                            </form>
                                        ) : (
                                            <div className="flex items-center gap-2.5">
                                                <span className={`flex h-8 w-8 shrink-0 items-center justify-center rounded-lg ${type === "country" ? "bg-blue-50 text-blue-600" : "bg-violet-50 text-violet-600"}`}><OptionIcon type={type} /></span>
                                                <span className="min-w-0 flex-1 break-words text-xs font-medium text-slate-800">{name}</span>
                                                <button type="button" disabled={saving} aria-label={`Edit ${name}`} title={`Edit ${name}`}
                                                    onClick={() => { setEditingName(name); setEditValue(name); setError(""); setNotice(""); }}
                                                    className="flex h-8 w-8 shrink-0 items-center justify-center rounded-lg text-slate-400 transition hover:bg-blue-50 hover:text-blue-600 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-blue-500 disabled:opacity-40">
                                                    <svg aria-hidden="true" width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.7" strokeLinecap="round" strokeLinejoin="round"><path d="m16 4 4 4M4 20l4-1L20 7a2.8 2.8 0 0 0-4-4L4 15v5Z"/></svg>
                                                </button>
                                                <button type="button" disabled={saving} aria-label={`Delete ${name}`} title={`Delete ${name}`}
                                                    onClick={() => { void mutate("delete", name); }}
                                                    className="flex h-8 w-8 shrink-0 items-center justify-center rounded-lg text-slate-400 transition hover:bg-red-50 hover:text-red-600 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-red-500 disabled:opacity-40">
                                                    <svg aria-hidden="true" width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.7" strokeLinecap="round" strokeLinejoin="round"><path d="M3 6h18M9 6V3h6v3M5 6l1 15h12l1-15M10 10v7M14 10v7"/></svg>
                                                </button>
                                            </div>
                                        )}
                                    </li>
                                ))}
                                {filteredOptions.length === 0 && <li className="rounded-xl border border-dashed border-slate-200 bg-slate-50 px-4 py-10 text-center"><p className="text-xs font-semibold text-slate-700">{options.length ? "No matches found" : `No ${pluralLabel.toLowerCase()} yet`}</p><p className="mt-1 text-[11px] text-slate-500">{options.length ? "Try a different search." : "Add your first options to get started."}</p></li>}
                            </ul>
                        </section>
                    </div>
                </div>
                <footer className="flex shrink-0 items-center justify-between gap-4 border-t border-slate-100 bg-slate-50/70 px-5 py-4 sm:px-7">
                    <span role="status" className="flex items-center gap-2 text-[11px] text-slate-500"><span className={`h-1.5 w-1.5 shrink-0 rounded-full ${saving ? "animate-pulse bg-blue-500" : "bg-emerald-500"}`} />{saving ? "Saving your changes..." : "Changes save automatically"}</span>
                    <button type="button" disabled={saving} onClick={close} className="h-10 rounded-lg bg-slate-900 px-5 text-xs font-semibold text-white transition hover:bg-slate-700 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-slate-500 focus-visible:ring-offset-2 disabled:opacity-50">Done</button>
                </footer>
            </div>
        </div>
    );
}

function OptionIcon({ type }: { type: OptionType }) {
    return <svg aria-hidden="true" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.7" strokeLinecap="round" strokeLinejoin="round">
        {type === "country" ? <><circle cx="12" cy="12" r="9"/><path d="M3 12h18M12 3c5 5 5 13 0 18-5-5-5-13 0-18Z"/></> : <><path d="m8 7-5 5 5 5M16 7l5 5-5 5M14 4l-4 16"/></>}
    </svg>;
}
