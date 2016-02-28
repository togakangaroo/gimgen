import { anySignal, timeoutSignal, invokableGimgen } from './gimgen'

export const once = invokableGimgen(({invokedSignal}) => function*(fn) {
  let val
  yield invokedSignal((...args) => val = fn(...args) )
  while(true)
    yield invokedSignal(() => val)
})

export const throttle = invokableGimgen(({invokedSignal}) => function*(ms, fn) {
  while(true) {
    yield invokedSignal()
    yield timeoutSignal(ms)
    fn()
  }
})

export const debounce = invokableGimgen(({invokedSignal}) => function*(ms, fn) {
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

export const after = invokableGimgen(({invokedSignal}) => function*(count, fn) {
  for(let i = 0; i<count; i+=1)
    yield invokedSignal(()=>null)
  while(true) {
    yield invokedSignal(fn)
  }
})
