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
  
  [/\b(\d+)?d(\d+)([+-]\d+)?\b/g]: (...matches) => {
    if (matches.length > MAX_DICE_ROLLS_PER_MESSAGE) return;
    // Prepare and validate some stuff.
    let rolls = [ ];
    let totalDice = 0;
    for (let match of matches) {
      let dice   = ((match[1] != null) ? Number(match[1]) : 1);
      let sides  = Number(match[2]);
      let offset = ((match[3] != null) ? Number(match[3]) : 0);
      if (isNaN(dice) || isNaN(sides) || isNaN(offset) ||
          (dice > MAX_DICE_PER_ROLL) || (sides > MAX_SIDES_ON_DIE)) return;
      totalDice += ((dice <= 8) ? dice : 1);
      rolls.push([ dice, sides, offset ]);
    }
    
    // Build an iterable for each roll (1d20 1d20 1d20 => 3 rolls).
    rolls = Iterable.map(rolls, (match) => {
      let [ dice, sides, offset ] = match;
      // Build an iterable for the individual dice roll results (5d20 => 5 results).
      let results = Iterable.range(0, dice).map((i) =>
        (1 + Math.floor(Math.random() * sides)));
      // If detail mode should be applied, create an array from the results.
      if (DETAIL_ENABLE && (dice > 1) &&
          (dice <= DETAIL_MAX_DICE_PER_ROLL) &&
          (totalDice <= DETAIL_MAX_TOTAL_DICE))
        results = results.toArray();
      // Calculate the result and average.
      let result  = Iterable.sum(results);
      let average = result / dice;
      // Return an object containing information about the throw.
      return {
        dice, sides, offset, result, average,
        results: ((results instanceof Array) ? results : null)
      };
    });
    
    // Put it all together.
    let totalResult = 0;
    let str = rolls.map(({ dice, sides, offset, result, average, results }) => {
        totalResult += result;
        return `${ dice }d${ sides }${ (offset != 0) ? (((offset > 0) ? "+" : "") + offset) : "" }` +
                ` = ${ result }${ results ? ` (${ results.join(", ") })` : "" }` +
                `${ (dice > 1) ? ` ~ ${ Math.round(average * 10) / 10 }` : "" }`
      }).join(" [+] ");
    return ((matches.length > 1) ? `${ str } [=] ${ totalResult }` : str);
  }
  
};
