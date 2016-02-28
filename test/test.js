import sinon from 'sinon'
import {assert} from 'chai'
import SyncPromise from 'sync-promise'
import {gimgen, manualSignal} from '../src/gimgen'

let _originalPromise = null
beforeEach(() => {
  _originalPromise = global.Promise
  global.Promise = SyncPromise
} )
afterEach(() => global.Promise = _originalPromise)

describe(`gimgen a process`, () => {
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
  it(`does not run initially`, () => assert(!callback.called))

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
//
// const throttle = functionalGenerators(function*(fg, ms, fn) {
//   while(true) {
//     yield fg.signalOnCall()
//     fn()
//     yield fg.signalIn(ms)
//   }
// })
//
// let clock
// beforeEach(() => clock = sinon.useFakeTimers() )
// afterEach(() => clock.restore() )
//
// const createSpy = (name) => Object.assign(sinon.spy(), {toString: () => name })
//
// describe("anySignal returns first signal", () => {
//   let fn, callback1, callback2, signal1, signal2;
//   beforeEach(() => {
//     const firstOf = functionalGenerators(function*(fg, fn1, fn2) {
//       while(true) {
//         signal1 = manualSignal()
//         signal2 = manualSignal()
//         const as = fg.anySignal(signal1, signal2)
//         console.log('as is', as)
//         const recieved = yield as;
//         console.log("returned from anySignal", recieved)
//         if(recieved == signal1)
//           fn1()
//         else if(recieved == signal2)
//           fn2()
//       }
//     })
//     fn = firstOf(callback1 = createSpy('one'), callback2 = createSpy('two'))
//   })
//   const checkCallCount = (count1, count2) => () => {
//     expect(callback1.callCount).to.equal(count1)
//     expect(callback2.callCount).to.equal(count2)
//   }
//
//   it("does not trigger any signal initially", checkCallCount(0, 0) )
//
//   describe("trigger signal2", () => {
//     beforeEach(() => signal2.trigger() )
//     it("triggers callback2", checkCallCount(0, 1))
//   })
//
//   describe("trigger signal1", () => {
//     beforeEach(() => signal1.trigger() )
//     it("triggers callback1", checkCallCount(1, 0))
//
//     describe("trigger signal1", () => {
//       beforeEach(() => signal1.trigger() )
//       it("triggers callback1", checkCallCount(2, 1))
//     })
//
//     describe("trigger signal2", () => {
//       beforeEach(() => signal2.trigger() )
//       it("triggers callback2", checkCallCount(1, 1))
//     })
//   })
// })
//
// describe("pass through function call", () => {
//   let fn, callback;
//   beforeEach(() => {
//     const passThrough = functionalGenerators(function*(fg, fn) {
//       while(true) {
//         yield fg.signalOnCall()
//         fn()
//       }
//     })
//     fn = passThrough(callback= sinon.spy() )  })
//
//   describe("when called", () => {
//     beforeEach(() => fn(123, 654))
//     it("will call wrapped function", () =>  expect(callback.callCount).to.equal(1))
//
//     describe("when called again", () => {
//       beforeEach(() => fn(789, 921))
//       it("will call wrapped function again", () => expect(callback.callCount).to.equal(2))
//     })
//   })
// })
//
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
// const debounce = gimgen(function*(fg, ms, fn) {
//   yield fg.signalOnCall()
//   while(true) {
//     const nextSignal = yield anySignal(timeoutSignal(ms), fg.signalOnCall())
//     if(timePassed == nextSignal) {
//       fn()
//       yield fg.signalOnCall()
//     }
//   }
// })
// describe.skip("debounce by 1000ms", () => {
//   var fn, callback;
//   beforeEach(() => fn = debounce(1000, callback = sinon.spy()) )
//
//   it("will not call fn initially", () => expect(callback.called).to.be.false)
//
//   describe("call now", () =>{
//     beforeEach(() => fn())
//     it("will not call", () => expect(callback.called).to.be.false)
//   })
//
//   describe("call in 900ms", () =>{
//     beforeEach(() => {
//       clock.tick(900);
//       fn();
//     })
//     it("will not call", () => expect(callback.called).to.be.false)
//
//     describe("wait 900ms", () => {
//       beforeEach(() => clock.tick(900))
//       it("will not call", () => expect(callback.called).to.be.false)
//
//       describe("wait 150ms", () => {
//         beforeEach(() => clock.tick(150))
//         it("will call", () => expect(callback.called).to.be.true)
//       })
//     })
//   })
// })
