import {
  type DeriveType,
  deserialize,
  type Layout,
  serialize,
} from "binary-layout";
import { fromHex, toHex } from "viem";
import { RequestPrefix } from "../types";
import { hexConversion } from "./conversions";

export const vaaV1RequestLayout = [
  { name: "chain", binary: "uint", size: 2 },
  { name: "address", binary: "bytes", size: 32, custom: hexConversion },
  { name: "sequence", binary: "uint", size: 8 },
] as const satisfies Layout;

export type VAAv1Request = DeriveType<typeof vaaV1RequestLayout>;

export const nttV1RequestLayout = [
  { name: "srcChain", binary: "uint", size: 2 },
  {
    name: "srcManager",
    binary: "bytes",
    size: 32,
    custom: hexConversion,
  },
  {
    name: "messageId",
    binary: "bytes",
    size: 32,
    custom: hexConversion,
  },
] as const satisfies Layout;

export type NTTv1Request = DeriveType<typeof nttV1RequestLayout>;

export const cctpV1RequestLayout = [
  { name: "sourceDomain", binary: "uint", size: 4 },
  { name: "nonce", binary: "uint", size: 8 },
] as const satisfies Layout;

export type CCTPv1Request = DeriveType<typeof cctpV1RequestLayout>;

export const cctpV2RequestLayout = [
  {
    name: "cctpV2Request",
    binary: "switch",
    idSize: 1,
    idTag: "cctpV2RequestPrefix",
    layouts: [[[0x01, "auto"], []]],
  },
] as const satisfies Layout;

export type CCTPv2Request = DeriveType<typeof cctpV2RequestLayout>;

export const requestLayout = [
  {
    name: "request",
    binary: "switch",
    idSize: 4,
    idTag: "prefix",
    layouts: [
      [[0x45525631, RequestPrefix.ERV1], vaaV1RequestLayout],
      [[0x45524e31, RequestPrefix.ERN1], nttV1RequestLayout],
      [[0x45524331, RequestPrefix.ERC1], cctpV1RequestLayout],
      [[0x45524332, RequestPrefix.ERC2], cctpV2RequestLayout],
    ],
  },
] as const satisfies Layout;

export type RequestLayout = DeriveType<typeof requestLayout>;

export function deserializeRequestForExecution(
  requestBytes: `0x${string}`,
): RequestLayout {
  return deserialize(requestLayout, fromHex(requestBytes, "bytes"));
}

export function serializeRequestForExecution(
  instruction: RequestLayout,
): `0x${string}` {
  return toHex(serialize(requestLayout, instruction));
}
