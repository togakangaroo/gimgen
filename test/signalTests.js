import sinon from 'sinon'
import {assert} from 'chai'
import SyncPromise from 'sync-promise'
import mockBrowser from 'mock-browser'
const mock = new mockBrowser.mocks.MockBrowser();
const CustomEvent = mockBrowser.mocks.MockBrowser.createWindow().CustomEvent
const document = mock.getDocument()

import { firstResolvedPromise, manualSignal, anySignal, domEventToSignal, runGimgen, controlSignal } from '../src/gimgen'

const createDeferred = () => {
  let resolve = null, reject = null
  const promise = new Promise((res, rej) => (resolve = res, reject = rej))
  return {
    promise: () => promise,
    resolve: (...args) => resolve(...args),
    reject: (...args) => reject(...args),
  }
}

let _originalPromise = null
beforeEach(() => {
  _originalPromise = global.Promise
  global.Promise = SyncPromise
} )
afterEach(() => global.Promise = _originalPromise)

describe(`firstResolvedPromise wraps two promises`, () => {
  let p1, p2, firstOf
  beforeEach(() => {
    p1 = createDeferred()
    p2 = createDeferred()
    firstResolvedPromise([p1.promise(), p2.promise()])
      .then(firstOf = sinon.spy())
  })

  it(`is not resolved by default`, () => {
    assert(!firstOf.called)
  })

  describe(`resolve first promise`, () => {
    beforeEach(() => p1.resolve('a'))
    it(`resolves`, () => assert(firstOf.calledOnce))
    it(`resolves with first promise`, () => {
      assert(firstOf.args[0][0].promise === p1.promise())
    })
  })

  describe(`resolve second promise`, () => {
    beforeEach(() => p2.resolve('b'))
    it(`resolves`, () => assert(firstOf.calledOnce))
    it(`resolves with second promise`, () => {
      assert(firstOf.args[0][0].promise === p2.promise())
    })
  })
})

describe(`manualSignal with two attached callbacks`, () => {
  let ms, callback1, callback2
  beforeEach(() => {
    ms = manualSignal()
    ms.createPromise().then(callback1 = sinon.spy())
    ms.createPromise().then(callback2 = sinon.spy())
  })
  it(`does not signal before triggering`, () => {
    assert(!callback1.called)
    assert(!callback2.called)
  })
  describe(`signals on trigger`, () => {
    beforeEach(() => ms.trigger(2))
    it(`is received by callback1`, () => assert(callback1.calledWith(2)) )
    it(`is received by callback2`, () => assert(callback2.calledWith(2)))
  })
})

describe(`anySignal`, () => {
  let s1, s2, firstSignal
  beforeEach(() => {
    s1 = manualSignal()
    s2 = manualSignal()
    anySignal(s1, s2)
      .createPromise()
      .then(firstSignal = sinon.spy())
  })

  it(`is not resolved by default`, () => {
    assert(!firstSignal.called)
  })

  describe(`trigger first signal`, () => {
    beforeEach(() => s1.trigger('a'))
    it(`resolves with first signal`, () => assert(firstSignal.calledWith(s1)) )
  })

  describe(`trigger second signal`, () => {
    beforeEach(() => s2.trigger('b'))
    it(`triggers with second signal`, () => assert(firstSignal.calledWith(s2)) )
  })
})

describe('domEventToSignal', () => {
  let el, callback
  beforeEach(() => {
    callback = sinon.spy()
    el = document.createElement('div')
    const sig = domEventToSignal(el, 'testEvent')
    runGimgen(function*(){
      while(true) {
        yield sig
        callback(sig.getLastEvent().detail)
      }
    })
  })

  it(`doesn't trigger initially`, () => assert(!callback.called))

  describe(`trigger event`, () => {
    beforeEach(() => el.dispatchEvent(new CustomEvent('testEvent', {detail: 'a'})))
    it(`recieves signal`, () => assert.equal(callback.lastCall.args[0], 'a'))
  })
})

describe(`controlSignal`, () => {
  let manualTrigger, prevEmits = []
  beforeEach(() => {
    manualTrigger = manualSignal()
    const control = controlSignal(function*({emit}) {
      const initialVal = 3
      let val1 = yield manualTrigger
      let val2 = yield manualTrigger
      emit(initialVal + val1 + val2)
    })
    runGimgen(function*() {
      while(true) {
        const val = yield control
        prevEmits.push(val)
      }
    })
  })
  describe(`aggregated signal emitted`, () => {
    beforeEach(() => manualTrigger.trigger(5))
    it(`does not emit since two yields preceed it`, () => assert.equal(0, prevEmits.length))
    describe(`aggregated signal emitted`, () => {
      beforeEach(() => manualTrigger.trigger(7))
      it(`emits aggregated value`, () => assert.equal(15, prevEmits[0]))
    })
  })
})
