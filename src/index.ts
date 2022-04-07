import config from "./config";
import { main as controller } from "./controllers/main.controller";
import { createServer, startServer } from "./server";
import { PrismaClient } from ".prisma/client";
import { log } from "./services";
import { isProd, isLocal } from "./config";


const prisma = new PrismaClient();

export const start = () =>
  startServer({
    app: createServer(
      {
        prisma,
      },
      controller,
    ),
    port: isProd ? 80 : config.PORT,
  }).catch((e) => {
    log.info("Internal Server Error: ", e.message);
    log.error(e.stack);
  });

start();
