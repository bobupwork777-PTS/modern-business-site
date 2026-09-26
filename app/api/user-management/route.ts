import { NextResponse } from "next/server";
import { connectDB } from "@/lib/mongodb";
import User from "@/lib/models/User";
import Page from "@/lib/models/Page";
import Permission from "@/lib/models/Permission";

export async function GET() {
    try {
        await connectDB();

        const [users, pages, permissions] = await Promise.all([
            User.find().select("-password"),
            Page.find({ active: true }).sort({ group: 1 }),
            Permission.find(),
        ]);

        return NextResponse.json({ users, pages, permissions });
    } catch (error) {
        console.error(error);
        return NextResponse.json({ message: "Server Error" }, { status: 500 });
    }
}

export async function PUT(req: Request) {
    try {
        await connectDB();
        const { userId, pageId, access } = await req.json();

        if (!userId || !pageId) {
            return NextResponse.json({ message: "Missing userId or pageId" }, { status: 400 });
        }

        const permission = await Permission.findOneAndUpdate(
            { userId, pageId },
            { userId, pageId, access },
            { upsert: true, new: true }
        );

        return NextResponse.json({ success: true, permission });
    } catch (error) {
        console.error(error);
        return NextResponse.json({ message: "Server Error" }, { status: 500 });
    }
}