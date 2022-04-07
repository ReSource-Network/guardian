import * as Sentry from "@sentry/node";
import Tracing from "@sentry/tracing";
import { RewriteFrames } from "@sentry/integrations";
import express from "express";
import morgan from "morgan";
import bodyParser from "body-parser";
import cors from "cors";
import config from "./config";
import { isProd, isLocal } from "./config";
import { Controller, ControllerDeps } from "./controllers/types";
import { auth } from "./middleware/auth";
import { limitMw, slowMw } from "./middleware";

export const createServer = (
  dependencies: ControllerDeps,
  ...controllers: Controller[]
): express.Express => {
  const app = express();

  Sentry.init({
    dsn: config.SENTRY_DSN,
    tracesSampleRate: 1.0,
    enabled: !isLocal,
    environment: config.APP_ENV,
    integrations: [
      // new Sentry.Integrations.Http({ tracing: true }),
      new RewriteFrames({ root: process.cwd() }) as any,
      new Tracing.Integrations.Express({
        app,
      }),
    ],
    release: config.COMMIT_SHA,
  });

  Sentry.captureException(new Error('evan test error1'))

  // const transaction = Sentry.startTransaction({
  //   op: "init",
  //   name: "Server instantiation",
  // });

  app.use(express.json());
  app.use(cors());

  // cors headers
  app.use(function (req, res, next) {
    res.set("Access-Control-Allow-Origin", "*");
    res.set(
      "Access-Control-Allow-Methods",
      "GET, POST, OPTIONS, PUT, PATCH, DELETE",
    );
    res.set("Access-Control-Allow-Headers", "X-Requested-With,content-type");

    next();
  });

  // rate limiting middleware
  app.use(slowMw);
  app.use(limitMw);

  // auth middleware
  app.use(auth);

  // body parsing for jest tests
  if (!isProd) {
    app.use(bodyParser.json());
    app.use(bodyParser.urlencoded({ extended: false }));
  }

  // loggin middleware
  app.use(morgan("dev"));

  // add controllers
  for (const setupController of controllers) {
    const controller = setupController(dependencies);
    app.use(controller.path, controller.router);
  }

  return app;
};

export const startServer = async ({
  app,
  port,
}: {
  app: express.Express;
  port: number | string;
}) => {
  return app.listen(port, () => {
    console.log("Server listening on port " + port);
  });
};
