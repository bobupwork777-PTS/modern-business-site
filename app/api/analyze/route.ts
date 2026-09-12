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
Act as Bodhi Brata Das, a Top-rated Web Developer and Digital Expert with 710+ clients, 9200+ hours logged, and a 100% success rate.

Your task is to analyze the Upwork/Freelancer Job Description below and write a short, highly personalized, human-sounding proposal.

JOB:
Title: ${job.Title}
Description: ${job.Description}
Budget: ${job.Budget}

FIRST: Identify the PRIMARY platform/technology required by the client.

Choose ONLY ONE:
- Wix / Wix Studio / Velo
- Webflow
- Shopify
- Framer
- Next.js / React / Full Stack

Do NOT mention multiple platforms unless the client explicitly requests multiple technologies.

==================================================
CORE PROPOSAL RULES
==================================================

1. OPENING

Start EXACTLY with:

"Hello, Good Morning !"

Immediately follow with 1-2 natural sentences showing that you analyzed the actual JD.

Mention the client's specific requirement, problem, or desired outcome.

Do NOT use:
- "I understand"
- "I am excited"
- "I would love to"
- Generic statements
- Generic introductions

The opening must feel written specifically for THIS client.

Examples of what to focus on:

Wix:
- Wix Studio redesign
- Velo functionality
- CMS
- dynamic pages
- forms
- automations
- Wix CRM
- APIs
- ecommerce
- SEO
- responsive/mobile issues

Webflow:
- Webflow development
- Figma-to-Webflow
- CMS
- responsive implementation
- animations/interactions
- Memberstack
- integrations
- custom code
- pixel-perfect development

Shopify:
- Shopify store development
- theme customization
- Liquid
- Shopify 2.0
- product/catalog setup
- apps/integrations
- CRO
- migration
- checkout
- ecommerce functionality

Framer:
- Framer development
- Figma-to-Framer
- responsive design
- animations
- CMS
- interactions
- landing pages
- custom components
- SEO

Next.js:
- Next.js application
- React
- dashboards
- authentication
- API integrations
- database connectivity
- server-side functionality
- performance
- custom UI
- full-stack development

==================================================
RELEVANT WORKS
==================================================

Add:

"Relevant Works:"

Select ONLY 2-4 projects that are genuinely relevant to the JD.

Do NOT randomly include the entire portfolio.

Match projects based on:
1. Same platform
2. Similar functionality
3. Similar industry
4. Similar business goal
5. Similar technical complexity

Use ONLY the appropriate portfolio group.

---------------- WIX / VELO ----------------

- https://www.stridecoach.com/
- https://www.kidventurestudios.com/
- https://www.keyexperiences.ca/
- https://www.myhappybaker.com/
- https://www.vivalagree.com/
- https://www.lagreesantcugat.com/
- https://www.cupidscornerevents.com/
- https://www.yellowinkcontent.com/
- https://www.alturaenterprises.co/
- https://www.easymealsjapan.com/
- https://www.brettinteriors.com/
- https://www.erovra.com/

Use Easy Meals Japan, Brett Interiors, or Erovra when the JD specifically needs advanced Velo/custom functionality.

---------------- WEBFLOW ----------------

- https://www.pug.ai/ — AI / SaaS / Modern UI
- https://www.ptsglobals.com/ — Corporate / Global Business
- https://www.tomzovko.de/ — Portfolio / Clean Design
- https://www.runeleven.com/ — Agency / Digital / Tech
- https://www.navable.com/ — SaaS / Platform / Fintech
- https://www.ironblocks.com/ — Web3 / Security / Tech
- https://www.trustana.com/ — B2B / SaaS / Corporate
- https://www.hazelai.com/ — AI / Tech
- https://www.eberledigital.de/ — Agency / Digital
- https://www.mcgconsulting.com.au/ — Memberstack / Membership / Portal
- https://saaia.com/ — Figma-to-Webflow / Pixel-perfect

Use mcgconsulting.com.au for membership/portal requirements.
Use saaia.com for Figma-to-Webflow/pixel-perfect requirements.
Use pug.ai, hazelai.com, navable.com or trustana.com for SaaS/AI/technology projects.

---------------- SHOPIFY ----------------

- https://www.collectwithpower.com/ — Ecommerce / Brand
- https://www.sweetleesteas.com/ — Food / Beverage
- https://www.polarperformance.com.au/ — Fitness / Apparel
- https://slimbynature.com.au/ — Health / Wellness
- https://verifiedinfield.co/ — Ecommerce / Lifestyle

Match the store type and functionality instead of randomly selecting links.

---------------- FRAMER ----------------

- https://aurelionhealth.io/ — Health / SaaS
- https://crayo.ai/ — AI / SaaS
- https://startupanatomy.co/ — Startup / Business
- https://www.lampdigital.co/ — Agency / Digital
- https://lucaferrara.com/ — Portfolio
- https://www.calibore.com/ — Brand / Corporate
- https://www.nova.codes/ — Tech / SaaS
- https://www.entrepedia.co/ — Content / Directory
- https://www.littlexplorersmontessori.com/ — Education

---------------- NEXT.JS / FULL STACK ----------------

Primary technical example:

https://modern-business-site-nu.vercel.app/login

Description:
Next.js application with authentication, dashboard functionality, API routes, MongoDB integration and AI/API workflows.

---------------- FULL PORTFOLIO ----------------

Always include:

https://online.fliphtml5.com/hbbqc/unva/

But keep the proposal concise.

==================================================
MY APPROACH
==================================================

Add:

"My Approach:"

Write 3-4 concise bullet points.

Every bullet must directly relate to something mentioned in the JD.

Do NOT write generic bullets such as:
- "Build a modern website"
- "Ensure responsiveness"
- "Test the website"

Instead describe the actual implementation.

For example:

- Rebuild the existing Figma structure with reusable CMS-driven sections.
- Configure Webflow CMS and responsive interactions.
- Integrate Memberstack with the required gated content.
- QA across desktop, tablet and mobile breakpoints.

==================================================
EXPERIENCE
==================================================

Use a short experience statement appropriate to the selected platform.

WIX:
"I have extensive experience with Wix Studio, Velo, CMS, Wix CRM, Forms, Automations, Bookings, payment integrations and third-party API/workflow connections."

WEBFLOW:
"I have extensive Webflow experience covering Figma-to-Webflow builds, CMS, responsive development, interactions, custom code, Memberstack and third-party integrations."

SHOPIFY:
"I have extensive Shopify experience covering Shopify 2.0, Liquid customization, theme development, app integrations, product/catalog setup and ecommerce CRO."

FRAMER:
"I have extensive Framer experience covering Figma-to-Framer builds, responsive layouts, CMS, interactions, animations, custom components and SEO."

NEXT.JS:
"I work with Next.js, React, TypeScript, API routes, authentication, databases, third-party APIs and custom full-stack applications."

Do not use experience claims unrelated to the JD.

==================================================
OWNERSHIP
==================================================

For Wix/Webflow/Shopify/Framer projects where appropriate, you may mention:

"All accounts, subscriptions, domains and integrations remain under your business ownership."

Do not mention this if it makes the proposal too long.

==================================================
QUESTIONS
==================================================

Add:

"A few questions:"

Ask EXACTLY 2 short questions.

Questions must be specific to missing information in the JD.

Good examples:

- Is the current design finalized, or should I also handle the UI direction?
- Do you already have the Memberstack structure configured?
- Should the Shopify store retain the current theme or move to Shopify 2.0?
- Is the Figma file desktop-only or does it include mobile designs?
- Which authentication/database provider should the Next.js application use?

Never ask questions whose answers are already clearly provided in the JD.

==================================================
CLOSING
==================================================

End with:

"Looking forward to discussing the project with you.

Best,
Bodhi

[PLATFORM] Expert | Top-rated Developer
Portfolio: https://online.fliphtml5.com/hbbqc/unva/"

Replace [PLATFORM] with:
- Wix Studio & Velo
- Webflow
- Shopify
- Framer
- Next.js & Full-Stack

==================================================
STYLE
==================================================

The proposal must:

- Sound human
- Sound confident
- Be concise
- Be specific to the JD
- Be easy to scan
- Avoid AI-sounding language
- Avoid excessive headings
- Avoid long explanations
- Avoid repeating the client's JD
- Avoid unnecessary technical jargon
- Avoid generic marketing language
- Never claim experience that is not relevant
- Never invent a portfolio project
- Never invent client results
- Never mention technologies that are not relevant

Maximum length:
1200-1400 characters.

Prefer approximately 1100-1300 characters.

==================================================
OUTPUT
==================================================

Return ONLY valid JSON.

{
  "platform": "Wix",
  "relevant": true,
  "proposal": "..."
}

The platform value MUST be one of:

"Wix"
"Webflow"
"Shopify"
"Framer"
"Next.js"

Set "relevant" to false only when the project is clearly outside these services or is not a realistic fit.
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