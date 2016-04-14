"use strict";

let Plug   = require("./Plug");
let Socket = require("../sockets/Socket");

let { extend, filter, any, first } = require("../utility");


/* Example configuration:
  "Bridge": {
    "debug": false,
    "ignore": [
      "irc:Inumuta",
      "discord:@164511461316493313"
    ],
    "bridges": [
      { "channels": [ "irc:#cord",    "discord:107923656885157888/#general" ] },
      { "channels": [ "irc:#projekt", "discord:#projekt" ] },
      { "channels": [ "irc:#test",    "discord:#162192835980820481" ], "ignore": "irc:Ruby" },
      { "channels": [ "irc:#test1", "irc:#test2", "otherirc:#test", "discord:#mytest" ], "enabled": false }
    ]
  } */

let defaults = {
  ignore: [ ],
  bridges: [ ]
};

let bridgeDefaults = {
  enabled: true,
  channels: [ ],
  ignore: [ ]
};


module.exports = class Bridge extends Plug {
  
  constructor(cord, config) {
    super(cord, extend({ }, defaults, config));
    
    this._relayMap = new Map();
    
    for (let bridge of this.config.bridges) {
      bridge = extend({ }, bridgeDefaults, bridge);
      for (let channel of bridge.channels) {
        // TODO: Verify resolve strings and make sure they're channels.
        let array = this._relayMap.getOrAdd(channel, () => [ ]);
        array.push(bridge);
      }
    }
  }
  
  _makeResponse(message) {
    // If the message was sent by the bot, re-send the same message.
    if (message.sender.isSelf) return message.parts;
    
    let isAction = false;
    let parts = Array.from(filter(message.parts, (part) =>
      ((part == Socket.Action) ? (isAction = true, false) : true)));
    
    if (isAction) parts.unshift("* ", message.sender, " ");
    else parts.unshift("<", message.sender, "> ");
    
    return parts;
  }
  
  activate() {
    this.cord.on("message", (message) => {
      // Make sure the message was from a user and to a channel.
      if (!(message.sender instanceof Socket.User) ||
          !(message.target instanceof Socket.Channel)) return;
      
      let response = null;
      let userResolves = new Set(message.sender.resolveStrings);
      
      // If user is ignored globally, skip this message.
      if (any(this.config.ignore, (e) => userResolves.has(e))) return;
      
      //this.debug(`${ target } resolves to [ ${ target.resolveStrings.join(", ") } ]`)
      for (let resolve of message.target.resolveStrings) {
        resolve = `${ message.socket.id }:${ resolve }`;
        let bridges = this._relayMap.get(resolve);
        if (bridges == null) continue;
        
        for (let bridge of bridges) {
          // If bridge is not enabled or user is ignored for this bridge, skip it.
          if (!bridge.enabled || any(bridge.ignore, (e) => userResolves.has(e))) continue;
          
          for (let other of bridge.channels) {
            // Don't re-send messages back to the origin channel.
            if (other == resolve) continue;
            
            let [ type, targets ] = this.cord.resolve(other);
            if ((type != "channel") || (targets.length == 0)) {
              this.debug(`Couldn't find channel matching '${ other }'`);
              continue;
            }
            
            if (response == null) response = this._makeResponse(message);
            for (let channel of targets) {
              this.debug(`Relayed message from '${ message.target.socket.id }:${ message.target }' ` +
                                           `to '${ channel.socket.id }:${ channel }'`);
              channel.sendSilent(...response);
            }
          }
        }
      }
    });
  }
  
};
