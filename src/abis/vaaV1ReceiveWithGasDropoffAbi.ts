export const vaaV1ReceiveWithGasDropAbi = [
  {
    type: "function",
    name: "VERSION",
    inputs: [],
    outputs: [{ name: "", type: "string", internalType: "string" }],
    stateMutability: "view",
  },
  {
    type: "function",
    name: "receiveMessage",
    inputs: [
      { name: "contractAddr", type: "address", internalType: "address" },
      { name: "message", type: "bytes", internalType: "bytes" },
      { name: "payeeAddress", type: "address", internalType: "address" },
      { name: "dropOffValue", type: "uint256", internalType: "uint256" },
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
    name: "InvalidMsgValue",
    inputs: [
      { name: "msgValue", type: "uint256", internalType: "uint256" },
      { name: "dropOffValue", type: "uint256", internalType: "uint256" },
    ],
  },
] as const;
