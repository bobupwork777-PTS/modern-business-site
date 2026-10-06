import { NextRequest, NextResponse } from "next/server";
import mongoose from "mongoose";
import { createHash } from "node:crypto";
import { connectDB } from "@/lib/mongodb";
import User from "@/lib/models/User";
import Page from "@/lib/models/Page";
import Permission from "@/lib/models/Permission";

export const runtime = "nodejs";

// Same model and collection as the login API. No JWT is used.
const Session = mongoose.models.LoginSession || mongoose.model("LoginSession", new mongoose.Schema({
    tokenHash: { type: String, required: true, unique: true },
    userId: { type: mongoose.Schema.Types.ObjectId, ref: "User", required: true },
    expiresAt: { type: Date, required: true, expires: 0 },
}));

const normalizePath = (value: string) => value.trim().replace(/\/+$/, "") || "/";
const json = (body: unknown, status = 200) => NextResponse.json(body, {
    status,
    headers: { "Cache-Control": "no-store" },
});

type PageRecord = {
    _id: { toString(): string };
    name?: string;
    path: string;
    group?: string;
    active?: boolean;
};

export async function POST(req: NextRequest) {
    try {
        const token = req.cookies.get("token")?.value;
        if (!token || !/^[a-f0-9]{64}$/.test(token)) {
            return json({ success: false, error: "Not authenticated" }, 401);
        }

        let body: unknown;
        try {
            body = await req.json();
        } catch {
            return json({ success: false, error: "Invalid JSON" }, 400);
        }
        if (!body || typeof body !== "object" || Array.isArray(body)) {
            return json({ success: false, error: "Invalid request body" }, 400);
        }
        const { path } = body as Record<string, unknown>;
        if (path !== undefined && (
            typeof path !== "string" || !path.startsWith("/") ||
            path.startsWith("//") || /[?#\\]/.test(path)
        )) {
            return json({ success: false, error: "Invalid page path" }, 400);
        }

        await connectDB();
        const session = await Session.findOne({
            tokenHash: createHash("sha256").update(token).digest("hex"),
            expiresAt: { $gt: new Date() },
        });
        if (!session) return json({ success: false, error: "Not authenticated" }, 401);

        const user = await User.findById(session.userId).select("_id active");
        if (!user || user.active === false) {
            return json({ success: false, error: "Not authenticated" }, 401);
        }

        // Ignore browser-supplied userId. Permissions belong to this session user.
        const [pageDocuments, permissions] = await Promise.all([
            Page.find().select("name path group active").lean(),
            Permission.find({ userId: user._id, access: true }).select("pageId").lean(),
        ]);
        const grantedIds = new Set(permissions.map(item => String(item.pageId)));
        const registeredPages = (pageDocuments as unknown as PageRecord[])
            .filter(page => typeof page.path === "string" &&
                page.path.trim().startsWith("/") && !page.path.trim().startsWith("//"))
            .map(page => ({ ...page, path: normalizePath(page.path) }));

        const pages = registeredPages
            .filter(page => page.active === true && grantedIds.has(String(page._id)))
            .map(page => ({ ...page, _id: String(page._id) }))
            .sort((a, b) => (a.group || "").localeCompare(b.group || "") ||
                (a.name || "").localeCompare(b.name || ""));

        let allowed: boolean | undefined;
        if (typeof path === "string") {
            const requestedPath = normalizePath(path);
            // The most specific registered route controls its descendants.
            // A /dashboard grant does not override a separate child-page denial.
            // Home (/) never grants access to every route.
            const matches = registeredPages.filter(page =>
                requestedPath === page.path ||
                (page.path !== "/" && requestedPath.startsWith(`${page.path}/`))
            ).sort((a, b) => b.path.length - a.path.length);
            const target = matches[0];
            allowed = Boolean(target && target.active === true &&
                grantedIds.has(String(target._id)));
        }

        return json({ success: true, userId: String(user._id), pages, allowed });
    } catch {
        console.error("PAGE PERMISSIONS API FAILED");
        return json({ success: false, error: "Unable to load permissions" }, 500);
    }
}
