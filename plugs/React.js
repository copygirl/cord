"use strict";

let Plug   = require("./Plug");
let Socket = require("../sockets/Socket");

let { extend, Iterable: { entries, values, map, filter },
      inspectFunction, UnexpectedTypeError } = require("../utility");


let defaults = {
  prefix: "~",             // Prefix used for regular commands, such as "~help".
  comms: { },              // Additional configuration for commands.
  replyOnUnknown: true,    // Whether to reply when an unknown command is used. 
  showRegexAsUsage: false, // Whether to show raw regexes as the usage text by default.
};

let commDefaults = {
  enabled: true
};


let commArgsRegex = /([^\s'"]+(['"])([^\2]*?)\2)|[^\s'"]+|(['"])([^\4]*?)\4/g;
let getCommArgs = function(str) {
  let match, args = [ ];
  while (match = commArgsRegex.exec(str))
    args.push(match[1] || match[5] || match[0]);
  return args;
}

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
  ["Socket"]:             (msg, v) => msg.socket.cord.sockets[v],
  ["Socket.Resolveable"]: (msg, v) => findResolveable(msg, v),
  ["Socket.User"]:        (msg, v) => findResolveable(msg, v, "user"),
  ["Socket.Channel"]:     (msg, v) => findResolveable(msg, v, "channel")
};

// Allow transforms to be used as Socket.XYZ and simply XYZ.
for (let [ name, func ] of entries(transforms))
  if (name.startsWith("Socket."))
    transforms[name.slice(7)] = func;


let React = module.exports = class React extends Plug {
  
  constructor(cord, config) {
    super(cord, extend({ }, defaults, config));
    
    this.commands = { };
    this.regexes  = [ ];
    this.lookup   = { };
    
    // Hold onto aliases comms until all others are processed.
    let aliases = [ ];
    
    for (let [ name, commConfig ] of entries(this.config.comms)) {
      if (commConfig.enabled === false) continue;
      commConfig = extend({ }, commDefaults, commConfig);
      let comms = require(`../comms/${ name }`);
      
      for (let [ trigger, comm ] of entries(comms)) {
        let regexTest = /\/(.+)\/(g)?/.exec(trigger);
        if (regexTest != null) trigger = new RegExp(regexTest[1], regexTest[2]);
        
        comm = extend({
          category: name, name: ((typeof trigger == "string") ? trigger : null),
          trigger, regex: (trigger instanceof RegExp),
          help: null, usage: null, alias: false,
        }, (((comm.action != null) || (comm.alias != null)) ? comm : { action: comm }));
        
        // Skip aliases commands for now.
        if (typeof comm.alias == "string") { aliases.push(comm); continue; }
        
        let origAction = comm.action;
        if (typeof comm.action == "string")    comm.action = () => origAction;
        else if (comm.action instanceof Array) comm.action = () => origAction.random();
        if (!(comm.action instanceof Function))
          throw new UnexpectedTypeError(comm, String, Array, Function);
        
        let inspect = inspectFunction(comm.action);
        let minParams = 0, maxParams = 0;
        for (let param of inspect.parameters) {
          
          let invalidParameterError = () => new Error(
            `Invalid parameter '${ param.name }' for comm '${ trigger }':\n${ comm.action }`);
          let invalidDefaultValueError = () => new Error(
            `Invalid type on parameter '${ param.name }' in comm '${ trigger }':\n${ comm.action }`);
          let invalidSpreadOperatorError = (needed = false) => new Error(
            `${ needed ? "Missing" : "Invalid" } spread operator on parameter ` +
            `'${ param.name }' in comm '${ trigger }':\n${ comm.action }`);
          
          // null, number and string default parameters are treated as such.
          // Arrays (like "[Channel]") are optional parameters of that type.
          let def = param.defaultValue;
          if ((def != null) && ((def == "null") || !isNaN(def) ||
                                (def[0] == '"') || (def[0] == '['))) {
            param.optional = true;
            param.defaultValue = (!isNaN(def) ? "Number"
              : ((def[0] == '[') && (def.length > 2)) ? def.substr(1, def.length - 2)
              : null);
            param.optionalIsArray = (def[0] == '[');
          } else param.optional = false;
          
          switch (param.name) {
            case "cord":
            case "message":
            case "target":
            case "sender":
            case "config":
              if (param.spread) throw invalidSpreadOperatorError();
              if (param.defaultValue) throw invalidDefaultValueError();
              param.hide = true;
              break;
            case "content":
              if (param.spread) throw invalidSpreadOperatorError();
              if (param.defaultValue) throw invalidDefaultValueError();
              if (minParams > 0) throw invalidParameterError();
              maxParams = Number.POSITIVE_INFINITY;
              break;
            
            case "match":
              if (!comm.regex || trigger.global) throw invalidParameterError();
              if (param.spread) throw invalidSpreadOperatorError();
              if (param.defaultValue) throw invalidDefaultValueError();
              if (minParams > 0) throw new Error(
                `Parameter '${ param.name }' for comm '${ trigger }' ` +
                `must before group parameters:\n${ comm.action }`);
              break;
            case "matches":
              if (!comm.regex || !trigger.global) throw invalidParameterError();
              if (!param.spread) throw invalidSpreadOperatorError(true);
              if (param.defaultValue) throw invalidDefaultValueError();
              break;
            
            default:
              if (param.spread) {
                if (comm.regex) throw invalidParameterError();
                if (param.defaultValue) throw invalidDefaultValueError();
                maxParams = Number.POSITIVE_INFINITY;
              } else {
                if (comm.regex && trigger.global) throw invalidParameterError();
                if (param.spread) throw invalidSpreadOperatorError();
                if (!Number.isFinite(maxParams)) throw invalidParameterError();
                if (!param.optional) minParams++;
                maxParams++;
              }
              break;
          }
          
          if (transforms[param.defaultValue || "None"] == null) throw new Error(
            `Unknown transform '${ param.defaultValue }' on parameter ` +
            `'${ param.name }' in comm '${ trigger }':\n${ comm.action }`);
          
        }
        
        if (!comm.regex) {
          // Automatic usage generation.
          let visibleParams = inspect.parameters.filter((param) => !param.hide);
          if ((comm.usage == null) && (visibleParams.length > 0))
            comm.usage = map(visibleParams, (param) => {
                let name = param.name;
                if (param.spread) name = `[${ name }...]`;
                else if (param.optional) name = `[${ name }]`;
                else name = `<${ name }>`;
                return name;
              }).join(" ");
          // Prefix non-regex comms' usage with "~name ".
          comm.usage = `${ config.prefix }${ comm.trigger }` +
                        `${ ((comm.usage != null) && (comm.usage.length > 0)) ? ` ${ comm.usage }` : "" }`;
        }
        
        // TODO: Catch and handle errors.
        comm.use = (message, content, args) => {
          if (!comm.regex && ((args.length < minParams) || (args.length > maxParams)))
            return message.reply(
              `${ comm.name }: Expected ${ minParams }${ ((maxParams != minParams) ?
                (Number.isFinite(maxParams) ? ` to ${ maxParams }` : " or more") : "") } ` +
              `argument${ ((minParams | maxParams) != 1) ? "s" : "" }, but got ${ args.length }.`);
          
          let origArgs = [ ];
          for (let param of inspect.parameters)
            switch (param.name) {
              case "cord": origArgs.push(this.cord); break;
              case "message": origArgs.push(message); break;
              case "target": origArgs.push(message.target); break;
              case "sender": origArgs.push(message.sender); break;
              case "config": origArgs.push(commConfig); break;
              case "content": origArgs.push(content); break;
              
              case "match": origArgs.push(args.shift()); break;
              case "matches": origArgs.push(...args); break;
              
              default:
                if (param.spread) {
                  // TODO: Somehow allow transforming varargs.
                  origArgs.push(...args);
                } else {
                let value = args.shift();
                  if (value == null)
                    value = (param.optionalIsArray ? null : undefined);
                  else if (param.defaultValue != null) {
                    let transform = transforms[param.defaultValue](message, value);
                    if (transform == null) return message.reply(
                      `${ comm.name }: '${ value }' is not a valid ${ param.defaultValue }.`);
                    value = ((transform != null) ? transform : null);
                  }
                  origArgs.push(value);
                }
                break;
            }
          
          let result = comm.action(...origArgs);
          if (result == null) return;
          
          if (result instanceof Array)
            message.target.send(...result);
          else message.reply(result);
        };
        
        if (comm.regex) this.regexes.push([ trigger, comm.use ]);
        else this.commands[trigger.toLowerCase()] = comm.use;
        
        if (comm.name != null)
          this.lookup[comm.name] = comm;
      }
    }
    
    // Now process all alias comms.
    for (let comm of aliases) {
      let orig = this.lookup[comm.alias];
      if (orig == null) throw new Error(
        `Aliased comm '${ comm.alias }' not found for comm '${ comm.trigger }'`);
      if (orig.regex) throw new Error(
        `Aliased comm '${ comm.alias }' for comm '${ comm.trigger }' is a regex comm`);
      comm = extend({ }, orig, {
        trigger: comm.trigger, name: comm.name, alias: comm.alias,
        usage: orig.usage.splice(this.config.prefix.length, orig.trigger.length, comm.trigger),
      });
      this.commands[comm.trigger] = comm.use;
      this.lookup[comm.trigger] = comm;
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
        if (comm == null) {
          if (this.config.replyOnUnknown)
            message.reply(`Unknown command '${ command }'.`);
          return;
        }
        
        content  = content.slice(this.config.prefix.length + command.length + 1);
        let args = getCommArgs(content);
        
        return comm(message, content, args);
      }
      
      for (let [ regex, comm ] of this.regexes) {
        let result = regex.exec(content);
        if (result == null) continue;
        
        // Global regexes should contain all matches.
        if (regex.global) {
          result = [ result ];
          let match;
          while (match = regex.exec(content))
            result.push(match);
        }
        
        return comm(message, content, result);
      }
      
    });
  }
  
};

React.builtin = {
  
  help: {
    help: "Shows this help or help for the specified comm.",
    action: (cord, comm=null) => {
      if (comm != null) {
        comm = (cord.plugs.React.lookup[comm] || {  });
        let result = (comm.regex ? `${ comm.name }: ` : "");
        if (comm.usage != null) result += `'${ comm.usage }' - `
        result += (comm.help || "No help available.");
        if (comm.alias) result += ` (alias for '${ comm.alias }')`;
        return result;
      } else {
        let prefix = cord.config.React.prefix;
        return `Use '${ prefix }comms' to show all comms and ` +
               `'${ prefix }help <comm>' to display help for a specific comm.`;
      }
    }
  },
  
  comms: {
    help: "Shows all available comms.",
    action: (cord) =>
      `Available comms: ${ values(cord.plugs.React.lookup).filter((comm) => !comm.alias)
        .map((comm) => `${ !comm.regex ? cord.config.React.prefix : "" }${ comm.name }`).join(", ") }`
  }
  
};
