"use strict";

let Plug   = require("./Plug");
let Socket = require("../sockets/Socket");

let { extend, entries, values,
      inspectFunction,
      UnexpectedTypeError } = require("../utility");


let defaults = {
  prefix: "~",
  comms: { }
};

let commDefaults = {
  enabled: true
};


let findResolveable = function(msg, v, restrict) {
  let split = v.split(':', 2);
  if (split.length == 2) {
    let socket = msg.socket.cord.sockets[split[0]];
    if (socket == null) return null;
    let [ type, resolve ] = socket.resolve(v);
    if (restrict && (type != restrict)) return null;
    return resolve[0];
  } else {
    let [ type, resolve ] = msg.socket.resolve(v);
    if ((resolve.length > 0) && !(restrict && (type != restrict))) return resolve[0];
    for (let socket of values(msg.socket.cord.sockets)) {
      if (socket == msg.socket) continue;
      let [ type, resolve ] = socket.resolve(v);
      if ((resolve.length > 0) && !(restrict && (type != restrict))) return resolve[0];
    }
    return null;
  }
};

let transforms = {
  ["None"]:   (msg, v) => v,
  ["Number"]: (msg, v) => ((/^(0|-?[1-9][0-9]*)$/.test(v) &&
                   Number.isSafeInteger(v = +v)) ? v : null),
  ["Resolveable"]: (msg, v) => findResolveable(msg, v),
  ["User"]:        (msg, v) => findResolveable(msg, v, "user"),
  ["Channel"]:     (msg, v) => findResolveable(msg, v, "channel")
};


module.exports = class React extends Plug {
  
  constructor(cord, config) {
    super(cord, extend({ }, defaults, config));
    
    this.commands = { };
    this.regexes  = [ ];
    
    for (let [ name, commConfig ] of entries(this.config.comms)) {
      if (commConfig.enabled === false) continue;
      commConfig = extend({ }, commDefaults, commConfig);
      let comms = require(`../comms/${ name }`);
      
      for (let [ comm, action ] of entries(comms)) {
        let regex = /\/(.+)\/(g)?/.exec(comm);
        if (regex != null) comm = new RegExp(regex[1], regex[2]);
        
        let origAction = action;
        if (typeof action == "string")    action = () => origAction;
        else if (action instanceof Array) action = () => origAction.random();
        
        if (!(action instanceof Function))
          throw new UnexpectedTypeError(action, String, Array, Function);
        
        let inspect = inspectFunction(action);
        let numParams = 0; // Number of parameters / minimum arguments.
        for (let param of inspect.parameters) {
          
          let invalidParameterError = () => new Error(
            `Invalid parameter '${ param.name }' for comm '${ comm }':\n${ action }`);
          let invalidDefaultValueError = () => new Error(
            `Invalid type on parameter '${ param.name }' in comm '${ comm }':\n${ action }`);
          let invalidSpreadOperatorError = (needed = false) => new Error(
            `${ needed ? "Missing" : "Invalid" } spread operator on parameter ` +
            `'${ param.name }' in comm '${ comm }':\n${ action }`);
          
          switch (param.name) {
            case "message":
            case "target":
            case "sender":
            case "config":
              if (param.spread) throw invalidSpreadOperatorError();
              if (param.defaultValue) throw invalidDefaultValueError();
              break;
            case "content":
              if (param.spread) throw invalidSpreadOperatorError();
              if (param.defaultValue) throw invalidDefaultValueError();
              if (numParams > 0) throw invalidParameterError();
              numParams = null;
              break;
            
            case "args":
              if (comm instanceof RegExp) throw invalidParameterError();
              if (!param.spread) throw invalidSpreadOperatorError(true);
              if (param.defaultValue) throw invalidDefaultValueError();
              break;
            
            case "match":
              if (!(comm instanceof RegExp)) throw invalidParameterError();
              if (param.spread) throw invalidSpreadOperatorError();
              if (param.defaultValue) throw invalidDefaultValueError();
              if (numParams > 0) throw new Error(
                `Parameter '${ param.name }' for comm '${ comm }' ` +
                `must before group parameters:\n${ action }`);
              break;
            case "matches":
              if (!(comm instanceof RegExp) || !comm.global) throw invalidParameterError();
              if (!param.spread) throw invalidSpreadOperatorError(true);
              if (param.defaultValue) throw invalidDefaultValueError();
              break;
            
            default:
              if ((comm instanceof RegExp) && comm.global) throw invalidParameterError();
              if (param.spread) throw invalidSpreadOperatorError();
              if (numParams == null) throw invalidParameterError();
              numParams++;
              break;
          }
          
          if (transforms[param.defaultValue || "None"] == null) throw new Error(
            `Unknown transform '${ param.defaultValue }' on parameter ` +
            `'${ param.name }' in comm '${ comm }':\n${ action }`);
          
        }
        
        let commAction = (message, content, args) => {
          if (!(comm instanceof RegExp) && (numParams != null) && ((args.length < numParams) ||
              (!inspect.spread && (args.length > numParams)))) return message.reply(
            `${ comm }: Expected ${ numParams }${ inspect.spread ? "+" : "" } ` +
            `argument${ (numParams != 1) ? "s" : "" }, but got ${ args.length }.`);
          
          let origArgs = [ ];
          for (let param of inspect.parameters)
            switch (param.name) {
              case "message": origArgs.push(message); break;
              case "target": origArgs.push(message.target); break;
              case "sender": origArgs.push(message.sender); break;
              case "content": origArgs.push(content); break;
              case "config": origArgs.push(commConfig); break;
              
              case "args": origArgs.push(...args); break;
              
              case "match": origArgs.push(args.shift()); break;
              case "matches": origArgs.push(...args); break;
              
              default:
                let value = args.shift();
                if (param.defaultValue != null) {
                  let transform = transforms[param.defaultValue](message, value);
                  if (transform == null) return message.reply(
                    `${ comm }: '${ value }' is not a valid ${ param.defaultValue }.`);
                  value = transform;
                }
                origArgs.push(value);
                break;
            }
          
          let result = action(...origArgs);
          if (result == null) return;
          
          if (result instanceof Array)
            message.target.send(...result);
          else message.reply(result);
        };
        
        if (comm instanceof RegExp)
          this.regexes.push([ comm, commAction ]);
        else this.commands[comm.toLowerCase()] = commAction;
      }
    }
  }
  
  activate() {
    this.cord.on("message", (message) => {
      if (!(message.sender instanceof Socket.User) ||
          !(message.target instanceof Socket.Channel) ||
          message.sender.isSelf) return;
          
      let content = message.parts.join("");
      
      if (content.startsWith(this.config.prefix)) {
        let command = content.slice(this.config.prefix.length).split(" ", 2)[0];
        let comm = this.commands[command.toLowerCase()];
        if (comm == null) return message.reply(`Unknown command '${ command }'.`);
        
        content  = content.slice(this.config.prefix.length + command.length + 1);
        let args = content.match(/"(?:\\"|\\\\|[^"])*"|\S+/g) || [ ];
        
        return comm(message, content, args);
      }
      
      for (let [ regex, comm ] of this.regexes) {
        let result = content.match(regex);
        if (result != null)
          return comm(message, content, result);
      }
      
    });
  }
  
};
