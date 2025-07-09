import { toHex } from "viem";
import { mnemonicToAccount } from "viem/accounts";

const account = mnemonicToAccount(
  "test test test test test test test test test test test junk",
  { addressIndex: 9 }
);

export const EVM_PUBLIC_KEY = account.address;
export const EVM_PRIVATE_KEY = toHex(account.getHdKey().privateKey || "0x");
