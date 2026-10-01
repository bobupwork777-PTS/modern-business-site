import { NextRequest, NextResponse } from "next/server";
import { connectDB } from "@/lib/mongodb";
import Skill from "@/lib/models/Skill";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

function cleanName(value: unknown): string {
    return typeof value === "string" ? value.trim().replace(/\s+/g, " ") : "";
}

function normalizeName(value: string) {
    return cleanName(value).toLowerCase();
}

async function readBody(request: NextRequest) {
    try {
        const body = await request.json();
        return body && typeof body === "object" && !Array.isArray(body) ? body : null;
    } catch {
        return null;
    }
}

function invalidName(name: string) {
    if (!name) return "Skill name is required";
    if (name.includes(",")) return "Enter one name per request. Use Add All in the modal for multiple options.";
    return null;
}

function failure(error: unknown, action: string) {
    console.error(`${action.toUpperCase()} Skill ERROR:`, error);
    if (typeof error === "object" && error !== null && "code" in error && error.code === 11000) {
        return NextResponse.json({ success: false, error: "Skill already exists" }, { status: 409 });
    }
    return NextResponse.json({ success: false, error: `Unable to ${action} skill` }, { status: 500 });
}

export async function GET() {
    try {
        await connectDB();
        const skills = await Skill.find({ active: true })
            .sort({ name: 1 })
            .select("_id name active createdAt updatedAt")
            .lean();
        return NextResponse.json({ success: true, skills, total: skills.length });
    } catch (error) {
        console.error("GET skills ERROR:", error);
        return NextResponse.json({ success: false, skills: [], total: 0, error: "Unable to fetch skills" }, { status: 500 });
    }
}

export async function POST(request: NextRequest) {
    try {
        const body = await readBody(request);
        if (!body) return NextResponse.json({ success: false, error: "Invalid JSON body" }, { status: 400 });
        const name = cleanName(body.name);
        const error = invalidName(name);
        if (error) return NextResponse.json({ success: false, error }, { status: 400 });
        await connectDB();
        const normalizedName = normalizeName(name);
        const existing = await Skill.findOne({ normalizedName });
        if (existing) {
            if (!existing.active) {
                existing.active = true;
                existing.name = name;
                await existing.save();
            }
            return NextResponse.json({ success: true, alreadyExists: true, skill: existing });
        }
        const skill = await Skill.create({ name, normalizedName, active: true });
        return NextResponse.json({ success: true, skill }, { status: 201 });
    } catch (error) {
        return failure(error, "add");
    }
}

export async function PUT(request: NextRequest) {
    try {
        const body = await readBody(request);
        if (!body) return NextResponse.json({ success: false, error: "Invalid JSON body" }, { status: 400 });
        const oldName = cleanName(body.oldName);
        const name = cleanName(body.name);
        if (!oldName) return NextResponse.json({ success: false, error: "Original Skill name is required" }, { status: 400 });
        const error = invalidName(name);
        if (error) return NextResponse.json({ success: false, error }, { status: 400 });
        await connectDB();
        const oldNormalizedName = normalizeName(oldName);
        const normalizedName = normalizeName(name);
        if (normalizedName !== oldNormalizedName) {
            const duplicate = await Skill.findOne({ normalizedName });
            if (duplicate) return NextResponse.json({ success: false, error: "Skill already exists" }, { status: 409 });
        }
        const skill = await Skill.findOneAndUpdate(
            { normalizedName: oldNormalizedName, active: true },
            { $set: { name, normalizedName } },
            { new: true, runValidators: true }
        );
        if (!skill) return NextResponse.json({ success: false, error: "Skill not found" }, { status: 404 });
        return NextResponse.json({ success: true, skill });
    } catch (error) {
        return failure(error, "update");
    }
}

export async function DELETE(request: NextRequest) {
    try {
        const body = await readBody(request);
        if (!body) return NextResponse.json({ success: false, error: "Invalid JSON body" }, { status: 400 });
        const name = cleanName(body.name);
        const error = invalidName(name);
        if (error) return NextResponse.json({ success: false, error }, { status: 400 });
        await connectDB();
        const skill = await Skill.findOneAndUpdate(
            { normalizedName: normalizeName(name), active: true },
            { $set: { active: false } },
            { new: true, runValidators: true }
        );
        if (!skill) return NextResponse.json({ success: false, error: "Skill not found" }, { status: 404 });
        return NextResponse.json({ success: true, deleted: true, skill });
    } catch (error) {
        return failure(error, "delete");
    }
}
