import sinon from 'sinon'
import {assert} from 'chai'
import SyncPromise from 'sync-promise'

import { firstResolvedPromise, manualSignal, anySignal } from '../src/gimgen'

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
