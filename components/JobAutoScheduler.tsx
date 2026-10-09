"use client";

import { useEffect, useRef, useState } from "react";

const CHECK_INTERVAL_MS = 5 * 60 * 1000;
const JOB_LOOKBACK_MS = 5 * 60 * 1000;
const FETCH_BUFFER_MS = 5 * 60 * 1000;
const REQUEST_TIMEOUT_MS = 120_000;

const FIXED_SKILLS = ["wix"];

const FIXED_PARAMS = {
    first: "50",
    countries: "",
    paymentVerified: "all",
    applicants: "all",
    previousClient: "false",
    postedDays: String(
        (JOB_LOOKBACK_MS + FETCH_BUFFER_MS) / 86_400_000
    ),
};

type Job = {
    id: string;
    title?: string | null;
    ciphertext?: string | null;
    publishedDateTime?: string | null;
};

type JobsResponse = {
    success: boolean;
    jobs?: Job[];
    total?: number;
    sourceTotal?: number;
    message?: string;
    error?: string;
    reauthRequired?: boolean;
    pageInfo?: {
        endCursor?: string | null;
        hasNextPage?: boolean;
    };
};

type JobAutoSchedulerProps = {
    userId?: string;
};

function getJobUrl(job: Job): string | null {
    const ciphertext = job.ciphertext?.trim();

    if (!ciphertext) return null;

    const jobKey = ciphertext.startsWith("~")
        ? ciphertext
        : `~${ciphertext}`;

    return `https://www.upwork.com/jobs/${encodeURIComponent(jobKey)}`;
}

export default function JobAutoScheduler({
    userId,
}: JobAutoSchedulerProps) {
    const storageKey =
        `upwork-job-notifications:${userId ?? "default"}`;

    const [enabled, setEnabled] = useState(false);
    const [ready, setReady] = useState(false);
    const [starting, setStarting] = useState(false);
    const [status, setStatus] = useState("Scheduler stopped.");
    const [reauthRequired, setReauthRequired] = useState(false);
    const [showMessage, setShowMessage] = useState(false);

    const notifiedJobs = useRef(new Map<string, number>());
    const mounted = useRef(false);
    const startingRef = useRef(false);

    useEffect(() => {
        mounted.current = true;

        let savedEnabled = false;

        try {
            savedEnabled =
                localStorage.getItem(storageKey) === "true";
        } catch {
            // Use the default OFF state if storage is unavailable.
        }

        setEnabled(savedEnabled);
        setReauthRequired(false);
        setShowMessage(false);
        setStatus(
            savedEnabled
                ? "Notifications enabled. Starting job checks..."
                : "Scheduler stopped."
        );
        setReady(true);

        return () => {
            mounted.current = false;
        };
    }, [storageKey]);

    function savePreference(nextEnabled: boolean) {
        try {
            localStorage.setItem(
                storageKey,
                String(nextEnabled)
            );
        } catch {
            // The toggle still works for this session.
        }

        setEnabled(nextEnabled);
    }

    async function startScheduler() {
        if (startingRef.current) return;

        if (!("Notification" in window)) {
            setStatus(
                "This browser does not support desktop notifications."
            );
            setShowMessage(true);
            return;
        }

        if (!window.isSecureContext) {
            setStatus(
                "Desktop notifications require HTTPS or localhost."
            );
            setShowMessage(true);
            return;
        }

        startingRef.current = true;
        setStarting(true);

        try {
            const permission =
                Notification.permission === "granted"
                    ? "granted"
                    : await Notification.requestPermission();

            if (!mounted.current) return;

            if (permission !== "granted") {
                setStatus(
                    "Allow notifications in your browser settings first."
                );
                setShowMessage(true);
                return;
            }

            setReauthRequired(false);
            setShowMessage(false);
            setStatus(
                "Notifications enabled. Starting job checks..."
            );

            savePreference(true);
        } catch {
            if (!mounted.current) return;

            setStatus("Unable to enable desktop notifications.");
            setShowMessage(true);
        } finally {
            startingRef.current = false;

            if (mounted.current) {
                setStarting(false);
            }
        }
    }

    function stopScheduler() {
        savePreference(false);
        setReauthRequired(false);
        setShowMessage(false);
        setStatus("Scheduler stopped.");
    }

    useEffect(() => {
        if (!ready || !enabled || reauthRequired) return;

        let disposed = false;
        let checking = false;
        let currentController: AbortController | null = null;

        function requireReauthorization() {
            if (disposed) return;

            setReauthRequired(true);
            setShowMessage(true);
            setStatus(
                "Notifications are ON, but job checks are paused. Reconnect Upwork, then reload this page."
            );
        }

        async function checkJobs() {
            if (disposed || checking) return;

            if (
                !("Notification" in window) ||
                !window.isSecureContext ||
                Notification.permission !== "granted"
            ) {
                setStatus(
                    "Notifications are ON, but browser permission is unavailable. Allow notifications in your browser settings."
                );
                setShowMessage(true);
                return;
            }

            checking = true;

            const checkedAt = Date.now();
            const cutoff = checkedAt - JOB_LOOKBACK_MS;
            const controller = new AbortController();

            currentController = controller;

            const timeout = window.setTimeout(() => {
                controller.abort();
            }, REQUEST_TIMEOUT_MS);

            try {
                setStatus("Checking for new jobs...");
                setShowMessage(false);

                const retentionMs = Math.max(
                    JOB_LOOKBACK_MS + FETCH_BUFFER_MS,
                    60 * 60 * 1000
                );

                for (const [id, notifiedAt] of notifiedJobs.current) {
                    if (notifiedAt < checkedAt - retentionMs) {
                        notifiedJobs.current.delete(id);
                    }
                }

                const matches = new Map<string, Job>();
                let fetchedRows = 0;

                for (const skill of FIXED_SKILLS) {
                    if (disposed) return;

                    let cursor = "0";
                    const visitedCursors = new Set<string>();

                    while (!disposed) {
                        if (visitedCursors.has(cursor)) {
                            throw new Error(
                                "API returned a repeated pagination cursor."
                            );
                        }

                        visitedCursors.add(cursor);

                        const params = new URLSearchParams({
                            ...FIXED_PARAMS,
                            q: skill,
                            skills: skill,
                            after: cursor,
                        });

                        const response = await fetch(
                            `/api/upwork/jobs?${params.toString()}`,
                            {
                                method: "GET",
                                cache: "no-store",
                                credentials: "same-origin",
                                headers: {
                                    Accept: "application/json",
                                },
                                signal: controller.signal,
                            }
                        );

                        if (disposed) return;

                        if (response.status === 401) {
                            requireReauthorization();
                            return;
                        }

                        if (response.redirected) {
                            throw new Error(
                                "Jobs API redirected. Check your app login."
                            );
                        }

                        const raw = await response.text();

                        if (disposed) return;

                        let data: JobsResponse;

                        try {
                            data = JSON.parse(raw) as JobsResponse;
                        } catch {
                            throw new Error(
                                `Jobs API returned non-JSON (${response.status}). Check your app login.`
                            );
                        }

                        if (
                            !data ||
                            typeof data !== "object" ||
                            Array.isArray(data)
                        ) {
                            throw new Error(
                                "Jobs API returned an invalid response."
                            );
                        }

                        if (
                            data.reauthRequired ||
                            data.error === "UPWORK_REAUTH_REQUIRED"
                        ) {
                            requireReauthorization();
                            return;
                        }

                        if (!response.ok || data.success !== true) {
                            throw new Error(
                                data.message ||
                                data.error ||
                                `Unable to fetch jobs (${response.status}).`
                            );
                        }

                        if (!Array.isArray(data.jobs)) {
                            throw new Error(
                                "API returned an invalid jobs list."
                            );
                        }

                        fetchedRows += data.jobs.length;

                        for (const job of data.jobs) {
                            const publishedAt = job.publishedDateTime
                                ? Date.parse(job.publishedDateTime)
                                : NaN;

                            if (
                                job.id &&
                                Number.isFinite(publishedAt) &&
                                publishedAt >= cutoff &&
                                publishedAt <= checkedAt &&
                                !notifiedJobs.current.has(job.id)
                            ) {
                                matches.set(job.id, job);
                            }
                        }

                        if (!data.pageInfo?.hasNextPage) break;

                        const nextCursor = data.pageInfo.endCursor;

                        if (!nextCursor) {
                            throw new Error(
                                "API returned no next-page cursor."
                            );
                        }

                        cursor = nextCursor;
                    }
                }

                if (disposed) return;

                const newJobs = [...matches.values()];
                let notificationCount = 0;

                for (const job of newJobs) {
                    if (disposed) return;

                    const jobUrl = getJobUrl(job);

                    try {
                        const notification = new Notification(
                            job.title || "New Upwork job",
                            {
                                body: jobUrl
                                    ? `New matching job\n${jobUrl}`
                                    : "Click to open your jobs page.",
                                icon: "/favicon.ico",
                                tag: `upwork-job-${job.id}`,
                            }
                        );

                        notification.onclick = () => {
                            window.open(
                                jobUrl ?? "/upwork-jobs",
                                "_blank",
                                "noopener,noreferrer"
                            );

                            notification.close();
                        };

                        notification.onerror = () => {
                            notifiedJobs.current.delete(job.id);

                            if (!disposed) {
                                setStatus(
                                    "A notification could not be displayed. Check browser and system notification settings."
                                );
                                setShowMessage(true);
                            }
                        };

                        notifiedJobs.current.set(job.id, checkedAt);
                        notificationCount += 1;
                    } catch {
                        // Leave this job eligible for a later attempt.
                    }
                }

                if (disposed) return;

                setStatus(
                    `Checked at ${new Date().toLocaleTimeString()}. ` +
                    `${fetchedRows} API rows fetched; ` +
                    `${newJobs.length} new matching jobs; ` +
                    `${notificationCount} notifications created.`
                );
            } catch (error) {
                if (disposed) return;

                const message = controller.signal.aborted
                    ? "Request timed out."
                    : error instanceof Error
                        ? error.message
                        : "Unable to check jobs.";

                setStatus(
                    `${message} Will retry at the next interval.`
                );
                setShowMessage(true);
            } finally {
                window.clearTimeout(timeout);
                checking = false;

                if (currentController === controller) {
                    currentController = null;
                }
            }
        }

        void checkJobs();

        const interval = window.setInterval(() => {
            void checkJobs();
        }, CHECK_INTERVAL_MS);

        return () => {
            disposed = true;
            window.clearInterval(interval);
            currentController?.abort();
        };
    }, [enabled, ready, reauthRequired]);

    return (
        <div className="job-notification-control">
            <span className="notification-label">
                Notifications
            </span>

            <button
                type="button"
                role="switch"
                aria-checked={enabled}
                aria-label="Job notifications"
                aria-busy={starting}
                title={status}
                disabled={!ready || starting}
                className="notification-switch"
                onClick={() => {
                    if (!ready || starting) return;

                    if (enabled) {
                        stopScheduler();
                    } else {
                        void startScheduler();
                    }
                }}
                style={{
                    backgroundColor: enabled
                        ? "#3B82F6"
                        : "#64748B",
                }}
            >
                <span
                    aria-hidden="true"
                    className="notification-thumb"
                    style={{
                        transform: enabled
                            ? "translateX(20px)"
                            : "translateX(0)",
                    }}
                />
            </button>

            <span
                role="status"
                className="notification-status"
            >
                {status}
            </span>

            {showMessage && (
                <div className="notification-message">
                    <p>{status}</p>

                    {reauthRequired && (
                        <a href="/api/upwork/connect">
                            Reconnect Upwork
                        </a>
                    )}
                </div>
            )}

            <style jsx>{`
                .job-notification-control {
                    position: relative;
                    display: inline-flex;
                    align-items: center;
                    gap: 10px;
                    flex-shrink: 0;
                    white-space: nowrap;
                    color: white;
                }

                .notification-label {
                    position: static;
                    display: block;
                    font-size: 14px;
                    font-weight: 600;
                    line-height: 20px;
                }

                .notification-switch {
                    position: relative;
                    display: block;
                    flex: 0 0 44px;
                    box-sizing: border-box;
                    width: 44px;
                    height: 24px;
                    margin: 0;
                    padding: 0;
                    border: 0;
                    border-radius: 999px;
                    appearance: none;
                    background-image: none;
                    cursor: pointer;
                    overflow: hidden;
                    transition: background-color 0.2s;
                }

                .notification-switch:disabled {
                    cursor: wait;
                    opacity: 0.7;
                }

                .notification-thumb {
                    position: absolute;
                    display: block;
                    left: 4px;
                    top: 4px;
                    width: 16px;
                    height: 16px;
                    margin: 0;
                    padding: 0;
                    border-radius: 50%;
                    background: white;
                    pointer-events: none;
                    transition: transform 0.2s;
                }

                .notification-switch::before,
                .notification-switch::after,
                .notification-thumb::before,
                .notification-thumb::after {
                    content: none !important;
                    display: none !important;
                }

                .notification-status {
                    position: absolute;
                    width: 1px;
                    height: 1px;
                    padding: 0;
                    margin: -1px;
                    overflow: hidden;
                    clip-path: inset(50%);
                    white-space: nowrap;
                    border: 0;
                }

                .notification-message {
                    position: absolute;
                    right: 0;
                    top: 100%;
                    z-index: 60;
                    width: 256px;
                    max-width: calc(100vw - 40px);
                    box-sizing: border-box;
                    margin-top: 12px;
                    padding: 12px;
                    border-radius: 12px;
                    background: #111b48;
                    font-size: 14px;
                    line-height: 20px;
                    white-space: normal;
                    overflow-wrap: anywhere;
                    box-shadow: 0 10px 25px rgba(0, 0, 0, 0.25);
                }

                .notification-message p {
                    margin: 0;
                }

                .notification-message a {
                    display: inline-block;
                    margin-top: 8px;
                    color: #93c5fd;
                    text-decoration: underline;
                }
            `}</style>
        </div>
    );
}