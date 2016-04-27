"use strict";

let { Client } = require("discord.js");
let Socket     = require("./Socket");

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
    if ((auth.token == null) && ((auth.email == null) || (auth.password == null)))
      throw new Error(`${ id }: token or email and password required`);
    
    this.token    = auth.token;
    this.email    = auth.email;
    this.password = auth.password;
    
    this._discord  = new Client();
    this._users    = new Map();
    this._channels = new Map();
    
    this._discord.on("ready", () => {
      this.emit("connected", this._getUser(this._discord.user, true));
      
      // Create user and channel objects.
      for (let user of this._discord.users)
        this._getUser(user, true);
      for (let channel of this._discord.channels)
        this._getChannel(channel, true);
    });
    
    // User events.
    this._discord.on("serverNewMember", (server, user) =>
      this._getUser(user, true));
    this._discord.on("serverMemberRemoved", (server, user) => {
      if (this._discord.users.has("id", user.id)) return;
      user = this._getUser(user);
      this._users.delete(user._id);
      user.emit("removed");
    });
    this._discord.on("presence", (oldUser, newUser) => {
      let user = this._getUser(newUser);
      if (oldUser.name != newUser.name) {
        let resolves = user.resolveStrings;
        user._name = newUser.name;
        user.emit("renamed", oldUser.name, newUser.name, resolves);
      }
    });
    
    // Channel events.
    this._discord.on("channelCreated", (channel) =>
      this._getChannel(channel, true));
    this._discord.on("channelDeleted", (channel) => {
      channel = this._getChannel(channel);
      this._channels.delete(channel._id);
      channel.emit("removed");
    });
    this._discord.on("channelUpdated", (oldChannel, newChannel) => {
      let channel = this._getChannel(newChannel);
      if (oldChannel.name != newChannel.name) {
        let resolves = channel.resolveStrings;
        channel._name = newChannel.name;
        channel.emit("renamed", oldChannel.name, newChannel.name, resolves);
      }
    });
    
    // TODO: Handle joining / leaving servers.
    
    this._discord.on("message", (msg) => this._message(msg));
    
    this._discord.on("disconnected", () => {
      for (let user of this._users.values()) user.emit("removed");
      for (let channel of this._channels.values()) channel.emit("removed");
      this._users.clear();
      this._channels.clear();
      
      // Clean up Discord.js' internal state.
      // This is needed to reconnect properly.
      this._discord.internal.setup();
      
      this.emit("disconnected", ((this.isConnected)
        ? "Disconnected" : "Unable to connect / login"));
    });
  }
  
  
  _getUser(id, create = false) {
    if (typeof id != "string") id = id.id;
    let user = this._users.get(id);
    if ((user == null) && create) {
      this._users.set(id, (user = new DiscordSocket.User(this, id)));
      this.emit("newUser", user);
    }
    return user;
  }
  
  _getChannel(id, create = false) {
    if (typeof id != "string") id = id.id;
    let channel = this._channels.get(id);
    if ((channel == null) && create) {
      this._channels.set(id, (channel = new DiscordSocket.Channel(this, id)));
      this.emit("newChannel", channel);
    }
    return channel;
  }
  
  
  _message(discordMsg, sent = false) {
    
    // Skip incoming messages that were send by the bot's account.
    if (!sent && (discordMsg.author == this._discord.user)) return;
    
    let time   = new Date(discordMsg.timestamp);
    let sender = this._getUser(discordMsg.author, true);
    let target = this._getChannel(discordMsg.channel, true);
    let parts  = [ discordMsg.content ];
    
    let message = new Socket.Message(this, time, target, sender, parts)
      // Turn action-like messages into Socket.Action messages.
      .augment(/^_([^_]*)_$/, (_, text) => [ Socket.Action, text ])
      // Turn discord mentions into their Socket equivalents.
      .augment(/<(#|@)(\d{17,18})>/, (_, type, id) => {
        let lookup = ((type == '#') ? "_getChannel" : "_getUser");
        let thing = this[lookup](id);
        return ((thing != null) ? thing.mention : null);
      })
      // Turn newlines into the Socket equivalent.
      .augment(/\n/, Socket.NewLine);
    
    for (let attachment of discordMsg.attachments)
      message.parts.push(" ", new Socket.Attachment(attachment.filename, attachment.url));
    
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
  
  
  connect() {
    return ((this.token != null)
      ? this._discord.loginWithToken(this.token, this.email, this.password)
      : this._discord.login(this.email, this.password));
  }
  
  disconnect(reason) {
    return this._discord.logout();
  }
  
  type(resolveStr) {
    // TODO: Allow resolving @username for mentions.
    let result = /^(?:(?:(\d{17,18})\/)?#([^\d].+)|#(\d{17,18})|@(\d{17,18}))$/.exec(resolveStr);
    return ((result != null) ? ((result[4] != null) ? "user" : "channel")
                             : null);
  }
  
  toString() { return `Discord`; }
  
};

DiscordSocket.User = class DiscordUser extends Socket.User {
  
  constructor(socket, id) {
    super(socket);
    this._id = id;
    this._name = this._discordUser.username;
  }
  
  get _discordUser() { return this.socket._discord.users.get("id", this._id); }
  get _discordMention() { return `<@${ this._id }>`; }
  
  get name() { return this._name; }
  get mentionStr() { return `@${ this._name }`; }
  get resolveStrings() { return [ `@${ this._id }` ]; }
  
};

DiscordSocket.Channel = class DiscordChannel extends Socket.Channel {
  
  constructor(socket, id) {
    super(socket);
    this._id   = id;
    this._name = this._discordChannel.name;
  }
  
  get _discordChannel() { return this.socket._discord.channels.get("id", this._id); }
  get _discordMention() { return `<#${ this._id }>`; }
  
  get name() { return `#${ this._name }`; }
  get resolveStrings() { return [ `#${ this._id }`, `#${ this._name }`,
                                  `${ this._discordChannel.server.id }/#${ this._name }` ]; }
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
      [ /([@#]).+/, (part, type) => {
        switch (type) {
          case '@':
            for (let user of this.socket._discord.users)
              part = part.replace(`@${ user.username }`, user.mention());
            break;
          case '#':
            for (let channel of this.socket._discord.channels)
              part = part.replace(`#${ channel.name }`, channel.mention());
            break;
        }
        return part;
      } ],
      // Get dem newlines in here!
      [ Socket.NewLine, "\n" ],
      // If there's an Action identifier, format the message afterwards.
      [ Socket.Action, () => (isAction = true, null) ],
      // User/channel objects should be bold.
      [ Socket.Resolveable, (part) => [ "**", part, "**" ] ],
      // If a discord user/channel is being mentioned, transform it to a proper mention.
      // For any other mention, add more boldness!
      [ Socket.Mention, (part) => ((part.mentionable._discordMention)
        ? part.mentionable._discordMention : [ "**", part, "**" ]) ]
    ).join("");
    if (isAction) content = `_${ content }_`;
    
    let promise = this.socket._discord.sendMessage(this._discordChannel, content);
    if (!silent) promise.then((message) => this.socket._message(message, true));
    // TODO: Do something about failed messages?
  }
  
};
