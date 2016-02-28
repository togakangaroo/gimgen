In this repository I play around with building functional helpers like debounce and throttle using es6 generators.

For example debounce (trigger callback once x time has elapsed since a function was last called) could work something like this

```js
const debounce = gimgen(function*(ms, fn) {
  yield fg.signalOnInvocation()
  while(true) {
    const nextSignal = yield fg.firstSignal(fg.signalOnTimeout(ms), fg.signalOnInvocation())
    if(timePassed == nextSignal) {
      fn()
      yield fg.signalOnInvocation()
    }
  }
})
```

I don't know what I'm going to do with this except it is an interesting idea.
