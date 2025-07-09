import {
  createPublicClient,
  createTestClient,
  encodeAbiParameters,
  getContract,
  http,
  keccak256,
  padHex,
  parseAbiParameters,
  toHex,
  type Hex,
} from "viem";
import { anvil } from "viem/chains";
import { CORE_ABI } from "./abis/core";
import { EVM_PUBLIC_KEY } from "./consts";

export async function overrideGuardianSet(
  anvilRpcUrl: string,
  coreContractAddress: Hex
) {
  const transport = http(anvilRpcUrl);
  const publicClient = createPublicClient({
    chain: anvil,
    transport,
  });
  const coreContract = getContract({
    address: coreContractAddress,
    abi: CORE_ABI,
    client: publicClient,
  });
  const guardianSetIndex = await coreContract.read.getCurrentGuardianSetIndex();
  const anvilClient = createTestClient({
    chain: anvil,
    mode: "anvil",
    transport,
  });
  const GUARDIAN_SETS_SLOT = padHex("0x02", { dir: "left", size: 32 });
  const addressesStorageSlot = keccak256(
    encodeAbiParameters(parseAbiParameters("uint32, bytes32"), [
      guardianSetIndex,
      GUARDIAN_SETS_SLOT,
    ])
  );
  const firstIndexStorageSlot = BigInt(keccak256(addressesStorageSlot));
  await anvilClient.setStorageAt({
    address: coreContractAddress,
    index: addressesStorageSlot,
    value: padHex("0x01", { dir: "left", size: 32 }),
  });
  await anvilClient.setStorageAt({
    address: coreContractAddress,
    index: toHex(firstIndexStorageSlot),
    // devnet guardian https://github.com/wormhole-foundation/wormhole/blob/b9d34bef10ec74c345fa4b406559cf44e3d70095/scripts/devnet-consts.json#L323
    value: padHex(EVM_PUBLIC_KEY, {
      dir: "left",
      size: 32,
    }),
  });
  const guardianSet = await coreContract.read.getGuardianSet([
    guardianSetIndex,
  ]);
  console.log(
    `Overrode guardian set ${guardianSetIndex} of ${anvilRpcUrl} contract ${coreContractAddress} to ${guardianSet.keys.join(
      ", "
    )}`
  );
}
