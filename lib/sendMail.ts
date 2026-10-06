import nodemailer from "nodemailer";

const escapeHtml = (value: unknown) => String(value ?? "").replace(/[&<>"']/g, character => ({
    "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;",
}[character] || character));

function getTransporter() {
    const { EMAIL_USER, EMAIL_PASS } = process.env;
    if (!EMAIL_USER || !EMAIL_PASS) throw new Error("Email configuration is missing");
    return nodemailer.createTransport({
        host: "smtp.gmail.com",
        port: 587,
        secure: false,
        requireTLS: true,
        auth: { user: EMAIL_USER, pass: EMAIL_PASS },
    });
}

export async function sendMail(email: string, token: string) {
    if (!/^[a-f0-9]{64}$/.test(token)) throw new Error("Invalid reset token");
    const baseUrl = process.env.APP_URL || process.env.NEXT_PUBLIC_URL ||
        (process.env.NODE_ENV !== "production" ? "http://localhost:3000" : "");
    if (!baseUrl) throw new Error("Application URL is missing");
    const configuredUrl = new URL(baseUrl);
    if (!["http:", "https:"].includes(configuredUrl.protocol)) throw new Error("Invalid application URL");
    const link = new URL(`/reset-password/${encodeURIComponent(token)}`, configuredUrl).toString();

    const result = await getTransporter().sendMail({
        from: process.env.EMAIL_USER,
        to: email,
        subject: "Reset your password",
        text: `Reset your password: ${link}\n\nThis link expires in 15 minutes. If you did not request this, ignore this email.`,
        html: `<h2>Reset your password</h2>
            <p>Click the button below to choose a new password.</p>
            <a href="${escapeHtml(link)}" style="display:inline-block;padding:12px 20px;background:#2563eb;color:#fff;text-decoration:none;border-radius:8px">Reset password</a>
            <p>This link expires in 15 minutes.</p>
            <p>If you did not request this, ignore this email.</p>`,
    });
    if (!result.accepted?.length) throw new Error("Reset email was not accepted");
    // Never log reset links or tokens.
}

interface ContactData {
    firstName: string;
    lastName: string;
    email: string;
    countryCode?: string;
    phone?: string;
    message: string;
}

export async function sendContactMail(data: ContactData) {
    const result = await getTransporter().sendMail({
        from: process.env.EMAIL_USER,
        to: "bobupwork777@gmail.com",
        subject: "New Contact Form Submission",
        text: `Name: ${data.firstName} ${data.lastName}\nEmail: ${data.email}\nPhone: ${data.countryCode || ""} ${data.phone || ""}\nMessage: ${data.message}`,
        html: `<h2>New Contact Request</h2>
            <p><strong>Name:</strong> ${escapeHtml(data.firstName)} ${escapeHtml(data.lastName)}</p>
            <p><strong>Email:</strong> ${escapeHtml(data.email)}</p>
            <p><strong>Phone:</strong> ${escapeHtml(data.countryCode)} ${escapeHtml(data.phone)}</p>
            <p><strong>Message:</strong></p>
            <p style="white-space:pre-wrap">${escapeHtml(data.message)}</p>`,
    });
    if (!result.accepted?.length) throw new Error("Contact email was not accepted");
}
