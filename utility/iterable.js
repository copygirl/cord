"use strict";

let Iterable = module.exports = class Iterable {
  
  constructor(iterable) {
    if (iterable instanceof Function)
      this[Symbol.iterator] = iterable;
    else if (Iterable.isIterable(iterable))
      this[Symbol.iterator] = iterable[Symbol.iterable].bind(iterable);
    else throw new Error("iterable is neither a function nor an iterable");
  }
  
  /** Returns if the specified object is iterable
   *  (= has property [System.iterator] set to a function). */
  static isIterable(obj) {
    return ((obj != null) && (typeof obj[Symbol.iterator] == "function"));
  }
  
  // ========== ITERABLE INSTANTIATION ==========
  
  /** Alternative way of creating an Iterable.
   *  Because "Iterable.of(obj)" looks better than "new Iterable(obj)". */
  static of(iterable) {
    return new Iterable(iterable);
  }
  
  /** Returns an Iterable that yields the value a specified number
   *  of times, or indefinitely if the times parameter is omitted. */
  static repeat(value, times = Number.POSITIVE_INFINITY) {
    return Iterable.of(function*() {
      for (let i = 0; i < times; times++)
        yield value;
    });
  }
  
  /** Returns an Iterable that yields a range of values. */
  static range(start, count, by = 1) {
    return Iterable.of(function*() {
      for (let i = 0; i < count; i++)
        yield (start + i * by);
    });
  }
  
  // ========== CREATE ITERABLE FROM OBJECT ==========
  
  /** Returns an Iterable that yields all values of the specified object. */
  static values(obj, own = true) {
    return Iterable.of(function*() {
      for (let key in obj)
        if (!own || obj.hasOwnProperty(key))
          yield obj[key];
    });
  }
  
  /** Returns an Iterable that yields [ key, value ]
   *  arrays for every property of the specified object. */
  static entries(obj, own = true) {
    return Iterable.of(function*() {
      for (let key in obj)
        if (!own || obj.hasOwnProperty(key))
          yield [ key, obj[key] ];
    });
  }
  
  // ========== INSTANCE PROPERTIES / METHODS ==========
  
  /** Returns the number of elements in the Iterable. */
  get count() { return Iterable.count(this); }
  /** Returns if the Iterable is empty. */
  get empty() { return Iterable.empty(this); }
  
  /** Returns if all elements of the Iterable satisfy the function. */
  all(test) { return Iterable.all(this, test); }
  /** Returns if at least one of the Iterable's elements satisfies the function. */
  any(test) { return Iterable.any(this, test); }
  
  /** Returns the first element of the Iterable that matches the
   *  specified function (or any element if omitted), or the
   *  default value if none matched / the Iterable was empty. */
  first(test, defaultValue) { return Iterable.first(this, test, defaultValue); }
  /** Returns the last element of the Iterable that matches the
   *  specified function (or any element if omitted), or the
   *  default value if none matched / the Iterable was empty. */
  last(test, defaultValue) { return Iterable.last(this, test, defaultValue); }
  
  aggregate(value, func) { return Iterable.aggregate(this, value, func); }
  /** Returns the sum of all elements in the iterable. */
  sum() { return Iterable.sum(this); }
  /** Returns the largest value of all elements in the iterable. */
  min() { return Iterable.min(this); }
  /** Returns the smallest value of all elements in the iterable. */
  max() { return Iterable.max(this); }
  /** Returns a string of all elements in the iterable
   *  joined together seperated by the specified string. */
  join(seperator = ", ") { return Iterable.join(this, seperator); }
  
  /** Returns an Iterable that yields elements of the
   *  source Iterable transformed using the function. */
  map(func) { return Iterable.map(this, func); }
  /** Returns an Iterable that yields only elements of
   *  the source Iterable that satisfy the function. */
  filter(func) { return Iterable.filter(this, func); }
  
  /** Returns an Iterable that yields up to a
   *  number of elements from the source Iterable. */
  take(count) { return Iterable.take(this, count); }
  /** Returns an Iterable that skips a number of elements
   *  from the source Iterable, before yielding the rest. */
  skip(count) { return Iterable.skip(this, count); }
  /** Returns an Iterable that yields elements from the
   *  source Iterable as long as the test function succeeds. */
  takeWhile(test) { return Iterable.takeWhile(this, test); }
  /** Returns an Iterable that skips elements from the source Iterable
   *  as long as the test function succeeds, before yielding the rest. */
  skipWhile(test) { return Iterable.skipWhile(this, test); }
  
  /** Returns an Iterable that yields elements of this
   *  Iterable, and then all other Iterables in order. */
  concat(...iterables) { return Iterable.concat(this, ...iterables); }
  /** Returns an Iterable that yields the specified
   *  values, followed by all elements of the Iterable. */
  prepend(...values) { return Iterable.prepend(this, ...values); }
  /** Returns an Iterable that yields all elements of
   *  the Iterable, followed by the specified values. */
  append(...values) { return Iterable.append(this, ...values); }
  
  /** Returns an Iterable that merges elements from both Iterables by taking one
   *  element from each, passing them to the function, and yielding the result. */
  zip(other, func) { return Iterable.zip(this, other, func); }
  
  /** Returns an Array containing all of the Iterable's elements. */
  toArray() { return Array.from(this); }
  /** Returns a Set containing all of the Iterable's elements. */
  toSet() { return new Set(this); }
  
  // ========== FUNCTION THAT RETURN A SINGLE VALUE ==========
  
  /** Returns the number of elements in the Iterable. */
  static count(iterable) {
    let count = 0;
    for (let _ of iterable) count++;
    return count;
  }
  /** Returns if the Iterable is empty. */
  static empty(iterable) {
    for (let _ of iterable) return true;
    return false;
  }
  
  /** Returns if all elements of the Iterable satisfy the function. */
  static all(iterable, test) {
    for (let element of iterable)
      if (!test(element)) return false;
    return true;
  }
  /** Returns if at least one of the Iterable's elements satisfies the function. */
  static any(iterable, test) {
    for (let element of iterable)
      if (test(element)) return true;
    return false;
  }
  
  /** Returns the first element of the Iterable that matches the
   *  specified function (or any element if omitted), or the
   *  default value if none matched / the Iterable was empty. */
  static first(iterable, test, defaultValue) {
    if (typeof test != "function") {
      defaultValue = test;
      test = undefined;
    }
    for (let element of iterable)
      if ((test === undefined) || test(element))
        return element;
    return defaultValue;
  }
  /** Returns the last element of the Iterable that matches the
   *  specified function (or any element if omitted), or the
   *  default value if none matched / the Iterable was empty. */
  static last(iterable, test, defaultValue) {
    if (typeof test != "function") {
      defaultValue = test;
      test = undefined;
    }
    let last = defaultValue;
    for (let element of iterable)
      if ((test === undefined) || test(element))
        last = element;
    return last;
  }
  
  // ========== AGGREGATE AND RELATED FUNCTIONS ==========
  
  /** Applies an aggregate function over all elements of the iterable, returning
   *  the result. Supplying an initial value is optional. Without it, the first
   *  element is used, and if the iterable is empty, undefined is returned. */
  static aggregate(iterable, value, func) {
    let skip = false;
    if (func === undefined)
      [ func, value, skip ] = [ value, undefined, true ];
    for (let element of iterable)
      value = (skip ? (skip = false, element)
                    : func(value, element));
    return value;
  };
  
  /** Returns the sum of all elements in the iterable. */
  static sum(iterable) { return Iterable.aggregate(iterable, 0, (a, b) => a + b); }
  /** Returns the largest value of all elements in the iterable. */
  static min(iterable) { return Iterable.aggregate(iterable, (a, b) => ((b < a) ? b : a)); }
  /** Returns the smallest value of all elements in the iterable. */
  static max(iterable) { return Iterable.aggregate(iterable, (a, b) => ((b > a) ? b : a)); }
  
  /** Returns a string of all elements in the iterable
   *  joined together seperated by the specified string. */
  static join(iterable, seperator = ", ") {
    return ("" + Iterable.aggregate(iterable, (a, b) => `${ a }${ seperator }${ b }`)); }
  
  // ========== TRANSFORMATIVE FUNCTIONS ==========
  
  /** Returns an Iterable that yields elements of the
   *  source Iterable transformed using the function. */
  static map(iterable, func) {
    return Iterable.of(function*() {
      for (let element of iterable)
        yield func(element);
    });
  }
  
  /** Returns an Iterable that yields only elements of
   *  the source Iterable that satisfy the function. */
  static filter(iterable, func) {
    return Iterable.of(function*() {
      for (let element of iterable)
        if (func(element))
          yield element;
    });
  }
  
  // ========== TAKE AND SKIP (WHILE) ==========
  
  /** Returns an Iterable that yields up to a
   *  number of elements from the source Iterable. */
  static take(iterable, count) {
    return Iterable.of(function*() {
        let i = 0;
        if (count > 0)
          for (let element of iterable) {
            yield element;
            if (++i >= count) break;
          }
    });
  }
  /** Returns an Iterable that skips a number of elements
   *  from the source Iterable, before yielding the rest. */
  static skip(iterable, count) {
    return Iterable.of(function*() {
      let i = 0;
      for (let element of iterable) {
        if (++i <= count) continue;
        yield element;
      }
    });
  }
  
  /** Returns an Iterable that yields elements from the
   *  source Iterable as long as the test function succeeds. */
  static takeWhile(iterable, test) {
    return Iterable.of(function*() {
        for (let element of iterable) {
          if (!test(element)) break;
          yield element;
        }
    });
  }
  /** Returns an Iterable that skips elements from the source Iterable
   *  as long as the test function succeeds, before yielding the rest. */
  static skipWhile(iterable, test) {
    return Iterable.of(function*() {
      let skip = true;
      for (let element of iterable) {
        if (skip && (skip = test(element))) continue;
        yield element;
      }
    });
  }
  
  // ========== CONCATENATION FUNCTIONS ==========
  
  /** Returns an Iterable that yields elements of all Iterables in order. */
  static concat(...iterables) {
    return Iterable.of(function*() {
      for (let iterable of iterables)
        yield* iterable;
    });
  }
  
  /** Returns an Iterable that yields the specified
   *  values, followed by all elements of the Iterable. */
  static prepend(iterable, ...values) { return Iterable.concat(values, iterable); }
  /** Returns an Iterable that yields all elements of
   *  the Iterable, followed by the specified values. */
  static append(iterable, ...values) { return Iterable.concat(iterable, values); }
  
  /** Returns an Iterable that merges elements from both Iterables by taking one
   *  element from each, passing them to the function, and yielding the result. */
  static zip(first, second, func) {
    return Iterable.of(function*() {
      first  = first[Symbol.iterator]();
      second = second[Symbol.iterator]();
      while (true) {
        let { value: element1, done: done1 } = first.next();
        let { value: element2, done: done2 } = second.next();
        if (done1 || done2) break;
        yield func(element1, element2);
      }
    });
  }
  
};
