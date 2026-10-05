import { GoogleGenerativeAI, SchemaType } from "@google/generative-ai";
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

export async function POST(req: Request) {
    try {
        const apiKey = process.env.GEMINI_API_KEY;
        if (!apiKey) {
            return Response.json({ error: "Missing Gemini API Key" }, { status: 500 });
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

        await connectDB();
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

        const genAI = new GoogleGenerativeAI(apiKey);
        const model = genAI.getGenerativeModel({
            model: process.env.GEMINI_MODEL || "gemini-2.5-flash",
            generationConfig: {
                responseMimeType: "application/json",
                responseSchema: {
                    type: SchemaType.OBJECT,
                    properties: {
                        relevant: {
                            type: SchemaType.BOOLEAN,
                            description: "Whether the job fits the freelancer's expertise"
                        },
                        proposal: {
                            type: SchemaType.STRING,
                            description: "Complete proposal when relevant; otherwise empty"
                        },
                        reason: {
                            type: SchemaType.STRING,
                            description: "Brief explanation of fit or mismatch"
                        }
                    },
                    required: ["relevant", "proposal", "reason"]
                }
            }
        });
        const result = await model.generateContent(prompt);
        const responseText = result.response.text().trim();
        if (!responseText) {
            return Response.json({
                error: "Gemini returned an empty response. Please retry."
            }, { status: 502 });
        }
        let responseData;
        try {
            responseData = JSON.parse(responseText);
        } catch {
            return Response.json({
                error: "Gemini returned invalid JSON. Please retry."
            }, { status: 502 });
        }
        if (!responseData ||
            typeof responseData.relevant !== "boolean" ||
            typeof responseData.proposal !== "string" ||
            typeof responseData.reason !== "string" ||
            (responseData.relevant && !responseData.proposal.trim()) ||
            (!responseData.relevant && !responseData.reason.trim())) {
            return Response.json({
                error: "Gemini returned an incomplete response. Please retry."
            }, { status: 502 });
        }
        return Response.json({
            platform: skillName,
            promptFor,
            promptId: String(promptData._id),
            relevant: responseData.relevant,
            proposal: responseData.relevant ? responseData.proposal.trim() : "",
            reason: responseData.reason.trim()
        });
    } catch {
        return Response.json({
            error: "Unable to generate the proposal. Please try again."
        }, { status: 500 });
    }
}
