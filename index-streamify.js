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

const getFontProperty = async (page) => {
  const selector = ".page";
  try {
    const font = await page.evaluate((selector) => {
      const title = document.querySelector(selector);
      return getComputedStyle(title).font;
    }, selector);
    return font;
  } catch (err) {
    console.err('Expecteded selector ".page" to get font propert');
  }
};

export const handler = awslambda.streamifyResponse(
  async (event, responseStream) => {
    //  console.log('event:', event)
    //  console.log('event.body:', event.body)
    if (!event?.body?.length) {
      console.log("Missing payload");
      return {
        statusCode: 400,
        body: "Missing HTML payload",
      };
    }
    const payload = event.body;

    const {
      format,
      scale,
      printBackground,
      headless,
      id,
      keepimgurl,
    } = getPdfOptions(event.queryStringParameters);

    console.log(
      "Got request with size %s and ID '%s' keepimgurl=%s",
      payload.length,
      id,
      keepimgurl,
      new Date()
    );

    const browser = await puppeteer.launch({
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

    const page = await browser.newPage();
    await page.setContent(payload);
    await page.emulateMediaType("screen");
    await page.evaluateHandle("document.fonts.ready");
    console.log("fontProperty: ", await getFontProperty(page));

    const buffer = await page.pdf({
      format: "A4",
      printBackground,
      headless,
      scale,
    });

    await page.close();
    await browser.close();

    console.log("Returning base64 encoded PDF of length", buffer.length);

    responseStream.setContentType("application/pdf");
    responseStream.write("anything");
    responseStream.end();
  }
);
