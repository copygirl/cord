"use strict";

let { Client, ChannelType, GatewayIntentBits } = require("discord.js");
let Socket = require("./Socket");

let { extend } = require("../utility");


let defaults = {
  // To authenticate, either just the token,
  // or both email and password, is required.
  token: null,
  email: null,
  password: null
};


let DiscordSocket = module.exports = class DiscordSocket extends Socket {
  
  constructor(cord, id, auth) {
    super(cord, id, auth);
    auth = extend({ }, defaults, auth);
    if (auth.token == null)
      throw new Error(`${ id }: token required`);
    
    this.token = auth.token;
    
    this._discord = new Client({
      intents: [
        GatewayIntentBits.Guilds,
        GatewayIntentBits.GuildMembers,
        GatewayIntentBits.GuildMessages,
        GatewayIntentBits.MessageContent
      ]
    });
    this._users    = new Map();
    this._channels = new Map();
    
    // User events.
    this._discord.on("guildMemberAdd", (member) =>
      this._getUser(member.user));
    this._discord.on("guildMemberRemove", (member) => {
      let user = this._getUser(member.id);
      this._users.delete(member.id);
      user.emit("removed");
    });
    this._discord.on("userUpdate", (oldUser, newUser) => {
      let user = this._getUser(newUser.id);
      if (user == null) return;
      user._discordUser = newUser;
      if (oldUser.name != newUser.name)
        user.emit("renamed", oldUser.name, newUser.name, user.resolveStrings);
    });
    
    // Channel events.
    this._discord.on("channelCreate", (discordChannel) =>
      this._getChannel(discordChannel));
    this._discord.on("channelDelete", (discordChannel) => {
      let channel = this._getChannel(discordChannel.id);
      this._channels.delete(discordChannel.id);
      channel.emit("removed");
    });
    this._discord.on("channelUpdate", (oldChannel, newChannel) => {
      let channel = this._getChannel(newChannel.id);
      if (channel == null) return;
      channel._discordChannel = newChannel;
      if (oldChannel.name != newChannel.name)
        channel.emit("renamed", oldChannel.name, newChannel.name, channel.resolveStrings);
    });
    
    // TODO: Handle joining / leaving guilds.
    
    this._discord.on("messageCreate", (msg) => this._message(msg));
    
    this._discord.on("shardDisconnect", (event, _shardId) => {
      for (let user of this._users.values()) user.emit("removed");
      for (let channel of this._channels.values()) channel.emit("removed");
      this._users.clear();
      this._channels.clear();
      
      // Clean up Discord.js' internal state.
      // This is needed to reconnect properly.
      //this._discord.internal.setup();
      
      let message = ((this.isConnected) ? "Disconnected" : "Unable to connect / login");
      this.emit("disconnected", `${ message } (${ event.code }: ${ event.reason })`);
    });
  }
  
  
  _getUser(id) {
    let discordUser = null;
    if (typeof id != "string") {
      discordUser = id;
      id = discordUser.id;
    }

    let user = this._users.get(id);
    if (user != null) return user; // Already cached.
    if (discordUser == null) return null;
    
    user = new DiscordSocket.User(this, discordUser);
    this._users.set(id, user);
    this.emit("newUser", user);
    return user;
  }
  
  _getChannel(id) {
    let discordChannel = null;
    if (typeof id != "string") {
      discordChannel = id;
      id = discordChannel.id;
    }

    let channel = this._channels.get(id);
    if (channel != null) return channel; // Already cached.

    // Currently doesn't support non-text channels.
    // So no DM or group DM channels, either :(
    if (discordChannel?.type != ChannelType.GuildText) return null;
    
    channel = new DiscordSocket.Channel(this, discordChannel);
    this._channels.set(id, channel);
    this.emit("newChannel", channel);
    return channel;
  }
  
  
  _message(discordMsg, sent = false) {
    
    // Skip incoming messages that were send by the bot's account.
    if (!sent && (discordMsg.author == this._discord.user)) return;

    let target = this._getChannel(discordMsg.channel, true);
    // If no channel could be created, which for example happens
    // for PM channels, get out now before it's too late!
    if (target == null) return;
    
    let sender = _overrideName(this._getUser(discordMsg.author, true), discordMsg.member);
    let parts  = [ discordMsg.content ];
    
    let message = new Socket.Message(this, discordMsg.createdAt, target, sender, parts)
      // Turn action-like messages into Socket.Action messages.
      .augment(/^_([^_]*)_$/, (_, text) => [ Socket.Action, text ])
      // Turn discord mentions into their Socket equivalents.
      .augment(/<(#|@!?)(\d{17,18})>/, (_, type, id) => {
        let lookup = ((type == '#') ? "_getChannel" : "_getUser");
        let thing = this[lookup](id);
        if (thing instanceof DiscordSocket.User)
          thing = _overrideName(thing, discordMsg.guild.members.cache.get(id));
        return ((thing != null) ? thing.mention : null);
      })
      // Turn newlines into the Socket equivalent.
      .augment(/\n/, Socket.NewLine);
    
    for (let [id, attachment] of discordMsg.attachments)
      message.parts.push(" ", new Socket.Attachment(attachment.filename, attachment.url));

    // Treating stickers like attachements
    for (let [id, sticker] of discordMsg.stickers)
      message.parts.push(" ", new Socket.Attachment(sticker.name, sticker.url))
    
    // TODO: Parse markdown formatting of messages.
    
    if (!sent) {
      this.emit("preMessage", message);
      if (message.abort) return;
    }
    
    this.emit("message", message);
    
  }
  
  _reduceSilentCount() {
    this._silentMessageCount--;
    if (this._silentMessageCount > 0) return;
    
    // Once all silent messages were received and
    // processed, deal with all the backed-up messages.
    for (let message of this._pendingMessages)
      this._message(message);
    this._pendingMessages.clear();
  }
  
  
  get users() { return this._users.values(); }
  
  get channels() { return this._channels.values(); }
  
  
  async connect() {
    await this._discord.login(this.token);
    this.emit("connected", this._getUser(this._discord.user, true));
    
    // Fetch channel and member objects of all connected guilds.
    for (let [name, guild] of this._discord.guilds.cache) {
      await guild.fetch();
      for (let [id, channel] of guild.channels.cache)
        this._getChannel(channel);
      for (let [id, member] of await guild.members.fetch())
        this._getUser(member.user);
    }
  }
  
  disconnect(reason) {
    throw new Error(`${ id }: Not supported`);
  }
  
  type(resolveStr) {
    let result = /^(?:(?:(\d{17,21})\/)?|#([^\d].+|\d{17,21})|@!?([^\d].+|\d{17,21}))$/.exec(resolveStr);
    return ((result != null) ? ((result[3] != null) ? "user" : "channel")
                             : null);
  }
  
  toString() { return `Discord`; }
  
};

DiscordSocket.User = class DiscordUser extends Socket.User {
  
  constructor(socket, discordUser) {
    super(socket);
    this._discordUser = discordUser;
  }
  
  get _id() { return this._discordUser.id; }
  get _discordMention() { return `<@${ this._id }>`; }
  
  get name() { return this._discordUser.username; }
  get mentionStr() { return `@${ this.name }`; }
  get resolveStrings() { return [ `@${ this._id }`, `@${ this.name }`, `@${ this.tag }` ]; }
  
};

DiscordSocket.Channel = class DiscordChannel extends Socket.Channel {
  
  constructor(socket, discordChannel) {
    super(socket);
    this._discordChannel = discordChannel;
  }
  
  get _id() { return this._discordChannel.id; }
  get _discordMention() { return `<#${ this._id }>`; }
  
  get name() { return `#${ this._discordChannel.name }`; }
  get resolveStrings() { return [ `#${ this._id }`, `${ this.name }`,
                                  `${ this._discordChannel.guild.id }/${ this.name }` ]; }
  get topic() { return (this._discordChannel.topic || null); }
  
  send(...parts) { this._send(parts, false); }
  sendSilent(...parts) { this._send(parts, true); }
  
  _send(parts, silent = false) {
    let message = new Socket.Message(this.socket, new Date(), this, this.socket.self, parts);
    
    if (!silent) {
      this.socket.emit("preMessage", message);
      if (message.abort) return;
    }
    
    let isAction = false;
    let content = message.augmentClone(
      // Replace @user and #channel mentions with their Discord equivalent.
      // ("(?<!\w)" makes sure the symbol is not preceeded by a word character.)
      [ /(?<!\w)([@#]).+/g, (match, type) => {
        switch (type) {
          case '@':
            for (let [id, member] of this._discordChannel.guild.members.cache) {
              let name = _sanitizeMemberDisplayName(member);
              // Ensure the matched string starts with this user's display name.
              if (!match.startsWith(name, 1)) continue;
              // Ensure the display name isn't followed by a word character.
              if (match.slice(name.length + 1).match(/^[\w]/)) continue;
              let mention = new Socket.Mention(this.socket._getUser(id));
              return [ mention, match.slice(name.length + 1) ];
            }
            break;
          case '#':
            for (let channel of this.socket.channels) {
              let name = channel.name;
              if (!match.startsWith(name)) continue;
              if (match.slice(name.length).match(/^[\w]/)) continue;
              let mention = new Socket.Mention(channel);
              return [ mention, match.slice(name.length) ];
            }
            break;
        }
        return false;
      } ],
      // Get dem newlines in here!
      [ Socket.NewLine, "\n" ],
      // If there's an Action identifier, format the message afterwards.
      [ Socket.Action, () => (isAction = true, null) ],
      // User/channel objects should be bold.
      [ Socket.Resolveable, (part) => [ "**", part, "**" ] ],
      // If a discord user/channel is being mentioned, transform it to a proper mention.
      // For any other mention, add more boldness!
      [ Socket.Mention, (part) => (("_discordMention" in part.mentionable)
        ? part.mentionable._discordMention : [ "**", part, "**" ]) ]
    ).join("");
    if (isAction) content = `_${ content }_`;
    
    let promise = this._discordChannel.send(content);
    if (!silent) promise.then((message) => this.socket._message(message, true));
    // TODO: Do something about failed messages?
  }
  
};

// Use a bit of a dirty hack to change the apparent name of a user (unique across
// all of Discord) to the member's display name (unique per Discord community).
// This also replaces spaces with underscores for better IRC support.
function _overrideName(user, member) {
  let displayName = _sanitizeMemberDisplayName(member);
  return Object.create(user, { name: { value: displayName } });
}

function _sanitizeMemberDisplayName(member) {
  return member.displayName.replaceAll(/\s+/g, "_");
}
