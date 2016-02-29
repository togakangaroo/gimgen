'use strict';

Object.defineProperty(exports, "__esModule", {
  value: true
});
exports.after = exports.debounce = exports.throttle = exports.once = undefined;

var _gimgen = require('./gimgen');

const once = exports.once = (0, _gimgen.invokableGimgen)(_ref => {
  let invokedSignal = _ref.invokedSignal;
  return function* (fn) {
    let val;
    yield invokedSignal(function () {
      return val = fn(...arguments);
    });
    while (true) yield invokedSignal(() => val);
  };
});

const throttle = exports.throttle = (0, _gimgen.invokableGimgen)(_ref2 => {
  let invokedSignal = _ref2.invokedSignal;
  return function* (ms, fn) {
    while (true) {
      yield invokedSignal();
      yield (0, _gimgen.timeoutSignal)(ms);
      fn();
    }
  };
});

const debounce = exports.debounce = (0, _gimgen.invokableGimgen)(_ref3 => {
  let invokedSignal = _ref3.invokedSignal;
  return function* (ms, fn) {
    yield invokedSignal();
    while (true) {
      const timePassed = (0, _gimgen.timeoutSignal)(ms);
      const nextSignal = yield (0, _gimgen.anySignal)(timePassed, invokedSignal());
      if (timePassed === nextSignal) {
        fn();
        yield invokedSignal();
      }
    }
  };
});

const after = exports.after = (0, _gimgen.invokableGimgen)(_ref4 => {
  let invokedSignal = _ref4.invokedSignal;
  return function* (count, fn) {
    for (let i = 0; i < count; i += 1) yield invokedSignal(() => null);
    while (true) {
      yield invokedSignal(fn);
    }
  };
});