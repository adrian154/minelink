const WebSocket = require("ws");

module.exports = class {

    constructor(host) {
        this.socket = new WebSocket("ws://" + host);
        this.requests = {};
        this.eventHandlers = {};
        this.requestID = 0;
        this.socket.on("message", (data) => {
            const message = JSON.parse(data);
            if(message.requestID && this.requests[message.type]) {
                if(message.error) {
                    this.requests[message.type].reject(message.error);
                } else {
                    this.requests[message.type].resolve(message);
                }
            } else if(this.eventHandlers[message.type]) {
                this.eventHandlers[message.type](message);
            }
        });
    }

    async waitConnect() {
        return new Promise((resolve, reject) => {
            if(this.socket.readyState === WebSocket.OPEN) resolve();
            this.socket.on("open", () => resolve());
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
        return new Promise((resolve, reject) => {
            this.requests[this.requestID++] = {resolve, reject};
            this.socket.send(JSON.stringify(payload));
        });
    }

};