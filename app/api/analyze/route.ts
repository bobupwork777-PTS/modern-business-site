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

JOB TITLE:
${job.Title}

JOB DESCRIPTION:
${job.Description}

BUDGET:
${job.Budget}


==================================================
1. IDENTIFY THE PRIMARY PLATFORM
==================================================

First analyze the complete JD and identify the PRIMARY platform/technology required.

Choose ONLY ONE:

- Wix
- Webflow
- Shopify
- Framer
- Next.js

Use the platform that represents the main requirement of the project.

Examples:

Wix:
Wix, Wix Studio, Velo, Wix CMS, Wix CRM, Wix Forms, Wix Automations, Wix APIs, Wix Ecommerce.

Webflow:
Webflow, Figma-to-Webflow, Webflow CMS, Memberstack, Webflow interactions, custom code.

Shopify:
Shopify, Shopify 2.0, Liquid, Shopify theme, Shopify apps, ecommerce store.

Framer:
Framer, Figma-to-Framer, Framer CMS, Framer animations, Framer interactions.

Next.js:
Next.js, React, TypeScript, API routes, authentication, database, dashboards, full-stack applications.

Do NOT mention multiple platforms unless the client explicitly asks for multiple platforms.

The selected platform must also determine which portfolio list is used.


==================================================
2. OPENING
==================================================

Start EXACTLY with:

"Hello, Good Morning !"

Immediately after that, write 1-2 natural sentences that demonstrate you carefully analyzed THIS specific JD.

Mention the client's actual requirement, problem, functionality, or desired outcome.

The opening must NOT sound like a generic freelancer introduction.

DO NOT use:

- "I understand"
- "I am excited"
- "I would love to"
- "I came across your job"
- "I have read your job posting"
- "I am confident"
- Generic introductions
- Generic marketing statements

Instead, directly address the project.

For example:

If the JD asks for Wix Velo:
Mention the actual Velo/CMS/API/automation requirement.

If the JD asks for Webflow:
Mention the actual Webflow redesign, Figma conversion, CMS, Memberstack, animation or integration requirement.

If the JD asks for Shopify:
Mention the actual Shopify theme, Liquid, app, ecommerce or CRO requirement.

If the JD asks for Framer:
Mention the actual Framer design, Figma conversion, CMS, animation or responsive requirement.

If the JD asks for Next.js:
Mention the actual application, authentication, dashboard, API, database or full-stack requirement.


==================================================
3. RELEVANT WORKS
==================================================

Add:

"Relevant Works:"

Select ONLY 2-4 portfolio projects that are genuinely relevant to the JD.

IMPORTANT:

The portfolio lists below are already arranged in PRIORITY ORDER.

YOU MUST PRESERVE THIS ORDER.

The model must NOT reorder projects based on its own preference.

Use this exact logic:

STEP 1:
Identify which projects are genuinely relevant to the JD.

STEP 2:
Filter out irrelevant projects.

STEP 3:
Keep the ORIGINAL ORDER from the portfolio list.

STEP 4:
Take the first 2-4 relevant projects in that original order.

Relevance determines WHICH projects are selected.

The supplied portfolio order determines HOW the selected projects are ordered.

Example:

Portfolio list:

A
B
C
D
E

If A, C and E are relevant, output:

A
C
E

NEVER output:

E
A
C

Do NOT rank or reorder selected projects.

Do NOT randomly select projects.

Do NOT include all portfolio links.

Do NOT use projects from another platform.

Do NOT invent project relevance.

Maximum: 4 projects.

Minimum: 2 projects when enough relevant projects exist.

If only 1 project is genuinely relevant, use only 1 rather than adding an irrelevant project.


==================================================
WIX / VELO PORTFOLIO
PRIORITY ORDER — DO NOT CHANGE
==================================================

1. https://www.stridecoach.com/
2. https://www.kidventurestudios.com/
3. https://www.keyexperiences.ca/
4. https://www.myhappybaker.com/
5. https://www.vivalagree.com/
6. https://www.lagreesantcugat.com/
7. https://www.cupidscornerevents.com/
8. https://www.yellowinkcontent.com/
9. https://www.alturaenterprises.co/
10. https://www.easymealsjapan.com/
11. https://www.brettinteriors.com/
12. https://www.erovra.com/

Use ONLY these for Wix projects.

Easy Meals Japan, Brett Interiors and Erovra are especially relevant when the JD requires advanced Velo, custom functionality, integrations or database-driven functionality.


==================================================
WEBFLOW PORTFOLIO
PRIORITY ORDER — DO NOT CHANGE
==================================================

1. https://www.pug.ai/ — AI / SaaS / Modern UI
2. https://www.ptsglobals.com/ — Global Business / Corporate
3. https://www.tomzovko.de/ — Portfolio / Clean Design
4. https://www.runeleven.com/ — Agency / Digital / Tech
5. https://www.navable.com/ — SaaS / Platform / Fintech
6. https://www.ironblocks.com/ — Web3 / Security / Tech
7. https://www.trustana.com/ — B2B / SaaS / Corporate
8. https://www.hazelai.com/ — AI / Tech / Modern Webflow
9. https://www.eberledigital.de/ — Agency / Digital
10. https://www.mcgconsulting.com.au/ — Memberstack / Membership / Portal
11. https://saaia.com/ — Figma-to-Webflow / Pixel-perfect

Use:
- mcgconsulting.com.au for Memberstack, membership and portal projects.
- saaia.com for Figma-to-Webflow and pixel-perfect projects.
- pug.ai, navable.com, trustana.com and hazelai.com for SaaS/AI/technology projects.

However, even when using these descriptions, ALWAYS preserve the original portfolio order when multiple projects are selected.


==================================================
SHOPIFY PORTFOLIO
PRIORITY ORDER — DO NOT CHANGE
==================================================

1. https://www.collectwithpower.com/ — Ecommerce / Brand Store
2. https://www.sweetleesteas.com/ — Food / Beverage / Specialty Products
3. https://www.polarperformance.com.au/ — Fitness / Apparel / Gear
4. https://slimbynature.com.au/ — Health / Wellness
5. https://verifiedinfield.co/ — Ecommerce / Lifestyle / Goods

Match the JD's industry and functionality.

Always preserve this exact order when multiple projects are selected.


==================================================
FRAMER PORTFOLIO
PRIORITY ORDER — DO NOT CHANGE
==================================================

1. https://aurelionhealth.io/ — Health / SaaS / Modern Web
2. https://crayo.ai/ — AI / SaaS / Dynamic UI
3. https://startupanatomy.co/ — Startup / Business / Resource Hub
4. https://www.lampdigital.co/ — Agency / Digital / Tech
5. https://lucaferrara.com/ — Portfolio / Designer Showcase
6. https://www.calibore.com/ — Modern Brand / Corporate
7. https://www.nova.codes/ — Tech / Code / SaaS
8. https://www.entrepedia.co/ — Content / Directory / Startup Platform
9. https://www.littlexplorersmontessori.com/ — Education / Clean Layout

Always preserve this exact order when multiple projects are selected.


==================================================
NEXT.JS / FULL-STACK PORTFOLIO
PRIORITY ORDER — DO NOT CHANGE
==================================================

1. https://modern-business-site-nu.vercel.app/login

This is a Next.js application demonstrating:

- Authentication
- Dashboard functionality
- API routes
- MongoDB integration
- AI/API workflows
- Full-stack functionality

Use this as the primary technical example for Next.js projects.


==================================================
FULL PORTFOLIO
==================================================

Always include the full portfolio deck LAST:

https://online.fliphtml5.com/hbbqc/unva/

Do NOT count the Full Portfolio Deck as one of the 2-4 Relevant Works.

Correct structure:

Relevant Works:

[2-4 selected projects in original priority order]

Full Portfolio:
https://online.fliphtml5.com/hbbqc/unva/


==================================================
4. MY APPROACH
==================================================

Add:

"My Approach:"

Write 3-4 concise bullet points.

Every bullet must directly address something mentioned in the JD.

Do NOT use generic statements such as:

- Build a modern website
- Ensure responsiveness
- Test the website
- Provide a high-quality solution
- Make the website user-friendly

Instead, describe the actual implementation.

For example:

- Rebuild the existing Figma structure using reusable CMS-driven sections.
- Configure Webflow CMS and required interactions.
- Connect Memberstack to the gated content.
- QA the final build across desktop, tablet and mobile.

The approach must be specific to the client's project.


==================================================
5. EXPERIENCE
==================================================

Use ONLY the experience statement corresponding to the selected platform.

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

Do NOT use experience claims unrelated to the JD.


==================================================
6. OWNERSHIP
==================================================

For Wix, Webflow, Shopify and Framer projects, you may include:

"All accounts, subscriptions, domains and integrations remain under your business ownership."

Only include this if the proposal remains within the character limit.

Do NOT force it into every proposal.


==================================================
7. QUICK QUESTIONS
==================================================

Add:

"A few questions:"

Ask EXACTLY 2 short questions.

Questions must be specific to the JD.

Questions should identify missing information that could affect implementation.

Do NOT ask questions whose answers are already clearly provided in the JD.

Examples:

- Is the current design finalized, or should I also handle the UI direction?
- Is the Figma file complete for both desktop and mobile?
- Do you already have the Memberstack structure configured?
- Should the Shopify store retain the current theme or move to Shopify 2.0?
- Which authentication/database provider should the Next.js application use?
- Do you already have the required API credentials available?


==================================================
8. CLOSING
==================================================

End with:

"Looking forward to discussing the project with you.

Best,
Bodhi

[PLATFORM] Expert | Top-rated Developer
Portfolio: https://online.fliphtml5.com/hbbqc/unva/"

Replace [PLATFORM] with exactly one:

Wix Studio & Velo

OR

Webflow

OR

Shopify

OR

Framer

OR

Next.js & Full-Stack


==================================================
9. PLATFORM-SPECIFIC POSITIONING
==================================================

WIX:

Position Bodhi as a Wix Studio + Velo expert.

Focus on:
- Wix Studio
- Velo
- CMS
- Wix CRM
- Forms
- Automations
- APIs
- Ecommerce
- Dynamic pages
- Custom functionality
- SEO
- Responsive/mobile fixes

WEBFLOW:

Position Bodhi as a Webflow expert.

Focus on:
- Webflow
- Figma-to-Webflow
- CMS
- Responsive development
- Interactions
- Animations
- Memberstack
- Custom code
- Integrations
- Pixel-perfect implementation

SHOPIFY:

Position Bodhi as a Shopify expert.

Focus on:
- Shopify 2.0
- Liquid
- Theme customization
- Ecommerce
- Product/catalog setup
- Apps
- Integrations
- CRO
- Migration
- Checkout

FRAMER:

Position Bodhi as a Framer expert.

Focus on:
- Framer
- Figma-to-Framer
- Responsive design
- CMS
- Animations
- Interactions
- Custom components
- Landing pages
- SEO

NEXT.JS:

Position Bodhi as a Next.js / Full-Stack expert.

Focus on:
- Next.js
- React
- TypeScript
- Authentication
- Dashboards
- API routes
- MongoDB/database
- Third-party APIs
- AI integrations
- Full-stack development
- Performance


==================================================
10. WRITING STYLE
==================================================

The proposal must:

- Sound human
- Sound confident
- Sound experienced
- Be personalized to the actual JD
- Be concise
- Be easy to scan
- Be conversational
- Avoid AI-sounding language
- Avoid excessive explanations
- Avoid repeating the JD
- Avoid generic marketing language
- Avoid unnecessary technical jargon
- Never invent experience
- Never invent portfolio projects
- Never invent client results
- Never claim functionality that a portfolio project does not represent
- Never include irrelevant technologies
- Never include irrelevant portfolio links

Do not use emojis.

Do not use excessive formatting.

Do not write a long introduction.

Do not start with "I understand".

The proposal should feel like a real freelancer personally wrote it after reading the client's job.


==================================================
11. CHARACTER LIMIT
==================================================

Maximum proposal length:

1400 characters.

Preferred length:

1100-1300 characters.

The 1400-character limit applies to the "proposal" value only.

Do not sacrifice personalization just to make the proposal shorter.

Prioritize:

1. Personalized opening
2. Relevant Works
3. Specific approach
4. Relevant experience
5. 2 questions
6. Short closing


==================================================
12. RELEVANCE CHECK
==================================================

Set:

"relevant": true

when the project is a realistic fit for Bodhi's services.

Set:

"relevant": false

only when:

- The project is clearly unrelated to the supported platforms/services.
- The required skills are completely outside the listed expertise.
- The project is not realistically suitable for this profile.

Do NOT mark a project irrelevant simply because the budget is low.


==================================================
13. FINAL OUTPUT
==================================================

Return ONLY valid JSON.

Do NOT return Markdown.

Do NOT return code fences.

Do NOT return explanations before or after the JSON.

Use exactly this structure:

{
  "platform": "Wix",
  "relevant": true,
  "proposal": "Hello, Good Morning ! ..."
}

The "platform" value MUST be exactly one of:

"Wix"
"Webflow"
"Shopify"
"Framer"
"Next.js"

The "relevant" value MUST be true or false.

The "proposal" value MUST contain the complete proposal.

Ensure the final response is valid JSON that can be parsed directly using JSON.parse().
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