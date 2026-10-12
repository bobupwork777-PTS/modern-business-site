import { NextRequest, NextResponse } from "next/server";
import { Types } from "mongoose";
import { connectDB } from "@/lib/mongodb";
import Skill from "@/lib/models/Skill";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const headers = { "Cache-Control": "no-store" };
function reply(body: unknown, status = 200) {
    return NextResponse.json(body, { status, headers });
}
function clean(value: unknown): string {
    return typeof value === "string" ? value.trim().replace(/\s+/g, " ") : "";
}
function failure(error: unknown) {
    const duplicate = typeof error === "object" && error !== null && "code" in error && error.code === 11000;
    return reply({ success: false, error: duplicate ? "Skill already exists." : "Unable to process skills request." }, duplicate ? 409 : 500);
}
async function bodyOf(request: NextRequest): Promise<Record<string, unknown> | null> {
    try {
        const body: unknown = await request.json();
        return body !== null && typeof body === "object" && !Array.isArray(body) ? body as Record<string, unknown> : null;
    } catch { return null; }
}
function validId(value: unknown): value is string {
    return typeof value === "string" && /^[a-fA-F0-9]{24}$/.test(value);
}
function nameError(name: string) {
    if (!name) return "Skill name is required.";
    if (name.length > 120) return "Use a skill name of 120 characters or fewer.";
    if (name.includes(",")) return "Enter one skill per request.";
    return null;
}

// Default GET preserves the scheduler's string-array response.
// GET ?manage=true returns complete records for the management page.
export async function GET(request: NextRequest) {
    try {
        await connectDB();
        const manage = request.nextUrl.searchParams.get("manage") === "true";
        const documents = await Skill.collection.find(
            manage ? {} : { notificationOn: true },
            { projection: { name: 1, normalizedName: 1, active: 1, notificationOn: 1, createdAt: 1, updatedAt: 1 } }
        ).sort({ name: 1 }).toArray();
        if (manage) {
            const skills = documents.map(doc => ({
                _id: doc._id.toString(),
                name: clean(doc.name),
                normalizedName: clean(doc.normalizedName),
                active: doc.active === true,
                notificationOn: doc.notificationOn === true,
            }));
            return reply({ success: true, skills, total: skills.length });
        }
        const skills = [...new Set(documents.map(doc => clean(doc.normalizedName) || clean(doc.name).toLowerCase()).filter(Boolean))];
        return reply({ success: true, skills, total: skills.length });
    } catch (error) { return failure(error); }
}

export async function POST(request: NextRequest) {
    try {
        const body = await bodyOf(request);
        if (!body) return reply({ success: false, error: "Invalid JSON body." }, 400);
        const name = clean(body.name);
        const error = nameError(name);
        if (error) return reply({ success: false, error }, 400);
        if (typeof body.notificationOn !== "boolean") return reply({ success: false, error: "notificationOn must be Boolean." }, 400);
        await connectDB();
        const normalizedName = name.toLowerCase();
        const existing = await Skill.collection.findOne({ normalizedName });
        if (existing?.active === true) return reply({ success: false, error: "Skill already exists." }, 409);
        const now = new Date();
        if (existing) {
            await Skill.collection.updateOne({ _id: existing._id }, { $set: { name, active: true, notificationOn: body.notificationOn, updatedAt: now } });
            return reply({ success: true, restored: true });
        }
        const result = await Skill.collection.insertOne({ name, normalizedName, active: true, notificationOn: body.notificationOn, createdAt: now, updatedAt: now });
        return reply({ success: true, id: result.insertedId.toString() }, 201);
    } catch (error) { return failure(error); }
}

export async function PUT(request: NextRequest) {
    try {
        const body = await bodyOf(request);
        if (!body || !validId(body.id)) return reply({ success: false, error: "Valid skill ID is required." }, 400);
        const name = clean(body.name);
        const error = nameError(name);
        if (error) return reply({ success: false, error }, 400);
        if (typeof body.active !== "boolean" || typeof body.notificationOn !== "boolean") return reply({ success: false, error: "active and notificationOn must be Boolean." }, 400);
        await connectDB();
        const id = new Types.ObjectId(body.id);
        const current = await Skill.collection.findOne({ _id: id });
        if (!current) return reply({ success: false, error: "Skill not found." }, 404);
        // Preserve existing search aliases (e.g. Velo -> wix velo) when name is unchanged.
        const normalizedName = name === clean(current.name) ? clean(current.normalizedName) || name.toLowerCase() : name.toLowerCase();
        const duplicate = await Skill.collection.findOne({ normalizedName, _id: { $ne: id } });
        if (duplicate) return reply({ success: false, error: "Skill already exists." }, 409);
        const result = await Skill.collection.updateOne({ _id: id }, { $set: {
            name, normalizedName, active: body.active,
            notificationOn: body.active && body.notificationOn,
            updatedAt: new Date(),
        } });
        if (!result.matchedCount) return reply({ success: false, error: "Skill not found." }, 404);
        return reply({ success: true });
    } catch (error) { return failure(error); }
}

export async function PATCH(request: NextRequest) {
    try {
        const body = await bodyOf(request);
        if (!body || !validId(body.id) || typeof body.notificationOn !== "boolean") return reply({ success: false, error: "Valid ID and Boolean notificationOn are required." }, 400);
        await connectDB();
        const result = await Skill.collection.updateOne(
            { _id: new Types.ObjectId(body.id), active: true },
            { $set: { notificationOn: body.notificationOn, updatedAt: new Date() } }
        );
        if (!result.matchedCount) return reply({ success: false, error: "Active skill not found." }, 404);
        return reply({ success: true });
    } catch (error) { return failure(error); }
}

// Soft delete: keep the record but remove it from active lists and notifications.
export async function DELETE(request: NextRequest) {
    try {
        const body = await bodyOf(request);
        if (!body || !validId(body.id)) return reply({ success: false, error: "Valid skill ID is required." }, 400);
        await connectDB();
        const result = await Skill.collection.updateOne(
            { _id: new Types.ObjectId(body.id) },
            { $set: { active: false, notificationOn: false, updatedAt: new Date() } }
        );
        if (!result.matchedCount) return reply({ success: false, error: "Skill not found." }, 404);
        return reply({ success: true, deleted: true });
    } catch (error) { return failure(error); }
}
