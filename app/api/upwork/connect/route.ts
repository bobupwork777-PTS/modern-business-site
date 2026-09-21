import { NextResponse } from "next/server";
import { getUpworkAuthorizationUrl } from "@/lib/upwork";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function GET() {
    try {
        const authUrl =
            getUpworkAuthorizationUrl();

        /*
         * IMPORTANT:
         * This is a browser redirect.
         * Do NOT fetch this route and call response.json().
         */
        return NextResponse.redirect(
            authUrl,
            302
        );

    } catch (error: any) {

        console.error(
            "UPWORK CONNECT ERROR:",
            error
        );

        return NextResponse.json(
            {
                success: false,
                error:
                    error?.message ||
                    "Unable to start Upwork authorization"
            },
            {
                status: 500
            }
        );
    }
}