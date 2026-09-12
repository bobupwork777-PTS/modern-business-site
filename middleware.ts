import { NextResponse } from "next/server";
import type { NextRequest } from "next/server";


export function middleware(req: NextRequest) {


    const token = req.cookies.get("token")?.value;

    const role = req.cookies.get("role")?.value?.toLowerCase();


    const path = req.nextUrl.pathname;



    const publicPages = [
        "/login",
        "/signup",
        "/forgot-password"
    ];



    const adminPages = [
        "/jobs",
        "/ai-opportunity-analyzer"
    ];




    // Public pages

    if (publicPages.includes(path)) {


        if (token) {

            return NextResponse.redirect(
                new URL("/dashboard", req.url)
            );

        }


        return NextResponse.next();

    }




    // Protected pages

    if (!token) {

        return NextResponse.redirect(
            new URL("/login", req.url)
        );

    }




    // Admin only

    if (adminPages.some(page => path.startsWith(page))) {

        if (role !== "admin") {

            return NextResponse.redirect(
                new URL("/dashboard", req.url)
            );

        }

    }



    return NextResponse.next();

}




export const config = {

    matcher: [
        "/dashboard/:path*",
        "/profile/:path*",
        "/reset-password/:path*",
        "/jobs/:path*",
        "/ai-opportunity-analyzer/:path*",
        "/login",
        "/signup",
        "/forgot-password"
    ]

};