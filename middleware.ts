import { NextResponse } from "next/server";
import type { NextRequest } from "next/server";

export async function middleware(req: NextRequest) {
    const path = req.nextUrl.pathname.replace(/\/+$/, "") || "/";
    const publicPages = ["/", "/login", "/signup", "/forgot-password", "/reset-password"];

    if (publicPages.includes(path) || path.startsWith("/reset-password/")) {
        return NextResponse.next();
    }

    const token = req.cookies.get("token")?.value;
    if (!token || !/^[a-f0-9]{64}$/.test(token)) {
        return NextResponse.redirect(new URL("/login", req.url));
    }

    try {
        // One API call validates the database session and checks page permission.
        const response = await fetch(new URL("/api/my-permissions", req.url), {
            method: "POST",
            headers: {
                "Content-Type": "application/json",
                Cookie: `token=${token}`,
            },
            body: JSON.stringify({ path }),
            cache: "no-store",
            redirect: "error",
            signal: AbortSignal.timeout(10000),
        });

        if (response.status === 401) {
            return NextResponse.redirect(new URL("/login", req.url));
        }
        if (!response.ok) {
            return new NextResponse("Unable to check page access. Please try again.", {
                status: 503,
                headers: { "Cache-Control": "no-store" },
            });
        }
        const data = await response.json();
        if (data.success === true && data.allowed === true) {
            return NextResponse.next();
        }
        return new NextResponse("You do not have permission to access this page.", {
            status: 403,
            headers: { "Cache-Control": "no-store" },
        });
    } catch {
        return new NextResponse("Unable to check page access. Please try again.", {
            status: 503,
            headers: { "Cache-Control": "no-store" },
        });
    }
}

export const config = {
    // A fixed matcher covers all page routes; MongoDB controls the grants.
    // API endpoints and public static assets are excluded from this page guard.
    matcher: [
        "/((?!api(?:/|$)|_next(?:/|$)|.*\\.[^/]+$).*)",
    ],
};
