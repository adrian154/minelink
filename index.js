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
const profileCache = {};
let mcChannel, consoleChannel;

// ----- init webend
const express = Express();
express.get("/profile", (req, res) => {
    const profile = profileCache[req.query.uuid];
    if(profile) {
        res.setHeader("Content-Type", "image/png");
        res.setHeader("Content-Length", profile.length);
        res.send(profile);
    } else {
        res.sendStatus(404);
    }
});

express.listen(config.port, () => console.log(`Webend started listening on port ${config.port}`));

// ----- init bot/discord link
const mcServer = new MCWS(config.mcws.host);
const bot = new Discord.Client();

mcServer.waitConnect().then(() => {
    mcServer.auth(config.mcws.clientID, config.mcws.secret).then(() => {
        console.log("Authed successfully");
    }).catch(console.error);
});

bot.login(config.discord.token);

// ----- set up events for mc server
mcServer.on("chat", async (event) => { 

    // fetch profile
    if(!profileCache[event.uuid]) {
        const skins = await MC.getSkins(event.uuid);
        const resp = await fetch(skins.skinURL);
        const buf = await sharp(await resp.buffer())
            .extract({left: 8, top: 8, width: 8, height: 8})
            .resize(256, 256, {kernel: sharp.kernel.nearest})
            .png()
            .toBuffer();
        profileCache[event.uuid] = buf;
    }

    // send webhook
    fetch("https://discord.com/api/webhooks/845156492256870453/PHpT785X8PGM43ftlC-SQlCwlTMolpM8yszEGxDD8I3l4b-bYTcOYG2t730zLyLC5tNu", {
        method: "post",
        body: JSON.stringify({
            username: event.playerName,
            content: event.message,
            avatar_url: `${config.hostname}/profile?uuid=${event.uuid}`
        }),
        headers: {"Content-Type": "application/json"}
    });

});

mcServer.on("console", (event) => {
    if(consoleChannel && bot.ready) {
        consoleChannel.send(`\`[${new Date(event.timestamp).toLocaleTimeString()}] [${event.level}] ${event.message.replace(/\u00a7./g, "")}\``);
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
                message.channel.send("This channel is now bound to the server console.");
                saveConfig();
            } else {
                message.channel.send("Incorrect arguments. Usage: `-bindchannel mc/console`").catch(ignore);
            }
        }

    } else {
        if(message.channel.id === mcChannel.id) {
            // TODO: deserialize discord format
            const jsonMessage = {text: `[Discord] ${message.author.username}: ${message.content}`};
            mcServer.runCommand(`tellraw @a ${JSON.stringify(jsonMessage)}`);
        } else if(message.channel.id === consoleChannel.id) {
            mcServer.runCommand(message.content);
        }
    }

});