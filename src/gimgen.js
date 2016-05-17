const isFunction = x => 'function' === typeof x
const contains = (arr, val) => ~arr.indexOf(val)

const omitEntries = (obj, ...propsToOmit) =>
  Object.keys(obj).map(k => [k, obj[k]])
  .filter(([key]) => !contains(propsToOmit, key))
const rebindFuncs = (entries, getFirstParam) =>
  entries.map(([key, val]) => [key, !isFunction(val) ? val : (...args) => val(getFirstParam(), ...args)])
        .reduce((obj, [key, val]) => (obj[key] = val, obj), {})

// Returns function that when invoked will return a representation of a signal.
// A signal is anything with a `createPromise` method
// See below for usages.
export const createSignalFactory = (name, propsOrCreatePromise) => {
  if(isFunction(propsOrCreatePromise))
    return createSignalFactory(name, {createPromise: propsOrCreatePromise})

  const { createPromise, getInitialState=null } = propsOrCreatePromise
  const templateEntries = omitEntries(propsOrCreatePromise, 'createPromise', 'getInitialState')
  const createInitial = isFunction(getInitialState) ? getInitialState : () => getInitialState;
  return (...signalInvocationArgs)  => {
    let state = createInitial(...signalInvocationArgs)
    const setState = newState => state = newState
    const getFirstParam = () => ({state, setState})
    return Object.assign(
      { toString: () => name},
      rebindFuncs(templateEntries, getFirstParam),
      { createPromise: () => createPromise(getFirstParam(), ...signalInvocationArgs), }
    )
  }
}

// Convert a DOM event to a signal
// Usage:
//  yield domEventToSignal(document.querySelector('#log-in'), 'click')
export const domEventToSignal = (el, eventName) =>
  createSignalFactory(`DOM event ${eventName}`, {
    createPromise: ({setState}) => new Promise(resolve => {
      el.addEventListener(eventName, function triggerResolve(event){
        el.removeEventListener(eventName, triggerResolve)
        setState(event)
        resolve(event)
      })
    }),
    getLastEvent: ({state}) => state,
})()

// Convert a then-able promise to a signal
// Usage:
//  yield promiseToSignal($.get('/data'))
export const promiseToSignal = promise => createSignalFactory('promiseSignal', () => promise)()

// Signal that triggers in the passed in amount of ms
// Usage:
//  yield timeoutSignal(100)
export const timeoutSignal = createSignalFactory('timeoutSignal', (_, ms) =>
                        new Promise(resolve => setTimeout(resolve, ms) )
                      )

// Signal that you trigger manually
// Usage:
//  const sig = manualSignal()
//  const firstArg = yield sig
//  sig.createPromise().then((...args) => doStuff(...args))
//  sig.createPromise().then((...args) => doOtherStuff(...args))
//  sig.trigger(1, 2, 3)
export const manualSignal = createSignalFactory('manualSignal', {
  getInitialState: () => [],
  createPromise: ({state: toNotify, setState}) =>
    new Promise(resolve => setState([resolve, ...toNotify])),
  trigger: ({state: toNotify, setState}, ...args) => {
    if(args.length > 1)
      setState([])
    toNotify.forEach(fn => fn(...args))
  }
})

export const firstResolvedPromise = (promises) =>
  new Promise(resolve =>
    promises.map(promise => promise.then(() => resolve({promise}) )
  ))

// Signal that resolves when any of the signals passed in resolve
// Usage:
//  const s = anySignal(timeoutSignal(300), x.invokedSignal())
export const anySignal = createSignalFactory('anySignal', (_, ...signals) => {
  const signalPromise = signals.map(signal => ({signal, promise: signal.createPromise()}) )
  return firstResolvedPromise(signalPromise.map(x => x.promise))
          .then(({promise:resolvedPromise}) =>
            signalPromise.filter(x => x.promise === resolvedPromise)[0].signal
          )
})

// Create a signal used to control other signals in a finer detail. Takes a  signal generator that
// takes a parameter with an emit method. Returns a signal that will trigger when the emit method is called
// Usage:
// const keysDown = controlSignal(function*({emit}) {
// 	const keydown = domEventToSignal(document, 'keydown')
// 	const keyup = domEventToSignal(document, 'keyup')
// 	const currentlyPressed = {}
// 	let interaction
// 	while(interaction = yield anySignal(keydown, keyup)) {
// 		currentlyPressed[interaction.getLastEvent().code] = (keydown === interaction)
// 		emit(currentlyPressed)
// 	}
// })
// ...
// const keysPressed = yield keysDown
export const controlSignal = createSignalFactory('controlSignal', {
  getInitialState: (signalGenerator) => {
    const triggerSignal = manualSignal()
    gimgen(signalGenerator)({emit: triggerSignal.trigger})
    return triggerSignal
  },
  createPromise: ({state}) => state.createPromise()
})

const runPromises = (iterator, valueToYield) => {
  const current = iterator.next(valueToYield)
  if(current.done) return
  current.value.createPromise()
    .then( promiseParam => runPromises(iterator, promiseParam) )
    .catch( err => iterator.throw(err) )
}
export const gimgen = (generator) => (...generatorArgs) => {
    const iterator = generator(...generatorArgs);
    runPromises(iterator)
}

export const runGimgen = (generator) => gimgen(generator)()

// Generate a function that takes a closure returning a gimgen generator. This returns a new function
// The closure will be passed an object containing an `invokedSignal` method. This
// will be a signal that emits when the function returned by invvokeableGimgen is invoked
//invokableGimgen(({invokedSignal}) => function*(...args)) -> function
export const invokableGimgen = (defineGenerator) => (...generatorArgs) => {
    let nextInvocationSignal = {trigger: () => {}}
    let getNextReturn = () => {}
    const setupInvokedSignal = resolveNextReturnFunc => (...args) => {
      getNextReturn = resolveNextReturnFunc(...args)
      return nextInvocationSignal = manualSignal(...args)
    }
    const invokedSignalExact = setupInvokedSignal(x => () => x)
    const invokedSignal = setupInvokedSignal(x => isFunction(x) ? x : () => x)

    const invocationHelpers = { invokedSignalExact, invokedSignal }
    gimgen(defineGenerator(invocationHelpers))(...generatorArgs)
    return (...args) => {
      const res = getNextReturn(...args)
      nextInvocationSignal.trigger(...args)
      return res
    }
}

export default gimgen
