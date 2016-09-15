"use strict";

let React = require("../plugs/React");
let { Action } = require("../sockets/Socket");


module.exports = {
  
  help: React.builtin.help,
  comms: React.builtin.comms,
  commands: { alias: "comms" },
  about: "I'm cord v2.2, a bot written by copygirl.",
  
  [/^cord: .+[^\?]$/]: {
    name: "talk",
    usage: "cord: <...>",
    help: "Get a reaction from cord!",
    action: (sender) => [
      "...", "Meh.", "Pff..", "Duh.", "<3",
      "...?", "What?", "Huh?", "Njeh~?", "Wheh..?", "Ueh~?",
      "Nya~", "Nyan~", "Pomf~", "Ugu~", "Duhuhu~", "Derp.",
      "Heh.", "Hahaha~", "Hehe~", "Lol!", "Lmao!", "Rofl!",
      
      "Dude..", "Wow.", "Woah.", "No way!", "Totes!",
      "I agree.", "Totally.", "Yup.", "Yeah.",
      
      "What the..?", "I am disappoint.", "The hell..?",
      
      ":)", ":(", ":'(", ":D", "D:", ":O", ":S", ":]",
      ">_>", "<_<\"", "o_o", "._.", "T_T", "=_=",
      
      "I have nothing to say.", "No comment.", "Please.",
      "That is so stupid.", "I'm so sick of this..",
      "My body is ready.", "What is love?", "Sorry.",
      
      "Beep.", "Boop.", "Beep boop.", "Curse you, Merasmus!",
      "Foo.", "Bar.", "Foobar.", "Fubar.", "Baz.", "Quux.",
      "Kill all humans!", "Exterminate!", "I AM ROBOT",
      
      "Please, say my name again.", "Talk to me more.",
      "I'm here for you.", "Don't stop.", "Continue.",
      
      [ Action, "dances." ], [ Action, "claps." ],
      [ Action, "is excited." ], [ Action, "jumps up and down." ],
      [ Action, "is speechless." ], [ Action, "is confused." ],
      [ Action, "doesn't know what to say." ],
      
      [ Action, "pokes ", sender.mention, "." ],
      [ Action, "pats ", sender.mention, "." ],
      [ Action, "hugs ", sender.mention, "." ],
      [ Action, "kisses ", sender.mention, "." ],
      [ Action, "tickles ", sender.mention, "." ],
      [ Action, "gives ", sender.mention, " a cookie." ],
      
      "Please ask copygirl to add more responses."
    ].random()
  },
  
  [/^cord: .+\?$/]: {
    name: "ask",
    usage: "cord: <...>?",
    help: "Ask cord an 8-ball style question!",
    action: (sender) => [
      "Yes!", "Yes.", "Yeah.", "Heck yeah!", "Sure.",
      "For sure!", "Totally.", "Positive.", "True.",
      
      "No!", "No.", "Nah.", "Nope.", "Doubt it.",
      "No way!", "Nooooo!", "Negative.", "False.",
      
      "Probably.", "Probably?", "Probably not.",
      "I don't know!", "I dunno...", "I guess?",
      
      "Maybe.", "Maaaaaybe..?", "Pff, maybe..",
      
      "Why are you asking me this?", "What?!",
      "Are you out of your mind?", "What the fueh?",
      
      "I have no opinion.", "No idea.", "I won't tell.",
      "Insufficient data.", "Computation error.",
      
      [ Action, "nods at ", sender.mention, "." ],
      [ Action, "shakes its head at ", sender.mention, "." ],
      [ Action, "shrugs at ", sender.mention, "." ]
    ].random()
  }
  
};
