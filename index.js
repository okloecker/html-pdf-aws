import puppeteer from "puppeteer-core";
import chromium from "@sparticuz/chromium";

const getPdfOptions = (query = {}) => {
  const format = query.format || "A4";
  const scale = +query.scale || 1.3;
  const printBackground = query.printBackground === "false" ? false : true;
  const headless = query.headless === "false" ? false : true;
  const id = query.id;
  const keepimgurl = query.keepimgurl;

  return { format, scale, printBackground, headless, id, keepimgurl };
};

const launchBrowser = async () =>
  await puppeteer.launch({
    args: [...chromium.args, "--font-render-hinting=medium"],
    defaultViewport: chromium.defaultViewport,
    executablePath: await chromium.executablePath(
      process.env.AWS_EXECUTION_ENV
        ? "/opt/nodejs/node_modules/@sparticuz/chromium/bin"
        : undefined
    ),
    headless: chromium.headless,
    ignoreHTTPSErrors: true,
  });

let browserLaunchCounter = 0;
let browser;

export const handler = async (event) => {
  console.log("event:", event);

  if (!event?.body?.length) {
    console.log("Missing payload");
    return {
      statusCode: 400,
      body: "Missing HTML payload",
    };
  }
  const payload = event.isBase64Encoded
    ? Buffer.from(event.body, "base64").toString("utf8")
    : event.body;

  const {
    format,
    scale,
    printBackground,
    headless,
    id,
    keepimgurl,
  } = getPdfOptions(event.queryStringParameters ?? {});

  console.log(
    "Got request with size %s and ID '%s' keepimgurl=%s",
    payload?.length,
    id,
    keepimgurl,
    new Date()
  );

  if (!browser || browserLaunchCounter % 10 === 0) {
    if (browser) await browser.close();
    browser = await launchBrowser();
    browserLaunchCounter++;
  }

  const page = await browser.newPage();
  await page.setContent(payload);
  await page.emulateMediaType("screen");

  const buffer = await page.pdf({
    format,
    printBackground,
    headless,
    scale,
  });

  await page.close();

  console.log("Returning base64 encoded PDF of length", buffer.length);

  return buffer.toString("base64");
};
