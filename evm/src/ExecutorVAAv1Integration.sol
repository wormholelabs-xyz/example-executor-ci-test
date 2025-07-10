// SPDX-License-Identifier: UNLICENSED
pragma solidity ^0.8.13;

import "wormhole-solidity-sdk/interfaces/IWormhole.sol";
import "example-messaging-executor/evm/src/interfaces/IExecutor.sol";
import "example-messaging-executor/evm/src/interfaces/IVaaV1Receiver.sol";
import "example-messaging-executor/evm/src/libraries/ExecutorMessages.sol";
import {toWormholeFormat} from "wormhole-solidity-sdk/Utils.sol";

struct ExecutorArgs {
    // The refund address used by the Executor.
    address refundAddress;
    // The signed quote to be passed into the Executor.
    bytes signedQuote;
    // The relay instructions to be passed into the Executor.
    bytes instructions;
}

/// This contract is for testing purposes only and is missing several security checks a real integration might do
/// Integrators are encouraged to follow the integration guide at
/// https://wormholelabs.notion.site/Executor-Integration-Notes-Public-1bd3029e88cb804e8281ec19e3264c3b
contract ExecutorVAAv1Integration is IVaaV1Receiver {
    bytes32 public immutable emitterAddress;
    uint16 public immutable ourChain;
    uint8 public immutable wormholeFinality;
    IWormhole public immutable wormhole;
    IExecutor public immutable executor;

    uint256 public number;

    error InvalidVaa(string reason);

    constructor(address _wormhole, address _executor, uint8 _wormholeFinality) {
        assert(_wormhole != address(0));
        assert(_executor != address(0));

        wormhole = IWormhole(_wormhole);
        executor = IExecutor(_executor);

        ourChain = wormhole.chainId();
        emitterAddress = toWormholeFormat(address(this));
        wormholeFinality = _wormholeFinality;
    }

    function incrementAndSend(uint16 destinationChain, bytes32 destinationAddress, ExecutorArgs calldata executorArgs)
        public
        payable
    {
        number++;
        uint256 wormholeFee = wormhole.messageFee();
        require(msg.value >= wormholeFee, "insufficient value");
        uint256 executionAmount = msg.value - wormholeFee;

        uint64 sequence = wormhole.publishMessage{value: wormholeFee}(0, abi.encodePacked(number), wormholeFinality);

        executor.requestExecution{value: executionAmount}(
            destinationChain,
            destinationAddress, // a real integration would likely send to its peer
            executorArgs.refundAddress,
            executorArgs.signedQuote,
            ExecutorMessages.makeVAAv1Request(ourChain, emitterAddress, sequence),
            executorArgs.instructions
        );
    }

    function executeVAAv1(bytes memory vaa) public payable {
        (IWormhole.VM memory vm, bool valid, string memory reason) = wormhole.parseAndVerifyVM(vaa);
        if (!valid) {
            revert InvalidVaa(reason);
        }
        (number) = abi.decode(vm.payload, (uint256));
    }
}
