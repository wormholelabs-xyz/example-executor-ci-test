# Example Executor CI Test

This repo provides an example [Tilt](https://tilt.dev/) and GitHub Action for CI that can be used as a reference by [Executor](https://github.com/wormholelabs-xyz/example-messaging-executor) integrators.

⚠ **This software is distributed on an "AS IS" BASIS, WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either express or
implied. See the License for the specific language governing permissions and limitations under the License.** Or plainly
spoken - this is a very complex piece of software which targets a bleeding-edge, experimental smart contract runtime.
Mistakes happen, and no matter how hard you try and whether you pay someone to audit it, it may eat your tokens, set
your printer on fire or startle your cat. Cryptocurrencies are a high-risk investment, no matter how fancy.

## Testing with Tilt

To run tests using Tilt, execute the following command:

```bash
tilt up
```

This will spin up a local development environment with all necessary components including Anvil chains and the executor service.

After Tilt is running, the test suite will run automatically in the `e2e` step.

````

## Capabilities and Supported Platforms

| Capability | Status | Description |
|------------|--------|-------------|
| NTT V1 | ✅ Supported | Native Token Transfer protocol integration |
| VAA V1 | ✅ Supported | Verified Action Approvals V1 protocol |

| Platform | Status | Networks |
|----------|--------|----------|
| EVM | ✅ Supported | Ethereum, BSC, Polygon, Avalanche, etc. |

## Running the Docker Image

You can run the executor using the published Docker image. To override the default configuration:

```bash
docker run -v /path/to/your/config.json:/app/config.json \
  -e CONFIG_PATH=/app/config.json \
  example-executor:latest
````

The configuration file should contain your chain settings, RPC endpoints, and other necessary parameters.

## Customizing Your Anvil Environment

The local Anvil chains can be customized to deploy additional integration contracts or modify the blockchain state for testing purposes. You can:

- Deploy custom contracts using Forge or other deployment tools
- Modify chain state using Anvil's RPC methods
- Configure custom accounts and balances
- Set up specific testing scenarios

Example of deploying additional contracts:

```bash
forge create YourContract -r http://localhost:8545 --private-key <your-private-key>
```

## Deployed Contracts

The following contracts are used as part of this repository infrastructure:

| Contract | Network | Address | Description |
|----------|---------|---------|-------------|
| NTT Shim Contract | Sepolia | [0x54DD7080aE169DD923fE56d0C4f814a0a17B8f41](https://sepolia.etherscan.io/address/0x54DD7080aE169DD923fE56d0C4f814a0a17B8f41) | Handles NTT protocol integration |
| Executor | Sepolia | [0xD0fb39f5a3361F21457653cB70F9D0C9bD86B66B](https://sepolia.etherscan.io/address/0xD0fb39f5a3361F21457653cB70F9D0C9bD86B66B) | Main executor contract |
| MultiReceiveWithGasDropOff | Base Sepolia | [0xe3cc16Cffa085C78e5D8144C74Fa97e4Fe53d68d](https://sepolia.basescan.org/address/0xe3cc16Cffa085C78e5D8144C74Fa97e4Fe53d68d) | Manages multi-receiver operations |

## Using the Executor Explorer

You can monitor and explore executor transactions using the Executor Explorer. For local development:

```
https://wormholelabs-xyz.github.io/executor-explorer/#/chain/10002/tx/${hash}?endpoint=http%3A%2F%2Flocalhost%3A3000&env=Testnet
```

Replace `${hash}` with your transaction hash. The explorer will connect to your local executor instance running on port 3000.
