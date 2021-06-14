const fs = require("fs");
const sharp = require("sharp");
const MC = require("node-mc-api");
const Express = require("express");
const fetch = require("node-fetch");
const Discord = require("discord.js");

// ----- local deps
const MCWS = require("./mcws.js");
const config = require("./config.json");

// ----- utility funcs
const saveConfig = () => {
    fs.writeFileSync("./config.json", JSON.stringify(config, null, 4));
};

const ignore = () => {};

// ----- misc state
const avatarCache = {};
let mcChannel, consoleChannel, statusChannel;

// ----- init webend
const express = Express();
express.get("/avatar", (req, res) => {
    const avatar = avatarCache[req.query.uuid];
    if(avatar) {
        res.setHeader("Content-Type", "image/png");
        res.setHeader("Content-Length", avatar.length);
        res.send(avatar);
    }
});

express.use((req, res, next) => {
    res.sendStatus(404);
});

express.listen(config.port, () => console.log(`Webend started listening on port ${config.port}`));

// ----- init bot/discord link
const mcServer = new MCWS(config.mcws.host);
const bot = new Discord.Client();

const reconnect = () => {
    if(!mcServer.connected) {
        if(consoleChannel) consoleChannel.send("Trying to reconnect...").catch(ignore);
        mcServer.connect();
        setTimeout(reconnect, 5000);
    } 
};

mcServer.on("connect", () => {
    mcServer.auth(config.mcws.clientID, config.mcws.secret).then(() => {
        console.log("Authed successfully");
    }).catch(console.error);
    if(statusChannel) statusChannel.send(":white_check_mark: Connected to the Minecraft server").catch(ignore);
    if(consoleChannel) consoleChannel.send("Reconnected to server :)").catch(ignore);
});

mcServer.on("close", () => {
    if(statusChannel) statusChannel.send(":x: Lost connection to the Minecraft server. Reconnecting...").catch(ignore);
    if(consoleChannel) consoleChannel.send("Lost connection to server :(").catch(ignore);
    reconnect();
});

mcServer.connect();

bot.login(config.discord.token);

// ----- set up events for mc server
mcServer.on("chat", async (event) => { 

    // fetch avatar
    if(!avatarCache[event.uuid]) {
        
        const skins = await MC.getSkins(event.uuid);
        const resp = await fetch(skins.skinURL);

        const skin = await sharp(await resp.buffer());

        const overlay = await skin.extract({left: 40, top: 8, width: 8, height: 8}).png().toBuffer();
        const smallAvatar = await skin.extract({left: 8, top: 8, width: 8, height: 8}).composite([{input: overlay}]).png().toBuffer();
        
        const avatar = sharp(smallAvatar).resize(256, 256, {kernel: sharp.kernel.nearest});
        avatarCache[event.uuid] = await avatar.png().toBuffer();

    }

    console.log(`/avatar?uuid=${event.uuid}`);

    // send webhook
    fetch(config.webhookURL, {
        method: "post",
        body: JSON.stringify({
            username: event.playerName,
            content: event.message,
            avatar_url: `${config.hostname}/avatar?uuid=${event.uuid}`
        }),
        headers: {"Content-Type": "application/json"}
    });

});

let consoleBuffer = [], lastSendTime = 0, bufferedLength = 0;

const flushConsoleBuffer = () => {
    if(consoleChannel && consoleBuffer.length > 0) {
        consoleChannel.send(consoleBuffer.join("\n"));
        consoleBuffer = [];
        bufferedLength = 0;
        lastSendTime = Date.now();
    }
};

mcServer.on("console", (event) => {
    if(consoleChannel && bot.ready) {
        const message = `\`[${new Date(event.timestamp).toLocaleTimeString()}] [${event.level}] ${event.message.replace(/\u00a7./g, "")}\``;
        if(bufferedLength + message.length > 2000) {
            flushConsoleBuffer();
        }
        consoleBuffer.push(message);
        bufferedLength += message.length;
        if(Date.now() - lastSendTime > 500) {
            flushConsoleBuffer();
            setTimeout(flushConsoleBuffer, 500);
        } else {
            setTimeout(flushConsoleBuffer, 500);
        }
    }
});

mcServer.on("death", (event) => {
    mcChannel.send(`:skull_crossbones: ${event.deathMessage}`);
});

mcServer.on("join", (event) => {
    mcChannel.send(`:inbox_tray: ${event.playerName} joined`);
});

mcServer.on("quit", (event) => {
    mcChannel.send(`:outbox_tray: ${event.playerName} left`);
});

// ----- set up bot logic
bot.on("ready", () => {
    console.log(`Logged in as ${bot.user.tag}`);
    bot.ready = true;
    mcChannel = bot.channels.cache.get(config.mcChannel);
    consoleChannel = bot.channels.cache.get(config.consoleChannel);
    statusChannel = bot.channels.cache.get(config.statusChannel);
});

bot.on("message", (message) => {
    
    if(message.author.bot) return;

    if(message.content[0] === "-") {
        
        const tokens = message.content.trim().split(/\s+/);
        const command = tokens[0].slice(1, tokens[0].length);
        
        if(command === "bindchannel") {
            if(tokens[1] === "mc") {
                config.mcChannel = message.channel.id;
                mcChannel = message.channel;
                message.channel.send("This channel is now bound to the Minecraft server.").catch(ignore);
                saveConfig();
            } else if(tokens[1] === "console") {
                config.consoleChannel = message.channel.id;
                consoleChannel = message.channel;
                message.channel.send("This channel is now bound to the server console.").catch(ignore);
                saveConfig();
            } else if(tokens[1] === "status") {
                config.statusChannel = message.channel.id;
                statusChannel = message.channel;
                message.channel.send("This channel is now bound for status updates.").catch(ignore);
                saveConfig();
            } else {
                message.channel.send("Incorrect arguments. Usage: `-bindchannel mc/console/status`").catch(ignore);
            }
        }

    } else {
        if(message.channel.id === mcChannel?.id) {
            // TODO: deserialize discord format
            const jsonMessage = {text: `[Discord] ${message.author.username}: ${message.content}`};
            mcServer.runCommand(`tellraw @a ${JSON.stringify(jsonMessage)}`).catch(ignore);
        } else if(message.channel.id === consoleChannel?.id) {
            if(message.content[0] === "/") {
                mcServer.runCommand(message.content.slice(1)).catch(ignore);
            }
        }
    }

});