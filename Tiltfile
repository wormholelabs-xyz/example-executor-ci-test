analytics_settings(False)
update_settings(max_parallel_updates=10)

k8s_yaml("k8s/anvil-base-sepolia.yaml")
k8s_yaml("k8s/anvil-eth-sepolia.yaml")

k8s_resource(
    "anvil-eth-sepolia",
    port_forwards = 8545,
    labels = ["anvil"],
)
k8s_resource(
    "anvil-base-sepolia",
    port_forwards = '8546:8545',
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

k8s_yaml("k8s/executor.yaml")
k8s_resource(
    "executor",
    port_forwards = 3000,
    resource_deps = ["anvil-eth-sepolia", "anvil-base-sepolia"],
    labels = ["app"],
)
