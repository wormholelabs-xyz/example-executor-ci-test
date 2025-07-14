import {
  relayInstructionsLayout,
  type RelayInstructions,
} from "@wormhole-foundation/sdk-definitions";
import { deserialize } from "binary-layout";
import { fromHex, getAddress, padHex, trim, type Hex } from "viem";

export function deserializeRelayInstructions(
  relayInstructionsBytes: `0x${string}`,
): RelayInstructions {
  return deserialize(
    relayInstructionsLayout,
    fromHex(relayInstructionsBytes, "bytes"),
  );
}
export function trimToAddress(hex: Hex) {
  return getAddress(
    padHex(trim(hex, { dir: "left" }), { dir: "left", size: 20 }),
  );
}
