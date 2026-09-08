
import { Node } from "node-red";
import { ConfigNode, ConfigNodeConfig, NodeDescription, SourceUtility } from "@theotherwillembotha/node-red-plugincore";
import { StateService, StateHandle, StateTemplate, StateTemplateConfig } from "@theotherwillembotha/node-red-plugincore";


export enum CircuitBreakerDefaultState {
    Closed = "Closed",
    Open   = "Open"
}

export interface CircuitBreakerConfigNodeConfig extends ConfigNodeConfig, StateTemplateConfig {
    defaultState: CircuitBreakerDefaultState;
}

@NodeDescription({
    id:"CircuitBreakerConfigNode",
    name:"Circuit Breaker Config Node",
    group:"config",
    sourceFile:SourceUtility.getSourcePath("/build/", "/src/") + "CircuitBreakerConfigNode.html",
    package: "@theotherwillembotha/node-red-circuitbreaker",
    templates: [
        { template: StateTemplate, config: {
            nameSuffix: '-State',
            defaultStates: [
                {key:"Closed", value:"Closed", canEdit:true, canRemove:false},
                {key:"Open", value:"Open", canEdit:true, canRemove:false}
            ],
            minStates:2, 
            maxStates:2,
            canAdd:false
        }}
    ],
    tags: [ "CircuitBreaker" ]
})
export class CircuitBreakerConfigNode extends ConfigNode<CircuitBreakerConfigNodeConfig> {

    private _open: boolean;
    private _eventListeners:((event:CircuitBreakerEvent) => void)[] = [];
    private _context: BreakerContext = new BreakerContext();
    private _stateHandle: StateHandle;

    constructor(node: Node, config: CircuitBreakerConfigNodeConfig){
        super(node, config);

        this._open = config.defaultState === CircuitBreakerDefaultState.Open;
        this._stateHandle = StateService.createHandle(config.stateReference);

        // Restore persisted state if the provider has a stored value.
        // If nothing is stored yet, seed the provider with this breaker's default state.
        this._stateHandle.get().then(persistedState => {
            if (persistedState === null) {
                this._stateHandle.set(config.defaultState ?? CircuitBreakerDefaultState.Closed);
            } else {
                const wasOpen = this._open;
                this._open = persistedState === CircuitBreakerDefaultState.Open;
                if (this._open !== wasOpen) {
                    this._eventListeners.forEach(l => l({
                        state: this._open ? CircuitBreakerEventType.Trip : CircuitBreakerEventType.Reset
                    }));
                }
            }
        });

        // Subscribe to externally-driven state changes (e.g. a third party writing to the ZNode).
        this._stateHandle.subscribe((externalState) => {
            const wasOpen = this._open;
            this._open = externalState === CircuitBreakerDefaultState.Open;
            if (this._open !== wasOpen) {
                this._eventListeners.forEach(l => l({
                    state: this._open ? CircuitBreakerEventType.Trip : CircuitBreakerEventType.Reset
                }));
            }
        });

        // Clean up the state subscription when this node is undeployed.
        node.on('close', () => {
            this._stateHandle.unsubscribe();
        });
    }

    public isOpen():boolean{
        return this._open;
    }

    public trip():void{
        this._open = true;
        this._stateHandle.set(CircuitBreakerDefaultState.Open);
        let event = {
            state: CircuitBreakerEventType.Trip
        };
        this._eventListeners.forEach(listener => listener(event));
    }

    public reset():void{
        this._open = false;
        this._stateHandle.set(CircuitBreakerDefaultState.Closed);
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
