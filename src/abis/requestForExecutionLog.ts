export const RequestForExecutionLogABI = [
  {
    type: "event",
    name: "RequestForExecution",
    inputs: [
      {
        name: "quoterAddress",
        type: "address",
        indexed: true,
        internalType: "address",
      },
      {
        name: "amtPaid",
        type: "uint256",
        indexed: false,
        internalType: "uint256",
      },
      {
        name: "dstChain",
        type: "uint16",
        indexed: false,
        internalType: "uint16",
      },
      {
        name: "dstAddr",
        type: "bytes32",
        indexed: false,
        internalType: "bytes32",
      },
      {
        name: "refundAddr",
        type: "address",
        indexed: false,
        internalType: "address",
      },
      {
        name: "signedQuote",
        type: "bytes",
        indexed: false,
        internalType: "bytes",
      },
      {
        name: "requestBytes",
        type: "bytes",
        indexed: false,
        internalType: "bytes",
      },
      {
        name: "relayInstructions",
        type: "bytes",
        indexed: false,
        internalType: "bytes",
      },
    ],
    anonymous: false,
  },
] as const;
