import { getBrowser } from "./upworkBrowser";


export async function getMemberSince(
  ciphertext: string
): Promise<string | null> {


  let context;


  try {

    const browser =
      await getBrowser();


    context =
      await browser.newContext();


    const page =
      await context.newPage();


    await page.goto(
      `https://www.upwork.com/jobs/${ciphertext}`,
      {
        waitUntil: "domcontentloaded",
        timeout: 60000
      }
    );


    await page.waitForTimeout(5000);


    const text =
      await page.locator("body").innerText();


    const match =
      text.match(
        /Member\s+since\s+([A-Za-z]+\s+\d{1,2},\s+\d{4})/i
      );


    return match?.[1] || null;


  } catch(error) {

    console.error(
      "Member Since Error:",
      error
    );


    return null;


  } finally {

    if(context){
      await context.close();
    }

  }

}