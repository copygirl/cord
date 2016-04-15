"use strict";

/** Returns a new string with some characters (index .. count)
 *  removed and the specified arguments inserted, replacing them. */
String.prototype.splice = function(index, count, ...args) {
  return `${ str.slice(0, index) }${ args.join("") }${str.slice(index + count)}`;
};


/** Removes all values from this array. */
Array.prototype.clear = function() {
  this.length = 0;
};

/** Removes the specified values from this array.
 *  Per value, only one entry is removed: [ 1, 1, 1 ].delete(1) => [ 1, 1 ]
 *  The number of removed entries is returned. */
Array.prototype.delete = function(...values) {
  let count = 0;
  for (let value of values) {
    let index = this.indexOf(value);
    if (index < 0) continue;
    this.splice(index, 1);
    count++;
  }
  return count;
};


/** Attempts to get a value from this map using the specified key. If the key doesn't
 *  exist, the specified default value is added using the key and returned.
 *  If defaultValue is a function, it will be called with they key as parameter and
 *  its return value will be used for the value instead. */
Map.prototype.getOrAdd = function(key, defaultValue) {
  let value = this.get(key);
  if (value === undefined) {
    value = ((defaultValue instanceof Function)
      ? defaultValue(key) : defaultValue);
    this.set(key, value);
  }
  return value;
};

/** Deletes the specified key from this map and returns the value it previously had,
 *  or the specified default value (default: undefined) if they key doesn't exist. */
Map.prototype.deleteGet = function(key, defaultValue = undefined) {
  let value = this.get(key);
  if (value === undefined) return defaultValue;
  this.delete(key);
  return value;
};
