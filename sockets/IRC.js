"use strict";

let { Client } = require("irc");
let Socket     = require("./Socket");

let { extend, map, join } = require("../utility");


let defaults = {
  server: null,     // [REQUIRED] Address of the server, for example "irc.esper.net".
  port: 6667,       //   Port of the server, defaults to 6667.
  serverName: null, //   Fancy disply name for the server, like "Esper.NET".
  channels: [ ],    //   Default channels to join once connected.
  
  nick: null,     // [REQUIRED] Preferred nick to use.
  password: null, //   Password used to identify with NickServ.
  userName: null, //   User name, defaults to nick.
  realName: null  //   Real name, defaults to nick.
};

let ircOptions = {
  autoConnect: false,
  floodProtection: true,
  stripColors: true
};

// TODO: Add other valid channel identifiers.
let channelChars = new Set([ '#' ]);


let IRCSocket = module.exports = class IRCSocket extends Socket {
  
  constructor(id, auth) {
    super(id, auth);
    if (auth.server == null) throw new Error(`${ id }: server required`);
    if (auth.nick == null) throw new Error(`${ id }: nick required`);
    if (auth.channels.length == 0) this.warn("No channels specified");
    
    this.name = auth.serverName || auth.server;
    auth = extend({ }, defaults, auth, ircOptions);
    if (auth.userName == null) auth.userName = auth.nick;
    if (auth.realName == null) auth.realName = auth.nick;
    
    this._users    = new Map();
    this._channels = new Map();
    
    this._irc = new Client(null, null, auth);
    
    this._irc.on("motd", (motd) => { this.motd = motd; });
    
    this._irc.on("registered", () => {
      this.emit("connected", this._getUser(this._irc.nick, true)); });
    
    this._irc.on("names", (channel, nicks) => {
      channel = this._getChannel(channel, true);
      for (let nick in nicks)
        this._join(channel, nick);
    });
    this._irc.on("topic", (channel, topic) => {
      channel = this._getChannel(channel, true)
      channel._topic = topic;
    });
    
    this._irc.on("join", (channel, nick) => {
      this._join(channel, nick); });
    
    this._irc.on("part", (channel, nick, reason) => {
      this._leave(channel, nick, `Left: ${ reason }`); });
    this._irc.on("kick", (channel, nick, by, reason) => {
      this._leave(channel, nick, `Kicked by ${ by }: ${ reason }`); });
    
    this._irc.on("quit", (nick, reason) => {
      this._quit(nick, `Quit: ${ reason }`); });
    this._irc.on("kill", (nick, reason) => {
      this._quit(nick, `Killed: ${ reason }`); });
    
    this._irc.on("message", (from, to, text) => {
      this._message(from, to, [ text ]); });
    this._irc.on("action", (from, to, text) => {
      this._message(from, to, [ Socket.Action, text ]); });
    this._irc.on("notice", (from, to, text) => {
      this._message(from, to, [ IRCSocket.Notice, text ]); });
    
    this._irc.on("nick", (oldName, newName) => {
      let user = this._getUser(oldName);
      let resolves = user.resolveStrings;
      user._name = newName;
      this._users.delete(oldName.toLowerCase());
      this._users.set(newName.toLowerCase(), user);
      user.emit("renamed", oldName, newName, resolves);
    });
    
    this._irc.on("abort", (retries) => {
      this.emit("disconnected", `Aborted after ${ retries } retries`); });
    
    this.on("disconnected", () => {
      this._users.clear();
      this._channels.clear();
    });
  }
  
  
  _getUser(name, create = false) {
    let key = name.toLowerCase();
    let user = this._users.get(key);
    if ((user == null) && create) {
      this._users.set(key, (user = new IRCSocket.User(this, name)));
      this.emit("newUser", user);
    }
    return user;
  }
  
  _getChannel(name, create = false) {
    let key = name.toLowerCase();
    let channel = this._channels.get(key);
    if ((channel == null) && create) {
      this._channels.set(key, (channel = new IRCSocket.Channel(this, name)));
      this.emit("newChannel", channel);
    }
    return channel;
  }
  
  _join(channel, user) {
    if (typeof channel == "string") channel = this._getChannel(channel, true);
    if (typeof user == "string") user = this._getUser(user, true);
    channel._users.add(user);
    user._channels.add(channel);
  }
  
  _leave(channel, user, reason) {
    if (typeof channel == "string") channel = this._getChannel(channel, true);
    if (typeof user == "string") user = this._getUser(user, true);
    channel._users.delete(user);
    user._channels.delete(channel);
    if (user.isSelf) {
      for (let otherUser of channel._users)
        this._leave(channel, otherUser, "Stopped watching");
      this._channels.delete(channel.name.toLowerCase());
      channel.emit("removed", channel);
    } else if (user._channels.size == 0) {
      this._users.delete(user.name.toLowerCase());
      user.emit("removed", user);
    }
  }
  
  _quit(user, reason) {
    if (typeof user == "string") user = this._getUser(user, true);
    for (let channel of user.channels)
      this._leave(channel, user, reason);
    if (user.isSelf)
      this.emit("disconnected", reason);
  }
  
  _message(from, to, parts) {
    // If from is undefined, the message is from the server
    if (from == null) return;
    // TODO: Handle server messages?
    //       this.self is null until logged in
    from = this._getUser(from, true);
    to   = this._getChannel(to) || this.self;
    // TODO: Private channels
    let message = new Socket.Message(this, new Date(), to, from, parts);
    this.emit("message", message);
  }
  
  
  get users() { return this._users.values(); }
  
  get channels() { return this._channels.values(); }
  
  
  connect() {
    return new Promise((resolve, reject) => {
      if (this.isConnected)
        throw new Error("Already connected");
        
      let onConnect, onDisconnect;
      onConnect    = (self)   => { this.removeListener("disconnected", onDisconnect); resolve(self); };
      onDisconnect = (reason) => { this.removeListener("connected",    onConnect); 
                                   reject(new Error("Disconnected trying to connect: " + reason)); };
      
      this.once("connected", onConnect);
      this.once("disconnected", onDisconnect);
      
      this._irc.connect();
      
      // _irc.conn is only set after .connect() is called.
      this._irc.conn.on("close", (err) => {
        if (this.isConnected) this.emit("disconnected", `Socket closed`); });
      this._irc.conn.on("error", (err) => {
        if (this.isConnected) this.emit("disconnected", `Socket error: ${ err }`); });
    });
  }
  
  disconnect(reason) {
    return new Promise((resolve, reject) => {
      if (!this.isConnected)
        throw new Error("Not connected");
      
      this.once("disconnected", resolve);
      this._irc.disconnect(reason);
    });
  }
  
  type(resolveStr) {
    // TODO: Do a more proper validation of channel/usernames.
    return (channelChars.has(resolveStr[0]) ? "channel" : "user");
  }
  
  toString() { return `IRC (${ this.name })`; }
  
};

IRCSocket.User = class IRCUser extends Socket.User {
  
  constructor(socket, name) {
    super(socket);
    this._name     = name;
    this._channels = new Set();
  }
  
  get name() { return this._name; }
  get resolveStrings() { return [ this._name ]; }
  get channels() { return this._channels; }
  
};

IRCSocket.Channel = class IRCChannel extends Socket.Channel {
  
  constructor(socket, name) {
    super(socket);
    this._name    = name;
    this._topic   = null;
    this._users   = new Set();
  }
  
  get name() { return this._name; }
  get resolveStrings() { return [ this._name ]; }
  get topic() { return this._topic; }
  get users() { return this._users; }
  
  send(...parts) { this._send(parts, true); }
  sendSilent(...parts) { this._send(parts, false); }
  
  _send(parts, fireEvent) {
    let message = new Socket.Message(this.socket, new Date(), this, this.socket.self, parts);
    let isAction = false;
    let content = join(map(parts, (part) =>
        ((part === Socket.Action) ? (isAction = true, "") : part)
      ), "");
    let func = (isAction ? "action" : "say");
    this.socket._irc[func](this.name, content);
    if (fireEvent) this.socket.emit("message", message);
  }
  
};

IRCSocket.Notice = { toString() { return "(notice) "; } };
