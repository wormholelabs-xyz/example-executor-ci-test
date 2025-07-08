// partial ABI from the Wormhole Core contract
// https://etherscan.io/address/0x3c3d457f1522d3540ab3325aa5f1864e34cba9d0#code

export const CORE_ABI = [
  {
    anonymous: false,
    inputs: [
      {
        indexed: true,
        internalType: "address",
        name: "sender",
        type: "address",
      },
      {
        indexed: false,
        internalType: "uint64",
        name: "sequence",
        type: "uint64",
      },
      { indexed: false, internalType: "uint32", name: "nonce", type: "uint32" },
      { indexed: false, internalType: "bytes", name: "payload", type: "bytes" },
      {
        indexed: false,
        internalType: "uint8",
        name: "consistencyLevel",
        type: "uint8",
      },
    ],
    name: "LogMessagePublished",
    type: "event",
  },
  {
    inputs: [],
    name: "getCurrentGuardianSetIndex",
    outputs: [{ internalType: "uint32", name: "", type: "uint32" }],
    stateMutability: "view",
    type: "function",
  },
  {
    inputs: [{ internalType: "uint32", name: "index", type: "uint32" }],
    name: "getGuardianSet",
    outputs: [
      {
        components: [
          { internalType: "address[]", name: "keys", type: "address[]" },
          { internalType: "uint32", name: "expirationTime", type: "uint32" },
        ],
        internalType: "struct Structs.GuardianSet",
        name: "",
        type: "tuple",
      },
    ],
    stateMutability: "view",
    type: "function",
  },
] as const;
