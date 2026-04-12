import { Node, NodeStatus } from "node-red";
import { BaseNode, BaseNodeConfig, NodeManager, onInput, SourceUtility, Message, NodeDescription } from "@theotherwillembotha/nodered_plugincore";
import { Metrics, MetricType, MetricsTemplate, CounterMetric, MetricsTemplateConfig } from "@theotherwillembotha/nodered_plugincore";
import { Log, Logger, LoggerTemplate, LoggerTemplateConfig } from "@theotherwillembotha/nodered_plugincore";

import { CircuitBreakerConfigNode, CircuitBreakerEventType } from "./CircuitBreakerConfigNode";

export interface CircuitBreakerNodeConfig extends BaseNodeConfig, MetricsTemplateConfig, LoggerTemplateConfig {
    circuitbreakerconfig: string;
}

const openStatus:NodeStatus = {fill:"red", shape:"dot", text:"open"};
const closedStatus:NodeStatus = {fill:"green", shape:"dot", text:"closed"};

@NodeDescription({
    id:"CircuitBreakerNode",
    name:"Circuit Breaker Node",
    group:"circuitbreaker",
    sourceFile:SourceUtility.getSourcePath("/build/", "/src/") + "CircuitBreakerNode.html",
    package: "@theotherwillembotha/nodered_circuitbreaker",
    dependencies:[ CircuitBreakerConfigNode ],
    templates : [
        {template:LoggerTemplate, config:{}},
        {template:MetricsTemplate, config:{}},
    ],
    tags: [ "CircuitBreaker" ]
})
export class CircuitBreakerNode extends BaseNode<CircuitBreakerNodeConfig> {

    @Logger()
    private log!:Log;
    
    @Metrics({name:"closeCounter",type:MetricType.Counter, description:"number of requests processed while circuit breaker closed"})
    private closedCounter!:CounterMetric;

    @Metrics({name:"openCounter",type:MetricType.Counter, description:"number of requests processed while circuit breaker open"})
    private openCounter!:CounterMetric;

    private _configNode: CircuitBreakerConfigNode;

    constructor(node: Node, config: CircuitBreakerNodeConfig){
        super(node, config);

        this._configNode = (NodeManager.RED.nodes.getNode(config.circuitbreakerconfig) as any).node();

        // register a status listener
        this._configNode.addEventListener(event => {
            this.node().status(event.state === CircuitBreakerEventType.Trip ? openStatus : closedStatus);
        })

        // set the initial status
        this.node().status(this._configNode.isOpen() ? openStatus : closedStatus);
    }

    @onInput()
    protected async messageReceived(message:Message){
        // check the current state of the node.
        if(this._configNode.isOpen()){
            this.openCounter.inc();
            this.log.log({state:"open", data:message});
            this.node().send([null, message]);
        }
        else{
            this.closedCounter.inc();
            this.log.log({state:"closed", data:message});
            this.node().send([message, null]);
        }
    }
}