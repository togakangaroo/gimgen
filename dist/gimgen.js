'use strict';

Object.defineProperty(exports, "__esModule", {
  value: true
});

var _slicedToArray = function () { function sliceIterator(arr, i) { var _arr = []; var _n = true; var _d = false; var _e = undefined; try { for (var _i = arr[Symbol.iterator](), _s; !(_n = (_s = _i.next()).done); _n = true) { _arr.push(_s.value); if (i && _arr.length === i) break; } } catch (err) { _d = true; _e = err; } finally { try { if (!_n && _i["return"]) _i["return"](); } finally { if (_d) throw _e; } } return _arr; } return function (arr, i) { if (Array.isArray(arr)) { return arr; } else if (Symbol.iterator in Object(arr)) { return sliceIterator(arr, i); } else { throw new TypeError("Invalid attempt to destructure non-iterable instance"); } }; }();

function _objectDestructuringEmpty(obj) { if (obj == null) throw new TypeError("Cannot destructure undefined"); }

const isFunction = x => 'function' === typeof x;
const contains = (arr, val) => ~arr.indexOf(val);

const omitEntries = function (obj) {
  for (var _len = arguments.length, propsToOmit = Array(_len > 1 ? _len - 1 : 0), _key = 1; _key < _len; _key++) {
    propsToOmit[_key - 1] = arguments[_key];
  }

  return Object.keys(obj).map(k => [k, obj[k]]).filter(_ref => {
    var _ref2 = _slicedToArray(_ref, 1);

    let key = _ref2[0];
    return !contains(propsToOmit, key);
  });
};
const rebindFuncs = (entries, getFirstParam) => entries.map(_ref3 => {
  var _ref4 = _slicedToArray(_ref3, 2);

  let key = _ref4[0];
  let val = _ref4[1];
  return [key, !isFunction(val) ? val : function () {
    for (var _len2 = arguments.length, args = Array(_len2), _key2 = 0; _key2 < _len2; _key2++) {
      args[_key2] = arguments[_key2];
    }

    return val(getFirstParam(), ...args);
  }];
}).reduce((obj, _ref5) => {
  var _ref6 = _slicedToArray(_ref5, 2);

  let key = _ref6[0];
  let val = _ref6[1];
  return obj[key] = val, obj;
}, {});

// Returns function that when invoked will return a representation of a signal.
// A signal is anything with a `createPromise` method
// See below for usages.
const createSignal = exports.createSignal = (name, propsOrCreatePromise) => {
  if (isFunction(propsOrCreatePromise)) return createSignal(name, { createPromise: propsOrCreatePromise });

  const createPromise = propsOrCreatePromise.createPromise;
  var _propsOrCreatePromise = propsOrCreatePromise.getInitialState;
  const getInitialState = _propsOrCreatePromise === undefined ? null : _propsOrCreatePromise;

  const templateEntries = omitEntries(propsOrCreatePromise, 'createPromise', 'getInitialState');
  const createInitial = isFunction(getInitialState) ? getInitialState : () => getInitialState;
  return function () {
    for (var _len3 = arguments.length, signalInvocationArgs = Array(_len3), _key3 = 0; _key3 < _len3; _key3++) {
      signalInvocationArgs[_key3] = arguments[_key3];
    }

    let state = createInitial();
    const setState = newState => state = newState;
    const getFirstParam = () => ({ state, setState });
    return Object.assign({ toString: () => name }, rebindFuncs(templateEntries, getFirstParam), { createPromise: () => createPromise(getFirstParam(), ...signalInvocationArgs) });
  };
};

// Convert a DOM event to a signal
// Usage:
//  yield domEventToSignal(document.querySelector('#log-in', 'click'))
const domEventToSignal = exports.domEventToSignal = (el, eventName) => createSignal(`DOM event ${ eventName }`, () => new Promise(resolve => {
  el.addEventListener(eventName, function triggerResolve() {
    el.removeEventListener(eventName, triggerResolve);
    resolve(...arguments);
  });
}));

// Convert a then-able promise to a signal
// Usage:
//  yield promiseToSignal($.get('/data'))
const promiseToSignal = exports.promiseToSignal = promise => createSignal('promiseSignal', () => promise);

// Signal that triggers in the passed in amount of ms
// Usage:
//  yield timeoutSignal(100)
const timeoutSignal = exports.timeoutSignal = createSignal('timeoutSignal', (_ref7, ms) => {
  _objectDestructuringEmpty(_ref7);

  return new Promise(resolve => setTimeout(resolve, ms));
});

// Signal that you trigger manually
// Usage:
//  const sig = manualSignal()
//  const firstArg = yield sig
//  sig.createPromise().then((...args) => doStuff(...args))
//  sig.createPromise().then((...args) => doOtherStuff(...args))
//  sig.trigger(1, 2, 3)
const manualSignal = exports.manualSignal = createSignal('manualSignal', {
  getInitialState: () => [],
  createPromise: _ref8 => {
    let toNotify = _ref8.state;
    let setState = _ref8.setState;
    return new Promise(resolve => setState([resolve, ...toNotify]));
  },
  trigger: function (_ref9) {
    for (var _len4 = arguments.length, args = Array(_len4 > 1 ? _len4 - 1 : 0), _key4 = 1; _key4 < _len4; _key4++) {
      args[_key4 - 1] = arguments[_key4];
    }

    let toNotify = _ref9.state;
    let setState = _ref9.setState;

    if (args.length > 1) setState([]);
    toNotify.forEach(fn => fn(...args));
  }
});

const firstResolvedPromise = exports.firstResolvedPromise = promises => new Promise(resolve => promises.map(promise => promise.then(() => resolve({ promise }))));

// Signal that resolves when any of the signals passed in resolve
// Usage:
//  const s = anySignal(timeoutSignal(300), x.invokedSignal())
const anySignal = exports.anySignal = createSignal('anySignal', function (_ref10) {
  for (var _len5 = arguments.length, signals = Array(_len5 > 1 ? _len5 - 1 : 0), _key5 = 1; _key5 < _len5; _key5++) {
    signals[_key5 - 1] = arguments[_key5];
  }

  _objectDestructuringEmpty(_ref10);

  const signalPromise = signals.map(signal => ({ signal, promise: signal.createPromise() }));
  return firstResolvedPromise(signalPromise.map(x => x.promise)).then(_ref11 => {
    let resolvedPromise = _ref11.promise;
    return signalPromise.filter(x => x.promise === resolvedPromise)[0].signal;
  });
});

const runPromises = (getNext, valueToYield) => {
  const current = getNext(valueToYield);
  if (current.done) return;
  current.value.createPromise().then(promiseParam => {
    runPromises(getNext, promiseParam);
  });
};

const gimgen = exports.gimgen = generator => function () {
  const iterator = generator(...arguments);
  runPromises(function () {
    return iterator.next(...arguments);
  });
};

const invokableGimgen = exports.invokableGimgen = defineGenerator => function () {
  let nextInvocationSignal = { trigger: () => {} };
  let getNextReturn = () => {};
  const setupInvokedSignal = resolveNextReturnFunc => function () {
    getNextReturn = resolveNextReturnFunc(...arguments);
    return nextInvocationSignal = manualSignal(...arguments);
  };
  const invokedSignalExact = setupInvokedSignal(x => () => x);
  const invokedSignal = setupInvokedSignal(x => isFunction(x) ? x : () => x);

  const invocationHelpers = { invokedSignalExact, invokedSignal };
  gimgen(defineGenerator(invocationHelpers))(...arguments);
  return function () {
    const res = getNextReturn(...arguments);
    nextInvocationSignal.trigger(...arguments);
    return res;
  };
};

exports.default = gimgen;