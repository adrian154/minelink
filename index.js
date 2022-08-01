const avatars = require("./avatars.js"),
      Discord = require("discord.js"),
      fetch = require("node-fetch"),
      express = require("express");

const config = require("./config.json");
for(const server of config.servers) {
    server.broadcastEndpoint = new URL("/chat", server.apiUrl);
}

// set up web-facing part of minelink
const app = express();
app.use("/avatars", express.static("avatars"));
app.use(express.json());

// receive events from minecraft servers via webhook
for(const server of config.servers) {
    app.post(`/webhooks/${server.siphonWebhookId}`, async (req, res) => {

        if(!bot.isReady()) {
            return;
        }
        
        if(req.body.event === "chat") {
            fetch(server.discordWebhook, {
                method: "post",
                headers: {
                    "Content-Type": "application/json"
                },
                body: JSON.stringify({
                    username: req.body.playerName,
                    content: req.body.message,
                    avatar_url: await avatars.getAvatarURL(req.body.uuid)
                })
            })   
        } else if(req.body.event === "player-death") {
            server.channel?.send(`:skull_crossbones: ${req.body.message}`)
        } else if(req.body.event === "player-join") {
            server.channel?.send(`:inbox_tray: ${req.body.playerName} joined`);
            avatars.refreshAvatar(req.body.uuid);
        } else if(req.body.event === "quit") {
            server.channel?.send(`:outbox_tray: ${req.body.playerName} left`)
        }

    });
}

app.use((req, res, next) => res.status(404));

app.listen(config.port, () => console.log("Webserver started"));

// set up discord bot
const bot = new Discord.Client({
    intents: [
        Discord.GatewayIntentBits.Guilds,
        Discord.GatewayIntentBits.GuildMessages,
        Discord.GatewayIntentBits.MessageContent
    ]
});

const BLURPLE = "#8fa8ff";

const formatMessage = message => {

    // replace all mentions with formatted text
    const replacedSections = [
        [...message.content.matchAll(/<#(\d{17,19})>/g)].map(match => ({match, component: {text: "#" + message.mentions.channels.get(match[1])?.name, color: BLURPLE}})),
        [...message.content.matchAll(/<@!?(\d{17,19})>/g)].map(match => {
            const user = message.mentions.users.get(match[1]);
            return {
                match, 
                component: {
                    text: "@" + user.username, color: BLURPLE,
                    hoverEvent: {
                        action: "show_text",
                        contents: user.tag
                    }
                }
            }
        }),
        [...message.content.matchAll(/<@&(\d{17,19})>/g)].map(match => {
            const role = message.mentions.roles.get(match[1]);
            return {match, component: {text: "@" + role?.name, color: role?.hexColor}};
        }),
        [...message.content.matchAll(/<:(.+):\d{17,19}>/g)].map(match => ({match, component: {text: ":" + match[1] + ":"}}))
    ].flat();

    const components = [];
    let index = 0;
    for(const section of replacedSections.sort((a, b) => a.match.index - b.match.index)) {
        components.push(message.content.slice(index, section.match.index), section.component);
        index = section.match.index + section.match[0].length; 
    }
    components.push(message.content.slice(index, message.content.length));

    return [
        "", // prevent inheritance
        {
            text: `[${message.author.username}]`,
            color: message.member.displayHexColor,
            hoverEvent: {
                action: "show_text",
                contents: message.author.tag
            }
        },
        " ",
        ...components
    ]

};

bot.on("messageCreate", async message => {
   
    if(message.author.bot) return;
    
    const server = config.servers.find(server => server.channelId == message.channelId);

    if(server) {
        fetch(server.broadcastEndpoint, {
            method: "POST",
            headers: {
                "Authorization": `Basic ${Buffer.from(`${server.clientId}:${server.key}`).toString("base64")}`,
                "Content-Type": "application/json"
            },
            body: JSON.stringify(formatMessage(message))
        }).catch(console.error);
    }

});

bot.on("ready", () => {
    console.log("Logged in as " + bot.user.tag);
    for(const server of config.servers) {
        server.channel = bot.channels.cache.get(server.channelId);
    }
});

bot.login(config.botToken);