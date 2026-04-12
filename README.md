# nodered_circuitbreaker
A Circuit Breaker node for Node Red with configurable back-off and status events.

### What is a Circuit Breaker.
A circuit breaker is a design pattern that acts as a safety mechanism for high-volume systems that has a potential failure point.

Lets say you have an externall service that you call via an http endpoint. You would submit a request to the endpoint and it will under normal circumstances respond in about 2 or 3 seconds. The problem is when something goes wrong in this external system. If there is an issue, the timeout can be up to 20 seconds and just bombarding it with more requests when it is in failure mode is not helping it to get back online. So what you would do is put a circuit breaker before it, and a fault detector after it. As soon as the fault detector starts seeing failures, it can pop the circuit breaker and tell it to stop sending through requests* and give the external system 2 or 3 minutes to recover.

Of course, the error detection and recovery should be completely customizable. For instance, if you're used to sending 100 requests per second, you might only see it as beeing faulty when the success rate drops below 95%, or you might tell the circuit breaker to instead of waiting 3 or 4 minutes, just send though 1 "test" request every second to see if it goes through and after 5 messages have gone through successfully, close the breaker again. there are hundreds of failure and recovery modes, which makes this pattern both incredibly useful, flexible and difficult to implement without some sort of governing template.


To Effectively use this circuit breaker pattern in node-red you will need to use several nodes.

#### Circuit Braker Node.
The first node you will put down is the circuit breaker node. It is essentially a switch that will either direct messages to the open output or the closed output. The reason why there are two outputs is so you can deal with messages in the event that the circuit breaker has been opened or closed: for instance, if the curcuit breaker has been opened, you might want to buffer the incomming mesages and resubmit them once it has been closed again to avoid the messages from being lost.

### Circuit Breaker Config Node.
Every Circuit Breaker, Failure Detector, Recovery Detector and Circuit Breaker Event Node needs to be linked to a Circuit Breaker Config Node. the config node basically
holds the state of the ciruit breaker "concept" and allows you to link multiple circuit brakers to the same config. For instance, if you have 3 or 4 integrations with an external system, and one of the integrations goes down, its in all likelihood that all of them will go down, in which case you could have 4 circuit breakers all open at the same time because one of them detected a fault.