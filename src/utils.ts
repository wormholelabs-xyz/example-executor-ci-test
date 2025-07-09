import {
  quoteLayout,
  relayInstructionsLayout,
  type Quote,
  type RelayInstructions,
} from "@wormhole-foundation/sdk-definitions";
import { deserialize, serialize } from "binary-layout";
import { concat, fromBytes, fromHex, keccak256 } from "viem";
import { sign } from "viem/accounts";
import { ScaledMath } from "./lib/ScaledMath";

const SIGNED_QUOTE_DECIMALS = 10;

export async function signQuote(quote: Quote, privateKey: `0x${string}`) {
  const serialized = serialize(quoteLayout, quote);
  const signature = await sign({
    hash: keccak256(serialized),
    privateKey,
    to: "hex",
  });
  return concat([fromBytes(serialized, "hex"), signature]);
}

export function getTotalGasLimitAndMsgValue(
  relayInstructionsHex: `0x${string}`
) {
  const relayInstructions = deserialize(
    relayInstructionsLayout,
    fromHex(relayInstructionsHex, "bytes")
  );

  return totalGasLimitAndMsgValue(relayInstructions);
}

function totalGasLimitAndMsgValue(relayInstructions: RelayInstructions): {
  gasLimit: bigint;
  msgValue: bigint;
} {
  let gasLimit = 0n;
  let msgValue = 0n;

  for (const relayInstruction of relayInstructions.requests) {
    const type = relayInstruction.request.type;
    if (type === "GasInstruction") {
      gasLimit += relayInstruction.request.gasLimit;
      msgValue += relayInstruction.request.msgValue;
    } else if (type === "GasDropOffInstruction") {
      msgValue += relayInstruction.request.dropOff;
    } else {
      const relayInstructionType: never = type;
      throw new Error(`Unsupported type: ${relayInstructionType}`);
    }
  }
  return { gasLimit, msgValue };
}

export function estimateQuote(
  { quote }: Quote,
  gasLimit: bigint,
  msgValue: bigint,
  dstGasPriceDecimals: number,
  srcTokenDecimals: number,
  dstNativeDecimals: number
): bigint {
  const r = 18;
  const srcChainValueForBaseFee = ScaledMath.normalize(
    quote.baseFee,
    SIGNED_QUOTE_DECIMALS,
    srcTokenDecimals
  );

  const nSrcPrice = ScaledMath.normalize(
    quote.srcPrice,
    SIGNED_QUOTE_DECIMALS,
    r
  );
  const nDstPrice = ScaledMath.normalize(
    quote.dstPrice,
    SIGNED_QUOTE_DECIMALS,
    r
  );
  const scaledConversion = ScaledMath.div(nDstPrice, nSrcPrice, r);

  const nGasLimitCost = ScaledMath.normalize(
    gasLimit * quote.dstGasPrice,
    dstGasPriceDecimals,
    r
  );

  const srcChainValueForGasLimit = ScaledMath.normalize(
    ScaledMath.mul(nGasLimitCost, scaledConversion, r),
    r,
    srcTokenDecimals
  );

  const nMsgValue = ScaledMath.normalize(msgValue, dstNativeDecimals, r);
  const srcChainValueForMsgValue = ScaledMath.normalize(
    ScaledMath.mul(nMsgValue, scaledConversion, r),
    r,
    srcTokenDecimals
  );
  return (
    srcChainValueForBaseFee +
    srcChainValueForGasLimit +
    srcChainValueForMsgValue
  );
}
