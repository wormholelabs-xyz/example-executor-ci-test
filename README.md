# Example Executor CI Test

This repo provides an example [Tilt](https://tilt.dev/) and GitHub Action for CI that can be used as a reference by [Executor](https://github.com/wormholelabs-xyz/example-messaging-executor) integrators.

⚠ **This software is distributed on an "AS IS" BASIS, WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either express or
implied. See the License for the specific language governing permissions and limitations under the License.** Or plainly
spoken - this is a very complex piece of software which targets a bleeding-edge, experimental smart contract runtime.
Mistakes happen, and no matter how hard you try and whether you pay someone to audit it, it may eat your tokens, set
your printer on fire or startle your cat. Cryptocurrencies are a high-risk investment, no matter how fancy.

## Testing Flow

> 🚧 This is a work in progress!

First tilt up.

```bash
tilt up
```

Next, deploy integration contracts to each chain.

```bash
forge create ExecutorVAAv1Integration -r http://localhost:8545 --broadcast --private-key 0xac0974bec39a17e36ba4a6b4d238ff944bacb478cbed5efcae784d7bf4f2ff80 --constructor-args 0x4a8bc80Ed5a4067f1CCf107057b8270E0cC11A78 0xD0fb39f5a3361F21457653cB70F9D0C9bD86B66B 200
forge create ExecutorVAAv1Integration -r http://localhost:8546 --broadcast --private-key 0xac0974bec39a17e36ba4a6b4d238ff944bacb478cbed5efcae784d7bf4f2ff80 --constructor-args 0x79A1027a6A159502049F10906D333EC57E95F083 0x51B47D493CBA7aB97e3F8F163D6Ce07592CE4482 200
```

Finally, bun test

```bash
bun test
```

Click the link! It should be `pending` at first and then after a couple seconds, refresh and it should be `submitted`!

Next steps

- Support NTT v1
- Publish the executor docker image
- Support passing the executor chain config from env or command line so that someone using the docker image can configure the chain info
- Deploy the contracts within the e2e test and actually confirm the messages send both ways and update the contract number.
- Trigger the e2e test in CI
