import { APIClient, SendEmailRequest } from "customerio-node/api";
import * as Sentry from "@sentry/node";

import { log } from "./logger";
import config, { isProd } from "../config";
import { generateShortLink } from "./link";

const customerio = new APIClient(config.CUSTOMERIO_APP_API_KEY);

export async function sendTxEmail(payload: {
  to: string;
  otp: string;
  id: string;
}): Promise<boolean> {
  try {
    const { to, otp, id } = payload;

    const urlParamsToMap = { otp: otp, email: to, origin: "guardian" };
    const params = Object.entries(urlParamsToMap)
      .map((kv): string => kv.map(<any>encodeURIComponent).join("="))
      .join("&");

    const urlPath = config.CLIENT_URL + params;

    const link = await generateShortLink(urlPath);

    if (!link) throw new Error();

    const request = new SendEmailRequest({
      to: payload.to,
      transactional_message_id: isProd() ? "11" : "13",
      message_data: { otp: link },
      identifiers: {
        id: id,
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
