"use strict";

let { EventEmitter } = require("events");

let { isClass, implement, Iterable } = require("../utility");


/** The Socket class defines a common interface for connections.
 *  Each socket represents a service / server such as IRC / Discord. */
let Socket = module.exports = implement(class Socket {
  
  constructor(cord, id, auth) {
    EventEmitter.call(this);
    this.cord = cord;
    this.id   = id;
    this.self = null;
    
    this._resolver = new Socket.Resolver(this);
    
    this.on("connected",    (self)   => { this.self = self; });
    this.on("disconnected", (reason) => { this.self = null; });
    
    // DRY - Don't repeat yourself!
    // Though, I *might* have taken this a *little* to far.
    let redirectMessageEvent = (event) =>
      this.on(event, (msg) => {
        if (msg.target instanceof Socket.Channel) msg.target.emit(event, msg);
        if (msg.sender instanceof Socket.User) msg.sender.emit(event, msg);
      });
    
    redirectMessageEvent("message");
    redirectMessageEvent("preMessage");
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
  
  /** Prints an information message to the console. */
  info(...args) { this.cord.log("info", this, ...args) }
  /** Prints a warning message to the console. */
  warn(...args) { this.cord.log("warn", this, ...args) }
  /** Prints an error message to the console. */
  error(...args) { this.cord.log("error", this, ...args) }
  
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
  
  // on("message",    (message) => ...)
  // on("preMessage", (message) => ...)
  
  toString() { throw new Error("Not implemented"); }
  
}, EventEmitter);

Socket.Resolveable = implement(class Resolveable {
  
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

Socket.User = class User extends Socket.Resolveable {
  
  constructor(socket) { super(socket); }
  
  /** Returns if this user is the own user. */
  get isSelf() { return (this == this.socket.self); }
  /** Returns if the user is known to be online. */
  get isOnline() { throw new Error("Not implemented"); }
  
};

Socket.Channel = class Channel extends Socket.Resolveable {
  
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
  
  /** Augments a message's parts into something more appropriate.
   *  For some example uses, check the Socket implementations' code,
   *  specifically the part where it receives and sends messages. */
  static augment(parts, test, action) {
    
    let testFunc;     // Function used to test if the part matches the test parameter.
    let after = null; // Function executed after the replace parameter has been applied.
                      // May return a number, which is the amount of parts to go back.
    
    // If the test parameter is a regex, match any string parts against it.
    // For example: /Trump/, "Drumpf"
    //              /<(.*)>/, (_, thing) => lookup(thing)
    if (test instanceof RegExp) {
      testFunc = (part) => ((typeof part == "string") && test.exec(part) || false);
      // Insert the text before and after the regex match into the replace array.
      after = (part, result, replace) => {
        let start = result.index;
        let end   = start + result[0].length;
        if (start > 0) replace.unshift(part.slice(0, start));
        if (end < part.length) replace.push(part.slice(end));
        
        let recheck = 0;
        // Recheck any additional strings at the end of the array.
        for (var i = replace.length - 1; (i > 0) && (typeof replace[i] == "string"); i++)
          recheck++;
        return recheck;
      };
    // If the test parameter is a class, do an instanceof test.
    // For example: Socket.User, (user) => [ "(", user.rank, ")", "<", user, ">" ]
    } else if (isClass(test))
      testFunc = (part) => (part instanceof test);
    // Lastly, if the test parameter is not a function, use equality checking.
    // For example: Socket.Action, (text) => [ "* ", text ]
    // Otherwise just use the function itself.
    else if (!(test instanceof Function))
      testFunc = (part) => (part === test);
    
    for (let i = 0; i < parts.length; i++) {
      let part = parts[i];
      
      let result = testFunc(part);
      if (result === false) continue;
      else if (result == null) result = [ ];
      else if (result === true) result = [ part ];
      else if (!(result instanceof Array)) result = [ result ];
      
      let replace = ((action instanceof Function) ? action(...result) : action);
      if (replace === false) {
        if ((test instanceof RegExp) && test.global) i--;
        continue;
      } else if (replace == null) replace = [ ];
      else if (!(replace instanceof Array)) replace = [ replace ];
      if ((test instanceof RegExp) && test.global) test.lastIndex = 0;
      
      let recheck = ((after != null) ? after(part, result, replace) : 0);
      parts.splice(i, 1, ...replace);
      i += replace.length - 1 - recheck;
    }
    
    return parts;
    
  }
  
  /** Augments a message's parts into something more appropriate.
   *  For some example uses, check the Socket implementations' code,
   *  specifically the part where it receives and sends messages. */
  augment(test, action) {
    Socket.Message.augment(this.parts, test, action);
    return this;
  }
  
  /** Augments a message's parts into something more appropriate.
   *  For some example uses, check the Socket implementations' code,
   *  specifically the part where it receives and sends messages.
   *  This method doesn't modify the message's parts. */
  augmentClone(...augments) {
    if (!(augments[0] instanceof Array))
      augments = [ augments ];
    
    let parts = this.parts.slice();
    for (let [ test, action ] of augments)
      Socket.Message.augment(parts, test, action);
    return parts;
  }
  
  /** Replies to the message, mentioning the user the message was from. */
  reply(...parts) {
    if (!(this.target instanceof Socket.Channel))
      throw new Error(`Can't send messages to non-channel '${ this.target }'`);
    if (this.target instanceof Socket.PrivateChannel)
      this.target.send(...parts);
    else if (this.sender instanceof Socket.User)
      this.target.send(this.sender.mention, ": ", ...parts);
  }
  
  toString(more = false) {
    let isAction = false;
    let content = Iterable.map(this.parts, (part) =>
      ((part == Socket.Action) ? (isAction = true, "") : part)).join("");
    let pre = (isAction ? `* ${ this.sender }` : `<${ this.sender }>`);
    if (more) {
      let time = this.time.toISOString().substr(11, 5);
      pre = `(${ time }) [${ this.target }] ${ pre }`
    }
    return `${ pre } ${ content }`;
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
  
  constructor(filename, url) {
    this.url      = url;
    this.filename = filename;
  }
  
  toString() { return this.url; }
  
};

Socket.Action = { toString() { return "(action) "; } };

Socket.NewLine = { toString() { return " "; } };


/** Utility class which keeps track of
 *  resolve strings for quick lookup. */
Socket.Resolver = class Resolver {
  
  constructor(socket) {
    this.socket = socket;
    
    this._resolveCache = new Map();
    
    socket.on("newUser",    (user)    => this._new(user));
    socket.on("newChannel", (channel) => this._new(channel));
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
