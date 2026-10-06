import { NextResponse } from "next/server";
import { connectDB } from "@/lib/mongodb";
import User from "@/lib/models/User";

type RouteContext = {
    params: { id: string } | Promise<{ id: string }>;
};

const editableFields = [
    "name", "email", "phone", "dob", "address", "state", "pin", "gender",
] as const;

function profileResponse(user: any) {
    return {
        id: String(user._id),
        name: user.name,
        email: user.email,
        phone: user.phone,
        dob: user.dob,
        address: user.address,
        state: user.state,
        pin: user.pin,
        gender: user.gender,
        role: user.role,
        profileImage: user.profileImage || "",
    };
}

function handleError(error: unknown) {
    console.error("PROFILE API ERROR:", error);
    const err = error as { code?: number; name?: string };
    if (err?.code === 11000) {
        return NextResponse.json({ error: "These details are already used by another account." }, { status: 409 });
    }
    if (err?.name === "ValidationError" || err?.name === "CastError") {
        return NextResponse.json({ error: "Invalid profile details. Please check your entries." }, { status: 400 });
    }
    return NextResponse.json({ error: "Profile API failed" }, { status: 500 });
}

export async function GET(_req: Request, context: RouteContext) {
    try {
        const { id } = await context.params;
        if (!/^[a-f\d]{24}$/i.test(id)) {
            return NextResponse.json({ error: "Invalid user ID" }, { status: 400 });
        }
        await connectDB();
        const user = await User.findById(id)
            .select("name email phone dob address state pin gender role profileImage");
        if (!user) {
            return NextResponse.json({ error: "User not found" }, { status: 404 });
        }
        return NextResponse.json(profileResponse(user));
    } catch (error) {
        return handleError(error);
    }
}

export async function PUT(req: Request, context: RouteContext) {
    try {
        const { id } = await context.params;
        if (!/^[a-f\d]{24}$/i.test(id)) {
            return NextResponse.json({ error: "Invalid user ID" }, { status: 400 });
        }

        // Before deployment, verify your session and that its user owns this ID.
        // The URL ID and browser localStorage are not proof of authentication.
        let body: Record<string, unknown>;
        try {
            const value = await req.json();
            if (!value || typeof value !== "object" || Array.isArray(value)) {
                return NextResponse.json({ error: "Invalid request body" }, { status: 400 });
            }
            body = value;
        } catch {
            return NextResponse.json({ error: "Invalid JSON" }, { status: 400 });
        }

        if (Object.prototype.hasOwnProperty.call(body, "role")) {
            return NextResponse.json({ error: "Role cannot be changed" }, { status: 400 });
        }

        const updates: Record<string, string> = {};
        for (const field of editableFields) {
            if (!Object.prototype.hasOwnProperty.call(body, field)) continue;
            if (typeof body[field] !== "string") {
                return NextResponse.json({ error: `${field} must be text` }, { status: 400 });
            }
            updates[field] = (body[field] as string).trim();
        }
        if (Object.prototype.hasOwnProperty.call(body, "profileImage")) {
            const image = body.profileImage;
            if (typeof image !== "string") {
                return NextResponse.json({ error: "Invalid profile image" }, { status: 400 });
            }
            if (image !== "") {
                if (image.length > 1_400_000) {
                    return NextResponse.json({ error: "Photo must be 1 MB or smaller" }, { status: 400 });
                }
                const match = image.match(/^data:image\/(jpeg|png|webp);base64,([A-Za-z0-9+/]+={0,2})$/);
                if (!match) {
                    return NextResponse.json({ error: "Choose a JPG, PNG, or WebP image" }, { status: 400 });
                }
                const bytes = Buffer.from(match[2], "base64");
                const validHeader = match[1] === "jpeg"
                    ? bytes.subarray(0, 3).equals(Buffer.from([0xff, 0xd8, 0xff]))
                    : match[1] === "png"
                        ? bytes.subarray(0, 8).equals(Buffer.from([137, 80, 78, 71, 13, 10, 26, 10]))
                        : bytes.toString("ascii", 0, 4) === "RIFF" && bytes.toString("ascii", 8, 12) === "WEBP";
                if (!validHeader || bytes.length > 1024 * 1024) {
                    return NextResponse.json({ error: "Invalid image or photo exceeds 1 MB" }, { status: 400 });
                }
            }
            updates.profileImage = image;
        }
        if (!Object.keys(updates).length) {
            return NextResponse.json({ error: "No editable details provided" }, { status: 400 });
        }
        if (updates.name === "" || updates.email === "") {
            return NextResponse.json({ error: "Name and email cannot be empty" }, { status: 400 });
        }

        await connectDB();
        const user = await User.findByIdAndUpdate(
            id,
            { $set: updates },
            { new: true, runValidators: true }
        ).select("name email phone dob address state pin gender role profileImage");
        if (!user) {
            return NextResponse.json({ error: "User not found" }, { status: 404 });
        }
        return NextResponse.json(profileResponse(user));
    } catch (error) {
        return handleError(error);
    }
}
