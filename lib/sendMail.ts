import nodemailer from "nodemailer";


const transporter = nodemailer.createTransport({

    host: "smtp.gmail.com",

    port: 587,

    secure: false,

    auth: {
        user: process.env.EMAIL_USER,
        pass: process.env.EMAIL_PASS
    }

});



// Reset Password Email

export async function sendMail(
    email: string,
    token: string
) {


    const link =
        `${process.env.NEXT_PUBLIC_URL}/reset-password/${token}`;



    await transporter.sendMail({

        from: process.env.EMAIL_USER,

        to: email,

        subject: "Reset Password",

        html: `

        <h2>Password Reset</h2>

        <p>Click below:</p>

        <a href="${link}">
            Reset Password
        </a>

        <p>This link expires in 15 minutes.</p>

        `

    });


    console.log("RESET MAIL SENT:", link);

}




// Contact Form Email

export async function sendContactMail(
    data:any
) {


    await transporter.sendMail({

        from: process.env.EMAIL_USER,

        to: "bobupwork777@gmail.com",

        subject: "New Contact Form Submission",

        html: `

        <h2>New Contact Request</h2>


        <p>
        <strong>Name:</strong>
        ${data.firstName} ${data.lastName}
        </p>


        <p>
        <strong>Email:</strong>
        ${data.email}
        </p>


        <p>
        <strong>Phone:</strong>
        ${data.countryCode} ${data.phone}
        </p>


        <p>
        <strong>Message:</strong>
        </p>

        <p>
        ${data.message}
        </p>

        `

    });


    console.log("CONTACT MAIL SENT");

}