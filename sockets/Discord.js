"use strict";

let { Client } = require("discord.js");
let Socket     = require("./Socket");

let { map, filter, any, join } = require("../utility");


let DiscordSocket = module.exports = class DiscordSocket extends Socket {
  
  constructor(id, auth) {
    super(id, auth);
    this.token    = auth.token;
    this.email    = auth.email;
    this.password = auth.password;
    
    this._discord  = new Client();
    this._users    = new Map();
    this._channels = new Map();
    
    this._pendingMessages    = [ ];
    this._missingSilentMsgs  = new Set();
    this._silentMessageCount = 0;
    
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
      this._users.clear();
      this._channels.clear();
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
  
  
  _message(message, silent = false) {
    
    // Since the discord message event and the sendMessage promise resolve happen at completely
    // different times (probably due to the former going over websockets and the latter being the
    // result of an API call), we don't know whether an incoming message is supposed to be silent
    // or not until the promise does resolve (see DiscordSocket.Channel.sendSilent).
    
    // To fix this, whenever there are silent messages that have been sent but not yet resolved,
    // any regular message coming through will get added to a buffer. When a silent message is
    // received, it is removed from the buffer to make sure it doesn't fire a message event. Once
    // all silent messages have been received, all buffered messages will be "released".
    
    if (silent) {
      if (this._pendingMessages.delete(message) == 0)
        // If we didn't receive the message though
        // the message event yet, keep track of it.
        this._missingSilentMsgs.add(message.id);
      
      this._reduceSilentCount();
      return;
    }
    // We found one of those missing silent messages! Let's make sure
    // it doesn't fire a message event just because it's a little late.
    else if (this._missingSilentMsgs.delete(message.id))
      return;
    
    // If there's silent messages that we're currently
    // waiting for, add incoming messages to a buffer.
    else if (this._silentMessageCount > 0) {
      this._pendingMessages.push(message);
      return;
    }
    
    let time   = new Date(message.timestamp);
    let sender = this._getUser(message.author, true);
    let target = this._getChannel(message.channel, true);
    let parts  = [ message.content ];
    
    // TODO: Split up message into text, mentions, newlines and attachments.
    // TODO: Detect action-style messages.
    // TODO: Parse markdown formatting of messages.
    
    message = new Socket.Message(this, time, target, sender, parts);
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
    let result = /^(?:(?:(\d{18})\/)?#([^\d].+)|#(\d{18})|@(\d{18}))$/.exec(resolveStr);
    return ((result != null) ? ((result[4] != null) ? "user" : "channel")
                             : null);
  }
  
  toString() { return `Discord (${ this.email })`; }
  
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
  
  _send(parts, silent) {
    let isAction = false;
    let content = join(map(parts, (part) =>
        // Get dem newlines in here!
        (part == Socket.NewLine) ? "\n" :
        // If there's an Action identifier, format the message afterwards.
        (part == Socket.Action) ? (isAction = true, "") :
        // If a discord user/channel is being mentioned, transform it to a proper mention.
        ((part instanceof Socket.Mention) && part.mentionable._discordMention) ? part._discordMention :
        // Otherwise just toString the part.
        part
      ), "");
    if (isAction) content = `_${ content }_`;
    
    let promise = this.socket._discord.sendMessage(this._discordChannel, content);
    
    if (silent) {
      this.socket._silentMessageCount++;
      promise.then((message) => this.socket._message(message, true),
                   (error)   => this.socket._reduceSilentMessage());
      // TODO: Do something with failed messages?
    }
  }
  
};