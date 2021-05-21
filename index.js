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
            .resize({width: 256, height: 256, kernel: sharp.kernel.nearest})
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
    if(config.consoleChannel && bot.ready) {
        const channel = bot.channels.cache.get(config.consoleChannel);
        if(channel) {
            channel.send("`" + event.message + "`");
        }
    }
});

// ----- set up bot logic
bot.on("ready", () => {
    console.log(`Logged in as ${bot.user.tag}`);
    bot.ready = true;
});

bot.on("message", (message) => {
    
    if(message.author.bot) return;

    if(message.content[0] === "-") {
        
        const tokens = message.content.trim().split(/\s+/);
        const command = tokens[0].slice(1, tokens[0].length);
        
        if(command === "bindchannel") {
            if(tokens[1] === "mc") {
                config.mcChannel = message.channel.id;
                saveConfig();
            } else if(tokens[1] === "console") {
                config.consoleChannel = message.channel.id;
                saveConfig();
            } else {
                message.channel.send("Incorrect arguments. Usage: `-bindchannel mc/console`").catch(ignore);
            }
        }

    } else {
        if(message.channel.id === config.mcChannel) {
            // TODO: deserialize discord format
            const jsonMessage = {text: `[Discord] ${message.author.username}: ${message.content}`};
            mcServer.runCommand(`tellraw @a ${JSON.stringify(jsonMessage)}`);
        } else if(message.channel.id === config.consoleChannel) {
            mcServer.runCommand(message.content);
        }
    }

});