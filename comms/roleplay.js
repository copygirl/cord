"use strict";

let { Iterable } = require("../utility");


const MAX_DICE_PER_ROLL = 20;
const MAX_SIDES_ON_DIE = 1000;
const MAX_DICE_ROLLS_PER_MESSAGE = 6;

// Detail mode will display the result of each individual dice throw.
// For example: "5d20 = 38 (2, 15, 9, 7, 3) ~ 7.2"
const DETAIL_ENABLE = true;
const DETAIL_MAX_DICE_PER_ROLL = 8;
const DETAIL_MAX_TOTAL_DICE = 16;


module.exports = {
  
  [/\b(\d+)d(\d+)(?:([v><])(\d+))?(( )?[+-]\6?\d+)?\b/g]: {
    name: "roll",
    help: "Roll some dice, for example '1d20+5' or '6d20>10'!",
    usage: "<dice>d<sides>[>/<limit][+/-offset] <...>",
    action: (...matches) => {
      if (matches.length > MAX_DICE_ROLLS_PER_MESSAGE) return;
      
      // Prepare and validate some stuff.
      let rolls = [ ];
      let totalDice = 0;
      for (let match of matches) {
        let dice  = Number(match[1]);
        let sides = Number(match[2]);
        let drop  = ((match[3] === "v") ? Number(match[4]) : 0);
        let min   = ((match[3] === ">") ? Number(match[4]) : null);
        let max   = ((match[3] === "<") ? Number(match[4]) : null);
        let diceOffset  = (((match[5] != null) && (match[6] == null)) ? Number(match[5]) : 0);
        let totalOffset = ((match[6] != null) ? Number(match[5].replace(/ /g, "")) : 0);
        
        if (![ drop, diceOffset, totalOffset ].some(Number.isSafeInteger) ||
            (drop >= dice) || (min >= sides + diceOffset) ||
            (dice > MAX_DICE_PER_ROLL) || (sides > MAX_SIDES_ON_DIE)) return;
        
        totalDice += ((dice <= 8) ? dice : 1);
        rolls.push({
          match: match[0],
          dice, sides, drop, min, max,
          diceOffset, totalOffset
        });
      }
      
      // Calculate each roll (1d20 1d20 1d20 => 3 rolls).
      for (let roll of rolls) {
        let { dice, sides, drop, min, max, diceOffset, totalOffset } = roll;
        
        roll.detail = (DETAIL_ENABLE && (dice > 1) &&
                      (dice <= DETAIL_MAX_DICE_PER_ROLL) &&
                      (totalDice <= DETAIL_MAX_TOTAL_DICE))
        
        // Build an array of the individual dice roll results (5d20 => 5 results).
        let results = roll.diceRolls = Iterable.range(0, dice)
          .map((i) => (1 + Math.floor(Math.random() * sides) + diceOffset))
          .toArray();
        
        // Modify dice roll requirements affecting the result of the roll (but not roll.diceRolls).
        if (drop > 0) { results = results.slice().sort((a, b) => (a - b)); results.splice(0, drop); }
        if (min != null) results = results.filter((result) => (result > min));
        if (max != null) results = results.filter((result) => (result < max));
        
        // Calculate the result and average.
        roll.result = Iterable.sum(results) + totalOffset;
        if (results.length > 1) roll.average = roll.result / results.length + totalOffset;
      };
      
      // Put the response together.
      let totalResult = 0;
      let str = rolls.map(({ match, detail, diceRolls, result, average }) => {
          totalResult += result;
          return `${ match } = ${ result }${ detail ? ` (${ diceRolls.join(", ") })` : "" }` +
                  `${ average ? ` ~ ${ Math.round(average * 10) / 10 }` : "" }`
        }).join(" [+] ");
      return ((matches.length > 1) ? `${ str } [=] ${ totalResult }` : str);
    }
  }
  
};
