import { GoogleGenerativeAI } from "@google/generative-ai";


const genAI = new GoogleGenerativeAI(
    process.env.GEMINI_API_KEY!
);



export async function POST(req: Request) {

    try {
        const { job } = await req.json();
        if (!process.env.GEMINI_API_KEY) {

            return Response.json(
                {
                    error: "Missing Gemini API Key"
                },
                {
                    status: 500
                }
            );
        }

        const model =
            genAI.getGenerativeModel({
                model: "gemini-3.5-flash-lite"
            });

const prompt = `

Act as Bodhi Brata Das, Wix Expert and Velo-certified Top-rated Developer.

Your task is to write a natural Upwork proposal based on this job.

Job Title:
${job.Title}

Job Description:
${job.Description}

Budget:
${job.Budget}


Important:
Read the JD carefully first.

Understand:
- Client's business
- Required Wix functionality
- Main pain points
- Expected outcome


Generate proposal following this exact style:


OPENING:

Start with:

"Hi, Good Morning !"

Immediately after that write 1-2 sentences proving you understood the project.

Mention the exact requirement:
- Wix redesign
- Wix Studio build
- Velo development
- CMS/database
- Automation
- Forms
- Ecommerce
- SEO
- Mobile optimization

If a relevant portfolio example exists, mention it in the first paragraph.


RELEVANT WORKS:

Add:

"Relevant Wix Works:"

Select only 3-5 relevant projects.

Choose based on:
- Industry similarity
- Functionality similarity
- Technical requirement similarity


Available projects:

Stride Coach:
https://www.stridecoach.com/

Kidventure Studios:
https://www.kidventurestudios.com/

Hale Smoothies:
https://www.halesmoothies.biz

Key Experiences:
https://www.keyexperiences.ca/

My Happy Baker:
https://www.myhappybaker.com/

Vivalagree:
https://www.vivalagree.com/

Lagree Sant Cugat:
https://www.lagreesantcugat.com/

Cupid's Corner Events:
https://www.cupidscornerevents.com/

Yellow Ink Content:
https://www.yellowinkcontent.com/

Altura Enterprises:
https://www.alturaenterprises.co/


Velo Projects:

Easy Meals Japan:
https://www.easymealsjapan.com/

Brett Interiors:
https://www.brettinteriors.com/

Erovra:
https://www.erovra.com/


APPROACH:

Add:

"My Approach:"

Write 4-6 bullet points.

Each bullet should solve the client's actual requirements.

Avoid generic points.


EXPERIENCE:

Add a short paragraph:

"I have experience with Wix Studio, Wix CRM, Forms, Automations, Bookings, CMS, payment integrations, and third party API/workflow connections.

All accounts, subscriptions, domains, and integrations will remain under your business ownership through Wix Collaborator access."


QUESTIONS:

End with:

"A few questions:"

Add exactly 2 short project-specific questions.


CLOSING:

End:

"Looking forward to discussing the project with you.

Best,
Bodhi 

Wix Expert | Velo-certified Top-rated Developer
Portfolio:https://online.fliphtml5.com/hbbqc/unva/"


Rules:
- Keep proposal natural and human.
- Do not sound AI generated.
- Avoid "I understand".
- Do not write long explanations.
- Maximum 1200-1400 characters.
- Return ONLY JSON:

{
"relevant":true,
"proposal":""
}

`;



        const result = await model.generateContent(prompt);
        const text = result.response.text();
        console.log("GEMINI RESPONSE:", text );

        const clean = text
                    .replace(/```json/g, "")
                    .replace(/```/g, "")
                    .trim();

        return Response.json(
            JSON.parse(clean)
        );


    }

    catch (error: any) {

        console.error( "GEMINI ERROR:", error );

        return Response.json(
            {
                error: error.message
            },
            {
                status: 500
            }
        );
    }

}