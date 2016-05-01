**gimgen** is a simple micro-library that allows you to invert program flow through the use of javascript generators. In particular, this is useful when you need to make decisions based on order or data of events that come from multiple sources. It also allows you to create simple and powerful coroutines.

What does this mean? Let's do this by example

# Examples

## Show Notifications

We want to be able to show pop-up notifications. A notification appears and stays visible for three seconds unless the user moves their mouse over it. When a notification "disappears" it must first acquire a `hidden` class to allow css transitions to animate it before being completely removed

[Live Demo here](http://jsbin.com/vugimu/9/edit?js,output).

```js
const showNotification = gimgen(function*(msg) {
  const el = document.createElement('li')
  el.textContent = msg
  notificationsArea.appendChild(el)

  const timeout = timeoutSignal(3000)
  const mouseMoved = domEventToSignal(el, 'mousemove')
  const mouseOver = domEventToSignal(el, 'mouseover')
  while(timeout !== (yield anySignal(timeout, mouseMoved, mouseOver))) { }
  el.classList.add('hidden')
  yield timeoutSignal(1000)
  el.remove()
})

showNotification("message one")
showNotification("another message")
```
What's that you say? If the user hovers over during timeout it should restart the process? [Easy enough to create that state machine](https://rawgit.com/togakangaroo/gimgen/master/demo/notifications.html) with a `do...while`.

## Debouncing

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

# Usage

The core functions to start using **gimgen** are

* `gimgen(generator) -> function`. Takes a generator and returns a function. Invoking the function will start running through the steps outlined in the generator.

# What is a signal?

At its heart a signal is a simple object with a `createPromise` method which returns any then-able object.

```js
{ createPromise: () -> Promise }
```

If you would like to create your own signals **gimgen** provides a convenience factory `createSignalFactory` which takes a name (used for a `toString` implementation) and either a `createPromise` function or a configuration object containing a `createPromise` function

```js
export const timeoutSignal = createSignal('timeoutSignal', ({}, ms) =>
                              new Promise(resolve => setTimeout(resolve, ms) )
                            )
```

The first parameter into any functions on the configuration object will always be an object with a `state` and `setState` property to read the current state of the signal and to adjust it respectively. An additional `getInitialState` function can be provided to set the state when a signal instance is created.

Any other functions or fields on the configuration object will be copied to each signal instance with all functions being re-bound to receive the state object as the first parameter before any others

```js
export const manualSignal = createSignal('manualSignal', {
  getInitialState: () => [],
  createPromise: ({state: toNotify, setState}) =>
    new Promise(resolve => setState([resolve, ...toNotify])),
  trigger: ({state: toNotify, setState}, ...args) => {
    if(args.length > 1)
      setState([])
    toNotify.forEach(fn => fn(...args))
  }
})
```
