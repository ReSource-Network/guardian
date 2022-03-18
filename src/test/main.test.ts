import { PrismaClient } from "@prisma/client";
import { ethers } from "ethers";
import { customAlphabet } from "nanoid";
import request from "supertest";
import { IKeyMultiSig } from "../../types/IKeyMultiSig";

import { main as controller } from "../controllers/main.controller";
import { createServer } from "../server";
import { getGuardianWallet } from "../services/wallet";
import { IKeyMultiSig__factory } from "../../types/factories/IKeyMultiSig__factory";

const prisma = new PrismaClient();
const nanoid = customAlphabet("1234567890abcdef", 10);

describe("Guardian Test Suite", function () {
  let multiSig: IKeyMultiSig, guardian, addresses, data, app;
  const newClient = "0x7a7cE72c9c0410113e7C2608c584Ea05e683F4f5";
  const oldClient = "0xAbeB77559A15F520A9e79982ACd6Cf8951b94949";
  const email = nanoid() + "@resourcenetwork.co";
  const jwt =
    "Bearer eyJhbGciOiJFZERTQSJ9.eyJpZCI6ImNrcXZ1bG9rNDAwMDJhb3NqMHhycms2ajUiLCJpYXQiOjE2MjU4MDU0NzUsImV4cCI6MTY1NjkwOTQ3NX0.byxffg0pTkw7t6Hl2PcjawITACCXMbSLJqs3oNotfmPJG7XYduvbLVsJQ-pplPGyc9dmiH3fPxzfReRVy-DuDQ";

  beforeAll(async function () {
    //   init express app
    app = createServer(
      {
        prisma,
      },
      controller,
    );

    //   deploy multisig
    guardian = await getGuardianWallet();
    addresses = [guardian.address, oldClient];

    const deployResult = await (
      await new IKeyMultiSig__factory(guardian).deploy()
    ).deployTransaction.wait();

    const multiSigAddress = deployResult.contractAddress;
    multiSig = IKeyMultiSig__factory.connect(multiSigAddress, guardian);

    await (
      await multiSig.initialize(
        [oldClient],
        [guardian.address],
        ethers.Wallet.createRandom().address,
        2,
      )
    ).wait();

    data = {
      userId: nanoid(),
      multiSigAddress: multiSig.address,
      clientAddress: oldClient,
      email: email,
    };
  });

  it("should respond with status of 'OK'", async () => {
    return await request(app)
      .get("/api/")
      .then((response) => {
        const { text } = response;
        expect(text).toStrictEqual("OK");
      })
      .catch((err) => console.log(err));
  });

  it("should throw when registering new user without proper jwt", async () => {
    return await request(app)
      .post("/api/register")
      .set("Content-Type", "application/json")
      .send(data)
      .then((response) => {
        const {
          body: { user },
        } = response;
        expect(user).toBeNull();
      })
      .catch((err) => console.log(err));
  });

  it("should respond with a newly created user", async () => {
    return await request(app)
      .post("/api/register")
      .set("Content-Type", "application/json")
      .set({ Authorization: jwt })
      .send(data)
      .then((response) => {
        const {
          body: { user },
        } = response;
        expect(user).toHaveProperty("userId");
        expect(user).toHaveProperty("email");
        expect(user).toHaveProperty("clientAddress");
        expect(user).toHaveProperty("multiSigAddress");
        expect(user).toHaveProperty("createdAt");
      })
      .catch((err) => console.log(err));
  });

  it("should call replaceMultiSigOwner successfully", async () => {
    const user = await prisma.user.findUnique({ where: { email } });
    expect(user).toBeTruthy();

    const toReplace = {
      validateEmailToken: user?.validateEmailToken,
      newClientAddress: newClient,
      email,
    };

    return await request(app)
      .post("/api/recover")
      .set("Content-Type", "application/json")
      .send(toReplace)
      .then((response) => {
        const {
          body: { user, tx },
        } = response;
        expect(tx).toBeTruthy();
        expect(user).toBeTruthy();
      })
      .catch((err) => console.log(err));
  });
});
