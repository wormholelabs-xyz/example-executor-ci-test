import { type CustomConversion } from "binary-layout";
import { fromBytes, fromHex } from "viem";

export const hexConversion = {
  to: (encoded: Uint8Array) => fromBytes(encoded, "hex"),
  from: (decoded: `0x${string}`) => fromHex(decoded, "bytes"),
} as const satisfies CustomConversion<Uint8Array, `0x${string}`>;

export const dateConversion = {
  to: (encoded: bigint) => new Date(Number(encoded * 1000n)),
  from: (decoded: Date) => BigInt(decoded.getTime()) / 1000n,
} as const satisfies CustomConversion<bigint, Date>;
