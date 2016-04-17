"use strict";

// TODO: Move this utility stuff to its own package.

let iterable = require("./iterable");


/** Returns if the specified object is an ES6 class. */
exports.isClass = function(obj) {
  return ((typeof obj == "function") && /^\s*class\s+/.test(obj.toString()));
}

/** Extends the target object with all properties of the source objects. */
let extend = exports.extend = function(target, ...sources) {
  for (let source of sources) {
    let properties = iterable.concat(
      Object.getOwnPropertyNames(source),
      Object.getOwnPropertySymbols(source));
    for (let property of properties) {
      let descriptor = Object.getOwnPropertyDescriptor(source, property);
      if (descriptor != null) {
        // If it's a data descriptor (not getter/setter), just set
        // the value normally, causing existing setters to be used.
        if (descriptor.value) target[property] = descriptor.value;
        // Otherwise, properly copy getters/setters over, instead of calling them.
        else Object.defineProperty(target, property, descriptor);
      }
    }
  }
  return target;
};

/** Implements the specified mixins (can be objects
 *  or classes) into the target class's prototype. */
exports.implement = function(targetClass, ...mixins) {
  extend(targetClass.prototype, ...iterable.map(mixins,
    // If mixin is a function, it's likely a class
    // constructor, so use its prototype instead.
    e => ((typeof e == "function") ? e.prototype : e)));
  return targetClass;
};

/** Flattens an iterable object into an array recursively. */
exports.flatten = function flatten(obj, array = [ ]) {
  if (iterable.isIterable(obj))
    for (let element of obj)
      flatten(element, array);
  else array.push(obj);
  return array;
};

/** Returns a string representation of an object's type.
 *  For example: "Number", Array", "Function", "Null", "Undefined", ... */
let type = exports.type = function(obj) {
  if (obj === undefined) return "Undefined";
  if (obj === null) return "Null";
  return Object.prototype.toString.call(obj).slice(8, -1);
};

/** Returns if value is a number in the specified range. */
exports.rangeCheck = function(value, min, max) {
  return ((typeof value == "number") && (value >= min) && (value <= max));
};

/** Error thrown when a value was not of the expected type(s). */
exports.UnexpectedTypeError = class UnexpectedTypeError extends Error {
  constructor(value, ...expected) {
    let str = "Expected ";
    for (let i = 0; i < expected.length; i++) {
      let exp = expected[i]
      if (exp.name != null) str += exp.name;
      else if (typeof exp == "string") str += exp;
      else if (exp == null) str += "Null";
      else throw new UnexpectedTypeError(exp, "Constructor", String, null);
      if (i < expected.length - 2) str += ", ";
      else if (i == expected.length - 2) str += " or ";
    }
    super(str);
  }
};

// Export iterable functions through this module.
extend(exports, iterable);

// Make extensions happen! This just executes the
// extensions script, which extends existing classes.
require("./extensions");
