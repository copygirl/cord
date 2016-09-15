"use strict";

let { Action, User, Channel } = require("../sockets/Socket");


module.exports = {
  
  testSimple: "Simple text response.",
  
  testRandom: {
    help: "Displays one of four random messages.",
    action: [
      "Random text response: Butterflies! (1 / 4)",
      "Random text response: Bodypillows! (2 / 4)",
      "Random text response: World peace! (3 / 4)",
      "Random text response: asie x copy! (4 / 4)"
    ]
  },
  
  testFunction: () =>
    `Function: ${ Math.floor(Math.random() * 1000) }`,
  
  testEcho: {
    usage: "<message>",
    action: (content) =>
      `Echo: ${ content }`
  },
  
  testSender: (sender) =>
    `Your name is ${ sender.name.length } characters long.`,
  
  testParts: (target) =>
    [ Action, "was poked by in ", target, "." ],
  
  testParameters: (a, b, c) =>
    `Parameter response: '${ a }', '${ b }' and '${ c }'`,
  
  testParametersOptional: (a, b=null, c=null) =>
    `Optional parameter response: '${ a }', '${ b }' and '${ c }'`,
  
  testTypes: (a=Number, b=User) =>
    [ a, " is a number and ", b.mention, " is a user. Hi!" ],
  
  testTypesOptional: (sender, a=-1, b=[User]) =>
    [ a, " might be a number that defaults to -1. And ", (b || sender).mention, " is a user, or you!" ],
  
  testArgs: (...args) =>
    `Varargs response: ${ args.length } element` +
    `${ (args.length != 1) ? "s" : "" }. Random: ${ args.random() }`,
  
  testConfig: (config) =>
    JSON.stringify(config),
  
  testAll: (target, sender, a, b=[Channel], ...any) => {
    target.send(`In ${ target }, ${ sender } said ${ a } and ` +
                `${ b || "<none>" } and also ${ any.join(", ") }.`); },
  
  [/\bregex\b/]: {
    name: "regex",
    help: "Notices when someone mentions regex.",
    usage: "regex",
    action: "You said something about regex?"
  },
  
  [/1d20/]: {
    name: "simpleRoll",
    help: "Rolls a 1d20 die.",
    usage: "1d20",
    action: () =>
      Math.floor(Math.random() * 20),
  },
  
  [/match/g]: (...matches) =>
    `There ${ (matches.length != 1) ? "were" : "was" } ` +
    `${ matches.length } match${ (matches.length != 1) ? "es" : "" }.`,
  
};
