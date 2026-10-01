import { GoogleGenerativeAI, SchemaType } from "@google/generative-ai";
import { connectDB } from "@/lib/mongodb";
import Prompt from "@/lib/models/Prompt";

export const runtime = "nodejs";

function toText(value: unknown): string {
    if (typeof value === "string") return value;
    if (typeof value === "number") return String(value);
    return "";
}

function detectSkill(title: string, description: string): string {
    const platforms = [
        { name: "Wix Studio", pattern: /\bwix\s+studio\b/i },
        { name: "Wix", pattern: /\bwix\b|\bvelo\b/i },
        { name: "Webflow", pattern: /\bwebflow\b/i },
        { name: "Shopify", pattern: /\bshopify\b/i },
        { name: "Framer", pattern: /\bframer\b/i },
        {
            name: "Illustration",
            pattern: /\billustrat(?:ion|ions|or)\b/i
        },
        {
            name: "next.js",
            pattern: /\bnext(?:\.js|js|\s+js)\b/i
        }
    ];

    // Prefer platform mentions in the title.
    for (const content of [title, description]) {
        const match = platforms.find(platform =>
            platform.pattern.test(content)
        );

        if (match) return match.name;
    }

    return "";
}

export async function POST(req: Request) {
    try {
        const apiKey = process.env.GEMINI_API_KEY;

        if (!apiKey) {
            return Response.json(
                { error: "Missing Gemini API Key" },
                { status: 500 }
            );
        }

        let body;

        try {
            body = await req.json();
        } catch {
            return Response.json(
                { error: "Invalid JSON request" },
                { status: 400 }
            );
        }

        const job = body?.job;

        if (!job || typeof job !== "object") {
            return Response.json(
                { error: "Job data missing" },
                { status: 400 }
            );
        }

        const title = toText(job.Title).trim();
        const description = toText(job.Description).trim();

        if (!title || !description) {
            return Response.json(
                { error: "Job title and description are required" },
                { status: 400 }
            );
        }

        const skillName =
            toText(job.Skill).trim() ||
            detectSkill(title, description);

        if (!skillName) {
            return Response.json(
                { error: "Select a skill for this job" },
                { status: 400 }
            );
        }

        await connectDB();

        const promptData = await Prompt.findOne({
            skillName,
            active: true
        });

        if (!promptData) {
            return Response.json(
                { error: `No active prompt found for ${skillName}` },
                { status: 404 }
            );
        }

        const databasePrompt = toText(promptData.prompt).trim();

        if (!databasePrompt) {
            return Response.json(
                { error: `The database prompt for ${skillName} is empty` },
                { status: 500 }
            );
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

        // Callback replacement preserves literal "$" characters.
        const filledPrompt = databasePrompt.replace(
            /{{\s*(SKILL|TITLE|DESCRIPTION|BUDGET|STATUS|PUBLISHED|ACTIVITY|URL)\s*}}/g,
            (_, field: string) => fields[field]
        );

        // Include full job details even if placeholders are absent.
        const prompt = [
            filledPrompt,
            "JOB DATA:",
            JSON.stringify(fields, null, 2)
        ].join("\n\n");

        const genAI = new GoogleGenerativeAI(apiKey);

        const model = genAI.getGenerativeModel({
            model: process.env.GEMINI_MODEL || "gemini-3.5-flash-lite",

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

        console.log("USING DATABASE PROMPT:", skillName);

        const result = await model.generateContent(prompt);
        const responseText = result.response.text().trim();

        if (!responseText) {
            return Response.json(
                { error: "Gemini returned an empty response. Please retry." },
                { status: 502 }
            );
        }

        let responseData;

        try {
            responseData = JSON.parse(responseText);
        } catch {
            return Response.json(
                { error: "Gemini returned invalid JSON. Please retry." },
                { status: 502 }
            );
        }

        if (
            !responseData ||
            typeof responseData.relevant !== "boolean" ||
            (
                responseData.relevant &&
                (
                    typeof responseData.proposal !== "string" ||
                    !responseData.proposal.trim()
                )
            ) ||
            (
                !responseData.relevant &&
                (
                    typeof responseData.reason !== "string" ||
                    !responseData.reason.trim()
                )
            )
        ) {
            return Response.json(
                { error: "Gemini returned an incomplete response. Please retry." },
                { status: 502 }
            );
        }

        return Response.json({
            platform: skillName,
            relevant: responseData.relevant,
            proposal: responseData.relevant
                ? responseData.proposal.trim()
                : "",
            reason: toText(responseData.reason).trim()
        });
    } catch (error: unknown) {
        console.error("GEMINI ERROR:", error);

        return Response.json(
            { error: "Unable to generate the proposal. Please try again." },
            { status: 500 }
        );
    }
}