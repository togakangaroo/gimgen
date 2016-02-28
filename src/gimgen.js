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
export const createSignal = (name, propsOrCreatePromise) => {
  if(isFunction(propsOrCreatePromise))
    return createSignal(name, {createPromise: propsOrCreatePromise})

  const { createPromise, getInitialState=null } = propsOrCreatePromise
  const templateEntries = omitEntries(propsOrCreatePromise, 'createPromise', 'getInitialState')
  const createInitial = isFunction(getInitialState) ? getInitialState : () => getInitialState;
  return (...signalInvocationArgs)  => {
    let state = createInitial()
    const setState = newState => state = newState
    const getFirstParam = () => ({state, setState})
    return Object.assign(
      { toString: () => name},
      rebindFuncs(templateEntries, getFirstParam),
      { createPromise: () => createPromise(getFirstParam(), ...signalInvocationArgs), }
    )
  }
}

export const firstResolvedPromise = (promises) =>
  new Promise(resolve =>
    promises.map(promise => promise.then(() => resolve({promise}) )
  ))

// Signal that triggers in the passed in amount of ms
// Usage:
//  yield timeoutSignal(100)
export const timeoutSignal = createSignal('timeoutSignal', ({}, ms) =>
                        new Promise(resolve => setTimeout(resolve, ms) )
                      )

// Signal that you trigger manually
// Usage:
//  const sig = manualSignal()
//  const firstArg = yield sig
//  sig.createPromise().then((...args) => doStuff(...args))
//  sig.createPromise().then((...args) => doOtherStuff(...args))
//  sig.trigger(1, 2, 3)
export const manualSignal = createSignal('manualSignal', {
  getInitialState: () => [],
  createPromise: ({state: toNotify, setState}) =>
    new Promise(resolve => setState([resolve, ...toNotify])),
  trigger: ({state: toNotify, setState}, ...args) => {
    if(args.length > 1)
    setState([])
    toNotify.forEach(fn => fn(...args))
  }
})

// Signal that resolves when any of the signals passed in resolve
// Usage:
//  const s = anySignal(timeoutSignal(300), x.invokedSignal())
export const anySignal = createSignal('anySignal', ({}, ...signals) => {
  const signalPromise = signals.map(signal => ({signal, promise: signal.createPromise()}) )
  return firstResolvedPromise(signalPromise.map(x => x.promise))
          .then(({promise:resolvedPromise}) =>
            signalPromise.filter(x => x.promise === resolvedPromise)[0].signal
          )
})

const runPromises = (getNext, valueToYield) => {
  const current = getNext(valueToYield)
  if(current.done) return
  current.value.createPromise().then(promiseParam =>{
    runPromises(getNext, promiseParam)
  })
}

export const gimgen = (generator) => (...generatorArgs) => {
    const iterator = generator(...generatorArgs);
    runPromises((...args) => iterator.next(...args))
}

export const invokableGimgen = (defineGenerator) => (...generatorArgs) => {
    let nextInvocationSignal = {trigger: () => {}}
    let getNextReturn = () => {}
    const invokedSignal = (...args) =>
                (getNextReturn = () => args[0], nextInvocationSignal = manualSignal(...args))
    const onInvokedSignal = (getVal) => {
                console.log('abad')
                getNextReturn = getVal
                return nextInvocationSignal = manualSignal()
              }
    const invocationHelpers = { invokedSignal, onInvokedSignal }
    gimgen(defineGenerator(invocationHelpers))(...generatorArgs)
    return (...args) => {
      const res = getNextReturn(...args)
      nextInvocationSignal.trigger(...args)
      return res
    }
}

export default gimgen
