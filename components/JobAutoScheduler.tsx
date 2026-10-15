"use client";

import { useEffect, useRef, useState } from "react";

const CHECK_INTERVAL_MS = 5 * 60 * 1000;
const JOB_LOOKBACK_MS = 5 * 60 * 1000;
const FETCH_BUFFER_MS = 5 * 60 * 1000;
const REQUEST_TIMEOUT_MS = 120_000;

// Change only this path if your Freelancer Next.js route uses a different folder.
const FREELANCER_API = "/api/freelancer/jobs";
const UPWORK_API = "/api/upwork/jobs";

type Platform = "upwork" | "freelancer";
type Job = {
  id: string;
  title: string;
  publishedDateTime: string;
  url: string | null;
  platform: Platform;
};
type JobAutoSchedulerProps = { userId?: string };

function isRecord(value: unknown): value is Record<string, unknown> {
  return value !== null && typeof value === "object" && !Array.isArray(value);
}

function asString(value: unknown): string {
  return typeof value === "string" ? value : "";
}

function parseJob(raw: unknown, platform: Platform): Job | null {
  if (!isRecord(raw)) return null;
  const id = typeof raw.id === "string" || typeof raw.id === "number" ? String(raw.id) : "";
  const publishedDateTime = asString(raw.createdDateTime) || asString(raw.publishedDateTime);
  if (!id || !publishedDateTime || !Number.isFinite(Date.parse(publishedDateTime))) return null;

  let url: string | null = null;
  if (platform === "freelancer") {
    // The supplied Freelancer API route already returns an absolute project URL.
    const providedUrl = asString(raw.url);
    if (providedUrl) {
      try {
        const parsed = new URL(providedUrl);
        if (parsed.protocol === "https:" &&
            (parsed.hostname === "freelancer.com" || parsed.hostname === "www.freelancer.com")) {
          url = parsed.toString();
        }
      } catch { /* Ignore invalid project URLs. */ }
    }
    if (!url) url = `https://www.freelancer.com/projects/${encodeURIComponent(id)}`;
  } else {
    const key = asString(raw.ciphertext).trim();
    if (key) url = `https://www.upwork.com/jobs/${encodeURIComponent(key.startsWith("~") ? key : `~${key}`)}`;
  }

  return {
    id,
    platform,
    title: asString(raw.title).trim() || "Untitled job",
    publishedDateTime,
    url,
  };
}

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
      method: "GET", cache: "no-store", credentials: "same-origin",
      headers: { Accept: "application/json" }, signal: controller.signal,
    });
    if (response.redirected) throw new Error("Your app session may have expired. Sign in again.");
    if (response.status === 401) return { response, data: {} as Record<string, unknown> };
    let data: unknown;
    try { data = await response.json(); }
    catch {
      if (controller.signal.aborted) throw new Error("Request cancelled.");
      throw new Error(`API returned non-JSON (${response.status}).`);
    }
    if (!isRecord(data)) throw new Error("API returned an invalid response.");
    return { response, data };
  } catch (error) {
    if (timedOut) throw new Error("Request timed out.");
    throw error;
  } finally {
    window.clearTimeout(timer);
    parentSignal.removeEventListener("abort", abort);
  }
}

export default function JobAutoScheduler({ userId }: JobAutoSchedulerProps) {
  // Preserve the existing saved switch preference, so Upwork users aren't reset.
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
    try { saved = Boolean(storageKey && localStorage.getItem(storageKey) === "true"); }
    catch { /* In-memory only. */ }
    setEnabled(saved);
    setLoadedKey(storageKey);
    setReauthRequired(false);
    setStatus(saved ? "Loading notification skills..." : "Scheduler stopped.");
    return () => { activeKey.current = null; };
  }, [storageKey]);

  function savePreference(next: boolean) {
    if (!storageKey || activeKey.current !== storageKey) return;
    try { localStorage.setItem(storageKey, String(next)); }
    catch { /* In-memory only. */ }
    setEnabled(next);
  }

  async function startScheduler() {
    if (!ready || !storageKey || startingRef.current) return;
    if (!("Notification" in window) || !window.isSecureContext) {
      setStatus("Desktop notifications require HTTPS or localhost in a supported browser.");
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
        setStatus("Allow notifications in browser settings first.");
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
    let interval: number | undefined;
    const requestKey = storageKey;
    const alive = () => !disposed && activeKey.current === requestKey;

    function notify(job: Job, skill: string, checkedAt: number): boolean {
      const key = `${job.platform}:${job.id}`; // Prevent duplicate IDs across sites.
      if (!alive() || notifiedJobs.current.has(key)) return false;
      try {
        const platformName = job.platform === "upwork" ? "Upwork" : "Freelancer";
        const notification = new Notification(`[${platformName}] ${job.title}`, {
          body: `Skill: ${skill}\n${job.url || "Open your jobs dashboard."}`,
          icon: "/favicon.ico",
          tag: `job-${job.platform}-${job.id}`,
        });
        notifiedJobs.current.set(key, checkedAt);
        notification.onclick = () => {
          window.open(job.url || (job.platform === "upwork" ? "/upwork-jobs" : "/freelancer-jobs"),
            "_blank", "noopener,noreferrer");
          notification.close();
        };
        notification.onerror = () => {
          if (!alive()) return;
          notifiedJobs.current.delete(key);
          setStatus("A notification failed. Check browser/system notification settings.");
        };
        return true;
      } catch { return false; }
    }

    async function checkJobs() {
      if (!alive() || checking) return;
      if (!("Notification" in window) || !window.isSecureContext || Notification.permission !== "granted") {
        setStatus("Notifications require browser permission. Allow them in your browser settings.");
        return;
      }

      checking = true;
      const controller = new AbortController();
      cycleController.current = controller;
      const checkedAt = Date.now();
      const cutoff = checkedAt - JOB_LOOKBACK_MS;
      const cycleMatches = new Set<string>();
      let completed = 0;
      let failed = 0;
      let notificationCount = 0;
      let notificationFailures = 0;
      const errors: string[] = [];

      try {
        setStatus("Loading notification skills...");
        const { response, data } = await fetchJson("/api/skills", controller.signal);
        if (!alive() || controller.signal.aborted) return;
        if (response.status === 401) throw new Error("Sign in to load skills.");
        if (!response.ok || data.success !== true || !Array.isArray(data.skills) ||
            !data.skills.every(s => typeof s === "string")) {
          throw new Error(asString(data.error) || "Unable to load notification skills.");
        }
        const skills = [...new Map((data.skills as string[])
          .map(s => s.trim()).filter(Boolean).map(s => [s.toLowerCase(), s])).values()];
        if (!skills.length) {
          setStatus("No notification skills enabled. Enable them in Skills Management.");
          return;
        }

        for (const [key, timestamp] of notifiedJobs.current) {
          if (timestamp < checkedAt - 60 * 60 * 1000) notifiedJobs.current.delete(key);
        }

        // Keep each request independent. An Upwork error must not block Freelancer, or vice versa.
        for (const platform of ["upwork", "freelancer"] as const) {
          for (let index = 0; index < skills.length; index++) {
            if (!alive() || controller.signal.aborted) return;
            const skill = skills[index];
            setStatus(`Checking ${platform === "upwork" ? "Upwork" : "Freelancer"} ${index + 1}/${skills.length}: ${skill}`);
            const visitedCursors = new Set<string>();
            let cursor = "0";
            let pageCount = 0;
            try {
              while (alive() && !controller.signal.aborted) {
                if (visitedCursors.has(cursor)) throw new Error("Repeated pagination cursor.");
                visitedCursors.add(cursor);
                const params = new URLSearchParams({
                  first: "50", q: skill, skills: skill, after: cursor,
                  countries: "", paymentVerified: "all", applicants: "all",
                  previousClient: "false",
                  postedDays: String((JOB_LOOKBACK_MS + FETCH_BUFFER_MS) / 86_400_000),
                });
                const base = platform === "upwork" ? UPWORK_API : FREELANCER_API;
                const { response: jobsResponse, data: jobsData } =
                  await fetchJson(`${base}?${params}`, controller.signal);
                if (!alive() || controller.signal.aborted) return;

                if (platform === "upwork" &&
                    (jobsResponse.status === 401 || jobsData.reauthRequired === true ||
                     jobsData.error === "UPWORK_REAUTH_REQUIRED")) {
                  errors.push("Upwork needs reconnection (open /api/upwork/connect)");
                  // Still continue to Freelancer this cycle.
                  break;
                }
                if (!jobsResponse.ok || jobsData.success !== true || !Array.isArray(jobsData.jobs)) {
                  throw new Error(asString(jobsData.message) || asString(jobsData.error) ||
                    `Jobs request failed (${jobsResponse.status}).`);
                }

                for (const raw of jobsData.jobs) {
                  const job = parseJob(raw, platform);
                  if (!job) continue;
                  const publishedAt = Date.parse(job.publishedDateTime);
                  if (publishedAt < cutoff || publishedAt > checkedAt) continue;
                  const key = `${platform}:${job.id}`;
                  cycleMatches.add(key);
                  if (!notifiedJobs.current.has(key)) {
                    if (notify(job, skill, checkedAt)) notificationCount++;
                    else notificationFailures++;
                  }
                }

                const pageInfo = isRecord(jobsData.pageInfo) ? jobsData.pageInfo : null;
                if (!pageInfo?.hasNextPage) break;
                if (typeof pageInfo.endCursor !== "string" || !pageInfo.endCursor) {
                  throw new Error("Missing next-page cursor.");
                }
                cursor = pageInfo.endCursor;
                pageCount++;
                // Bound every skill scan; pagination may be large on Freelancer.
                if (pageCount >= 20) {
                  errors.push(`${platform} ${skill}: page limit reached`);
                  break;
                }
              }
              completed++;
            } catch (error) {
              if (!alive() || controller.signal.aborted) return;
              failed++;
              errors.push(`${platform} ${skill}: ${error instanceof Error ? error.message : "unknown error"}`);
            }
          }
        }
        if (alive()) {
          setStatus(`${completed}/${skills.length * 2} platform/skill checks succeeded` +
            `${failed ? `; ${failed} failed` : ""}. ${cycleMatches.size} fresh jobs; ` +
            `${notificationCount} notifications.${notificationFailures ? ` ${notificationFailures} notification failures.` : ""}` +
            `${errors.length ? ` Issues: ${errors.slice(0, 2).join("; ")}.` : ""}` +
            ` Checking every 5 minutes while this page is active.`);
        }
      } catch (error) {
        if (!alive() || controller.signal.aborted) return;
        setStatus(`${error instanceof Error ? error.message : "Unable to check jobs."} Retrying next check.`);
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

  if (!userId) return null;
  return (
    <div className="job-notification-control">
      <span className="notification-label">Upwork + Freelancer Notifications</span>
      <button type="button" role="switch" aria-checked={ready && enabled}
        aria-label="Upwork and Freelancer job notifications" aria-busy={starting}
        title={status} disabled={!ready || starting} className="notification-switch"
        onClick={() => enabled ? stopScheduler() : void startScheduler()}
        style={{ backgroundColor: ready && enabled ? "#3B82F6" : "#64748B" }}>
        <span aria-hidden="true" className="notification-thumb"
          style={{ transform: ready && enabled ? "translateX(20px)" : "translateX(0)" }} />
      </button>
      <span role="status" className="notification-status">{status}</span>
      {reauthRequired && (
        <a className="reconnect-link" href="/api/upwork/connect"
          title="Reconnect Upwork, then reload this page">Reconnect Upwork</a>
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
