"use strict";

let { Action } = require("../sockets/Socket");


module.exports = {
  
  about: "I'm cord v2.0, a bot written by copygirl.",
  
  help: (sender) => [
      "Everything will be okay.",
      "Everything will be alright.",
      "Don't worry. Be happy :)",
      "Don't worry, I'm here for you.",
      "You're awesome!", "Keep being awesome!",
      "I love you! <3", "I really like you!",
      "Don't give up!", "Stay strong!",
      "I want you to be happy.",
      "I want you to be strong.",
      "You can do it!", "I believe in you!",
      [ Action, "hugs ", sender.mention, "." ],
      [ Action, "gives ", sender.mention, " a big hug." ],
      [ Action, "comforts ", sender.mention, "." ],
      [ Action, "kisses ", sender.mention, "." ],
      [ Action, "kisses ", sender.mention, " on the cheek." ],
      [ Action, "pats ", sender.mention, " on the head." ],
      [ Action, "takes ", sender.mention, " by the hand and smiles." ],
      [ Action, "will always be there for ", sender.mention, "." ]
    ].random(),
  
  // Random responses.
  [/^cord: [^\?]$/]: [
    "...", "Meh.", "Pff..", "Duh.", "<3",
    "...?", "What?", "Huh?", "Njeh~?", "Wheh..?", "Ueh~?",
    "Nya~", "Nyan~", "Pomf~", "Ugu~", "Duhuhu~", "Derp.",
    "Heh.", "Hahaha~", "Hehe~", "Lol!", "Lmao!", "Rofl!",
    "Dude..", "Wow.", "Woah.", "No way!", "Totes!",
    "I agree.", "Totally.", "Yup.", "Yeah.",
    "What the..?", "*shakes head*", "I am disappoint.",
    "I have nothing to say.", "No comment.", "Please.",
    "That is so stupid.", "I'm so sick of this..",
    "My body is ready.", "What is love?", "Sorry.",
    "Beep.", "Boop.", "Beep boop.", "Curse you, Merasmus!",
    "Foo.", "Bar.", "Foobar.", "Fubar.", "Baz.", "Quux.",
    "Kill all humans!", "Exterminate!", "I AM ROBOT",
    "Please, say my name again.", "Talk to me more.",
    "I'm here for you.", "Don't stop.", "Continue.",
    "Please ask copygirl to add more responses."
  ],
  
  // Magic 8-ball, cord-style! <3
  [/^cord: .\?$/]: [
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
  ]
  
};
