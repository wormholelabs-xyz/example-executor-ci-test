analytics_settings(False)
update_settings(max_parallel_updates=10)

k8s_yaml("tilt/anvil-base-sepolia.yaml")
k8s_yaml("tilt/anvil-eth-sepolia.yaml")

k8s_resource(
    "anvil-eth-sepolia",
    port_forwards = [
        port_forward(8545, name = "RPC [:8545]"),
    ],
    labels = ["anvil"],
)
k8s_resource(
    "anvil-base-sepolia",
    port_forwards = [
        port_forward(8546, 8545, name = "RPC [:8546]"),
    ],
    labels = ["anvil"],
)

docker_build(
    ref = "executor",
    context = ".",
    dockerfile = "./Dockerfile",
    target="test",
    only=[
        "package.json", "bun.lock", "src", ".env.test"
    ]
)

k8s_yaml("tilt/executor.yaml")
k8s_resource(
    "executor",
    port_forwards = [
        port_forward(3000, name = "Executor [:3000]"),
    ],
    resource_deps = ["anvil-eth-sepolia", "anvil-base-sepolia"],
    labels = ["app"],
)
