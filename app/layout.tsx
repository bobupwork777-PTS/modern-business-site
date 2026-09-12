import "./globals.css";
import Navbar from "@/components/Navbar";
import { AuthProvider } from "@/components/AuthProvider";


export default function RootLayout({
    children,
}: {
    children: React.ReactNode
}) {


    return (
        <html lang="en">

            <body suppressHydrationWarning={true}>

                <AuthProvider>

                    <Navbar />

                    {children}

                </AuthProvider>

            </body>

        </html>
    );
}