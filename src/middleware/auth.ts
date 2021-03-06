import { Request, Response, NextFunction } from "express";

import { log } from "../services";
import { Decoded, verify } from "./jwt";

export async function authenticate(
  req: Request,
  res: Response,
  next: NextFunction,
) {
  const header = req.headers.authorization as string;

  if (header) {
    const token = header.replace("Bearer ", "");
    const decoded = await verify({ token });

    if (!decoded)
      return res
        .status(403)
        .send({ ERROR: true, MESSAGE: "NOT AUTHENTICATED" });

    if (decoded.admin) {
      (req as any).admin = true;
      return next();
    }

    (req as any).user = (decoded as Decoded).id;
    next();
  } else {
    log.debug(
      "Unauthenticated request. PATH: " + req.path + " | METHOD: " + req.method,
    );
    return res.status(403).send({ ERROR: true, MESSAGE: "NOT AUTHENTICATED" });
  }
}

export function unless(middleware: any, ...paths: string[]) {
  return function (req: Request, res: Response, next: NextFunction) {
    const pathCheck = paths.some((path) => path === req.path);
    pathCheck ? next() : middleware(req, res, next);
  };
}

export const auth = unless(authenticate, "/api/", "/api/recover", "/api/reset");
