"use strict";

let Plug   = require("./Plug");
let Socket = require("../sockets/Socket");

let { extend, entries, any, concat } = require("../utility");


let defaults = {
  ignore: [ ],
  bridges: { }
};

let bridgeDefaults = {
  enabled: true,
  channels: [ ],
  ignore: [ ]
};


let Bridge = module.exports = class Bridge extends Plug {
  
  constructor(cord, config) {
    super(cord, extend({ }, defaults, config));
    
    this.bridges  = { };
    this.channels = new Map();
    
    this._resolveMap = new Map();
    
    for (let [ id, config ] of entries(this.config.bridges)) {
      config = extend({ }, bridgeDefaults, config);
      
      let bridge = new Bridge.Info(this, id, config);
      for (let resolve of bridge.resolves) {
        let old = this._resolveMap.get(resolve);
        if (old != null) throw new Error(
          `Channel '${ resolve }' is in multiple ` +
          `bridges ('${ old.id }' and '${ bridge.id }')`);
        // TODO: Verify resolve strings and make sure they could be valid channels.
        this._resolveMap.set(resolve, bridge);
      }
      this.bridges[id] = bridge;
    }
  }
  
  activate() {
    this.cord.on("newChannel", (channel) => {
      for (let resolve of channel.resolveStrings) {
        resolve = `${ channel.socket.id }:${ resolve }`;
        let bridge = this._resolveMap.get(resolve);
        if (bridge == null) continue;
        
        let old = this.channels.get(channel);
        if (old != null) throw new Error(
          `Channel '${ resolve }' active in multiple ` +
          `bridges ('${ old.id }' and '${ bridge.id }')`);
        
        this.debug(`${ bridge.id } += ${ channel } (${ resolve })`);
        channel.bridge = bridge;
        bridge.channels.add(channel);
        this.channels.set(channel, bridge);
        
        channel.on("removed", () => {
          this.debug(`${ bridge.id } -= ${ channel }`);
          channel.bridge = null;
          bridge.channels.delete(channel);
          this.channels.delete(channel);
        });
        
        break;
      }
    });
    
    this.cord.on("message", (message) => {
      // Make sure the message was from a user and to a channel.
      if (!(message.sender instanceof Socket.User) ||
          !(message.target instanceof Socket.Channel)) return;
      
      let bridge = this.channels.get(message.target);
      if ((bridge == null) || !bridge.enabled) return;
      
      let userResolves = new Set(message.sender.resolveStrings);
      
      if (any(concat(this.config.ignore, bridge.config.ignore),
              (e) => userResolves.has(e))) return;
      
      let parts = message.parts;
      if (!message.sender.isSelf) {
        let isAction = false;
        parts = message.augmentClone(Socket.Action, () => (isAction = true, null));
        if (isAction) parts.unshift("* ", message.sender, " ");
        else parts.unshift("<", message.sender, "> ");
      }
      
      for (let channel of bridge.channels)
        if (channel !== message.target)
          channel.sendSilent(...parts);
    });
  }
  
};

Bridge.Info = class BridgeInfo {
  
  constructor(plug, id, config) {
    this.plug   = plug;
    this.id     = id;
    this.config = config;
    
    this.channels = new Set();
    this.resolves = new Set(config.channels);
  }
  
  get enabled() { return this.config.enabled; }
  set enabled(value) { this.config.enabled = value; }
  
  toString() { return `bridge:${ this.id }`; }
  
};
