const fetch = require("node-fetch"),
      crypto = require("crypto"),
      sharp = require("sharp"),
      fs = require("fs");

const config = require("./config.json");

if(!fs.existsSync("avatars")) {
    fs.mkdirSync("avatars");
}

const knownAvatars = {};

const refreshAvatar = async uuid => {
    const resp = await fetch(`https://sessionserver.mojang.com/session/minecraft/profile/${uuid}`)
    if(resp.ok) {
        
        // get skin
        const profile = await resp.json();
        const skins = JSON.parse(Buffer.from(profile.properties.find(property => property.name === "textures").value, "base64"));
        const skin = sharp(await (await fetch(skins.textures.SKIN.url)).buffer());
        
        // extract avatar
        const overlay = await skin.extract({left: 40, top: 8, width: 8, height: 8}).png().toBuffer();
        const smallAvatar = await skin.extract({left: 8, top: 8, width: 8, height: 8}).composite([{input: overlay}]).png().toBuffer();
        const avatar = await sharp(smallAvatar).resize(256, 256, {kernel: sharp.kernel.nearest}).png().toBuffer();

        // cache-busting!!
        const hash = crypto.createHash("md5").update(avatar).digest("hex");
        const fileName = `avatars/${hash}.png`;
        fs.writeFileSync(fileName, avatar);

        // remember the avatar
        knownAvatars[uuid] = new URL(fileName, config.baseURL).href;

    }
};

module.exports = {
    getAvatarURL: async uuid => {
        if(!knownAvatars[uuid]) {
            await refreshAvatar(uuid);
        }
        return knownAvatars[uuid];
    },
    refreshAvatar
};