import { PrismaClient } from "@prisma/client";
import { ethers } from "ethers";

import config from "../config";
import { log } from "./logger";
import { tryWithGas } from "./utils";
import { retry } from "ts-retry";
import { IKeyMultiSig__factory } from "../types/factories/IKeyMultiSig__factory";
import { IKeyMultiSig } from "../types/IKeyMultiSig";

export const getProvider = async () => {
  let provider = new ethers.providers.JsonRpcProvider(
    config.BLOCKCHAIN_NETWORK,
  );
  await provider.ready;
  return provider;
};

export const getGuardianWallet = async () => {
  const provider = await getProvider();
  const pk = config.GUARDIAN_WALLET_PK;
  return new ethers.Wallet(pk, provider);
};

export async function replaceMultiSigOwner({
  id,
  newClientAddress,
  prisma,
}: {
  id: string;
  newClientAddress: string;
  prisma: PrismaClient;
}) {
  let txId: string | null;
  try {
    // instantiate Guardian Wallet
    const guardianWallet = await getGuardianWallet();

    // fetchuser with id
    const user = await prisma.user.findUnique({ where: { id } });

    // MultiSigWallet
    if (!user) throw new Error("User does not exist");

    const { multiSigAddress, userId, clientAddress } = user;

    if (!multiSigAddress)
      throw new Error("MultiSigAddress fields do not exist on user");

    if (!clientAddress)
      throw new Error("clientAddress does not exist on multiSig");

    const multiSigWallet = new ethers.Contract(
      multiSigAddress,
      IKeyMultiSig__factory.createInterface(),
      guardianWallet,
    ) as IKeyMultiSig;

    const owners = await multiSigWallet.getOwners();

    if (owners.includes(newClientAddress)) {
      throw new Error("OWNERS CONTAINS NEW ADDRESS");
    }
    if (!owners.includes(guardianWallet.address))
      throw new Error("Guardian wallet is not an owner");

    // connect GuardianWallet and replace old clientAddress with new generated client address
    const data = (
      await multiSigWallet
        .connect(guardianWallet)
        .populateTransaction.replaceClient(clientAddress, newClientAddress)
    ).data;

    if (!data) throw new Error("Cannot populate replaceOwner tx with owner A");

    // get multiSig owner tx nonce
    const guardianNonce = await multiSigWallet.nonces(guardianWallet.address);

    // generate prepare submit transaction hash for signature by ownerA
    const guardianHashToSign = ethers.utils.arrayify(
      await multiSigWallet
        .connect(guardianWallet)
        .prepareSubmitTransaction(
          multiSigWallet.address,
          0,
          data,
          guardianNonce,
        ),
    );

    // generate ownerA signature
    const guardianSig = ethers.utils.joinSignature(
      await guardianWallet.signMessage(guardianHashToSign),
    );

    const gas = await multiSigWallet.estimateGas.submitTransactionByRelay(
      multiSigWallet.address,
      0,
      data,
      guardianSig,
      guardianWallet.address,
    );
    console.log(gas);

    const func = multiSigWallet.submitTransactionByRelay;

    const args = [
      multiSigWallet.address,
      0,
      data,
      guardianSig,
      guardianWallet.address,
    ];

    const submitTxResponse = await retry(
      async () => {
        return await (await tryWithGas(func, args, gas)).wait();
      },
      { delay: 100, maxTry: 5 },
    );

    const transactionId = ethers.utils.formatUnits(
      submitTxResponse.events?.find(
        (e: any) => e.eventSignature == "Submission(uint256)",
      )?.args?.transactionId,
      "wei",
    );

    if (!transactionId)
      throw new Error("TransactionID invalid, try again bitch");

    // update new clientAddress on user
    await prisma.user.update({
      where: { userId },
      data: { clientAddress: newClientAddress },
    });

    txId = transactionId;
  } catch (e) {
    log.error("Error replacing owner: " + e, {
      id,
      newClientAddress,
    });
    txId = null;
    throw e;
  }

  return { transactionId: txId };
}

export async function getGuardianAddr() {
  return (await getGuardianWallet()).address;
}
