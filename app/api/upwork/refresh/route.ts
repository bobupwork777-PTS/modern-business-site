import {
    NextResponse
} from "next/server";

import {
    forceRefreshUpworkToken,
    getUpworkTokenStatus,
    isUpworkReauthError
} from "@/lib/upwork";

export const runtime =
    "nodejs";

export const dynamic =
    "force-dynamic";

export async function POST() {

    try {

        await forceRefreshUpworkToken();

        const tokenStatus =
            await getUpworkTokenStatus();

        return NextResponse.json({
            success: true,

            message:
                "Upwork token refreshed successfully.",

            tokenStatus
        });

    } catch (error: any) {

        console.error(
            "UPWORK REFRESH ERROR:",
            error
        );

        if (
            isUpworkReauthError(
                error
            )
        ) {

            return NextResponse.json(
                {
                    success: false,

                    error:
                        "UPWORK_REAUTH_REQUIRED",

                    reauthRequired:
                        true,

                    message:
                        "Upwork authorization is required.",

                    reauthReason:
                        error?.reason ||
                        "No valid refresh token is available.",

                    /*
                     * Always send our own connect endpoint.
                     *
                     * Client must NAVIGATE here,
                     * not fetch it as JSON.
                     */
                    reauthUrl:
                        "/api/upwork/connect"
                },
                {
                    status: 401
                }
            );
        }

        return NextResponse.json(
            {
                success: false,

                error:
                    error?.message ||
                    "Unable to refresh Upwork token"
            },
            {
                status: 500
            }
        );
    }
}