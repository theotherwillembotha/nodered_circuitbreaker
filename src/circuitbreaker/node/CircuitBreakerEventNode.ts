import { Node } from "node-red";
import { BaseNode, BaseNodeConfig, NodeDescription, NodeManager, SourceUtility } from "@theotherwillembotha/node-red-plugincore";
import { Metrics, MetricType, MetricsTemplate, CounterMetric, MetricsTemplateConfig } from "@theotherwillembotha/node-red-plugincore";
import { Log, Logger, LoggerTemplate, LoggerTemplateConfig } from "@theotherwillembotha/node-red-plugincore";

import { CircuitBreakerConfigNode, CircuitBreakerEventListener, CircuitBreakerEventType } from "./CircuitBreakerConfigNode";

export interface CircuitBreakerEventNodeConfig extends BaseNodeConfig, MetricsTemplateConfig, LoggerTemplateConfig {
    circuitbreakerconfig: string;
}

@NodeDescription({
    id:"CircuitBreakerEventNode",
    name:"Circuit Breaker Event Node",
    group:"circuitbreaker",
    sourceFile:SourceUtility.getSourcePath("/build/", "/src/") + "CircuitBreakerEventNode.html",
    package: "@theotherwillembotha/node-red-circuitbreaker",
    dependencies:[ CircuitBreakerConfigNode ],
    templates : [
        {template:LoggerTemplate, config:{}},
        {template:MetricsTemplate, config:{}},
    ],
    tags: [ "CircuitBreaker" ]
})
export class CircuitBreakerEventNode extends BaseNode<CircuitBreakerEventNodeConfig> {

    @Logger()
    private log!:Log;
    
    @Metrics({name:"tripCounter",type:MetricType.Counter, description:"number of times the circuit breaker tripped"})
    private tripCounter!:CounterMetric;

    @Metrics({name:"resetCounter",type:MetricType.Counter, description:"number of times the circuit breaker was reset"})
    private resetCounter!:CounterMetric;

    private _circuitBreakerConfigNode: CircuitBreakerConfigNode;
    private _eventListener:CircuitBreakerEventListener;

    constructor(node: Node, config: CircuitBreakerEventNodeConfig){
        super(node, config);

        this._circuitBreakerConfigNode = (NodeManager.RED.nodes.getNode(config.circuitbreakerconfig) as any).node();

        this._eventListener = this._circuitBreakerConfigNode.addEventListener(event => {
            if(event.state === CircuitBreakerEventType.Trip){
                this.tripCounter.inc();
                this.log.log(event);
                this.node().send([event, null])
            }
            if(event.state === CircuitBreakerEventType.Reset){
                this.resetCounter.inc();
                this.log.log(event);
                this.node().send([null, event])
            }
        });

        this.node().on("close", () => {
            this._circuitBreakerConfigNode.removeEventListener(this._eventListener);
        })
    }
}