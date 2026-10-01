import { NextRequest, NextResponse } from "next/server";
import { connectDB } from "@/lib/mongodb";
import Country from "@/lib/models/Country";

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
    if (!name) return "Country name is required";
    if (name.includes(",")) return "Enter one name per request. Use Add All in the modal for multiple options.";
    return null;
}

function failure(error: unknown, action: string) {
    console.error(`${action.toUpperCase()} Country ERROR:`, error);
    if (typeof error === "object" && error !== null && "code" in error && error.code === 11000) {
        return NextResponse.json({ success: false, error: "Country already exists" }, { status: 409 });
    }
    return NextResponse.json({ success: false, error: `Unable to ${action} country` }, { status: 500 });
}

export async function GET() {
    try {
        await connectDB();
        const countries = await Country.find({ active: true })
            .sort({ name: 1 })
            .select("_id name active createdAt updatedAt")
            .lean();
        return NextResponse.json({ success: true, countries, total: countries.length });
    } catch (error) {
        console.error("GET countries ERROR:", error);
        return NextResponse.json({ success: false, countries: [], total: 0, error: "Unable to fetch countries" }, { status: 500 });
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
        const existing = await Country.findOne({ normalizedName });
        if (existing) {
            if (!existing.active) {
                existing.active = true;
                existing.name = name;
                await existing.save();
            }
            return NextResponse.json({ success: true, alreadyExists: true, country: existing });
        }
        const country = await Country.create({ name, normalizedName, active: true });
        return NextResponse.json({ success: true, country }, { status: 201 });
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
        if (!oldName) return NextResponse.json({ success: false, error: "Original Country name is required" }, { status: 400 });
        const error = invalidName(name);
        if (error) return NextResponse.json({ success: false, error }, { status: 400 });
        await connectDB();
        const oldNormalizedName = normalizeName(oldName);
        const normalizedName = normalizeName(name);
        if (normalizedName !== oldNormalizedName) {
            const duplicate = await Country.findOne({ normalizedName });
            if (duplicate) return NextResponse.json({ success: false, error: "Country already exists" }, { status: 409 });
        }
        const country = await Country.findOneAndUpdate(
            { normalizedName: oldNormalizedName, active: true },
            { $set: { name, normalizedName } },
            { new: true, runValidators: true }
        );
        if (!country) return NextResponse.json({ success: false, error: "Country not found" }, { status: 404 });
        return NextResponse.json({ success: true, country });
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
        const country = await Country.findOneAndUpdate(
            { normalizedName: normalizeName(name), active: true },
            { $set: { active: false } },
            { new: true, runValidators: true }
        );
        if (!country) return NextResponse.json({ success: false, error: "Country not found" }, { status: 404 });
        return NextResponse.json({ success: true, deleted: true, country });
    } catch (error) {
        return failure(error, "delete");
    }
}
