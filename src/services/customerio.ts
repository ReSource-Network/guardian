import { APIClient, SendEmailRequest } from "customerio-node/api";
import * as Sentry from "@sentry/node";

import { log } from "./logger";
import config, { isProd } from "../config";
import { generateShortLink } from "./link";
import { retryAsyncUntilTruthy } from "ts-retry";

const customerio = new APIClient(config.CUSTOMERIO_APP_API_KEY);

export async function sendCustomerioResetEmail(payload: {
  recipient: string;
  oneTimePass: string;
  recipientId: string;
}): Promise<boolean> {
  try {
    const { recipient, oneTimePass, recipientId } = payload;

    const urlParamsToMap = {
      otp: oneTimePass,
      email: recipient,
      origin: "guardian",
    };
    const params = Object.entries(urlParamsToMap)
      .map((kv): string => kv.map(<any>encodeURIComponent).join("="))
      .join("&");

    const urlPath = config.CLIENT_URL + params;

    let link = await generateShortLink(urlPath);

    if (!link) {
      try {
        link = await retryAsyncUntilTruthy(
          async () => {
            return await generateShortLink(urlPath);
          },
          { delay: 100, maxTry: 3 },
        );
      } catch (e) {
        log.debug("Error generating shortlink: ", e.message);
        log.error(e);
        throw new Error(e);
      }
    }

    const request = new SendEmailRequest({
      to: recipient,
      transactional_message_id: isProd() ? "11" : "13",
      message_data: { otp: link },
      identifiers: {
        id: recipientId,
      },
    });

    await customerio.sendEmail(request);

    return true;
  } catch (e) {
    Sentry.captureException(e);
    log.info("Error sending CIO transactional email: ", e.message);
    log.error(e);
    return false;
  }
}
