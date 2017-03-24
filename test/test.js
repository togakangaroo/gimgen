import sinon from 'sinon'
import { assert } from 'chai'
import { gimgen, runGimgen, manualSignal, invokableGimgen, promiseToSignal, _changeDefer } from '../src/gimgen'
import { once, debounce, throttle, after } from '../src/gimgen-implementations'

const originalSetTimeout = setTimeout
const defer = fn => originalSetTimeout(fn, 0)
const deferFn = fn => done => { fn(); defer(done) }
const deferBeforeEach = fn => beforeEach(deferFn(fn))

let clock
beforeEach(() => {
  clock = sinon.useFakeTimers()
} )
afterEach(() => {
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
    beforeEach(() => { run(2) })
    callbackInvokedTimes(1, 3)
    describe(`signal`, () => {
      beforeEach(deferFn(() => signal.trigger()))
      callbackInvokedTimes(2, 4)
      describe(`signal again`, () => {
        beforeEach(deferFn(() => signal.trigger('a') ))
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
    deferBeforeEach(() => { trigger = run(2) })
    callbackInvokedTimes(1, 3)
    describe(`invoke trigger`, () => {
      deferBeforeEach(() => { trigger() })
      callbackInvokedTimes(2, 4)
      describe(`invoke trigger again and check return value`, () => {
        let invocationResult
        deferBeforeEach(() => { invocationResult = trigger('a') } )
        it(`recieves invocation result`, () =>
          assert.equal(invocationResult, 'foo')
        )
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

describe("throttle by 1000ms", () => {
  var fn, callback;
  beforeEach(() => fn = throttle(1000, callback = sinon.spy()) )
  it("will not call initially", () => assert(!callback.called))

  describe(`wait 1500ms`, () => {
    beforeEach(() => clock.tick(1500))
    it("will not call", () => assert(!callback.called))
  })

  describe("call now", () => {
    beforeEach(() => fn())
    it("will not call", () => assert(!callback.called))

    describe("wait 900ms and call again", () => {
      beforeEach(() => {
        clock.tick(900)
        fn()
      })
      it("will not call", () => assert(!callback.called))

      describe("wait 150ms", () => {
        deferBeforeEach(() => clock.tick(150))
        it("will call", () => assert(callback.called))
      })
    })
  })
})

describe("debounce by 1000ms", () => {
  let fn, callback;
  beforeEach(() => fn = debounce(1000, callback = sinon.spy()) )

  it("will not call fn initially", () => assert(!callback.called))

  describe("call now", () =>{
    beforeEach(() => fn())
    it("will not call", () => assert(!callback.called))
  })

  describe("call in 900ms", () =>{
    deferBeforeEach(() => {
      clock.tick(900);
      fn();
    })
    it("will not call", () => assert(!callback.called))

    describe("wait 900ms", () => {
      deferBeforeEach(() => clock.tick(900))
      it("will not call", () => assert(!callback.called))

      describe("wait 150ms", () => {
        deferBeforeEach(() => clock.tick(150))
        it("will call", () => assert(callback.called))
      })
    })
  })
})

describe(`after 2`, () => {
  let fn, callback;
  beforeEach(() => fn = after(2, callback = sinon.spy()))
  it(`will not call`, () => assert(!callback.called))

  describe(`call twice`, () => {
    beforeEach(done => defer(() => {
      fn(); defer(() => {
        fn(); done()
      })
    }) )
    it(`will not call`, () => assert(!callback.called))

    describe(`call a third time`, () => {
      deferBeforeEach(() => fn())
      it(`will call once`, () => assert.equal(callback.args.length, 1))
      describe(`call a fourth time`, () => {
        deferBeforeEach(() => fn())
        it(`will call twice`, () => assert.equal(callback.args.length, 2))
      })
    })
  })
})

const listenableFunc = () => {
  const listeners = new Set()
  const listenable = function() {
    for(let fn of listeners)
      fn.apply(this, arguments)
  }
  listenable.on = fn => listeners.add(fn)
  return listenable
}

const createDeferred = () => {
  const resolve = listenableFunc()
  const reject = listenableFunc()
  const p = new Promise((res, rej) => {
    resolve.on(res)
    reject.on(rej)
  })
  return { reject, resolve, promise: () => p }
}

describe(`errors within gimgen`, () => {
  let def, recievedError, coroutineEnd
  beforeEach(() => {
    def = createDeferred()
    coroutineEnd = runGimgen(function * () {
      try {
        yield promiseToSignal(def.promise())
      } catch(e) {
        recievedError = e
      }
    })
  })

  describe(`resolve promise`, () => {
    beforeEach(() => {
      def.resolve("yay")
    } )
    it(`has no error`, () => assert(!recievedError))
  })

  describe(`reject promise`, () => {
    beforeEach((done) => {
      def.reject("boo")
      originalSetTimeout(done)
    } )
    it(`recieves error`, () => {
      assert(recievedError)
    })
  })
})
