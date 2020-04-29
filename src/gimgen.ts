const isFunction = <T>(x: Function | T): x is Function =>
  "function" === typeof x;
type PlainObjectType = { [P in any]: any };
type ObjectKeyType = string | number;
type ObjectEntryType = [ObjectKeyType, unknown];
type FactoryType<T> = (..._: unknown[]) => T;
type ItemOrFactoryType<T> = T | FactoryType<T>;

const omitEntries = (
  obj: PlainObjectType,
  ...propsToOmit: string[]
): ObjectEntryType[] =>
  Object.entries(obj).filter(([key]) => !propsToOmit.includes(key));

const wrapFnButPrependArg = (fn: Function, getFirstArg: () => unknown) => (
  ...args: unknown[]
) => fn(getFirstArg(), ...args);
const rebindFirstParameterOfAllMethods = (
  entries: ObjectEntryType[],
  getFirstParam: () => unknown
) =>
  entries
    .map(
      ([key, val]): ObjectEntryType => {
        if (!isFunction(val)) return [key, val];
        return [key, wrapFnButPrependArg(val as Function, getFirstParam)];
      }
    )
    .reduce((obj: PlainObjectType, [key, val]) => ((obj[key] = val), obj), {});

export type RunStrategyType = (fn: Function) => void;
let run: RunStrategyType = fn => fn(); // by default synchronous

// By default, runs the next yielded step immediately when a promise is resolved. In certain debugging situations
// this can lead to a constantly growing call stack. Call this function to change out the running strategy being used
// eg. This will schedule the continuation on the tick following promise resolution
//   changeRunStrategy(fn => setTimeout(fn))
export const changeRunStrategy = (runFn: RunStrategyType) => (run = runFn);

export type StateType = any;
export type CreatePromiseType<T> = (
  _: SignalInstanceType,
  ...__: any[]
) => Promise<T>;
export type SignalPrototypeType = {
  createPromise: CreatePromiseType<unknown>;
  getInitialState?: ItemOrFactoryType<StateType>;
} & { [P in any]: SignalInstanceFunction };
export type SignalType = SignalPrototypeType & {};
export type SignalInstanceType = {
  state: StateType;
  setState: (_: StateType) => unknown;
};
type SignalInstanceFunction = (
  instance: SignalInstanceType,
  ..._: unknown[]
) => unknown;

// Returns a function that when invoked will return a representation of a signal (SignalType).
// A SignalPrototypeType must have a `createPromise` method.
// It may optionally have a `getInitialState` method that provides an object which sets the state internal to a signal instance
// similar to how ReactJs components work.
// See below for usages.
export const createSignalFactory = (
  name: string,
  signalOrCreatePromise: SignalPrototypeType | CreatePromiseType<unknown>
): FactoryType<SignalType> => {
  if (isFunction(signalOrCreatePromise))
    return createSignalFactory(name, { createPromise: signalOrCreatePromise });

  const props = signalOrCreatePromise as SignalType;
  const { createPromise, getInitialState = null } = props;
  const templateEntries = omitEntries(
    props,
    "createPromise",
    "getInitialState"
  );
  const createInitial = isFunction(getInitialState)
    ? getInitialState
    : () => getInitialState;
  return (...signalInvocationArgs: unknown[]) => {
    let state = createInitial(...signalInvocationArgs);
    const setState = (newState: StateType) => (state = newState);
    const getFirstParam: FactoryType<SignalInstanceType> = () => ({
      state,
      setState,
    });
    return {
      toString: () => name,
      ...rebindFirstParameterOfAllMethods(templateEntries, getFirstParam),
      createPromise: () =>
        createPromise(getFirstParam(), ...signalInvocationArgs),
    };
  };
};

// Convert a DOM event to a signal
// Usage:
//  yield domEventToSignal(document.querySelector('#log-in'), 'click')
export const domEventToSignal = (el: Element, eventName: string) =>
  createSignalFactory(`DOM event ${eventName}`, {
    createPromise: ({ setState }) =>
      new Promise(resolve => {
        el.addEventListener(eventName, function triggerResolve(event) {
          el.removeEventListener(eventName, triggerResolve);
          setState(event);
          resolve(event);
        });
      }),
    getLastEvent: ({ state }: SignalInstanceType) => state,
  })();

// Convert a then-able promise to a signal
// Usage:
//  yield promiseToSignal($.get('/data'))
export const promiseToSignal = (promise: Promise<unknown>) =>
  createSignalFactory("promiseSignal", () => promise)();

// Signal that triggers in the passed in amount of ms
// Usage:
//  yield timeoutSignal(100)
export const timeoutSignal = createSignalFactory(
  "timeoutSignal",
  (_, ms: number) => new Promise(resolve => setTimeout(resolve, ms))
);

// Signal that you trigger manually
// Usage:
//  const sig = manualSignal()
//  const firstArg = yield sig
//  sig.createPromise().then((...args) => doStuff(...args))
//  sig.createPromise().then((...args) => doOtherStuff(...args))
//  sig.trigger(1, 2, 3)
export const manualSignal = createSignalFactory("manualSignal", {
  getInitialState: () => [],
  createPromise: ({ state: toNotify, setState }) =>
    new Promise(resolve => setState([resolve, ...toNotify])),
  trigger: ({ state: toNotify, setState }, ...args) => {
    if (args.length > 1) setState([]);
    toNotify.forEach((fn: Function) => fn(...args));
  },
});

type PromiseType<T> = {
  result: T;
  promise: Promise<T>;
};
export const firstResolvedPromise = <T>(promises: Promise<T>[]) =>
  new Promise<PromiseType<T>>(resolve =>
    promises.map(promise =>
      promise.then(result => {
        resolve({ promise, result });
      })
    )
  );

// Signal that resolves when any of the signals passed in resolve. The resulting object will contain
//   signal - the signal object that was resolved
//   result - the payload the signal was triggered with
// Usage:
//  const {signal, result} = anySignal(timeoutSignal(300), x.invokedSignal())
export const anySignal = createSignalFactory("anySignal", (_, ...signals) => {
  const signalPromise = signals.map(signal => ({
    signal,
    promise: signal.createPromise(),
  }));
  return firstResolvedPromise<any>(signalPromise.map(x => x.promise)).then(
    ({ promise: resolvedPromise, result }) => {
      const signal = signalPromise.filter(x => x.promise === resolvedPromise)[0]
        .signal;
      return { signal, result };
    }
  );
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
export const controlSignal = createSignalFactory("controlSignal", {
  getInitialState: (
    signalGenerator: any
  ): signalGenerator is Generator<unknown, void, unknown> => {
    const triggerSignal = manualSignal();
    gimgen(signalGenerator)({ emit: triggerSignal.trigger });
    return triggerSignal;
  },
  createPromise: ({ state }) => state.createPromise(),
});

const asyncRecursive = fn => (...args) => {
  const recurse = (...nextArgs) => run(fn.bind(null, recurse, ...nextArgs));
  fn(recurse, ...args);
};

const runPromises = asyncRecursive((recurse, iterator, valueToYield) => {
  const current = iterator.next(valueToYield);
  return current.done
    ? Promise.resolve()
    : current.value.createPromise().then(
        promiseParam => recurse(iterator, promiseParam),
        err => iterator.throw(err)
      );
});
export const gimgen = generator => (...generatorArgs) => {
  const iterator = generator(...generatorArgs);
  return runPromises(iterator);
};

export const runGimgen = generator => gimgen(generator)();

// Generate a function that takes a closure returning a gimgen generator. This returns a new function
// The closure will be passed an object containing an `invokedSignal` method. This
// will be a signal that emits when the function returned by invvokeableGimgen is invoked
//invokableGimgen(({invokedSignal}) => function*(...args)) -> function
export const invokableGimgen = defineGenerator => (...generatorArgs) => {
  let nextInvocationSignal = { trigger: () => {} };
  let getNextReturn = () => {};
  const setupInvokedSignal = resolveNextReturnFunc => (...args) => {
    getNextReturn = resolveNextReturnFunc(...args);
    return (nextInvocationSignal = manualSignal(...args));
  };
  const invokedSignalExact = setupInvokedSignal(x => () => x);
  const invokedSignal = setupInvokedSignal(x => (isFunction(x) ? x : () => x));

  const invocationHelpers = { invokedSignalExact, invokedSignal };
  gimgen(defineGenerator(invocationHelpers))(...generatorArgs);
  return (...args) => {
    const res = getNextReturn(...args);
    nextInvocationSignal.trigger(...args);
    return res;
  };
};

export default gimgen;
