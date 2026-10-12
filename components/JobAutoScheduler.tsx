"use client";

import { useEffect, useRef, useState } from "react";

const CHECK_INTERVAL_MS = 5 * 60 * 1000;
const JOB_LOOKBACK_MS = 5 * 60 * 1000;
const FETCH_BUFFER_MS = 5 * 60 * 1000;
const REQUEST_TIMEOUT_MS = 120_000;

const FIXED_PARAMS = {
    first: "50",
    countries: "",
    paymentVerified: "all",
    applicants: "all",
    previousClient: "false",
    postedDays: String((JOB_LOOKBACK_MS + FETCH_BUFFER_MS) / 86_400_000),
};

type Job = {
    id: string;
    title: string;
    ciphertext: string | null;
    publishedDateTime: string;
};

type JobAutoSchedulerProps = { userId?: string };

function isRecord(value: unknown): value is Record<string, unknown> {
    return value !== null && typeof value === "object" && !Array.isArray(value);
}

function errorMessage(error: unknown): string {
    return error instanceof Error ? error.message : "Unable to check jobs.";
}

function getJobUrl(job: Job): string | null {
    const key = job.ciphertext?.trim();
    if (!key) return null;
    return `https://www.upwork.com/jobs/${encodeURIComponent(key.startsWith("~") ? key : `~${key}`)}`;
}

// Each request has its own timeout, so later skills get their full time limit.
async function fetchJson(url: string, parentSignal: AbortSignal) {
    const controller = new AbortController();
    const abort = () => controller.abort();
    parentSignal.addEventListener("abort", abort, { once: true });
    if (parentSignal.aborted) controller.abort();
    let timedOut = false;
    const timer = window.setTimeout(() => {
        timedOut = true;
        controller.abort();
    }, REQUEST_TIMEOUT_MS);

    try {
        const response = await fetch(url, {
            method: "GET",
            cache: "no-store",
            credentials: "same-origin",
            headers: { Accept: "application/json" },
            signal: controller.signal,
        });
        if (response.redirected) throw new Error("Your app session may have expired. Sign in again.");
        // Handle authentication before attempting to parse a possibly empty body.
        if (response.status === 401) return { response, data: {} as Record<string, unknown> };
        let data: unknown;
        try {
            data = await response.json();
        } catch {
            if (controller.signal.aborted) throw new Error("Request cancelled.");
            throw new Error(`API returned non-JSON (${response.status}).`);
        }
        if (!isRecord(data)) throw new Error("API returned an invalid response.");
        return { response, data };
    } catch (error) {
        if (timedOut) throw new Error("Request timed out. The next skill will still be checked.");
        throw error;
    } finally {
        window.clearTimeout(timer);
        parentSignal.removeEventListener("abort", abort);
    }
}

export default function JobAutoScheduler({ userId }: JobAutoSchedulerProps) {
    const storageKey = userId ? `upwork-job-notifications:${userId}` : null;
    const [enabled, setEnabled] = useState(false);
    const [loadedKey, setLoadedKey] = useState<string | null>(null);
    const [starting, setStarting] = useState(false);
    const [status, setStatus] = useState("Scheduler stopped.");
    const [reauthRequired, setReauthRequired] = useState(false);

    const activeKey = useRef<string | null>(null);
    const startingRef = useRef(false);
    const notifiedJobs = useRef(new Map<string, number>());
    const cycleController = useRef<AbortController | null>(null);
    const ready = storageKey !== null && loadedKey === storageKey;

    useEffect(() => {
        activeKey.current = storageKey;
        notifiedJobs.current.clear();
        let saved = false;
        try {
            saved = Boolean(storageKey && localStorage.getItem(storageKey) === "true");
        } catch { /* The switch still works for this session. */ }
        setEnabled(saved);
        setLoadedKey(storageKey);
        setReauthRequired(false);

        setStatus(saved ? "Loading notification skills..." : "Scheduler stopped.");
        return () => { activeKey.current = null; };
    }, [storageKey]);

    function savePreference(next: boolean) {
        if (!storageKey || activeKey.current !== storageKey) return;
        try { localStorage.setItem(storageKey, String(next)); }
        catch { /* Keep the current-session preference. */ }
        setEnabled(next);
    }

    async function startScheduler() {
        if (!ready || !storageKey || startingRef.current) return;
        if (!("Notification" in window) || !window.isSecureContext) {
            setStatus("Desktop notifications require a supported browser on HTTPS or localhost.");
            return;
        }
        const requestKey = storageKey;
        startingRef.current = true;
        setStarting(true);
        try {
            const permission = Notification.permission === "granted"
                ? "granted" : await Notification.requestPermission();
            if (activeKey.current !== requestKey) return;
            if (permission !== "granted") {
                setStatus("Allow notifications in your browser settings first.");
                return;
            }
            setReauthRequired(false);
            setStatus("Loading notification skills...");
            savePreference(true);
        } catch {
            if (activeKey.current === requestKey) setStatus("Unable to enable notifications.");
        } finally {
            startingRef.current = false;
            if (activeKey.current !== null) setStarting(false);
        }
    }

    function stopScheduler() {
        cycleController.current?.abort();
        savePreference(false);
        setReauthRequired(false);
        setStatus("Scheduler stopped.");
    }

    useEffect(() => {
        if (!storageKey || !ready || !enabled || reauthRequired) return;
        let disposed = false;
        let checking = false;
        let paused = false;
        let interval: number | undefined;
        const requestKey = storageKey;
        const alive = () => !disposed && activeKey.current === requestKey;

        function pauseForReauthorization() {
            paused = true;
            if (!alive()) return;
            setReauthRequired(true);
            setStatus("Job checks paused. Reconnect Upwork, then reload this page.");
        }

        function notify(job: Job, skill: string, checkedAt: number) {
            if (!alive() || notifiedJobs.current.has(job.id)) return false;
            const url = getJobUrl(job);
            try {
                const notification = new Notification(job.title || "New Upwork job", {
                    body: `Skill: ${skill}\n${url ?? "Click to open your jobs page."}`,
                    icon: "/favicon.ico",
                    tag: `upwork-job-${job.id}`,
                });
                notifiedJobs.current.set(job.id, checkedAt);
                notification.onclick = () => {
                    window.open(url ?? "/upwork-jobs", "_blank", "noopener,noreferrer");
                    notification.close();
                };
                notification.onerror = () => {
                    if (!alive()) return;
                    notifiedJobs.current.delete(job.id);
                    setStatus("A notification could not be displayed. Check browser and system settings.");
                };
                return true;
            } catch {
                return false;
            }
        }

        async function checkJobs() {
            if (!alive() || paused || checking) return;
            if (!("Notification" in window) || !window.isSecureContext || Notification.permission !== "granted") {
                setStatus("Notifications are ON, but browser permission is unavailable. Allow notifications in browser settings.");
                return;
            }

            checking = true;
            const controller = new AbortController();
            cycleController.current = controller;
            const checkedAt = Date.now();
            const cutoff = checkedAt - JOB_LOOKBACK_MS;

            try {
                setStatus("Loading notification skills...");
                const { response, data } = await fetchJson("/api/skills", controller.signal);
                if (!alive() || controller.signal.aborted) return;
                if (response.status === 401) throw new Error("Check your app login to load skills.");
                if (!response.ok || data.success !== true) {
                    throw new Error(typeof data.error === "string" ? data.error : "Unable to load skills.");
                }
                if (!Array.isArray(data.skills) || !data.skills.every(skill => typeof skill === "string")) {
                    throw new Error("Skills API returned an invalid skills list.");
                }
                const skills = [...new Map((data.skills as string[])
                    .map(skill => skill.trim()).filter(Boolean)
                    .map(skill => [skill.toLowerCase(), skill])).values()];

                if (!skills.length) {
                    setStatus("No notification skills enabled. Enable them in Skills Management.");
                    return;
                }
                for (const [id, timestamp] of notifiedJobs.current) {
                    if (timestamp < checkedAt - 60 * 60 * 1000) notifiedJobs.current.delete(id);
                }

                const cycleMatches = new Set<string>();
                let completed = 0;
                let failed = 0;
                let totalNotifications = 0;
                let notificationFailures = 0;

                // Await ALL pages of the current skill before starting the next skill.
                for (let index = 0; index < skills.length; index++) {
                    if (!alive() || controller.signal.aborted) return;
                    const skill = skills[index];
                    const matches = new Map<string, Job>();
                    const visitedCursors = new Set<string>();
                    let cursor = "0";
                    setStatus(`Checking ${index + 1}/${skills.length}: ${skill}`);

                    try {
                        while (alive() && !controller.signal.aborted) {
                            if (visitedCursors.has(cursor)) throw new Error("API repeated a pagination cursor.");
                            visitedCursors.add(cursor);
                            const params = new URLSearchParams({ ...FIXED_PARAMS, q: skill, skills: skill, after: cursor });
                            const { response: jobsResponse, data: jobsData } = await fetchJson(`/api/upwork/jobs?${params}`, controller.signal);
                            if (!alive() || controller.signal.aborted) return;
                            if (jobsResponse.status === 401 || jobsData.reauthRequired === true || jobsData.error === "UPWORK_REAUTH_REQUIRED") {
                                pauseForReauthorization();
                                return;
                            }
                            if (!jobsResponse.ok || jobsData.success !== true) {
                                throw new Error(typeof jobsData.message === "string" ? jobsData.message
                                    : typeof jobsData.error === "string" ? jobsData.error : `Jobs request failed (${jobsResponse.status}).`);
                            }
                            if (!Array.isArray(jobsData.jobs)) throw new Error("API returned an invalid jobs list.");

                            for (const raw of jobsData.jobs) {
                                if (!isRecord(raw) || typeof raw.id !== "string" || !raw.id || typeof raw.publishedDateTime !== "string") continue;
                                const publishedAt = Date.parse(raw.publishedDateTime);
                                if (!Number.isFinite(publishedAt) || publishedAt < cutoff || publishedAt > checkedAt || matches.has(raw.id)) continue;
                                const job: Job = {
                                    id: raw.id,
                                    title: typeof raw.title === "string" && raw.title.trim() ? raw.title : "Untitled job",
                                    ciphertext: typeof raw.ciphertext === "string" ? raw.ciphertext : null,
                                    publishedDateTime: raw.publishedDateTime,
                                };
                                matches.set(job.id, job);
                                cycleMatches.add(job.id);
                                // Notify NOW; do not wait for the other skills to finish.
                                if (!notifiedJobs.current.has(job.id)) {
                                    if (notify(job, skill, checkedAt)) {
                                        totalNotifications++;
                                    } else notificationFailures++;
                                }
                            }
                            const pageInfo = isRecord(jobsData.pageInfo) ? jobsData.pageInfo : null;
                            if (!pageInfo?.hasNextPage) break;
                            if (typeof pageInfo.endCursor !== "string" || !pageInfo.endCursor) throw new Error("API returned no next-page cursor.");
                            cursor = pageInfo.endCursor;
                        }
                        if (!alive() || controller.signal.aborted) return;
                        completed++;
                    } catch {
                        if (!alive() || controller.signal.aborted) return;
                        failed++;
                    }
                }
                if (alive()) {
                    setStatus(`${completed}/${skills.length} skills checked${failed ? `; ${failed} failed` : ""}. ${cycleMatches.size} matching jobs; ${totalNotifications} notifications created.${notificationFailures ? ` ${notificationFailures} notifications failed.` : ""} Checks repeat every 5 minutes.`);
                }
            } catch (error) {
                if (!alive() || controller.signal.aborted) return;
                setStatus(`${errorMessage(error)} Retrying at the next check.`);
            } finally {
                checking = false;
                if (cycleController.current === controller) cycleController.current = null;
            }
        }

        // Keep the existing five-minute schedule. Skip a tick if a check is still running.
        void checkJobs();
        interval = window.setInterval(() => void checkJobs(), CHECK_INTERVAL_MS);
        return () => {
            disposed = true;
            window.clearInterval(interval);
            cycleController.current?.abort();
        };
    }, [storageKey, ready, enabled, reauthRequired]);

    if (!userId) return null;

    return (
        <div className="job-notification-control">
            <span className="notification-label">Notifications</span>
            <button type="button" role="switch" aria-checked={ready && enabled}
                aria-label="Job notifications" aria-busy={starting} title={status}
                disabled={!ready || starting} className="notification-switch"
                onClick={() => enabled ? stopScheduler() : void startScheduler()}
                style={{ backgroundColor: ready && enabled ? "#3B82F6" : "#64748B" }}>
                <span aria-hidden="true" className="notification-thumb"
                    style={{ transform: ready && enabled ? "translateX(20px)" : "translateX(0)" }} />
            </button>
            <span role="status" className="notification-status">{status}</span>
            {reauthRequired && (
                <a className="reconnect-link" href="/api/upwork/connect" title="Reconnect Upwork, then reload this page">Reconnect</a>
            )}
            <style jsx>{`
                .job-notification-control { position: relative; display: inline-flex; align-items: center; gap: 8px; flex-shrink: 0; color: #fff; }
                .notification-label { position: static; font-size: 13px; font-weight: 600; line-height: 20px; }
                .notification-switch { position: relative; display: block; flex: 0 0 44px; box-sizing: border-box; width: 44px; height: 24px; margin: 0; padding: 0; border: 0; border-radius: 999px; appearance: none; background-image: none; cursor: pointer; overflow: hidden; transition: background-color .2s; }
                .notification-switch:disabled { cursor: wait; opacity: .7; }
                .notification-thumb { position: absolute; display: block; left: 4px; top: 4px; width: 16px; height: 16px; margin: 0; padding: 0; border-radius: 50%; background: #fff; pointer-events: none; transition: transform .2s; }
                .notification-switch::before, .notification-switch::after, .notification-thumb::before, .notification-thumb::after { content: none !important; display: none !important; }
                .notification-status { position: absolute; width: 1px; height: 1px; padding: 0; margin: -1px; overflow: hidden; clip-path: inset(50%); white-space: nowrap; border: 0; }
                .reconnect-link { position: static; font-size: 11px; color: #93c5fd; text-decoration: underline; }
                button:focus-visible, a:focus-visible { outline: 2px solid #93c5fd; outline-offset: 3px; }
                @media(max-width: 520px) { .notification-label { font-size: 12px; } }
                @media(prefers-reduced-motion: reduce) { .notification-switch, .notification-thumb { transition: none; } }
            `}</style>
        </div>
    );
}