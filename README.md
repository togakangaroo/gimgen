**gimgen** is a simple micro-library that allows you to invert program flow through the use of javascript generators. In particular, this is useful when you need to make decisions based on order or data of events that come from multiple sources.

What does this mean? Let's do this by example

# Examples

## debouncing

A particularly popular operation in many utilities libraries is to throttle invocations of a function via [debouncing](http://underscorejs.org/#debounce). A function that is debounced will trigger only after X milliseconds have ellapsed since it was last called. This is incredibly useful for waiting until events that occur in bursts finish before triggering some operation for example waiting until a user stops typing before preforming a search.

```js
const preformBackendSearch = debounce(preformBackendSearchNow)
document.querySelector('[name=search]').addEventListener('keyup', preformBackendSearch)
```

As you can imagine, a typical implementation of `debounce` involves quite a few `setTimeout` and `clearTimeout` calls and difficult to think through checks for edge conditions. With the **gimgen** library you can implement it yourself in a straightforward manner

```js
export const debounce = invokableGimgen(({invokedSignal}) => function*(ms, fn) {
  yield invokedSignal()                                           //do nothing until function is invoked
  while(true) {
    const timePassed = timeoutSignal(ms)
    const nextSig = yield anySignal(timePassed, invokedSignal())  //wait for an invocation or timeout
    if(timePassed === nextSig) {                                  //if it timed out
      fn()                                                        //invoke function
      yield invokedSignal()                                       //wait for invocation
    }
  }                                                               //rinse, repeat
})
```

While it is certainly debateable whether this format is simpler, it is certainly more direct and harder to make subtle mistakes with.

## Show Notifications


```js
const showNotification = gigmen(function*(msg) {
  const el = document.createElement('li')
  el.textContent = msg
  notificationsList.appendChild(el)
  const timeout = timeoutSignal(3000)
  const mouseMoved = domEventToSignal(el, 'mouseover')
  while(timeout !== yield anySignal(timeout, mouseMoved)) {}
  el.remove()
})
```

## memoization

This is another [common operation](http://underscorejs.org/#memoize), wrapping a pure function in a way that its inputs and return values are cached.

```js
const calculate = memoize(val => calculateSuperDifferentialIntegral(val))
const a = calculate(10) //takes a while
const b = calculate(15) //takes a while
const c = calculate(10) //returns immediately since the return value for 10 is cached
```
With **gimgen** it looks like this

```js
export const memoize = invokeableGimgen(({invokedSignal}) => function*(getValue) {
  const cache = new Map()
  while(true) {
    yield inovokedSignal(val => {
      if()
      const result = getValue(val)
      return cache.set(val, result)
    })
})
