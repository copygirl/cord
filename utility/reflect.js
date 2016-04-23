"use strict";

let funcRegex      = /^\s*function(\*)?\s*(?:\s+(.+?))?\((.*?)\)\s*{\s*(.*?)\s*}\s*$/m;
let arrowFuncRegex = /^\s*\(?(.*?)\)?\s*=>\s*{?\s*(.*?)\s*}?\s*$/m;
let parameterRegex = /^\s*(\.\.\.)?(.+?)(?:\s*=\s*(.+?))?\s*$/m;

/** Inspects the specified function and returns an object containing
 *  information about it and its parameters. Note: This breaks down
 *  when using certain strings or functions as default value parameters. */
exports.inspectFunction = function(func) {
  if (!(func instanceof Function)) throw new Error("Not a function");
  let str = func.toString();
  
  let result;
  if (result = funcRegex.exec(str)) result = {
    name: (result[2] || null), parameters: result[3], body: result[4],
    generator: (result[1] != null), arrow: false, spread: false };
  else if (result = arrowFuncRegex.exec(str)) result = {
    name: null, parameters: result[1], body: result[2],
    generator: false, arrow: true, spread: false };
  else throw new Error(`Unable to inspect function:\n${ str }`);
  
  result.parameters = (result.parameters && result.parameters.split(",") || [ ])
    .map((param, index) => {
      let [ _, spread, name, defaultValue ] = parameterRegex.exec(param);
      if (spread = !!spread) result.spread = true;
      return { name, index, defaultValue, spread };
    });
  
  return result;
};
