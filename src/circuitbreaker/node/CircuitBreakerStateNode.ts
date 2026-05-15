import { Node } from "node-red";
import { BaseNode, BaseNodeConfig, Message, NodeDescription, NodeManager, onInput, SourceUtility } from "@theotherwillembotha/node-red-plugincore";
import { Metrics, MetricType, MetricsTemplate, CounterMetric, MetricsTemplateConfig } from "@theotherwillembotha/node-red-plugincore";
import { Log, Logger, LoggerTemplate, LoggerTemplateConfig } from "@theotherwillembotha/node-red-plugincore";
import { ScriptEditorTemplate } from "@theotherwillembotha/node-red-plugincore";

import { CircuitBreakerConfigNode } from "./CircuitBreakerConfigNode";

export interface CircuitBreakerStateNodeConfig extends BaseNodeConfig, MetricsTemplateConfig, LoggerTemplateConfig {
    circuitbreakerconfig: string;
    action:CircuitBreakerStateAction;
    script:string;
}

@NodeDescription({
    id:"CircuitBreakerStateNode",
    name:"Circuit Breaker State Node",
    group:"circuitbreaker",
    sourceFile:SourceUtility.getSourcePath("/build/", "/src/") + "CircuitBreakerStateNode.html",
    package: "@theotherwillembotha/node-red-circuitbreaker",
    dependencies:[ CircuitBreakerConfigNode ],
    templates : [
        {template:LoggerTemplate, config:{}},
        {template:MetricsTemplate, config:{}},
        {template:ScriptEditorTemplate, config:{}},
    ],
    tags: [ "CircuitBreaker" ]
})
export class CircuitBreakerStateNode extends BaseNode<CircuitBreakerStateNodeConfig> {

    @Logger()
    private log!:Log;
    
    @Metrics({name:"counter",type:MetricType.Counter, description:"number of messages received"})
    private counter!:CounterMetric;

    private _circuitBreakerConfigNode: CircuitBreakerConfigNode;
    private _breakerScript!: (breaker: any, message: any) => any;

    constructor(node: Node, config: CircuitBreakerStateNodeConfig){
        super(node, config);

        this._circuitBreakerConfigNode = (NodeManager.RED.nodes.getNode(config.circuitbreakerconfig) as any).node();

        if(config.action === CircuitBreakerStateAction.Script){
            this._breakerScript = new Function('breaker', 'message', config.script) as (breaker:any, message: any) => any;
        }
    }

    @onInput()
    private onMessageReceived(message:Message):void{
        this.log.log(message);
        this.counter.inc();
        
        // handle the message and change the state based on the mesage.
        if(this.config().action === CircuitBreakerStateAction.Reset){
            this._circuitBreakerConfigNode.reset();
        }
        if(this.config().action === CircuitBreakerStateAction.Trip) {
            this._circuitBreakerConfigNode.trip();
        }
        if(this.config().action === CircuitBreakerStateAction.Script) {
            this._breakerScript(this._circuitBreakerConfigNode, message);
        }
        this.node().send(message);
    }
}

enum CircuitBreakerStateAction {
    Reset = "Reset",
    Trip = "Trip",
    Script = "Script"
}