# minelink
 
MineLink is a Discord bot that enables communication between your Discord server and your Minecraft server.

# Setup

**Server Setup**
* Install [MCWebSocket](https://github.com/adrian154/MCWebSocketPlugin) on the Minecraft server. Create an access key for Minelink using `/mcws-addclient`.

**Bot Setup**
* Install `node` on the server which will host the bot along with `npm`.
* Clone this repository and run `npm install`.
* Configure the bot. See the section on configuration.
* You are now ready to run the bot with `node index.js`.

If you want to use run this bot with Docker, you can use the publicly available image at [adrian154/minelink](https://hub.docker.com/repository/docker/adrian154/minelink). Mount the configuration file as `/app/config.json`.

# Configuration

TODO
