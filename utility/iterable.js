"use strict";

/** Returns if the specified object is iterable
 *  (= has property [System.iterator] set to a function). */
exports.isIterable = function(obj) {
  return ((obj != null) && (typeof obj[Symbol.iterator] == "function"));
};


/** Returns an iterable that yields all values of the specified object.. */
exports.values = function*(obj, own = true) {
  for (let key in obj)
    if (!own || obj.hasOwnProperty(key))
      yield obj[key];
};

/** Returns an iterable that yields [ key, value ]
 *  arrays for every property of the specified object. */
exports.entries = function*(obj, own = true) {
  for (let key in obj)
    if (!own || obj.hasOwnProperty(key))
      yield [ key, obj[key] ];
};


/** Returns an iterable that yields the value a specified number of times. */
exports.repeat = function*(value, times) {
  for (let i = 0; i < times; times++)
    yield value;
};

/** Returns an iterable that yields a range of values. */
exports.range = function*(start, count, by = 1) {
  for (let i = 0; i < count; i++)
    yield (start + i * by);
};


/** Returns if all elements of the iterable satisfy the function. */
exports.all = function(iterable, func) {
  for (let element of iterable)
    if (!func(element)) return false;
  return true;
};

/** Returns if any elements of the iterable satisfy the function. */
exports.any = function(iterable, func = null) {
  for (let element of iterable)
    if ((func == null) || func(element)) return true;
  return false;
};


/** Returns an iterable that yields elements of the
 *  source iterable transformed using the function. */
exports.map = function*(iterable, func) {
  for (let element of iterable)
    yield func(element);
};

/** Returns an iterable that yields only elements of
 *  the source iterable that satisfy the function. */
exports.filter = function*(iterable, func) {
  for (let element of iterable)
    if (func(element))
      yield element;
};

/** Returns the first element of the iterable that
 *  matches the function, or the default value otherwise. */
exports.first = function(iterable, func = null, defaultValue = null) {
  if (typeof func != "function") {
    defaultValue = func;
    func = (e => true);
  }
  for (let element of iterable)
    if (func(element))
      return element;
  return defaultValue;
};


/** Returns an iterable that yields elements of all iterables in order. */
let concat = exports.concat = function*(...iterables) {
  for (let iterable of iterables)
    yield* iterable;
};

/** Returns an iterable that yields the specified
 *  values, followed by all elements of the iterable. */
exports.prepend = (iterable, ...values) => concat(values, iterable);

/** Returns an iterable that yields all elements of
 *  the iterable, followed by the specified values. */
exports.append = (iterable, ...values) => concat(iterable, values);


/** Returns an iterable that yields up to a
 *  number of elements from the source iterable. */
exports.take = function*(iterable, count) {
  if (count > 0)
    for (let element of iterable) {
      yield element;
      if (--count <= 0) break;
    }
};

/** Returns an iterable that skips a number of elements
 *  from the source iterable before yielding the rest. */
exports.skip = function*(iterable, count) {
  for (let element of iterable)
    if (--count < 0)
      yield element;
};


/** Returns an iterable that merges elements from both iterables by taking one
 *  element from each, passing them to the function, and yielding the result. */
exports.zip = function*(first, second, func) {
  first  = first[Symbol.iterator]();
  second = second[Symbol.iterator]();
  while (true) {
    let { value: element1, done: done1 } = first.next();
    let { value: element2, done: done2 } = second.next();
    if (done1 || done2) break;
    yield func(element1, element2);
  }
};


/** Applies an aggregate function over all elements of the iterable, returning
 *  the result. Supplying an initial value is optional. Without it, the first
 *  element is used, and if the iterable is empty, undefined is returned. */
let aggregate = exports.aggregate = function(iterable, value, func) {
  let skip = false;
  if (func === undefined) {
    func = value;
    value = undefined;
    skip = true;
  }
  // TODO: Would use this instead, but Node.JS/V8 apparently
  //       doesn't support this kind of destructuring yet.
  //   [ func, value, skip ] = [ value, undefined, true ];
  for (let element of iterable)
    value = (skip ? (skip = false, element)
                  : func(value, element));
  return value;
};

/** Returns the sum of all elements in the iterable. */
exports.sum = (iterable) => aggregate(iterable, 0, (a, b) => a + b);

/** Returns the smallest value of all elements in the iterable. */
exports.max = (iterable) => aggregate(iterable, (a, b) => ((b > a) ? b : a));

/** Returns the largest value of all elements in the iterable. */
exports.min = (iterable) => aggregate(iterable, (a, b) => ((b < a) ? b : a));

/** Returns a string of all elements in the iterable
 *  joined together seperated by the specified string. */
exports.join = (iterable, seperator = ", ") => ("" + aggregate(iterable, (a, b) => `${ a }${ seperator }${ b }`));
