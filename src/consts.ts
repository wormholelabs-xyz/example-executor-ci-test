import { padHex, toHex } from "viem";
import { mnemonicToAccount } from "viem/accounts";

export const ANVIL_MNEMONIC =
  "test test test test test test test test test test test junk";

const account9 = mnemonicToAccount(ANVIL_MNEMONIC, { addressIndex: 9 });

export const PAYEE_PUBLIC_KEY = "0xf7122c001b3e07d7fafd8be3670545135859954a";

export const EVM_PUBLIC_KEY = account9.address;
export const EVM_PRIVATE_KEY = toHex(account9.getHdKey().privateKey || "0x");

export const QUOTER_PUBLIC_KEY = account9.address;
export const QUOTER_PRIVATE_KEY = toHex(account9.getHdKey().privateKey || "0x");

export const EMPTY_ADDRESS = padHex(
  "0x0000000000000000000000000000000000000000000000000000000000000000",
  { size: 32 },
);
