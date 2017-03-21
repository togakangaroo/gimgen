(function (global, factory) {
  if (typeof define === "function" && define.amd) {
    define(['exports'], factory);
  } else if (typeof exports !== "undefined") {
    factory(exports);
  } else {
    var mod = {
      exports: {}
    };
    factory(mod.exports);
    global.gimgen = mod.exports;
  }
})(this, function (exports) {
  'use strict';

  Object.defineProperty(exports, "__esModule", {
    value: true
  });

  function _toConsumableArray(arr) {
    if (Array.isArray(arr)) {
      for (var i = 0, arr2 = Array(arr.length); i < arr.length; i++) {
        arr2[i] = arr[i];
      }

      return arr2;
    } else {
      return Array.from(arr);
    }
  }

  var _slicedToArray = function () {
    function sliceIterator(arr, i) {
      var _arr = [];
      var _n = true;
      var _d = false;
      var _e = undefined;

      try {
        for (var _i = arr[Symbol.iterator](), _s; !(_n = (_s = _i.next()).done); _n = true) {
          _arr.push(_s.value);

          if (i && _arr.length === i) break;
        }
      } catch (err) {
        _d = true;
        _e = err;
      } finally {
        try {
          if (!_n && _i["return"]) _i["return"]();
        } finally {
          if (_d) throw _e;
        }
      }

      return _arr;
    }

    return function (arr, i) {
      if (Array.isArray(arr)) {
        return arr;
      } else if (Symbol.iterator in Object(arr)) {
        return sliceIterator(arr, i);
      } else {
        throw new TypeError("Invalid attempt to destructure non-iterable instance");
      }
    };
  }();

  var isFunction = function (x) {
    return 'function' === typeof x;
  };
  var contains = function (arr, val) {
    return ~arr.indexOf(val);
  };

  var omitEntries = function (obj) {
    for (var _len = arguments.length, propsToOmit = Array(_len > 1 ? _len - 1 : 0), _key = 1; _key < _len; _key++) {
      propsToOmit[_key - 1] = arguments[_key];
    }

    return Object.keys(obj).map(function (k) {
      return [k, obj[k]];
    }).filter(function (_ref) {
      var _ref2 = _slicedToArray(_ref, 1),
          key = _ref2[0];

      return !contains(propsToOmit, key);
    });
  };
  var rebindFuncs = function (entries, getFirstParam) {
    return entries.map(function (_ref3) {
      var _ref4 = _slicedToArray(_ref3, 2),
          key = _ref4[0],
          val = _ref4[1];

      return [key, !isFunction(val) ? val : function () {
        for (var _len2 = arguments.length, args = Array(_len2), _key2 = 0; _key2 < _len2; _key2++) {
          args[_key2] = arguments[_key2];
        }

        return val.apply(undefined, [getFirstParam()].concat(args));
      }];
    }).reduce(function (obj, _ref5) {
      var _ref6 = _slicedToArray(_ref5, 2),
          key = _ref6[0],
          val = _ref6[1];

      return obj[key] = val, obj;
    }, {});
  };

  var defer = function (fn) {
    return setTimeout(fn);
  };
  // gm - annyingly, necessary for tests to work
  var _changeDefer = exports._changeDefer = function (fn) {
    return defer = fn;
  };

  // Returns function that when invoked will return a representation of a signal.
  // A signal is anything with a `createPromise` method
  // See below for usages.
  var createSignalFactory = exports.createSignalFactory = function (name, propsOrCreatePromise) {
    if (isFunction(propsOrCreatePromise)) return createSignalFactory(name, { createPromise: propsOrCreatePromise });

    var createPromise = propsOrCreatePromise.createPromise,
        _propsOrCreatePromise = propsOrCreatePromise.getInitialState,
        getInitialState = _propsOrCreatePromise === undefined ? null : _propsOrCreatePromise;

    var templateEntries = omitEntries(propsOrCreatePromise, 'createPromise', 'getInitialState');
    var createInitial = isFunction(getInitialState) ? getInitialState : function () {
      return getInitialState;
    };
    return function () {
      for (var _len3 = arguments.length, signalInvocationArgs = Array(_len3), _key3 = 0; _key3 < _len3; _key3++) {
        signalInvocationArgs[_key3] = arguments[_key3];
      }

      var state = createInitial.apply(undefined, signalInvocationArgs);
      var setState = function (newState) {
        return state = newState;
      };
      var getFirstParam = function () {
        return { state: state, setState: setState };
      };
      return Object.assign({ toString: function () {
          return name;
        } }, rebindFuncs(templateEntries, getFirstParam), { createPromise: function () {
          return createPromise.apply(undefined, [getFirstParam()].concat(signalInvocationArgs));
        } });
    };
  };

  // Convert a DOM event to a signal
  // Usage:
  //  yield domEventToSignal(document.querySelector('#log-in'), 'click')
  var domEventToSignal = exports.domEventToSignal = function (el, eventName) {
    return createSignalFactory('DOM event ' + eventName, {
      createPromise: function (_ref7) {
        var setState = _ref7.setState;
        return new Promise(function (resolve) {
          el.addEventListener(eventName, function triggerResolve(event) {
            el.removeEventListener(eventName, triggerResolve);
            setState(event);
            resolve(event);
          });
        });
      },
      getLastEvent: function (_ref8) {
        var state = _ref8.state;
        return state;
      }
    })();
  };

  // Convert a then-able promise to a signal
  // Usage:
  //  yield promiseToSignal($.get('/data'))
  var promiseToSignal = exports.promiseToSignal = function (promise) {
    return createSignalFactory('promiseSignal', function () {
      return promise;
    })();
  };

  // Signal that triggers in the passed in amount of ms
  // Usage:
  //  yield timeoutSignal(100)
  var timeoutSignal = exports.timeoutSignal = createSignalFactory('timeoutSignal', function (_, ms) {
    return new Promise(function (resolve) {
      return setTimeout(resolve, ms);
    });
  });

  // Signal that you trigger manually
  // Usage:
  //  const sig = manualSignal()
  //  const firstArg = yield sig
  //  sig.createPromise().then((...args) => doStuff(...args))
  //  sig.createPromise().then((...args) => doOtherStuff(...args))
  //  sig.trigger(1, 2, 3)
  var manualSignal = exports.manualSignal = createSignalFactory('manualSignal', {
    getInitialState: function () {
      return [];
    },
    createPromise: function (_ref9) {
      var toNotify = _ref9.state,
          setState = _ref9.setState;
      return new Promise(function (resolve) {
        return setState([resolve].concat(_toConsumableArray(toNotify)));
      });
    },
    trigger: function (_ref10) {
      for (var _len4 = arguments.length, args = Array(_len4 > 1 ? _len4 - 1 : 0), _key4 = 1; _key4 < _len4; _key4++) {
        args[_key4 - 1] = arguments[_key4];
      }

      var toNotify = _ref10.state,
          setState = _ref10.setState;

      if (args.length > 1) setState([]);
      toNotify.forEach(function (fn) {
        return fn.apply(undefined, args);
      });
    }
  });

  var firstResolvedPromise = exports.firstResolvedPromise = function (promises) {
    return new Promise(function (resolve) {
      return promises.map(function (promise) {
        return promise.then(function (result) {
          resolve({ promise: promise, result: result });
        });
      });
    });
  };

  // Signal that resolves when any of the signals passed in resolve. The resulting object will contain
  //   signal - the signal object that was resolved
  //   result - the payload the signal was triggered with
  // Usage:
  //  const {signal, result} = anySignal(timeoutSignal(300), x.invokedSignal())
  var anySignal = exports.anySignal = createSignalFactory('anySignal', function (_) {
    for (var _len5 = arguments.length, signals = Array(_len5 > 1 ? _len5 - 1 : 0), _key5 = 1; _key5 < _len5; _key5++) {
      signals[_key5 - 1] = arguments[_key5];
    }

    var signalPromise = signals.map(function (signal) {
      return { signal: signal, promise: signal.createPromise() };
    });
    return firstResolvedPromise(signalPromise.map(function (x) {
      return x.promise;
    })).then(function (_ref11) {
      var resolvedPromise = _ref11.promise,
          result = _ref11.result;

      var signal = signalPromise.filter(function (x) {
        return x.promise === resolvedPromise;
      })[0].signal;
      return { signal: signal, result: result };
    });
  });

  // Create a signal used to control other signals in a finer detail. Takes a  signal generator that
  // takes a parameter with an emit method. Returns a signal that will trigger when the emit method is called
  // Usage:
  // const keysDown = controlSignal(function*({emit}) {
  // 	const keydown = domEventToSignal(document, 'keydown')
  // 	const keyup = domEventToSignal(document, 'keyup')
  // 	const currentlyPressed = {}
  // 	let interaction
  // 	while({signal: interaction} = yield anySignal(keydown, keyup)) {
  // 		currentlyPressed[interaction.getLastEvent().code] = (keydown === interaction)
  // 		emit(currentlyPressed)
  // 	}
  // })
  // ...
  // const keysPressed = yield keysDown
  var controlSignal = exports.controlSignal = createSignalFactory('controlSignal', {
    getInitialState: function (signalGenerator) {
      var triggerSignal = manualSignal();
      gimgen(signalGenerator)({ emit: triggerSignal.trigger });
      return triggerSignal;
    },
    createPromise: function (_ref12) {
      var state = _ref12.state;
      return state.createPromise();
    }
  });

  var run = function (fn) {
    return function () {
      return fn();
    };
  };
  var asyncRecursive = function (fn) {
    return function () {
      for (var _len6 = arguments.length, args = Array(_len6), _key6 = 0; _key6 < _len6; _key6++) {
        args[_key6] = arguments[_key6];
      }

      var recurse = function () {
        for (var _len7 = arguments.length, nextArgs = Array(_len7), _key7 = 0; _key7 < _len7; _key7++) {
          nextArgs[_key7] = arguments[_key7];
        }

        return defer(run(fn.bind.apply(fn, [null, recurse].concat(nextArgs))));
      };
      fn.apply(undefined, [recurse].concat(args));
    };
  };

  var runPromises = asyncRecursive(function (recurse, iterator, valueToYield) {
    var current = iterator.next(valueToYield);
    return current.done ? Promise.resolve() : current.value.createPromise().then(function (promiseParam) {
      return recurse(iterator, promiseParam);
    }, function (err) {
      return iterator.throw(err);
    });
  });
  var gimgen = exports.gimgen = function (generator) {
    return function () {
      var iterator = generator.apply(undefined, arguments);
      return runPromises(iterator);
    };
  };

  var runGimgen = exports.runGimgen = function (generator) {
    return gimgen(generator)();
  };

  // Generate a function that takes a closure returning a gimgen generator. This returns a new function
  // The closure will be passed an object containing an `invokedSignal` method. This
  // will be a signal that emits when the function returned by invvokeableGimgen is invoked
  //invokableGimgen(({invokedSignal}) => function*(...args)) -> function
  var invokableGimgen = exports.invokableGimgen = function (defineGenerator) {
    return function () {
      var nextInvocationSignal = { trigger: function () {} };
      var getNextReturn = function () {};
      var setupInvokedSignal = function (resolveNextReturnFunc) {
        return function () {
          getNextReturn = resolveNextReturnFunc.apply(undefined, arguments);
          return nextInvocationSignal = manualSignal.apply(undefined, arguments);
        };
      };
      var invokedSignalExact = setupInvokedSignal(function (x) {
        return function () {
          return x;
        };
      });
      var invokedSignal = setupInvokedSignal(function (x) {
        return isFunction(x) ? x : function () {
          return x;
        };
      });

      var invocationHelpers = { invokedSignalExact: invokedSignalExact, invokedSignal: invokedSignal };
      gimgen(defineGenerator(invocationHelpers)).apply(undefined, arguments);
      return function () {
        var _nextInvocationSignal;

        var res = getNextReturn.apply(undefined, arguments);
        (_nextInvocationSignal = nextInvocationSignal).trigger.apply(_nextInvocationSignal, arguments);
        return res;
      };
    };
  };

  exports.default = gimgen;
});