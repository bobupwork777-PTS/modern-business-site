import { GoogleGenerativeAI } from "@google/generative-ai";
import { connectDB } from "@/lib/mongodb";
import Prompt from "@/lib/models/Prompt";

const genAI = new GoogleGenerativeAI(process.env.GEMINI_API_KEY!);

export async function POST(req: Request) {
    try {
        if (!process.env.GEMINI_API_KEY) {
            return Response.json({ error: "Missing Gemini API Key" }, { status: 500 });
        }

        await connectDB();
        const { job } = await req.json();

        if (!job) {
            return Response.json({ error: "Job data missing" }, { status: 400 });
        }

        const skillName = job.Skill || "Wix";
        const promptData = await Prompt.findOne({ skillName, active: true });

        if (!promptData) {
            return Response.json({ error: `No active prompt found for ${skillName}` }, { status: 404 });
        }

        const prompt = promptData.prompt
            .replace(/{{TITLE}}/g, job.Title || "")
            .replace(/{{DESCRIPTION}}/g, job.Description || "")
            .replace(/{{BUDGET}}/g, job.Budget || "")
            .replace(/{{STATUS}}/g, job.Status || "")
            .replace(/{{PUBLISHED}}/g, job.PublishedDate || "")
            .replace(/{{ACTIVITY}}/g, job.Activity || "")
            .replace(/{{URL}}/g, job.URL || "");

        console.log("USING PROMPT:", skillName);

        const model = genAI.getGenerativeModel({ model: "gemini-3.5-flash-lite" });
        const result = await model.generateContent(prompt);
        const text = result.response.text();

        console.log("GEMINI RESPONSE:", text);

        const clean = text.replace(/```json/g, "").replace(/```/g, "").trim();

        let responseData;
        try {
            responseData = JSON.parse(clean);
        } catch {
            responseData = { platform: skillName, relevant: true, proposal: clean };
        }

        return Response.json(responseData);

    } catch (error: any) {
        console.error("GEMINI ERROR:", error);
        return Response.json({ error: error.message || "Something went wrong" }, { status: 500 });
    }
}