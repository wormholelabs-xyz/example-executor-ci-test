export const nttV1multiReceiveWithGasDropOffAbi = [
  {
    type: "function",
    name: "VERSION",
    inputs: [],
    outputs: [{ name: "", type: "string", internalType: "string" }],
    stateMutability: "view",
  },
  {
    type: "function",
    name: "receiveMessages",
    inputs: [
      {
        name: "contracts",
        type: "address[]",
        internalType: "address[]",
      },
      { name: "messages", type: "bytes[]", internalType: "bytes[]" },
      {
        name: "payeeAddress",
        type: "address",
        internalType: "address",
      },
    ],
    outputs: [],
    stateMutability: "payable",
  },
  {
    type: "error",
    name: "DropOffFailed",
    inputs: [
      { name: "", type: "address", internalType: "address" },
      { name: "", type: "uint256", internalType: "uint256" },
    ],
  },
  {
    type: "error",
    name: "InvalidParameters",
    inputs: [
      { name: "", type: "uint256", internalType: "uint256" },
      { name: "", type: "uint256", internalType: "uint256" },
    ],
  },
] as const;
