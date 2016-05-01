(function (global, factory) {
  if (typeof define === "function" && define.amd) {
    define(['exports', './gimgen'], factory);
  } else if (typeof exports !== "undefined") {
    factory(exports, require('./gimgen'));
  } else {
    var mod = {
      exports: {}
    };
    factory(mod.exports, global.gimgen);
    global.gimgenImplementations = mod.exports;
  }
})(this, function (exports, _gimgen) {
  'use strict';

  Object.defineProperty(exports, "__esModule", {
    value: true
  });
  exports.after = exports.debounce = exports.throttle = exports.once = undefined;
  var once = exports.once = (0, _gimgen.invokableGimgen)(function (_ref) {
    var invokedSignal = _ref.invokedSignal;
    return function* (fn) {
      var val = void 0;
      yield invokedSignal(function () {
        return val = fn.apply(undefined, arguments);
      });
      while (true) {
        yield invokedSignal(function () {
          return val;
        });
      }
    };
  });

  var throttle = exports.throttle = (0, _gimgen.invokableGimgen)(function (_ref2) {
    var invokedSignal = _ref2.invokedSignal;
    return function* (ms, fn) {
      while (true) {
        yield invokedSignal();
        yield (0, _gimgen.timeoutSignal)(ms);
        fn();
      }
    };
  });

  var debounce = exports.debounce = (0, _gimgen.invokableGimgen)(function (_ref3) {
    var invokedSignal = _ref3.invokedSignal;
    return function* (ms, fn) {
      yield invokedSignal();
      while (true) {
        var timePassed = (0, _gimgen.timeoutSignal)(ms);
        var nextSignal = yield (0, _gimgen.anySignal)(timePassed, invokedSignal());
        if (timePassed === nextSignal) {
          fn();
          yield invokedSignal();
        }
      }
    };
  });

  var after = exports.after = (0, _gimgen.invokableGimgen)(function (_ref4) {
    var invokedSignal = _ref4.invokedSignal;
    return function* (count, fn) {
      for (var i = 0; i < count; i += 1) {
        yield invokedSignal(function () {
          return null;
        });
      }while (true) {
        yield invokedSignal(fn);
      }
    };
  });
});