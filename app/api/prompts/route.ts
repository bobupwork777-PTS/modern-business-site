import { NextResponse } from "next/server";
import { connectDB } from "@/lib/mongodb";
import Prompt from "@/lib/models/Prompt";
import Skill from "@/lib/models/Skill";

export async function GET() {
    try {
        await connectDB();
        const prompts = await Prompt.find({}).sort({ createdAt: -1 });
        return NextResponse.json(prompts);
    } catch (error: any) {
        console.log("GET PROMPT ERROR:", error);
        return NextResponse.json({ error: error.message }, { status: 500 });
    }
}

export async function POST(req: Request) {
    try {
        await connectDB();
        const body = await req.json();

        if (!body.skillId || !body.prompt) {
            return NextResponse.json({ error: "Skill and prompt required" }, { status: 400 });
        }

        const skill = await Skill.findOne({ name: body.skillId });
        const promptData = {
            skillId: body.skillId,
            skillName: skill?.name || body.skillId,
            prompt: body.prompt,
            active: true,
            updatedAt: new Date(),
        };

        if (body.editId) {
            await Prompt.findByIdAndUpdate(body.editId, promptData);
        } else {
            await Prompt.findOneAndUpdate(
                { skillId: body.skillId },
                { ...promptData, createdAt: new Date() },
                { upsert: true, new: true }
            );
        }

        return NextResponse.json({ success: true });
    } catch (error: any) {
        console.log("PROMPT ERROR:", error);
        return NextResponse.json({ error: error.message }, { status: 500 });
    }
}

export async function DELETE(req: Request) {
    try {
        await connectDB();
        const { searchParams } = new URL(req.url);
        const id = searchParams.get("id");

        if (!id) {
            return NextResponse.json({ error: "Missing prompt id" }, { status: 400 });
        }

        await Prompt.findByIdAndDelete(id);
        return NextResponse.json({ success: true });
    } catch (error: any) {
        console.log("DELETE PROMPT ERROR:", error);
        return NextResponse.json({ error: error.message }, { status: 500 });
    }
}