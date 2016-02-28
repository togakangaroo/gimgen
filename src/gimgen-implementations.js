import {anySignal, timeoutSignal, invokableGimgen } from './gimgen'

export const once = invokableGimgen(({onInvokedSignal}) => function*(fn) {
  let val
  yield onInvokedSignal((...args) => val = fn(...args) )
  while(true)
    yield onInvokedSignal(() => val)
})

// export const throttle = invokableGimgen(({invokedSignal}) => function*() {
//
// })
// const throttle = functionalGenerators(function*(fg, ms, fn) {
//   while(true) {
//     yield fg.signalOnCall()
//     fn()
//     yield fg.signalIn(ms)
//   }
// })


export const debounce = invokableGimgen(({invokedSignal }) => function*(ms, fn) {
  yield invokedSignal()
  while(true) {
    const timePassed = timeoutSignal(ms)
    const nextSignal = yield anySignal(timePassed, invokedSignal())
    if(timePassed == nextSignal) {
      fn()
      yield invokedSignal()
    }
  }
})
