import { NodeGenerator } from "@theotherwillembotha/nodered_plugincore"

// services.


// nodes.
import { CircuitBreakerConfigNode } from "./circuitbreaker/node/CircuitBreakerConfigNode";
import { CircuitBreakerNode } from "./circuitbreaker/node/CircuitBreakerNode";
import { CircuitBreakerFaultDetectorNode } from "./circuitbreaker/node/CircuitBreakerFaultDetectorNode";
import { CircuitBreakerEventNode } from "./circuitbreaker/node/CircuitBreakerEventNode";
import { CircuitBreakerStateNode } from "./circuitbreaker/node/CircuitBreakerStateNode";

new NodeGenerator("./src/")
    // services.

    // nodes
    .registerNode(CircuitBreakerConfigNode)
    .registerNode(CircuitBreakerNode)
    .registerNode(CircuitBreakerFaultDetectorNode)
    .registerNode(CircuitBreakerEventNode)
    .registerNode(CircuitBreakerStateNode)

    // done.
    .generate("./build/Nodes", "./build/Plugins");

process.exit(0);