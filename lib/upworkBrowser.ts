import { chromium, Browser } from "playwright";


const globalForBrowser = globalThis as typeof globalThis & {
  upworkBrowser?: Browser;
};


export async function getBrowser() {

  if (globalForBrowser.upworkBrowser) {
    return globalForBrowser.upworkBrowser;
  }


  const browser =
    await chromium.launch({
      headless: false,
      channel: "chrome",
      args: [
        "--disable-blink-features=AutomationControlled"
      ]
    });


  globalForBrowser.upworkBrowser =
    browser;


  return browser;

}