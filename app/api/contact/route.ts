import { NextResponse } from "next/server";
import nodemailer from "nodemailer";


export async function POST(req: Request) {

    try {


        const data = await req.json();



        const transporter = nodemailer.createTransport({

            service: "gmail",

            auth: {

                user: process.env.EMAIL_USER,

                pass: process.env.EMAIL_PASSWORD

            }

        });



        await transporter.sendMail({

            from: process.env.EMAIL_USER,

            to: "bobupwork777@gmail.com",

            subject: "New Contact Form Submission",

            html: `

            <h2>New Contact Request</h2>

            <p><strong>Name:</strong> 
            ${data.firstName} ${data.lastName}</p>


            <p><strong>Email:</strong> 
            ${data.email}</p>


            <p><strong>Phone:</strong> 
            ${data.countryCode} ${data.phone}</p>


            <p><strong>Message:</strong></p>

            <p>
            ${data.message}
            </p>

            `

        });



        return NextResponse.json({

            success:true

        });



    }
    catch(error:any){


        console.log("EMAIL ERROR:", error);



        return NextResponse.json(

            {
                success:false,
                error:error.message
            },

            {
                status:500
            }

        );


    }

}