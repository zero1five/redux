import $$observable from 'symbol-observable'

import ActionTypes from './utils/actionTypes'
import isPlainObject from './utils/isPlainObject'

export default function createStore(reducer, preloadedState, enhancer) {
  if (typeof preloadedState === 'function' && typeof enhancer === 'undefined') {
    enhancer = preloadedState
    preloadedState = undefined
  } /* 如果初始化的state是一个函数，则将它视为enhancer，preloadedState视为undefined */

  if (typeof enhancer !== 'undefined') {
    if (typeof enhancer !== 'function') { /* 如果enhancer存在但是不是函数则抛出一个error */
      throw new Error('Expected the enhancer to be a function.')
    }
    /* 实现一个能够改变createStore接口的高阶函数， */
    return enhancer(createStore)(reducer, preloadedState)
  }

  if (typeof reducer !== 'function') { /* 如果reducer不是一个函数则抛出一个错误 */
    throw new Error('Expected the reducer to be a function.')
  }

  let currentReducer = reducer /* reducer -> currentReducer  */
  let currentState = preloadedState /* 初始化state -> 当前的state */
  let currentListeners = [] /* listener 设置存放回调函数的数组 */
  let nextListeners = currentListeners /* 当前的回调数组 -> 下一个回调数组 */
  let isDispatching = false /* 当前处于派发中 */

  function ensureCanMutateNextListeners() {
    if (nextListeners === currentListeners) {
      nextListeners = currentListeners.slice()
      /* 如果下一个listener === 当前的listener 则直接将curr复制给next */
    }
  }

  function getState() {
    if (isDispatching) {
      throw new Error(
        'You may not call store.getState() while the reducer is executing. ' +
          'The reducer has already received the state as an argument. ' +
          'Pass it down from the top reducer instead of reading it from the store.'
      )
    }

    return currentState
  }

  function subscribe(listener) { /* 订阅方法 实现pub / sub */
    if (typeof listener !== 'function') {
      throw new Error('Expected the listener to be a function.')
    }

    if (isDispatching) {
      throw new Error(
        'You may not call store.subscribe() while the reducer is executing. ' +
          'If you would like to be notified after the store has been updated, subscribe from a ' +
          'component and invoke store.getState() in the callback to access the latest state. ' +
          'See https://redux.js.org/api-reference/store#subscribe(listener) for more details.'
      )
    }

    let isSubscribed = true

    ensureCanMutateNextListeners()
    nextListeners.push(listener)

    return function unsubscribe() {
      if (!isSubscribed) {
        return
      }

      if (isDispatching) {
        throw new Error(
          'You may not unsubscribe from a store listener while the reducer is executing. ' +
            'See https://redux.js.org/api-reference/store#subscribe(listener) for more details.'
        )
      }

      isSubscribed = false

      ensureCanMutateNextListeners()
      const index = nextListeners.indexOf(listener)
      nextListeners.splice(index, 1) /* 从下一个回调中删掉 */
    }
  }

  function dispatch(action) {
    if (!isPlainObject(action)) {
      throw new Error(
        'Actions must be plain objects. ' +
          'Use custom middleware for async actions.'
      )
    }

    if (typeof action.type === 'undefined') {
      throw new Error(
        'Actions may not have an undefined "type" property. ' +
          'Have you misspelled a constant?'
      )
    }

    if (isDispatching) {
      throw new Error('Reducers may not dispatch actions.')
    }

    try {
      isDispatching = true
      currentState = currentReducer(currentState, action) /* 返回新对象重新赋值 */
    } finally {
      isDispatching = false
    }

    const listeners = (currentListeners = nextListeners)
    for (let i = 0; i < listeners.length; i++) {
      const listener = listeners[i]
      listener()
    }

    return action
  }

  function replaceReducer(nextReducer) {
    if (typeof nextReducer !== 'function') {
      throw new Error('Expected the nextReducer to be a function.')
    }

    currentReducer = nextReducer
    dispatch({ type: ActionTypes.REPLACE })
  }

  function observable() { /* 将数据设置为可观察 */
    const outerSubscribe = subscribe
    return {
      subscribe(observer) {
        if (typeof observer !== 'object' || observer === null) {
          throw new TypeError('Expected the observer to be an object.')
        }

        function observeState() {
          if (observer.next) {
            observer.next(getState())
          }
        }

        observeState()
        const unsubscribe = outerSubscribe(observeState)
        return { unsubscribe }
      },

      [$$observable]() {
        return this
      }
    }
  }

  dispatch({ type: ActionTypes.INIT })

  return {
    dispatch,
    subscribe,
    getState,
    replaceReducer,
    [$$observable]: observable
  }
}
