import { GoogleGenerativeAI } from "@google/generative-ai";

const genAI = new GoogleGenerativeAI(process.env.GEMINI_API_KEY!);

export async function POST(req: Request) {
    try {
        if (!process.env.GEMINI_API_KEY) {
            return Response.json({ error: "Missing Gemini API Key" }, { status: 500 });
        }

        const { job } = await req.json();
        const model = genAI.getGenerativeModel({ model: "gemini-3.5-flash-lite" });

        const prompt = `
Act as Bodhi Brata Das, a Top-rated Web Developer, Creative Designer and Professional Illustrator with 710+ clients, 9200+ hours logged, and a 100% success rate. Analyze the Upwork/Freelancer Job Description below and write a short, highly personalized, human-sounding proposal.

JOB TITLE: ${job.Title}
JOB DESCRIPTION: ${job.Description}
BUDGET: ${job.Budget}

==================================================
1. IDENTIFY THE PRIMARY SERVICE
==================================================
Choose ONLY ONE: Wix, Webflow, Shopify, Framer, Illustration.

==================================================
2. OPENING
==================================================
Start EXACTLY with "Hello, Good Morning !". Add 1-2 natural sentences demonstrating careful analysis of THIS specific JD. Avoid generic introductions or phrases like "I understand" / "I am excited".

==================================================
3. RELEVANT WORKS
==================================================
Add "Relevant Works:". Pick 2-4 relevant projects from the designated list, preserving exact priority order.

- WIX: 
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

- WEBFLOW:
1. https://www.pug.ai/
2. https://www.ptsglobals.com/
3. https://www.tomzovko.de/
4. https://www.runeleven.com/
5. https://www.navable.com/
6. https://www.ironblocks.com/
7. https://www.trustana.com/
8. https://www.hazelai.com/
9. https://www.eberledigital.de/
10. https://www.mcgconsulting.com.au/
11. https://saaia.com/

- SHOPIFY:
1. https://www.collectwithpower.com/
2. https://www.sweetleesteas.com/
3. https://www.polarperformance.com.au/
4. https://slimbynature.com.au/
5. https://verifiedinfield.co/

- FRAMER:
1. https://aurelionhealth.io/
2. https://crayo.ai/
3. https://startupanatomy.co/
4. https://www.lampdigital.co/
5. https://lucaferrara.com/
6. https://www.calibore.com/
7. https://www.nova.codes/
8. https://www.entrepedia.co/
9. https://www.littlexplorersmontessori.com/

- ILLUSTRATION: 
https://online.fliphtml5.com/ujbyb/illustration-portfolio-2026_Upwork-gcpm/

- FULL PORTFOLIO (Place LAST for Wix/Webflow/Shopify/Framer):
https://online.fliphtml5.com/hbbqc/unva/

==================================================
4. MY APPROACH & EXPERIENCE
==================================================
Add "My Approach:" followed by 3-4 concise bullet points directly addressing the JD requirements.
Add the appropriate experience statement based on the chosen service category.

==================================================
5. OWNERSHIP, QUESTIONS & CLOSING
==================================================
For web projects, include: "All accounts, subscriptions, domains and integrations remain under your business ownership."
Add "A few questions:" with EXACTLY 2 short questions specific to the JD.
End with:
"Looking forward to discussing the project with you.

Best,
Bodhi

[PLATFORM] Expert | Top-rated Developer"

==================================================
6. FORMAT & OUTPUT
==================================================
- Max 1400 characters for the proposal. No emojis.
- Determine "relevant" (true/false).
- Return ONLY valid JSON matching this structure:
{
  "platform": "Wix",
  "relevant": true,
  "proposal": "Hello, Good Morning ! ..."
}
`;

        const result = await model.generateContent(prompt);
        const text = result.response.text();
        console.log("GEMINI RESPONSE:", text);

        const clean = text.replace(/```json/g, "").replace(/```/g, "").trim();
        return Response.json(JSON.parse(clean));
    } catch (error: any) {
        console.error("GEMINI ERROR:", error);
        return Response.json({ error: error.message }, { status: 500 });
    }
}