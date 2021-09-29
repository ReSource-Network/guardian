import { APIClient, SendEmailRequest } from "customerio-node/api";
import * as Sentry from "@sentry/node";

import { log } from "./logger";
import config, { isProd } from "../config";
import { generateShortLink } from "./link";

const customerio = new APIClient(config.CUSTOMERIO_APP_API_KEY);

export async function sendCustomerioResetEmail(payload: {
  recipient: string;
  oneTimePass: string;
  recipientId: string;
  redirectUrl: string;
}): Promise<{ sent: boolean }> {
  try {
    const { recipient, oneTimePass, recipientId, redirectUrl } = payload;

    const urlParamsToMap = {
      otp: oneTimePass,
      email: recipient,
      origin: "guardian",
    };
    const params = Object.entries(urlParamsToMap)
      .map((kv): string => kv.map(<any>encodeURIComponent).join("="))
      .join("&");

    const path = redirectUrl.endsWith("/") ? "recover?" : "/recover?";
    const urlPath = redirectUrl + path + params;

    let link = await generateShortLink(urlPath);

    const request = new SendEmailRequest({
      to: recipient,
      transactional_message_id: isProd() ? "11" : "13",
      message_data: { otp: link },
      identifiers: {
        id: recipientId,
      },
    });

    await customerio.sendEmail(request);

    console.log("customerio.ts -- reached:");
    return { sent: true };
  } catch (e: any) {
    Sentry.captureException(e);
    log.info("Error sending CIO transactional email: ", e.message);
    log.error(e);
    return { sent: false };
  }
}
