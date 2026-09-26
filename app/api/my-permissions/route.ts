import { NextResponse } from "next/server";
import { connectDB } from "@/lib/mongodb";
import Permission from "@/lib/models/Permission";
import "@/lib/models/Page";

export async function POST(req: Request) {
    try {
        await connectDB();
        const { userId } = await req.json();

        const permissions = await Permission.find({ userId, access: true })
            .populate({
                path: "pageId",
                populate: { path: "parentId" },
            })
            .lean();

        const pages = permissions
            .filter((item: any) => item.pageId)
            .map((item: any) => item.pageId);

        return NextResponse.json({ success: true, pages });
    } catch (error: any) {
        console.log("API ERROR:", error.message);
        return NextResponse.json(
            { success: false, message: error.message },
            { status: 500 }
        );
    }
}