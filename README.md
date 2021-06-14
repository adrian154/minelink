# minelink
 
MineLink is a Discord bot that enables communication between your Discord server and your Minecraft server.

# Setup

I made Minelink for use with my own server, so it's pretty unwieldy. Some determination is necessary to complete setup.

**Server Setup**
* Install [MCWebSocket](https://github.com/adrian154/MCWebSocketPlugin) on the Minecraft server. Create an access key for Minelink using `/mcws-addclient`.
    * Pick any client ID, though a descriptive one like "minelink" is suggested.
    * You'll need to configure the client ID and the generated secret in `config.json` when setting up the bot. 
    
**Bot Setup**
* Install `node` on the server which will host the bot along with `npm`.
* Clone this repository and run `npm install`.
* Configure the bot. See the section on configuration.
    * The bot runs an internal webserver to serve player avatar images. The bot needs to be publicly accessible from the web somehow.
    * By default, as long as the bot is accessible under the configured `hostname` field, things should be fine.
    * For HTTPS support, you will need to use a reverse proxy like nginx. 
* You are now ready to run the bot with `node index.js`.

**Final Steps**
* Use `-bindchannel <chanenltype>` to associate channels on your Discord server with various updates.
    * `mc`: Minecraft chat will be sent to the channel, and messages in the channel will be broaddcast on the Minecraft server.
    * `console`: Console messages will be sent to the channel, and commands in the channel will be run on the Minecraft server.
        * **Make sure you manage access to this channel.** Anyone who can send messages here can run commands on the Minecraft server as well as see players' IP addresses.
    * `status`: Messages indicating when the server starts/shuts down will be sent here.  

If you want to use run this bot with Docker, you can use the publicly available image at [adrian154/minelink](https://hub.docker.com/repository/docker/adrian154/minelink) on Docker Hub. Mount the configuration file as `/app/config.json`.

# Configuration

`config.json` stores the settings for the bot in JSON.

* **File**
    * `mcws`:
        * `host`: (String) the hostname of the Minecraft server with the MCWS port, e.g. `myserver.com:1738`.
        * `clientID`: (String) the client ID used to connect, see setup
        * `secret`: (String) the generated secret used to connect, see setup
    * `discord`
        * `token`: (String) the Discord bot token that will be used to connect
    * `port`: (Number) the port that the internal web server will listen on
    * `hostname`: (String) the hostname of the bot server
    * `webhookURL`: (String) the URL to push chat updates to
