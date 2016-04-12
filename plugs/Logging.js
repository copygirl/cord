"use strict";

let Plug = require("./Plug");

let { extend, entries } = require("../utility");


/* Example configuration:
  "Logging": {
    format: "[$socket] $message",
    names: {
      esper:    "Esper    IRC",
      freenode: "freenode IRC",
      discord:  "     Discord"
    }
  } */

let defaults = {
  format: "($time) [$socket] $message",
  names: { }
};


// TODO: Support logging to file.
// TODO: Support black/whitelisting of channels.

module.exports = class Logging extends Plug {
  
  constructor(cord, config) {
    super(cord, extend({ }, defaults, config));
    this.nameMap = new Map();
  }
  
  activate() {
    for (let [ name, socket ] of entries(this.cord.sockets))
      this.nameMap.set(socket, (this.config.names[name] || name));
    
    this.cord.on("connected",    (socket)         => this.log(socket, "Connected!"));
    this.cord.on("disconnected", (socket, reason) => this.log(socket, `Disconnected: ${ reason }`));
    this.cord.on("message",      (message)        => this.log(message.socket, message.toString()));
  }
  
  log(socket, message, time = message.time || new Date()) {
    console.log(this.config.format
      .replace("$time", time.toISOString().substr(11, 5))
      .replace("$socket", this.nameMap.get(socket))
      .replace("$message", message));
  }
  
};
