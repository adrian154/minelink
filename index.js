const sharp = require("sharp");
const MC = require("node-mc-api");
const fetch = require("node-fetch");
const Express = require("express");

// local deps
const MCWS = require("./mcws.js");
const config = require("./config.json");

const profileCache = {};

const express = Express();
express.get("/profile", (req, res) => {
    console.log(profileCache);
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

const mcServer = new MCWS(config.mcws.host);
mcServer.waitConnect().then(() => {
    mcServer.auth(config.mcws.clientID, config.mcws.secret).then(() => {
        console.log("Authed successfully");
    }).catch(console.error);
});

mcServer.on("chat", async (event) => { 
    
    // fetch profile
    if(!profileCache[event.uuid]) {
        const skins = await MC.getSkins(event.uuid);
        const resp = await fetch(skins.skinURL);
        const buf = await sharp(await resp.buffer()).extract({left: 8, top: 8, width: 8, height: 8}).png().toBuffer();
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