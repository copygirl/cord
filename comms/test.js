"use strict";

let Socket = require("../sockets/Socket");
let { Action, User, Channel } = Socket;


module.exports = {
  
  testSimple: "Simple text response.",
  
  testRandom: [
    "Random text response: Butterflies! (1 / 4)",
    "Random text response: Bodypillows! (2 / 4)",
    "Random text response: World peace! (3 / 4)",
    "Random text response: asie x copy! (4 / 4)"
  ],
  
  testFunction: () => `Function: ${ Math.floor(Math.random() * 1000) }`,
  
  testEcho: (content) => `Echo: ${ content }`,
  
  testSender: (sender) => `Your name is ${ sender.name.length } characters long.`,
  
  testParts: (target) => [ Action, "was poked by in ", target, "." ],
  
  testParameters: (a, b, c) => `Parameter response: '${ a }', '${ b }' and '${ c }'`,
  
  testTypes: (a=Number, b=User) => `${ a } is a number and ${ b.mention } is a user. Hi!`,
  
  testArgs: (...args) => `Varargs response: ${ args.length } element` +
                         `${ (args.length != 1) ? "s" : "" }. Random: ${ args.random() }`,
  
  testConfig: (config) => JSON.stringify(config),
  
  testAll: (target, sender, a, b=Channel, ...args) => {
    target.send(`In ${ target }, ${ sender } said ${ a } ` +
                `and ${ b } and also ${ args.join(", ") }.`); },
  
  [/regex/]: "You said something about regex?",
  
  [/1d20/]: () => Math.floor(Math.random() * 20),
  
  [/match/g]: (...matches) => `There ${ (matches.length != 1) ? "were" : "was" } ` +
                           `${ matches.length } match${ (matches.length != 1) ? "es" : "" }.`,
  
  [/^(\d+) \+ (\d+) =$/]: (match, a=Number, b=Number) => `${ match } ${ a + b }`
  
};
