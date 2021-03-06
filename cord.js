"use strict";

let auth   = require("./auth");
let config = require("./config");

let { EventEmitter } = require("events");

let { implement, Iterable: { values, entries } } = require("./utility");


let cord = module.exports = implement(class cord {
  
  constructor() {
    EventEmitter.call(this);
    this.config  = config;
    this.sockets = { };
    this.plugs   = { };
  }
  
  // on("connected",    (socket, self)   => ...)
  // on("disconnected", (socket, reason) => ...)
  
  // on("newUser",    (user)    => ...)
  // on("newChannel", (channel) => ...)
  
  // on("message", (message) => ...)
  //   Note that the message event fires for outgoing
  //   messages as well, unless sendSilent was used.
  // on("preMessage", (message) => ...)
  //   Fires before "message" (for both incoming and outgoing
  //   messages), allows for augmenting and outright dropping
  //   the message by setting message.abort to true.
  
  resolve(resolveStr) {
    let [ socketName, str ] = resolveStr.split(":", 2);
    let socket = this.sockets[socketName];
    return ((socket != null) ? socket.resolve(str) : null);
  }
  
  log(level, source, ...args) {
    let func = ((level == "error") ? "error" : "log");
    console[func](`[${ level }|${ source }]`, args);
  }
  
  run() {
    // Initialize sockets.
    for (let [ name, authData ] of entries(auth)) {
      if (authData.enabled === false) continue;
      let SocketClass = require("./sockets/" + authData.socket);
      let socket = new SocketClass(this, name, authData);
      this.sockets[name] = socket;
      
      socket.on("connected",    (self)   => this.emit("connected", socket, self));
      socket.on("disconnected", (reason) => this.emit("disconnected", socket, reason));
      
      socket.on("newUser",    (user) =>    this.emit("newUser", user));
      socket.on("newChannel", (channel) => this.emit("newChannel", channel));
      
      socket.on("message",    (message) => this.emit("message", message));
      socket.on("preMessage", (message) => this.emit("preMessage", message));
    }
    
    // Load plugins.
    for (let [ name, config ] of entries(this.config)) {
      if (config.enabled === false) continue;
      let PluginClass = require("./plugs/" + name);
      this.plugs[name] = new PluginClass(this, config);
    }

    // Activate plugins.
    for (let plug of values(this.plugs))
      plug.activate();

    // Connect to sockets.
    for (let socket of values(this.sockets))
      socket.connect();
  }
  
}, EventEmitter);

new cord().run();
