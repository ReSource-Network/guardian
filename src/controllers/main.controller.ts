import { PrismaClient, User } from "@prisma/client";
import PromisePool from "@supercharge/promise-pool";
import { Router } from "express";
import { retryAsyncUntilTruthy } from "ts-retry";
import * as yup from "yup";

import {
  migrateBatchSchema,
  recoverSchema,
  registerSchema,
  removeAndFetchSchema,
  resetSchema,
  updateSchema,
  validate as validateSchema,
} from "../middleware/schema";
import {
  generate,
  getGuardianAddr,
  log,
  replaceMultiSigOwner,
  sendCustomerioResetEmail,
} from "../services";
import { Controller } from "./types";

export const main: Controller = ({ prisma }) => {
  const r = Router();

  r.get("/", (_, res) => {
    return res.status(200).send("OK");
  });

  r.get("/user", validateSchema(removeAndFetchSchema), async (req, res) => {
    if (!(req as any).user)
      return res
        .status(403)
        .send({ ERROR: true, MESSAGE: "NOT AUTHENTICATED" });

    const { userId } = req.body;

    if (!userId) {
      return res.status(401).send({
        ERROR: true,
        MESSAGE: "NOT FOUND: PARAMS DATA AND USER ID REQUIRED",
      });
    }

    if ((req as any).user !== userId) {
      return res.status(401).send({
        ERROR: true,
        MESSAGE: "BAD REQUEST: TOKEN MUST MATCH USER ID",
      });
    }

    try {
      const user =
        (await prisma.user.findUnique({ where: { userId } })) || null;

      if (!user) {
        return res.status(401).send({
          ERROR: true,
          MESSAGE: "NOT FOUND: COULD NOT FIND USER WITH USER ID: " + userId,
        });
      }

      return res.status(200).json({ user });
    } catch (e: any) {
      log.debug("Error updating user:");
      log.error(e);

      return res.status(500).send({
        ERROR: true,
        MESSAGE: "INTERNAL SERVER ERROR: " + e,
      });
    }
  });

  r.post("/register", validateSchema(registerSchema), async (req, res) => {
    if (!(req as any).user)
      return res
        .status(403)
        .send({ ERROR: true, MESSAGE: "NOT AUTHENTICATED" });

    const { userId, email, multiSigAddress, clientAddress } = req.body;

    if (!(userId && email && multiSigAddress && clientAddress))
      return res.status(401).send({
        ERROR: true,
        MESSAGE:
          "BAD REQUEST: PARAMS USERID && EMAIL && MULTISIGADDRESS && CLIENTADDRESS REQUIRED",
      });

    if ((req as any).user !== userId) {
      return res.status(401).send({
        ERROR: true,
        MESSAGE: "BAD REQUEST: JWT TOKEN MUST MATCH USER ID",
      });
    }

    try {
      const user = await prisma.user.upsert({
        where: {
          userId,
        },
        update: {
          multiSigAddress,
          clientAddress,
        },
        create: {
          userId,
          email,
          multiSigAddress,
          clientAddress,
          validateEmailToken: null,
        },
      });

      if (!user) {
        try {
          await retryAsyncUntilTruthy(
            async () =>
              await prisma.user.upsert({
                where: {
                  userId,
                },
                update: {
                  multiSigAddress,
                  clientAddress,
                },
                create: {
                  userId,
                  email,
                  validateEmailToken: null,
                  multiSigAddress: multiSigAddress,
                  clientAddress: clientAddress,
                },
              }),
            { delay: 100, maxTry: 3 },
          );
        } catch (e: any) {
          return res.status(500).send({
            ERROR: true,
            MESSAGE: "INTERNAL SERVER ERROR: COULD NOT CREATE USER",
          });
        }
      }

      const guardian = await getGuardianAddr();

      return res.status(200).json({
        user,
        guardian,
      });
    } catch (e: any) {
      log.debug("Error registering user:");
      log.error(e);

      return res.status(500).send({
        ERROR: true,
        MESSAGE: "INTERNAL SERVER ERROR: " + e,
      });
    }
  });

  r.post("/reset", validateSchema(resetSchema), async (req, res) => {
    const { email, redirectUrl } = req.body;

    if (!email || !redirectUrl) {
      return res.status(401).send({
        ERROR: true,
        MESSAGE:
          "INTERNAL SERVER ERROR: BOTH PARAMS 'EMAIL' & 'REDIRECTURL' REQUIRED",
      });
    }

    try {
      const user = await prisma.user.findUnique({ where: { email } });

      if (!user) {
        return res.status(401).send({
          ERROR: true,
          MESSAGE: "NOT FOUND: COULD NOT FIND USER WITH EMAIL: " + email,
        });
      }

      if (!user.validateEmailToken) {
        const validateEmailToken = await generate();

        await prisma.user.update({
          where: {
            id: user.id,
          },
          data: {
            validateEmailToken,
          },
        });

        const payload = {
          oneTimePass: validateEmailToken,
          recipient: user.email,
          recipientId: user.userId,
          redirectUrl: redirectUrl,
        };

        const sent = await sendCustomerioResetEmail(payload);

        if (!sent)
          return res.status(500).send({
            ERROR: true,
            MESSAGE:
              "INTERNAL SERVER ERROR: FAILED TO SEND RESET PASSWORD EMAIL",
          });

        return res.status(200).send({ sent: true });
      } else {
        const payload = {
          oneTimePass: user.validateEmailToken,
          recipient: user.email,
          recipientId: user.userId,
          redirectUrl: redirectUrl,
        };

        const sent = await sendCustomerioResetEmail(payload);

        if (!sent)
          return res.status(500).send({
            ERROR: true,
            MESSAGE:
              "INTERNAL SERVER ERROR: FAILED TO SEND RESET PASSWORD EMAIL",
          });

        return res.status(200).send({ sent: true });
      }
    } catch (e: any) {
      log.debug("Error sending TOTP password:");
      log.error(e);

      return res.status(500).send({
        ERROR: true,
        MESSAGE: "INTERNAL SERVER ERROR: " + e,
      });
    }
  });

  r.post("/recover", validateSchema(recoverSchema), async (req, res) => {
    const { email, validateEmailToken, newClientAddress } = req.body;

    try {
      const userToUpdate: User | null = await prisma.user.findUnique({
        where: {
          email,
        },
      });

      if (!userToUpdate) {
        log.info("Error: Could not find user with email: " + email);

        return res.status(401).send({
          ERROR: true,
          MESSAGE: "NOT FOUND: COULD NOT FIND USER WITH EMAIL: " + email,
        });
      }

      const { id, validateEmailToken: validEmailToken } = userToUpdate;

      if (validateEmailToken !== validEmailToken) {
        return res.status(401).send({
          ERROR: true,
          MESSAGE: "INVALID VALIDATE EMAIL TOKEN",
        });
      }

      let transactionId;

      try {
        const tx = await replaceMultiSigOwner({
          id,
          newClientAddress,
          prisma,
        });

        transactionId = tx.transactionId;
      } catch (e: any) {
        if (e.message === "OWNERS CONTAINS NEW ADDRESS") {
          return res.status(200).json({
            ERROR: true,
            MESSAGE: "NOT NEW PASSWORD",
          });
        }

        throw e;
      }

      await prisma.user.update({
        where: {
          id,
        },
        data: {
          validateEmailToken: null,
        },
      });

      if (!transactionId) {
        log.info("Error replacing multisig owner: " + email, {
          id,
          newClientAddress,
        });
        return res.status(500).send({
          ERROR: true,
          MESSAGE: "INTERNAL SERVER ERROR: COULD NOT REPLACE MULTISIG OWNER",
        });
      }

      return res.status(200).json({ user: userToUpdate, tx: transactionId });
    } catch (e: any) {
      log.debug("Error verifying TOTP or replacing multisig owner:");
      log.error(e);

      return res.status(500).send({
        ERROR: true,
        MESSAGE: "INTERNAL SERVER ERROR: " + e,
      });
    }
  });

  r.post("/update", validateSchema(updateSchema), async (req, res) => {
    if (!(req as any).user || !(req as any).admin)
      return res
        .status(403)
        .send({ ERROR: true, MESSAGE: "NOT AUTHENTICATED" });

    const { userId, data } = req.body;

    if (!userId || !data) {
      return res.status(401).send({
        ERROR: true,
        MESSAGE: "BAD REQUEST: PARAMS DATA AND USER ID REQUIRED",
      });
    }

    if ((req as any).user !== userId) {
      return res.status(401).send({
        ERROR: true,
        MESSAGE: "BAD REQUEST: TOKEN MUST MATCH USER ID",
      });
    }

    try {
      const exists =
        (await prisma.user.findUnique({ where: { userId } })) || null;

      if (!exists) {
        return res.status(401).send({
          ERROR: true,
          MESSAGE:
            "INTERNAL SERVER ERROR: COULD NOT FIND USER WITH USER ID: " +
            userId,
        });
      }

      const user = await prisma.user.update({
        where: { id: exists.id },
        data: data,
      });

      if (user) return res.status(200).json({ user });

      return res.status(400).send({ updated: false });
    } catch (e: any) {
      log.debug("Error updating user:");
      log.error(e);

      return res.status(500).send({
        ERROR: true,
        MESSAGE: "INTERNAL SERVER ERROR: " + e,
      });
    }
  });

  r.post("/remove", validateSchema(removeAndFetchSchema), async (req, res) => {
    if (!(req as any).user || !(req as any).admin)
      return res
        .status(403)
        .send({ ERROR: true, MESSAGE: "NOT AUTHENTICATED" });

    const { userId } = req.body;

    if (!userId) {
      return res.status(401).send({
        ERROR: true,
        MESSAGE: "BAD REQUEST: USER ID PARAM REQUIRED",
      });
    }

    try {
      const user =
        (await prisma.user.findUnique({ where: { userId } })) || null;

      if (!user) {
        return res.status(401).send({
          ERROR: true,
          MESSAGE:
            "INTERNAL SERVER ERROR: COULD NOT FIND USER WITH USER ID: " +
            userId,
        });
      }

      const resp = await prisma.user.delete({ where: { id: user.id } });

      if (!resp)
        return res.status(401).send({
          ERROR: true,
          MESSAGE:
            "INTERNAL SERVER ERROR: COULD NOT DELETE USER WITH USER ID: " +
            userId,
        });

      return res.status(200).send({ deleted: true });
    } catch (e: any) {
      log.debug("Error removing user:");
      log.error(e);

      return res.status(500).send({
        ERROR: true,
        MESSAGE: "INTERNAL SERVER ERROR: " + e,
      });
    }
  });

  r.post(
    "/migrate/batch",
    validateSchema(migrateBatchSchema),
    async (req, res) => {
      if (!(req as any).admin)
        return res.status(403).send({
          ERROR: true,
          MESSAGE: "NOT AUTHENTICATED: ADMIN PRIVILEGES REQUIRED",
        });

      const { data } = req.body;

      if (!data || !Array.isArray(data))
        return res.status(401).send({
          ERROR: true,
          MESSAGE: "BAD REQUEST: PARAM 'DATA' MUST BE OF TYPE ARRAY",
        });

      try {
        const { results } = await PromisePool.for(data)
          .withConcurrency(20)
          .process((i) => batchUpdateUsersWallet(i as BatchUpdateObj, prisma));

        if (results.length !== data.length) {
          return res.status(401).send({
            ERROR: true,
            MESSAGE: "INTERNAL SERVER ERROR: ERROR BATCH UPDATING USERS",
          });
        }

        return res.status(200).send({ results });
      } catch (e: any) {
        log.debug("Error batch updating users: ");
        log.error(e);

        return res.status(500).send({
          ERROR: true,
          MESSAGE: "INTERNAL SERVER ERROR: " + e,
        });
      }
    },
  );

  return {
    path: "/api",
    router: r,
  };
};

async function batchUpdateUsersWallet(
  data: BatchUpdateObj,
  prisma: PrismaClient,
): Promise<User[] | null> {
  let results;

  const { multiSigAddress, clientAddress, userId } = data;

  const schema = yup
    .object()
    .shape({
      userId: yup.string().required(),
      clientAddress: yup.string().required(),
      multiSigAddress: yup.string().required(),
    })
    .required();

  try {
    await schema.validate(data);

    results = await prisma.user.update({
      where: { userId },
      data: {
        multiSigAddress,
        clientAddress: clientAddress ?? undefined,
      },
    });
  } catch (e: any) {
    results = null;
    log.debug("Error batch updating user with userId: " + userId);
    log.error(e.message);
  }

  return results;
}

type BatchUpdateObj = {
  userId: string;
  multiSigAddress: string;
  clientAddress?: string;
};
