/* Autogenerated file. Do not edit manually. */
/* tslint:disable */
/* eslint-disable */

import { Contract, Signer, utils } from "ethers";
import { Provider } from "@ethersproject/providers";
import type {
  IiKeyWalletDeployer,
  IiKeyWalletDeployerInterface,
} from "../IiKeyWalletDeployer";

const _abi = [
  {
    inputs: [
      {
        internalType: "address[]",
        name: "_clients",
        type: "address[]",
      },
      {
        internalType: "address[]",
        name: "_guardians",
        type: "address[]",
      },
      {
        internalType: "address",
        name: "_coSigner",
        type: "address",
      },
      {
        internalType: "uint256",
        name: "_required",
        type: "uint256",
      },
    ],
    name: "deployWallet",
    outputs: [
      {
        internalType: "address",
        name: "",
        type: "address",
      },
    ],
    stateMutability: "nonpayable",
    type: "function",
  },
];

export class IiKeyWalletDeployer__factory {
  static readonly abi = _abi;
  static createInterface(): IiKeyWalletDeployerInterface {
    return new utils.Interface(_abi) as IiKeyWalletDeployerInterface;
  }
  static connect(
    address: string,
    signerOrProvider: Signer | Provider
  ): IiKeyWalletDeployer {
    return new Contract(address, _abi, signerOrProvider) as IiKeyWalletDeployer;
  }
}
