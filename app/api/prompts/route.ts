import { NextResponse } from "next/server";
import { isValidObjectId } from "mongoose";
import { connectDB } from "@/lib/mongodb";
import Prompt from "@/lib/models/Prompt";
import Skill from "@/lib/models/Skill";

export const dynamic = "force-dynamic";

function platformFilter(promptFor: string) {
    // Older records belong to Upwork until they are updated.
    return promptFor === "Upwork"
        ? { $or: [
            { promptFor: "Upwork" },
            { promptFor: { $exists: false } },
            { promptFor: null },
            { promptFor: "" },
        ] }
        : { promptFor };
}

function handleError(error: any) {
    if (error?.code === 11000) {
        return NextResponse.json(
            { error: "Duplicate prompt. Check the platform/skill indexes in MongoDB." },
            { status: 409 }
        );
    }
    if (error?.name === "ValidationError") {
        return NextResponse.json({ error: error.message }, { status: 400 });
    }
    return NextResponse.json(
        { error: "Unable to process prompt request." },
        { status: 500 }
    );
}

export async function GET() {
    try {
        await connectDB();
        const prompts = await Prompt.find({}).sort({ createdAt: -1 }).lean();
        return NextResponse.json(prompts.map((item) => ({
            ...item,
            promptFor: item.promptFor || "-",
        })));
    } catch (error) {
        return handleError(error);
    }
}

export async function POST(req: Request) {
    try {
        const body = await req.json().catch(() => null);
        const promptFor = typeof body?.promptFor === "string" ? body.promptFor.trim() : "";
        const skillId = typeof body?.skillId === "string" ? body.skillId.trim() : "";
        const prompt = typeof body?.prompt === "string" ? body.prompt : "";
        const editId = typeof body?.editId === "string" ? body.editId.trim() : "";

        // Plain string validation; no enum or platform whitelist.
        if (!promptFor || !skillId || !prompt.trim()) {
            return NextResponse.json(
                { error: "Prompt For, skill and prompt are required." },
                { status: 400 }
            );
        }
        if (editId && !isValidObjectId(editId)) {
            return NextResponse.json({ error: "Invalid prompt id." }, { status: 400 });
        }

        await connectDB();
        const skill = await Skill.findOne({ name: skillId });
        const filter = { skillId, ...platformFilter(promptFor) };
        const promptData = {
            promptFor,
            skillId,
            skillName: skill?.name || skillId,
            prompt,
            active: true,
            updatedAt: new Date(),
        };

        let savedPrompt;
        if (editId) {
            const duplicate = await Prompt.exists({ ...filter, _id: { $ne: editId } });
            if (duplicate) {
                return NextResponse.json(
                    { error: "A prompt already exists for this platform and skill." },
                    { status: 409 }
                );
            }
            savedPrompt = await Prompt.findByIdAndUpdate(
                editId,
                { $set: promptData },
                { new: true, runValidators: true }
            );
            if (!savedPrompt) {
                return NextResponse.json({ error: "Prompt not found." }, { status: 404 });
            }
        } else {
            savedPrompt = await Prompt.findOneAndUpdate(
                filter,
                { $set: promptData, $setOnInsert: { createdAt: new Date() } },
                { upsert: true, new: true, runValidators: true }
            );
        }
        return NextResponse.json({ success: true, prompt: savedPrompt });
    } catch (error) {
        return handleError(error);
    }
}

export async function DELETE(req: Request) {
    try {
        const id = new URL(req.url).searchParams.get("id");
        if (!id || !isValidObjectId(id)) {
            return NextResponse.json({ error: "Valid prompt id required." }, { status: 400 });
        }
        await connectDB();
        const deleted = await Prompt.findByIdAndDelete(id);
        if (!deleted) {
            return NextResponse.json({ error: "Prompt not found." }, { status: 404 });
        }
        return NextResponse.json({ success: true });
    } catch (error) {
        return handleError(error);
    }
}