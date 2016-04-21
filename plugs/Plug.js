"use strict";

let { extend } = require("../utility");


let defaults = {
  enabled: true,
  debug: false
};


module.exports = class Plug {
  
  constructor(cord, config) {
    this.cord   = cord;
    this.config = extend({ }, defaults, config);
  }
  
  activate() { throw new Error("Not implemented"); }
  
  info(...args) { this.cord.log("info", this, ...args); }
  warn(...args) { this.cord.log("warn", this, ...args); }
  error(...args) { this.cord.log("error", this, ...args); }
  debug(...args) { if (this.config.debug) this.cord.log("debug", this, ...args); }
  
};
