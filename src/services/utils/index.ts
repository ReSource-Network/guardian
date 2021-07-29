import { BigNumber, ContractFunction, ethers } from "ethers";
import { getCeloProvider, getGuardianWallet } from "../wallet";
import { MultiSigWallet__factory } from "../../types";
import { MultiSigWallet } from "../../types/MultiSigWallet";
import config from "../../config";

export const tryWithGas = async (
  func: ContractFunction,
  args: Array<any>,
  gas: BigNumber,
) => {
  let tries = 0;
  let confirmed = false;
  while (!confirmed) {
    tries += 1;
    gas = gas.shl(1);
    let options = { gasLimit: gas };
    try {
      const result = await func(...args, options);
      await result.wait();
      confirmed = true;
      return result;
    } catch (e) {
      if (
        tries >= 5 ||
        (e.code !== "CALL_EXCEPTION" && e.code !== "UNPREDICTABLE_GAS_LIMIT")
      )
        throw e;
    }
  }
};

export const getClientAddress = async (
  multiSigAddress: string,
): Promise<string> => {
  const guardian = await getGuardianWallet();
  const multiSigContract = new ethers.Contract(
    multiSigAddress,
    MultiSigWallet__factory.createInterface(),
    guardian,
  ) as MultiSigWallet;

  const owners = await multiSigContract.getOwners();

  const offset = [config.COSIGN_WALLET_ADDRESS, guardian.address];

  const client = owners.filter((owner) => !offset.includes(owner))[0];
  return client || "";
};
