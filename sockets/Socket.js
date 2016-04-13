"use strict";

let { EventEmitter } = require("events");

let { implement, map, prepend, join } = require("../utility");


/** The Socket class defines a common interface for connections.
 *  Each socket represents a service / server such as IRC / Discord. */
let Socket = module.exports = implement(class Socket {
  
  constructor(id, auth) {
    EventEmitter.call(this);
    this.id   = id;
    this.self = null;
    
    this._resolver = new Socket.Resolver(this);
    
    this.on("connected",    (self)   => { this.self = self; });
    this.on("disconnected", (reason) => { this.self = null; });
    
    this.on("message", (message) => {
      if (message.target instanceof Socket.Channel)
        message.target.emit("message", message);
      if (message.sender instanceof Socket.User)
        message.sender.emit("message", message);
    });
  }
  
  /** Returns an iterable of known users. */
  get isConnected() { return (this.self != null); }
  /** Returns an iterable of known users. */
  get users() { throw new Error("Not implemented"); }
  /** Returns an iterable of known channels. */
  get channels() { throw new Error("Not implemented"); }
  
  /** Connects the socket, returning a promise. */
  connect() { throw new Error("Not implemented"); }
  /** Disconnects the socket, returning a promise. */
  disconnect(reason) { throw new Error("Not implemented"); }
  
  /** Prints a warning message to the console. */
  warn(message) { console.log(`[WARN|${ this.id }] ${ message }`) }
  
  /** Returns a string depending on the expected type of the resolve string.
   *  That is, "user", "channel" or null for an invalid resolve string. */
  type(resolveStr) { throw new Error("Not implemented"); }
  
  /** Resolves the given string into a user or channel object.
   *  Returns [ type, matches ]:
   *  type    - "user", "channel" or null for an invalid resolve string.
   *  matches - An array of user or channel objects that matched the resolve string. */
  resolve(resolveStr) { return [ this.type(resolveStr), this._resolver.resolve(resolveStr) ]; }
  
  // on("connected",    (self)   => ...)
  // on("disconnected", (reason) => ...)
  
  // on("newUser",    (user)    => ...)
  // on("newChannel", (channel) => ...)
  
  // on("message", (message) => ...)
  
  toString() { throw new Error("Not implemented"); }
  
}, EventEmitter);

let Resolveable = implement(class Resolveable {
  
  constructor(socket) {
    EventEmitter.call(this);
    this.socket = socket;
  }
  
  /** Returns a string representation of this resolveable's name. */
  get name() { throw new Error("Not implemented"); }
  /** Returns a mention object for this resolveable. */
  get mention() { return new Socket.Mention(this); }
  /** Returns a string that should be used when mentioning this resolveable in any socket. */
  get mentionStr() { return this.name; }
  /** Returns an array of strings that would match this resolveable. */
  get resolveStrings() { throw new Error("Not implemented"); }
  
  // on("message", (message) => ...)
  // on("renamed", (oldName, newName, oldResolves) => ...)
  // on("removed", () => ...)
  
  toString() { return this.name; }
  
}, EventEmitter);

Socket.User = class User extends Resolveable {
  
  constructor(socket) { super(socket); }
  
  /** Returns if this user is the own user. */
  get isSelf() { return (this == this.socket.self); }
  /** Returns if the user is known to be online. */
  get isOnline() { throw new Error("Not implemented"); }
  
};

Socket.Channel = class Channel extends Resolveable {
  
  constructor(socket) { super(socket); }
  
  /** Returns a string containing the channel's "message of the day". */
  get topic() { throw new Error("Not implemented"); }
  /** Returns an iterable of users currently in this channel. */
  get users() { throw new Error("Not implemented"); }
  
  /** Sends a message made of the specified parts to the channel. */
  send(...parts) { throw new Error("Not implemented"); }
  /** Sends a silent message, much like send(), which won't fire a "message" event. */
  sendSilent(...parts) { throw new Error("Not implemented"); }
  
};

Socket.PrivateChannel = class PrivateChannel extends Socket.Channel {
  
  constructor(socket, user) {
    super(socket);
    this.user = user;
  }
  
  get name() { return "@" + this.user.name; }
  
};

Socket.Message = class Message {
  
  /** @param time A Date object from when the message was received / sent.
   *  @param sender An object (User in most cases) representing the sender.
   *  @param target An object (Channel in most cases) representing the message target.
   *  @param parts An array containing the parts (strings, users, channels,
   *               mentions, attachments, ...) that make up this message. */
  constructor(socket, time, target, sender, parts) {
    this.socket = socket;
    this.time   = time;
    this.target = target;
    this.sender = sender;
    this.parts  = parts;
  }
  
  /** Replies to the message, mentioning the user the message was from. */
  reply(...parts) {
    if (!(this.target instanceof Socket.Channel))
      throw new Error(`Can't send messages to non-channel '${ this.target }'`);
    if (this.target instanceof Socket.PrivateChannel)
      this.target.send(...parts);
    else if (this.sender instanceof Socket.User)
      this.target.send(...prepend(parts, this.sender.mention, ": "));
  }
  
  toString() {
    let isAction = false;
    let content = join(map(this.parts, part =>
      ((part == Socket.Action) ? (isAction = true, "") : part)), "");
    let sender = (isAction ? `* ${ this.sender }` : `<${ this.sender }>`);
    return `[${ this.target }] ${ sender } ${ content }`;
  }
  
};

Socket.Mention = class Mention {
  
  constructor(mentionable) { this.mentionable = mentionable; }
  
  /** Returns if the mention is to a user. */
  get isUser() { return (this.mentionable instanceof Socket.User); }
  /** Returns if the mention is to a channel. */
  get isChannel() { return (this.mentionable instanceof Socket.Channel); }
  
  toString() { return this.mentionable.mentionStr; }
  
};

Socket.Attachment = class Attachment {
  
  constructor(url) { this.url = url; }
  
  toString() { return this.url; }
  
};

Socket.Action = { toString() { return "(action) "; } };

Socket.NewLine = { toString() { return " "; } };


/** Utility class which keeps track of
 *  resolve strings for quick lookup. */
Socket.Resolver = class Resolver {
  
  constructor(service) {
    this.service = service;
    
    this._resolveCache = new Map();
    
    service.on("newUser",    (user)    => this._new(user));
    service.on("newChannel", (channel) => this._new(channel));
  }
  
  
  resolve(resolveStr) {
    return Array.from(this._resolveCache.get(resolveStr) || [ ]);
  }
  
  
  _add(map, key, value) {
    let set = map.getOrAdd(key, () => new Set());
    set.add(value);
  }
  _remove(map, key, value) {
    let set = map.get(key);
    if (set == null) return;
    set.delete(value);
    if (set.size == 0)
      map.delete(key);
  }
  
  _addThing(thing) {
    for (let resolve of thing.resolveStrings)
      this._add(this._resolveCache, resolve, thing);
  }
  _removeThing(thing, resolves = thing.resolveStrings) {
    for (let resolve of resolves)
      this._remove(this._resolveCache, resolve, thing);
  }
  
  _new(thing) {
    this._addThing(thing);
    thing.on("removed", () => this._removeThing(thing));
    thing.on("renamed", (oldName, newName, oldResolves) => {
      this._removeThing(thing, oldResolves);
      this._addThing(thing);
    });
  }
  
};
