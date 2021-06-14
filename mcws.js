const WebSocket = require("ws");

module.exports = class {

    constructor(host) {
        this.host = host;
        this.requests = {};
        this.eventHandlers = {};
        this.requestID = 0;
    }

    event(which, ...params) {
        if(this.eventHandlers[which]) this.eventHandlers[which](...params);
    }

    connect() {
        this.socket = new WebSocket("ws://" + this.host);
        this.socket.on("open", () => {
            this.connected = true;
            this.event("connect");
        });
        this.socket.on("error", () => {
            this.socket.terminate();
        });
        this.socket.on("close", () => {
            if(this.connected) {
                this.connected = false;
                this.event("close");
            }
        });
        this.socket.on("message", (data) => {
            const message = JSON.parse(data);
            if(message.hasOwnProperty("requestID") && this.requests[message.type]) {
                if(message.error) {
                    this.requests[message.type].reject(message.error);
                } else {
                    this.requests[message.type].resolve(message);
                }
            } else if(message.type) {
                this.event(message.type, message);
            }
        });
    }

    async auth(clientID, secret) {
        return this.request({
            action: "auth",
            clientID: clientID,
            secret: secret
        });
    }

    async getOnlinePlayers() {
        return this.request({
            action: "getOnline"
        });
    }

    async runCommand(command) {
        return this.request({
            action: "runCommand",
            command: command
        });
    }

    on(event, handler) {
        this.eventHandlers[event] = handler;
    }

    request(payload) {
        if(this.socket.readyState !== WebSocket.OPEN) throw new Error("Not connected");
        return new Promise((resolve, reject) => {
            this.requests[this.requestID++] = {resolve, reject};
            this.socket.send(JSON.stringify(payload));
        });
    }

};