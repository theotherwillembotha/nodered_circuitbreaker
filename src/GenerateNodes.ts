import { NodeGenerator } from "@theotherwillembotha/node-red-plugincore";
import {
    LoggerService, MetricsService, NodeTypeService, SettingsService, StateService,
    DelegatedConfigReferenceNode,
    ConsoleLoggerConfigNode, RestLoggerConfigNode,
    CounterMetricConfigNode, GaugeMetricConfigNode, TimerMetricConfigNode,
    InternalStateConfigNode,
} from "@theotherwillembotha/node-red-plugincore";

// nodes.
import { CircuitBreakerConfigNode } from "./circuitbreaker/node/CircuitBreakerConfigNode";
import { CircuitBreakerNode } from "./circuitbreaker/node/CircuitBreakerNode";
import { CircuitBreakerFaultDetectorNode } from "./circuitbreaker/node/CircuitBreakerFaultDetectorNode";
import { CircuitBreakerEventNode } from "./circuitbreaker/node/CircuitBreakerEventNode";
import { CircuitBreakerStateNode } from "./circuitbreaker/node/CircuitBreakerStateNode";

new NodeGenerator("./src/circuitbreaker/")
    // infrastructure (required — deduplication guards make this safe)
    .registerService(LoggerService)
    .registerService(MetricsService)
    .registerService(NodeTypeService)
    .registerService(SettingsService)
    .registerService(StateService)
    .registerNode(DelegatedConfigReferenceNode)
    .registerNode(ConsoleLoggerConfigNode)
    .registerNode(RestLoggerConfigNode)
    .registerNode(CounterMetricConfigNode)
    .registerNode(GaugeMetricConfigNode)
    .registerNode(TimerMetricConfigNode)
    .registerNode(InternalStateConfigNode)

    // circuit breaker nodes
    .registerNode(CircuitBreakerConfigNode)
    .registerNode(CircuitBreakerNode)
    .registerNode(CircuitBreakerFaultDetectorNode)
    .registerNode(CircuitBreakerEventNode)
    .registerNode(CircuitBreakerStateNode)

    .generate("./build/Nodes", "./build/Plugins");

process.exit(0);