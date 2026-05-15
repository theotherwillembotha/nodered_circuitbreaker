import { Node } from "node-red";
import { BaseNode, BaseNodeConfig, NodeManager, SourceUtility, Message, onInput, NodeDescription } from "@theotherwillembotha/node-red-plugincore";
import { Metrics, MetricType, MetricsTemplate, CounterMetric, MetricsTemplateConfig } from "@theotherwillembotha/node-red-plugincore";
import { Log, Logger, LoggerTemplate, LoggerTemplateConfig } from "@theotherwillembotha/node-red-plugincore";
import { ScriptEditorTemplate } from "@theotherwillembotha/node-red-plugincore";

import { CircuitBreakerConfigNode } from "./CircuitBreakerConfigNode";

export interface CircuitBreakerFaultDetectorNodeConfig extends BaseNodeConfig, MetricsTemplateConfig, LoggerTemplateConfig {
    circuitbreakerconfig: string;
    faultFunction:string;
    tripFunction:string;
}

@NodeDescription({
    id:"CircuitBreakerFaultDetectorNode",
    name:"Circuit Breaker Fault Detector Node",
    group:"circuitbreaker",
    sourceFile:SourceUtility.getSourcePath("/build/", "/src/") + "CircuitBreakerFaultDetectorNode.html",
    package: "@theotherwillembotha/node-red-circuitbreaker",
    dependencies:[ CircuitBreakerConfigNode ],
    templates : [
        {template:LoggerTemplate, config:{}},
        {template:MetricsTemplate, config:{}},
        {template:ScriptEditorTemplate, config:{}},
    ],
    tags: [ "CircuitBreaker" ]
})
export class CircuitBreakerFaultDetectorNode extends BaseNode<CircuitBreakerFaultDetectorNodeConfig> {

    @Logger()
    private log!:Log;
    
    @Metrics({name:"counter",type:MetricType.Counter, description:"number of requests received"})
    private counter!:CounterMetric;

    private _configNode: CircuitBreakerConfigNode;
    private _breakerFaultFunction: (message: any) => boolean;       // was there a fault with the message.
    private _breakerTripFunction: (message: any) => boolean;        // should the breaker be tripped.

    constructor(node: Node, config: CircuitBreakerFaultDetectorNodeConfig){
        super(node, config);
        let _this = this;

        // get a reference to the reolink clients.
        this._configNode = (NodeManager.RED.nodes.getNode(config.circuitbreakerconfig) as any).node();

        this._breakerFaultFunction = new Function('msg', config.faultFunction) as (msg: any) => boolean;
        this._breakerTripFunction = new Function('breaker', config.tripFunction) as (message: any) => boolean;
    }

    @onInput()
    protected async messageReceived(message:Message){
        this.log.log(message);
        this.counter.inc();
        
        // perform the fault check
        if(this._breakerFaultFunction(message)){
            
            // perform the trip function. if it passes, notify the circuitbreakerconfig.
            if(this._breakerTripFunction(this._configNode)){
                this._configNode.trip();
            }
            this.node().send([null, message]);
        }

        else{
            // perform the resetFunction. if it passes, notify the circuritbreakerconfig.
            this.node().send([message, null]);
        }
    }
}
