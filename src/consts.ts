import { padHex, toHex } from "viem";
import { mnemonicToAccount } from "viem/accounts";

const account = mnemonicToAccount(
  "test test test test test test test test test test test junk",
  { addressIndex: 9 },
);

export const PAYEE_PUBLIC_KEY = account.address;

export const EVM_PUBLIC_KEY = account.address;
export const EVM_PRIVATE_KEY = toHex(account.getHdKey().privateKey || "0x");

export const QUOTER_PUBLIC_KEY = account.address;
export const QUOTER_PRIVATE_KEY = toHex(account.getHdKey().privateKey || "0x");

export const EMPTY_ADDRESS = padHex(
  "0x0000000000000000000000000000000000000000000000000000000000000000",
  { size: 32 },
);
