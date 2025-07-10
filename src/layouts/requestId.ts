import {
  type DeriveType,
  deserialize,
  type Layout,
  serialize,
} from "binary-layout";
import { fromHex, toHex } from "viem";
import { hexConversion } from "./conversions";

const requestIdChainLayout = [
  { name: "chain", binary: "uint", size: 2 },
] as const satisfies Layout;

const evmRequestIdLayout = [
  ...requestIdChainLayout,
  { name: "hash", binary: "bytes", size: 32, custom: hexConversion },
  { name: "logIndex", binary: "uint", size: 32 },
] as const satisfies Layout;

export const requestIdLayout = {
  binary: "switch",
  idSize: 1,
  idTag: "type",
  layouts: [[[0, "Evm"], evmRequestIdLayout]],
} as const satisfies Layout;
export type RequestId = DeriveType<typeof requestIdLayout>;

export function deserializeRequestId(requestIdBytes: `0x${string}`): RequestId {
  return deserialize(requestIdLayout, fromHex(requestIdBytes, "bytes"));
}

export function serializeRequestId(id: RequestId) {
  return toHex(serialize(requestIdLayout, id));
}
