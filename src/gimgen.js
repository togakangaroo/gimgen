"use strict";
var __spreadArrays = (this && this.__spreadArrays) || function () {
    for (var s = 0, i = 0, il = arguments.length; i < il; i++) s += arguments[i].length;
    for (var r = Array(s), k = 0, i = 0; i < il; i++)
        for (var a = arguments[i], j = 0, jl = a.length; j < jl; j++, k++)
            r[k] = a[j];
    return r;
};
exports.__esModule = true;
var isFunction = function (x) { return 'function' === typeof x; };
var foo = Object.entries({});
var omitEntries = function (obj) {
    var propsToOmit = [];
    for (var _i = 1; _i < arguments.length; _i++) {
        propsToOmit[_i - 1] = arguments[_i];
    }
    return Object.keys(obj).map(function (k) { return [k, obj[k]]; })
        .filter(function (_a) {
        var key = _a[0];
        return !~propsToOmit.indexOf(key);
    });
};
var rebindFuncs = function (entries, getFirstParam) {
    return entries.map(function (_a) {
        var key = _a[0], val = _a[1];
        return [
            key,
            !isFunction(val) ? val : function () {
                var args = [];
                for (var _i = 0; _i < arguments.length; _i++) {
                    args[_i] = arguments[_i];
                }
                return val.apply(void 0, __spreadArrays([getFirstParam()], args));
            }
        ];
    }).reduce(function (obj, _a) {
        var key = _a[0], val = _a[1];
        return (obj[key] = val, obj);
    }, {});
};
var run = function (fn) { return fn(); }; // by default synchronous
// By default, runs the next yielded step immediately when a promise is resolved. In certain debugging situations
// this can lead to a constantly growing call stack. Call this function to change out the running strategy being used
// eg. This will schedule the continuation on the tick following promise resolution
//   changeRunStrategy(fn => setTimeout(fn))
exports.changeRunStrategy = function (runFn) { return run = runFn; };
exports.createSignalFactory = function (name, propsOrCreatePromise) {
    if (isFunction(propsOrCreatePromise))
        return exports.createSignalFactory(name, { createPromise: propsOrCreatePromise });
    var props = propsOrCreatePromise;
    var createPromise = props.createPromise, _a = props.getInitialState, getInitialState = _a === void 0 ? null : _a;
    var templateEntries = omitEntries(props, 'createPromise', 'getInitialState');
    var createInitial = isFunction(getInitialState) ? getInitialState : function () { return getInitialState; };
    return function () {
        var signalInvocationArgs = [];
        for (var _i = 0; _i < arguments.length; _i++) {
            signalInvocationArgs[_i] = arguments[_i];
        }
        var state = createInitial.apply(void 0, signalInvocationArgs);
        var setState = function (newState) { return state = newState; };
        var getFirstParam = function () { return ({ state: state, setState: setState }); };
        return Object.assign({ toString: function () { return name; } }, rebindFuncs(templateEntries, getFirstParam), { createPromise: function () { return createPromise.apply(void 0, __spreadArrays([getFirstParam()], signalInvocationArgs)); } });
    };
};
// Convert a DOM event to a signal
// Usage:
//  yield domEventToSignal(document.querySelector('#log-in'), 'click')
exports.domEventToSignal = function (el, eventName) {
    return exports.createSignalFactory("DOM event " + eventName, {
        createPromise: function (_a) {
            var setState = _a.setState;
            return new Promise(function (resolve) {
                el.addEventListener(eventName, function triggerResolve(event) {
                    el.removeEventListener(eventName, triggerResolve);
                    setState(event);
                    resolve(event);
                });
            });
        },
        getLastEvent: function (_a) {
            var state = _a.state;
            return state;
        }
    })();
};
// Convert a then-able promise to a signal
// Usage:
//  yield promiseToSignal($.get('/data'))
exports.promiseToSignal = function (promise) { return exports.createSignalFactory('promiseSignal', function () { return promise; })(); };
// Signal that triggers in the passed in amount of ms
// Usage:
//  yield timeoutSignal(100)
exports.timeoutSignal = exports.createSignalFactory('timeoutSignal', function (_, ms) {
    return new Promise(function (resolve) { return setTimeout(resolve, ms); });
});
// Signal that you trigger manually
// Usage:
//  const sig = manualSignal()
//  const firstArg = yield sig
//  sig.createPromise().then((...args) => doStuff(...args))
//  sig.createPromise().then((...args) => doOtherStuff(...args))
//  sig.trigger(1, 2, 3)
exports.manualSignal = exports.createSignalFactory('manualSignal', {
    getInitialState: function () { return []; },
    createPromise: function (_a) {
        var toNotify = _a.state, setState = _a.setState;
        return new Promise(function (resolve) { return setState(__spreadArrays([resolve], toNotify)); });
    },
    trigger: function (_a) {
        var toNotify = _a.state, setState = _a.setState;
        var args = [];
        for (var _i = 1; _i < arguments.length; _i++) {
            args[_i - 1] = arguments[_i];
        }
        if (args.length > 1)
            setState([]);
        toNotify.forEach(function (fn) { return fn.apply(void 0, args); });
    }
});
exports.firstResolvedPromise = function (promises) {
    return new Promise(function (resolve) { return promises.map(function (promise) { return promise.then(function (result) {
        resolve({ promise: promise, result: result });
    }); }); });
};
// Signal that resolves when any of the signals passed in resolve. The resulting object will contain
//   signal - the signal object that was resolved
//   result - the payload the signal was triggered with
// Usage:
//  const {signal, result} = anySignal(timeoutSignal(300), x.invokedSignal())
exports.anySignal = exports.createSignalFactory('anySignal', function (_) {
    var signals = [];
    for (var _i = 1; _i < arguments.length; _i++) {
        signals[_i - 1] = arguments[_i];
    }
    var signalPromise = signals.map(function (signal) { return ({ signal: signal, promise: signal.createPromise() }); });
    return exports.firstResolvedPromise(signalPromise.map(function (x) { return x.promise; }))
        .then(function (_a) {
        var resolvedPromise = _a.promise, result = _a.result;
        var signal = signalPromise.filter(function (x) { return x.promise === resolvedPromise; })[0].signal;
        return { signal: signal, result: result };
    });
});
// Create a signal used to control other signals in a finer detail. Takes a  signal generator that
// takes a parameter with an emit method. Returns a signal that will trigger when the emit method is called
// Usage:
// const keysDown = controlSignal(function*({emit}) {
//  const keydown = domEventToSignal(document, 'keydown')
//  const keyup = domEventToSignal(document, 'keyup')
//  const currentlyPressed = {}
//  let interaction
//  while({signal: interaction} = yield anySignal(keydown, keyup)) {
//    currentlyPressed[interaction.getLastEvent().code] = (keydown === interaction)
//    emit(currentlyPressed)
//  }
// })
// ...
// const keysPressed = yield keysDown
exports.controlSignal = exports.createSignalFactory('controlSignal', {
    getInitialState: function (signalGenerator) {
        var triggerSignal = exports.manualSignal();
        exports.gimgen(signalGenerator)({ emit: triggerSignal.trigger });
        return triggerSignal;
    },
    createPromise: function (_a) {
        var state = _a.state;
        return state.createPromise();
    }
});
var asyncRecursive = function (fn) { return function () {
    var args = [];
    for (var _i = 0; _i < arguments.length; _i++) {
        args[_i] = arguments[_i];
    }
    var recurse = function () {
        var nextArgs = [];
        for (var _i = 0; _i < arguments.length; _i++) {
            nextArgs[_i] = arguments[_i];
        }
        return run(fn.bind.apply(fn, __spreadArrays([null, recurse], nextArgs)));
    };
    fn.apply(void 0, __spreadArrays([recurse], args));
}; };
var runPromises = asyncRecursive(function (recurse, iterator, valueToYield) {
    var current = iterator.next(valueToYield);
    return current.done ?
        Promise.resolve() :
        current.value.createPromise()
            .then(function (promiseParam) { return recurse(iterator, promiseParam); }, function (err) { return iterator["throw"](err); });
});
exports.gimgen = function (generator) { return function () {
    var generatorArgs = [];
    for (var _i = 0; _i < arguments.length; _i++) {
        generatorArgs[_i] = arguments[_i];
    }
    var iterator = generator.apply(void 0, generatorArgs);
    return runPromises(iterator);
}; };
exports.runGimgen = function (generator) { return exports.gimgen(generator)(); };
// Generate a function that takes a closure returning a gimgen generator. This returns a new function
// The closure will be passed an object containing an `invokedSignal` method. This
// will be a signal that emits when the function returned by invvokeableGimgen is invoked
//invokableGimgen(({invokedSignal}) => function*(...args)) -> function
exports.invokableGimgen = function (defineGenerator) { return function () {
    var generatorArgs = [];
    for (var _i = 0; _i < arguments.length; _i++) {
        generatorArgs[_i] = arguments[_i];
    }
    var nextInvocationSignal = { trigger: function () { } };
    var getNextReturn = function () { };
    var setupInvokedSignal = function (resolveNextReturnFunc) { return function () {
        var args = [];
        for (var _i = 0; _i < arguments.length; _i++) {
            args[_i] = arguments[_i];
        }
        getNextReturn = resolveNextReturnFunc.apply(void 0, args);
        return nextInvocationSignal = exports.manualSignal.apply(void 0, args);
    }; };
    var invokedSignalExact = setupInvokedSignal(function (x) { return function () { return x; }; });
    var invokedSignal = setupInvokedSignal(function (x) { return isFunction(x) ? x : function () { return x; }; });
    var invocationHelpers = { invokedSignalExact: invokedSignalExact, invokedSignal: invokedSignal };
    exports.gimgen(defineGenerator(invocationHelpers)).apply(void 0, generatorArgs);
    return function () {
        var args = [];
        for (var _i = 0; _i < arguments.length; _i++) {
            args[_i] = arguments[_i];
        }
        var res = getNextReturn.apply(void 0, args);
        nextInvocationSignal.trigger.apply(nextInvocationSignal, args);
        return res;
    };
}; };
exports["default"] = exports.gimgen;
