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
  
  debug(...parts) {
    if (this.config.debug)
      console.log(`[DEBUG|${ this.constructor.name }]`, ...parts);
  }
  
};
