"use strict";

let Plug = require("./Plug");

let { extend, Iterable: { entries } } = require("../utility");


let defaults = {
  format: {
    general: "($time) ($source|$level)",
    message: "($time) [$source|$target]"
  },
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
    
    this.cord.on("connected",    (socket)         => this.log("info", socket, "Connected!"));
    this.cord.on("disconnected", (socket, reason) => this.log("info", socket, `Disconnected: ${ reason }`));
    this.cord.on("message",      (message)        => this.message(message));
    
    this.cord.log = this.log.bind(this);
  }
  
  log(level, source, ...args) {
    let func = ((level == "error") ? "error" : "log");
    console[func](
      this.config.format.general
        .replace("$time", (new Date()).toISOString().substr(11, 5))
        .replace("$source", this.nameMap.get(source) || source.constructor.name)
        .replace("$level", level.toUpperCase()),
      ...args);
  }
  
  message(message) {
    console.log(
      this.config.format.message
        .replace("$time", (new Date()).toISOString().substr(11, 5))
        .replace("$source", this.nameMap.get(message.socket))
        .replace("$target", message.target),
      message.toString());
  }
  
};
