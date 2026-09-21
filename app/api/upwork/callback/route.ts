import {
    NextRequest,
    NextResponse
} from "next/server";

import {
    exchangeUpworkAuthorizationCode
} from "@/lib/upwork";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const DASHBOARD_URL =
    process.env.UPWORK_DASHBOARD_URL ||
    "https://bobupwork777.wixstudio.com/my-site-157";

function dashboardRedirect(
    status: "connected" | "error",
    message?: string
) {
    const url =
        new URL(DASHBOARD_URL);

    url.searchParams.set(
        "upwork",
        status
    );

    if (message) {
        url.searchParams.set(
            "upworkMessage",
            message
        );
    }

    return url;
}

export async function GET(
    request: NextRequest
) {
    try {

        const oauthError =
            request.nextUrl.searchParams
                .get("error");

        const oauthDescription =
            request.nextUrl.searchParams
                .get("error_description");

        /*
         * User denied authorization
         * or Upwork returned OAuth error.
         */
        if (oauthError) {

            console.error(
                "UPWORK OAUTH ERROR:",
                oauthError,
                oauthDescription
            );

            return NextResponse.redirect(
                dashboardRedirect(
                    "error",
                    oauthDescription ||
                    oauthError
                )
            );
        }

        const code =
            request.nextUrl.searchParams
                .get("code")
                ?.trim();

        if (!code) {

            console.error(
                "UPWORK CALLBACK ERROR: authorization code missing"
            );

            return NextResponse.redirect(
                dashboardRedirect(
                    "error",
                    "Authorization code missing"
                )
            );
        }

        console.log(
            "UPWORK CALLBACK: exchanging authorization code"
        );

        /*
         * Exchange code for:
         *
         * access_token
         * refresh_token
         *
         * saveTokens() then stores these
         * in MongoDB.
         */
        await exchangeUpworkAuthorizationCode(
            code
        );

        console.log(
            "UPWORK CALLBACK: authorization successful"
        );

        return NextResponse.redirect(
            dashboardRedirect(
                "connected"
            )
        );

    } catch (error: any) {

        console.error(
            "UPWORK CALLBACK ERROR:",
            error
        );

        return NextResponse.redirect(
            dashboardRedirect(
                "error",
                error?.message ||
                "Upwork authorization failed"
            )
        );
    }
}