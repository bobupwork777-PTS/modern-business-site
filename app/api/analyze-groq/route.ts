import { connectDB } from "@/lib/mongodb";
import Prompt from "@/lib/models/Prompt";

export const runtime = "nodejs";

function toText(value: unknown): string {
    return typeof value === "string" || typeof value === "number" ? String(value) : "";
}

function escapeRegex(value: string): string {
    return value.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
}

function detectSkill(title: string, description: string): string {
    const platforms = [
        { name: "Wix Studio", pattern: /\bwix\s+studio\b/i },
        { name: "Wix", pattern: /\bwix\b|\bvelo\b/i },
        { name: "Webflow", pattern: /\bwebflow\b/i },
        { name: "Shopify", pattern: /\bshopify\b/i },
        { name: "Framer", pattern: /\bframer\b/i },
        { name: "Illustration", pattern: /\billustrat(?:ion|ions|or)\b/i },
        { name: "Next.js", pattern: /\bnext(?:\.js|js|\s+js)\b/i }
    ];
    for (const content of [title, description]) {
        const match = platforms.find(platform => platform.pattern.test(content));
        if (match) return match.name;
    }
    return "";
}

function safeErrorMessage(error: unknown): string {
    let message = error instanceof Error ? error.message : "Unknown server error";
    for (const secret of [process.env.GROQ_API_KEY, process.env.MONGODB_URI]) {
        if (secret) message = message.split(secret).join("[redacted]");
    }
    return message
        .replace(/mongodb(?:\+srv)?:\/\/[^\s]+/gi, "[redacted database URI]")
        .replace(/([?&]key=)[^&\s]+/gi, "$1[redacted]")
        .replace(/gsk_[\w-]+/g, "[redacted API key]")
        .slice(0, 1800);
}

export async function POST(req: Request) {
    let stage = "request validation";
    try {
        const apiKey = process.env.GROQ_API_KEY;
        if (!apiKey) {
            return Response.json({ error: "Missing GROQ_API_KEY" }, { status: 500 });
        }

        let body;
        try {
            body = await req.json();
        } catch {
            return Response.json({ error: "Invalid JSON request" }, { status: 400 });
        }
        const job = body?.job;
        if (!job || typeof job !== "object" || Array.isArray(job)) {
            return Response.json({ error: "Job data missing" }, { status: 400 });
        }
        const title = toText(job.Title).trim();
        const description = toText(job.Description).trim();
        if (!title || !description) {
            return Response.json(
                { error: "Job title and description are required" }, { status: 400 }
            );
        }

        // Older Upwork callers omit promptFor. Freelancer callers must send it.
        const requestedPlatform = toText(body.promptFor).trim();
        const promptFor = requestedPlatform || "Upwork";
        if (promptFor !== "Freelancer" && promptFor !== "Upwork") {
            return Response.json(
                { error: "promptFor must be Freelancer or Upwork" }, { status: 400 }
            );
        }

        const selectedSkills: string[] = Array.isArray(body.selectedSkills)
            ? body.selectedSkills
                .filter((value: unknown): value is string => typeof value === "string")
                .map((value: string) => value.trim()).filter(Boolean)
            : [];
        const explicitSkill = toText(body.skill).trim();
        const jobSkill = toText(job.Skill).trim();
        // The button's matched skill takes priority. Otherwise use search skills.
        // Job detection is used only when the request contains no selected skill.
        const candidateSkills = explicitSkill
            ? [explicitSkill]
            : selectedSkills.length ? selectedSkills
            : [jobSkill || detectSkill(title, description)].filter(Boolean);
        if (!candidateSkills.length) {
            return Response.json({ error: "Select a skill for this job" }, { status: 400 });
        }

        const promptId = toText(body.promptId).trim();
        if (promptId && !/^[a-f\d]{24}$/i.test(promptId)) {
            return Response.json({ error: "Invalid prompt ID" }, { status: 400 });
        }

        stage = "MongoDB connection";
        await connectDB();
        stage = "prompt lookup";
        let promptData = null;
        let skillName = "";
        for (const skill of candidateSkills) {
            const skillMatch = new RegExp(`^${escapeRegex(skill)}$`, "i");
            promptData = await Prompt.findOne({
                ...(promptId ? { _id: promptId } : {}),
                promptFor,
                active: true,
                $or: [
                    { skillId: skillMatch },
                    { skillName: skillMatch }
                ]
            }).sort({ updatedAt: -1, createdAt: -1, _id: -1 });
            if (promptData) {
                skillName = toText(promptData.skillId).trim() ||
                    toText(promptData.skillName).trim() || skill;
                break;
            }
        }
        if (!promptData) {
            return Response.json({
                error: `No active ${promptFor} prompt found for ${candidateSkills.join(", ")}`
            }, { status: 404 });
        }

        // Use database instructions, even when the frontend also sends prompt text.
        const databasePrompt = toText(promptData.prompt).trim();
        if (!databasePrompt) {
            return Response.json({
                error: `The ${promptFor} prompt for ${skillName} is empty`
            }, { status: 500 });
        }
        const fields: Record<string, string> = {
            SKILL: skillName,
            TITLE: title,
            DESCRIPTION: description,
            BUDGET: toText(job.Budget),
            STATUS: toText(job.Status),
            PUBLISHED: toText(job.PublishedDate),
            ACTIVITY: toText(job.Activity),
            URL: toText(job.URL)
        };
        const filledPrompt = databasePrompt.replace(
            /{{\s*(SKILL|TITLE|DESCRIPTION|BUDGET|STATUS|PUBLISHED|ACTIVITY|URL)\s*}}/g,
            (_, field: string) => fields[field]
        );
        const prompt = [
            filledPrompt,
            "JOB DATA:",
            JSON.stringify(fields, null, 2)
        ].join("\n\n");

        stage = "Groq generation";
        const model = process.env.GROQ_MODEL?.trim() || "openai/gpt-oss-120b";
        const requestBody = JSON.stringify({
            model,
            messages: [{
                role: "user",
                content: `${prompt}\n\nReturn JSON with relevant, proposal, and reason. If relevant is false, proposal must be empty.`
            }],
            max_completion_tokens: 4096,
            response_format: {
                type: "json_schema",
                json_schema: {
                    name: "proposal_analysis",
                    strict: true,
                    schema: {
                        type: "object",
                        additionalProperties: false,
                        properties: {
                            relevant: { type: "boolean" },
                            proposal: { type: "string" },
                            reason: { type: "string" }
                        },
                        required: ["relevant", "proposal", "reason"]
                    }
                }
            }
        });
        let completion: any = null;
        for (let attempt = 0; attempt < 2; attempt++) {
            if (req.signal.aborted) {
                return Response.json({ error: "Proposal request cancelled" }, { status: 499 });
            }
            const controller = new AbortController();
            let timedOut = false;
            const onCancel = () => controller.abort();
            req.signal.addEventListener("abort", onCancel, { once: true });
            const timeout = setTimeout(() => {
                timedOut = true;
                controller.abort();
            }, 30000);
            try {
                const response = await fetch("https://api.groq.com/openai/v1/chat/completions", {
                    method: "POST",
                    signal: controller.signal,
                    cache: "no-store",
                    headers: {
                        Authorization: `Bearer ${apiKey}`,
                        "Content-Type": "application/json"
                    },
                    body: requestBody
                });
                const raw = await response.text();
                let data: any;
                try {
                    data = JSON.parse(raw);
                } catch {
                    throw Object.assign(new Error("Groq returned a non-JSON response."), { status: response.ok ? 502 : response.status });
                }
                if (!response.ok) {
                    throw Object.assign(new Error(toText(data?.error?.message) || "Groq request failed."), {
                        status: response.status,
                        retryAfter: response.headers.get("retry-after")
                    });
                }
                completion = data;
                break;
            } catch (error: unknown) {
                if (req.signal.aborted) {
                    return Response.json({ error: "Proposal request cancelled" }, { status: 499 });
                }
                const failure = timedOut
                    ? Object.assign(new Error("Groq request timed out."), { status: 504 })
                    : error;
                const status = failure && typeof failure === "object" && "status" in failure
                    ? Number(failure.status) : 0;
                if (attempt === 1 || ![500, 502, 503, 504].includes(status)) throw failure;
            } finally {
                clearTimeout(timeout);
                req.signal.removeEventListener("abort", onCancel);
            }
            await new Promise<void>(resolve => setTimeout(resolve, 1000 + Math.floor(Math.random() * 250)));
        }
        stage = "Groq response";
        const choice = completion?.choices?.[0];
        if (choice?.finish_reason === "length") {
            return Response.json({ error: "Groq reached the output token limit. Shorten the prompt or increase max_completion_tokens." }, { status: 502 });
        }
        const responseText = toText(choice?.message?.content).trim();
        if (!responseText) {
            return Response.json({ error: "Groq returned an empty response. Please retry." }, { status: 502 });
        }
        let responseData;
        try {
            responseData = JSON.parse(responseText);
        } catch {
            return Response.json({
                error: "Groq returned invalid JSON. Please retry."
            }, { status: 502 });
        }
        if (!responseData ||
            typeof responseData.relevant !== "boolean" ||
            typeof responseData.proposal !== "string" ||
            typeof responseData.reason !== "string" ||
            (responseData.relevant && !responseData.proposal.trim()) ||
            (!responseData.relevant && !responseData.reason.trim())) {
            return Response.json({
                error: "Groq returned an incomplete response. Please retry."
            }, { status: 502 });
        }
        return Response.json({
            platform: skillName,
            model,
            provider: "Groq",
            promptFor,
            promptId: String(promptData._id),
            relevant: responseData.relevant,
            proposal: responseData.relevant ? responseData.proposal.trim() : "",
            reason: responseData.reason.trim()
        });
    } catch (error: unknown) {
        const details = safeErrorMessage(error);
        const upstreamStatus = error && typeof error === "object" && "status" in error
            ? Number(error.status) : 0;
        let message = `Proposal generation failed during ${stage}.`;
        let status = stage.startsWith("Groq") ? 502 : 500;
        if (upstreamStatus === 429) {
            message = "Groq rate or token limit reached. Check your Groq limits and retry after the reset.";
            status = 429;
        } else if (upstreamStatus === 401 || upstreamStatus === 403) {
            message = "Groq rejected the API key or model access. Check GROQ_API_KEY.";
        } else if (upstreamStatus === 400 || upstreamStatus === 404) {
            message = "Groq rejected the model or request configuration. Use a model supporting strict JSON schema, such as openai/gpt-oss-120b.";
        } else if (upstreamStatus === 503 || upstreamStatus === 504) {
            message = "Groq is temporarily unavailable or timed out. Please retry shortly.";
            status = upstreamStatus;
        }
        const retryAfter = error && typeof error === "object" && "retryAfter" in error
            ? toText(error.retryAfter) : "";
        console.error("GROQ PROPOSAL ERROR", { stage, upstreamStatus, details });
        return Response.json({
            error: process.env.NODE_ENV === "production" ? message : `${message} ${details}`,
            stage,
            ...(upstreamStatus ? { upstreamStatus } : {}),
            ...(retryAfter ? { retryAfter } : {})
        }, {
            status,
            ...(retryAfter ? { headers: { "Retry-After": retryAfter } } : {})
        });
    }
}
