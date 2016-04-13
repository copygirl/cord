"use strict";

let Plug = require("./Plug");

let { extend } = require("../utility");


let defaults = {
  initial: 1,   // Starting delay in seconds.
  factor: 2,    // After a failed reconnection attempt, multiply current delay by this factor.
  maximum: 64,  // Maximum delay between reconnection attempts in seconds.
  retries: null // Maximum number of retries after giving up completely (null = retry FOREVER!!).
};


module.exports = class Respawn extends Plug {
  
  constructor(cord, config) {
    super(cord, extend({ }, defaults, config));
  }
  
  activate() {
    this.cord.on("disconnected", (socket) => {
      if (socket.reconnecting) return;
      this.reconnect(socket);
    });
  }
  
  reconnect(socket, delay = this.config.initial, attempt = 1) {
    socket.reconnecting = true;
    
    if ((this.config.retries != null) && (attempt > this.config.retries))
      return this.log(`Gave up reconnecting to ${ socket } after ${ attempt } attempts.`);
    
    let s = Math.round(delay);
    this.log(`Reconnecting in ${ s } second${ ((s == 1) ? "" : "s") }...`)
    
    setTimeout(() => {
      delay = Math.min(delay * this.config.factor, this.config.maximum);
      socket.connect().then(
          () => { socket.reconnecting = false; },
          (reason) => this.reconnect(socket, delay, attempt + 1)
        );
    }, delay * 1000);
  }
  
};
