import sinon from 'sinon'
import {assert} from 'chai'
import SyncPromise from 'sync-promise'
import { gimgen, manualSignal, invokableGimgen } from '../src/gimgen'
import { once, debounce } from '../src/gimgen-implementations'

let clock, _originalPromise = null
beforeEach(() => {
  _originalPromise = global.Promise
  global.Promise = SyncPromise
  clock = sinon.useFakeTimers()
} )
afterEach(() => {
  global.Promise = _originalPromise
  clock.restore()
})

describe(`gimgen a generator`, () => {
  let run, signal, callback
  beforeEach(() => {
    signal = manualSignal()
    callback = sinon.spy()
    run = gimgen(function*(counter) {
      callback(counter+=1)
      yield signal
      callback(counter+=1)
      const a = yield signal
      callback(a)
    })
  })
  it(`does not run it initially`, () => assert(!callback.called))

  const callbackInvokedTimes = (timesInvoked, argumentValue, itDoes = it) => {
    itDoes(`triggered callback ${timesInvoked} times`, () =>
      assert.equal(callback.args.length, timesInvoked))
    itDoes(`triggered callback with ${argumentValue}`, () => {
      assert.equal(callback.args[timesInvoked-1][0], argumentValue)
    })
  }
  describe(`run and start counter at 2`, () => {
    beforeEach(() => run(2))
    callbackInvokedTimes(1, 3)
    describe(`signal`, () => {
      beforeEach(() => signal.trigger())
      callbackInvokedTimes(2, 4)
      describe(`signal again`, () => {
        beforeEach(() => signal.trigger('a'))
        callbackInvokedTimes(3, 'a')
      })
    })
  })
})

describe(`invokeable gimgen generator`, () => {
  let run, trigger, callback
  beforeEach(() => {
    callback = sinon.spy()
    run = invokableGimgen( ({invokedSignal}) => function*(counter) {
      callback(counter+=1)
      yield invokedSignal()
      callback(counter+=1)
      const a = yield invokedSignal('foo')
      callback(a)
    })
  })
  it(`does not run initially`, () => assert(!callback.called))

  const callbackInvokedTimes = (timesInvoked, argumentValue, itDoes = it) => {
    itDoes(`triggered callback ${timesInvoked} times`, () => {
      assert.equal(callback.args.length, timesInvoked)
    })
    itDoes(`triggered callback with ${argumentValue}`, () => {
      assert.equal(callback.args[timesInvoked-1][0], argumentValue)
    })
  }
  describe(`run to get trigger and start counter at 2`, () => {
    beforeEach(() => trigger = run(2))
    callbackInvokedTimes(1, 3)
    describe(`invoke trigger`, () => {
      beforeEach(() => trigger())
      callbackInvokedTimes(2, 4)
      describe(`invoke trigger again and check return value`, () => {
        let invocationResult
        beforeEach(() => {
          invocationResult = trigger('a')
        })
        it(`recieves invocation result`, () => {
          assert.equal(invocationResult, 'foo')
        })
        callbackInvokedTimes(3, 'a')
      })
    })
  })
})

describe(`once incrementor`, () => {
  let fn, callback
  beforeEach(() => {
    callback = sinon.spy()
    fn = once(val => {
      callback()
      return val+1
    })
  })

  it(`does not call contained function initially`, () => assert(!callback.called))

  describe(`call with value of 2`, () => {
    let result
    beforeEach(() => result = fn(2))
    it(`returns 3`, () => assert.equal(result, 3))
    it(`only runs once`, () => assert.equal(callback.args.length, 1))
  })
})

// const after = functionalGenerators(function*(fg, ms, fn) {
//   while(true) {
//     const c = yield fg.signalOnCall()
//     const t = yield fg.signalIn(ms)
//     fn()
//   }
// })
//
// describe("after by 1000ms", () => {
//   var fn, callback;
//   beforeEach(() => fn = after(1000, callback = sinon.spy()) )
//
//   it("will not call initially", () => expect(callback.called).to.be.false)
//
//   describe("call now", () => {
//     beforeEach(() => fn())
//     it("will not call", () => expect(callback.called).to.be.false)
//
//     describe("wait 900ms", () => {
//       beforeEach(() => clock.tick(900))
//       it("will not call", () => expect(callback.called).to.be.false)
//
//       describe("wait 150ms", () => {
//
//         beforeEach(() => clock.tick(150))
//         it("will call", () => expect(callback.called).to.be.true)
//       })
//     })
//   })
// })
//
describe("debounce by 1000ms", () => {
  var fn, callback;
  beforeEach(() => fn = debounce(1000, callback = sinon.spy()) )

  it("will not call fn initially", () => assert(!callback.called))

  describe("call now", () =>{
    beforeEach(() => fn())
    it("will not call", () => assert(!callback.called))
  })

  describe("call in 900ms", () =>{
    beforeEach(() => {
      clock.tick(900);
      fn();
    })
    it("will not call", () => assert(!callback.called))

    describe("wait 900ms", () => {
      beforeEach(() => clock.tick(900))
      it("will not call", () => assert(!callback.called))

      describe("wait 150ms", () => {
        beforeEach(() => clock.tick(150))
        it("will call", () => assert(callback.called))
      })
    })
  })
})
