
import { Node } from "node-red";
import { ConfigNode, ConfigNodeConfig, NodeDescription, SourceUtility } from "@theotherwillembotha/nodered_plugincore";


export interface CircuitBreakerConfigNodeConfig extends ConfigNodeConfig {
    defaultOpen:boolean;
}

@NodeDescription({
    id:"CircuitBreakerConfigNode",
    name:"Circuit Breaker Config Node",
    group:"config",
    sourceFile:SourceUtility.getSourcePath("/build/", "/src/") + "CircuitBreakerConfigNode.html",
    package: "@theotherwillembotha/nodered_circuitbreaker",
    tags: [ "CircuitBreaker" ]
})
export class CircuitBreakerConfigNode extends ConfigNode<CircuitBreakerConfigNodeConfig> {

    private _open: boolean;
    private _eventListeners:((event:CircuitBreakerEvent) => void)[] = [];
    private _context: BreakerContext = new BreakerContext();

    constructor(node: Node, config: CircuitBreakerConfigNodeConfig){
        super(node, config);

        this._open = !!config.defaultOpen;
    }

    public isOpen():boolean{
        return this._open;
    }

    public trip():void{
        this._open = true;
        let event = {
            state: CircuitBreakerEventType.Trip
        };
        this._eventListeners.forEach(listener => listener(event));
    }

    public reset():void{
        this._open = false;
        let event = {
            state: CircuitBreakerEventType.Reset
        };
        this._eventListeners.forEach(listener => listener(event));
    }

    public addEventListener(listener: (event:CircuitBreakerEvent) => void): CircuitBreakerEventListener {
        this._eventListeners.push(listener);
        return listener;
    }

    public removeEventListener(listener: CircuitBreakerEventListener):void {
        let index = this._eventListeners.indexOf(listener as ((event:CircuitBreakerEvent) => void));
        if(index >= 0){
            this._eventListeners = this._eventListeners.splice(index, 1);
        }
    }

    public context():BreakerContext {
        return this._context;
    }
}

export interface CircuitBreakerEventListener {

}

export class BreakerContext {
    private values:{[id:string]:any} = {};
    
    public get<T>(id:string, defaultValue?:T): T {
        let value = this.values[id];
        if(value === undefined){
            value = this.set(id, defaultValue);
        }
        return value;
    }

    public set<T>(id:string, value:T): T {
        return this.values[id] = value;
    }
}

export type CircuitBreakerEvent = {
    state:CircuitBreakerEventType;
}

export enum CircuitBreakerEventType {
    Trip = "Trip",
    Reset = "Reset"
}
