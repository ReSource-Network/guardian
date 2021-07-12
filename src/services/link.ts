import axios, { AxiosRequestConfig } from "axios";
import { log } from "./logger";
import * as Sentry from "@sentry/node";

export async function generateShortLink(path: string) {
  const endpoint = "https://rsrc.co/api/create";

  const config: AxiosRequestConfig = {
    method: "POST",
    url: endpoint,
    headers: {
      "Content-Type": "application/json",
    },
    data: {
      link: path,
    },
  };

  try {
    const {
      data: { link },
    } = await axios(config);

    if (link) return link;
    return path;
  } catch (e) {
    Sentry.captureException(e);
    log.debug("Error generating shortlink: " + e.message);
    log.error(e);
    return null;
  }
}
