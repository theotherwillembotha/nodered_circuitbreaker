import { NodeGenerator, NodeTypeService } from "@theotherwillembotha/node-red-plugincore";

// circuit breaker nodes
import { CircuitBreakerConfigNode } from "./circuitbreaker/node/CircuitBreakerConfigNode";
import { CircuitBreakerNode } from "./circuitbreaker/node/CircuitBreakerNode";
import { CircuitBreakerFaultDetectorNode } from "./circuitbreaker/node/CircuitBreakerFaultDetectorNode";
import { CircuitBreakerEventNode } from "./circuitbreaker/node/CircuitBreakerEventNode";
import { CircuitBreakerStateNode } from "./circuitbreaker/node/CircuitBreakerStateNode";

// Only register leaf nodes and NodeTypeService.
// All infrastructure (services, templates, DelegatedConfigReferenceNode)
// is resolved automatically from @NodeDescription and @TemplateDescription
// dependency chains.
new NodeGenerator("./src/circuitbreaker/")
    .registerService(NodeTypeService)
    .registerNode(CircuitBreakerConfigNode)
    .registerNode(CircuitBreakerNode)
    .registerNode(CircuitBreakerFaultDetectorNode)
    .registerNode(CircuitBreakerEventNode)
    .registerNode(CircuitBreakerStateNode)
    .generate("./build/Nodes", "./build/Plugins", "@theotherwillembotha/node-red-circuitbreaker");

process.exit(0);
