'use strict'

const assert = require('assert')
const sinon = require('sinon')
const expect = require('chai').expect

// function debounce(ms, fn) {
//   var delayHandle;
//   return () => {
//     delayHandle && clearTimeout(delayHandle);
//     delayHandle = setTimeout(fn, ms);
//   }
// }


const anyPromise = (promises) =>
  new Promise((resolve) => promises.map(p =>
    p.then(function() { resolve(p, ...arguments)} )
  ))

class SynchronousPromise {
  constructor(builder) {
    this.resolvers = []
    this.rejectors = []
    builder(
      function(){ this.resolvers.forEach(r => r.apply(null, arguments)) }.bind(this),
      function(){ this.rejectors.forEach(r => r.apply(arguments)) }.bind(this)
    )
  }
  then(resolve, reject) {
    resolve && this.resolvers.push(resolve)
    reject && this.rejectors.push(reject)
  }
}

const functionalGenerators = function(generator) {
  return function wrappedFunction() {

    const signalInIdentity = Symbol('signalIn')
    const signalIn = (ms) => ({
      identity: signalInIdentity,
      is: (other) => signalInIdentity == other.identity,
      promise: () => new Promise((resolve) => setTimeout(resolve, ms))
    })

    const signalOnCallIdentity = Symbol('signalOnCall')
    var onNextFunctionCall = []
    const signalOnCall = () => {
      return {
        identity: signalOnCallIdentity,
        is: (other) => signalOnCallIdentity == other.identity,
        promise: () => new SynchronousPromise((resolve) => {
                          console.log(`generating signalOnCall promise`)
                          onNextFunctionCall.push(resolve)
                        })
      }
    }

    const anySignal = function() {
      const signalsWithPromise = Array.from(arguments).map(s => ({
        promise: s.promise(), signal: s,
      }))
      anyPromise(signalsWithPromise.map(x => x.promise)).then(function() {
        const args = Array.from(arguments)
        const promise = args[0]
        return signalsWithPromise.filter(x => x.promise === promise)[0].signal
      })
    }
    const fg = { signalIn, signalOnCall, anySignal };
    const iterator = generator(fg, ...arguments);
    loopTillDone(iterator.next.bind(iterator))
    return function() {
          const fns = onNextFunctionCall
          onNextFunctionCall = []
          console.log(`method called, applying once to ${fns.length} functions`)
          fns.forEach(fn => fn.apply(null, arguments) )
      }
  }
}

function loopTillDone(getNext) {
  const current = getNext()
  if(current.done) return console.log('cone looping')
  console.log(`waiting for promise completion`)
  current.value.promise().then(function() {
    console.log(`promise completed`)
    loopTillDone(getNext)
  })
}



const throttle = functionalGenerators(function*(fg, ms, fn) {
  while(true) {
    yield fg.signalOnCall()
    fn()
    yield fg.signalIn(ms)
    }
})
const debounce = functionalGenerators(function*(fg, ms, fn) {
  while(true) {
    yield fg.signalOnCall()
    const nextSignal = yield fg.anySignal(fg.signalIn(ms), fg.signalOnCall())
    if(timePassed.is(nextSignal))
      fn()
  }
})
const after = functionalGenerators(function*(fg, ms, fn) {
  while(true) {
    const c = yield fg.signalOnCall()
    const t = yield fg.signalIn(ms)
    fn()
  }
})

var clock
beforeEach(() => clock = sinon.useFakeTimers() )
afterEach(() => clock.restore() )


describe("pass through function call", () => {
  var fn, callback;
  beforeEach(() => {
    const passThrough = functionalGenerators(function*(fg, fn) {
      while(true) {
        console.log(`yielding signalOnCall`)
        yield fg.signalOnCall()
        console.log(`yield returned calling fn`)
        fn()
      }
    })
    callback = sinon.spy()
    const foo = passThrough(() => {console.log("inside passThrough method"); callback(); })
    fn = () => {console.log("calling passThrough method"); foo(); }
  })

  describe("when called", () => {
    beforeEach(() => fn(123, 654))
    it.only("will call wrapped function", () => {console.log(`checking expection`); expect(callback.callCount).to.equal(1)})

    describe("when called again", () => {
      beforeEach(() => fn(789, 921))
      it("will call wrapped function again", () => expect(callback.callCount).to.equal(2))
    })
  })
})

describe("after by 1000ms", () => {
  var fn, callback;
  beforeEach(() => fn = after(1000, callback = sinon.spy()) )

  it("will not call initially", () => expect(callback.called).to.be.false)

  describe("call now", () => {
    beforeEach(() => fn())
    it("will not call", () => expect(callback.called).to.be.false)

    describe("wait 900ms", () => {
      beforeEach(() => clock.tick(900))
      it("will not call", () => expect(callback.called).to.be.false)

      describe("wait 150ms", () => {

        beforeEach(() => clock.tick(150))
        it("will call", () => expect(callback.called).to.be.true)
      })
    })
  })
})


describe("debounce by 1000ms", () => {
  var fn, callback;
  beforeEach(() => fn = debounce(1000, callback = sinon.spy()) )

  it("will not call fn initially", () => expect(callback.called).to.be.false)

  describe("call now", () =>{
    beforeEach(() => fn())
    it("will not call", () => expect(callback.called).to.be.false)
  })

  describe("call in 900ms", () =>{
    beforeEach(() => {
      clock.tick(900);
      fn();
    })
    it("will not call", () => expect(callback.called).to.be.false)

    describe("wait 900ms", () => {
      beforeEach(() => clock.tick(900))
      it("will not call", () => expect(callback.called).to.be.false)

      describe("wait 150ms", () => {
        beforeEach(() => clock.tick(150))
        it("will call", () => expect(callback.called).to.be.true)
      })
    })
  })
})
