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
  
  log(...args) {
    console.log(`[INFO|${ this.constructor.name }]`, ...args); }
  warn(...args) {
    console.log(`[WARN|${ this.constructor.name }]`, ...args); }
  debug(...args) {
    if (this.config.debug)
      console.log(`[DEBUG|${ this.constructor.name }]`, ...args);
  }
  
};
