/* @flow */
// transition组件的动画；逻辑
import { inBrowser, isIE9, warn } from 'core/util/index'
import { mergeVNodeHook } from 'core/vdom/helpers/index'
import { activeInstance } from 'core/instance/lifecycle'

import {
  once,
  isDef,
  isUndef,
  isObject,
  toNumber
} from 'shared/util'

import {
  nextFrame,
  resolveTransition,
  whenTransitionEnds,
  addTransitionClass,
  removeTransitionClass
} from '../transition-util'

export function enter (vnode: VNodeWithData, toggleDisplay: ?() => void) {
  const el: any = vnode.elm

  // call leave callback now
  if (isDef(el._leaveCb)) {
    el._leaveCb.cancelled = true
    el._leaveCb()
  }

  /**
   * 解析过渡数据
   * resolveTransition定义在 src/platforms/web/transition-util.js
   * 合并data；处理name属性，根据name生成动画的类名
   */
  const data = resolveTransition(vnode.data.transition)
  if (isUndef(data)) {
    return
  }

  /* istanbul ignore if */
  if (isDef(el._enterCb) || el.nodeType !== 1) {
    return
  }

  const {
    css,
    type,
    enterClass,
    enterToClass,
    enterActiveClass,
    appearClass,
    appearToClass,
    appearActiveClass,
    beforeEnter,
    enter,
    afterEnter,
    enterCancelled,
    beforeAppear,
    appear,
    afterAppear,
    appearCancelled,
    duration
  } = data

  // activeInstance will always be the <transition> component managing this
  // transition. One edge case to check is when the <transition> is placed
  // as the root node of a child component. In that case we need to check
  // <transition>'s parent for appear check.
  /**
   * 处理边界情况
   * isAppear 表示当前上下文实例还没有 mounted，第一次出现的时机。
   * 当transition是子组件根节点，isAppear为true并且没有设置appear，就直接返回
   */
  let context = activeInstance
  let transitionNode = activeInstance.$vnode
  while (transitionNode && transitionNode.parent) {
    context = transitionNode.context
    transitionNode = transitionNode.parent
  }

  const isAppear = !context._isMounted || !vnode.isRootInsert

  if (isAppear && !appear && appear !== '') {
    return
  }


  /**
   * 定义过渡类名、钩子函数和其它配置
   * 
   * startClass 定义进入过渡的开始状态，在元素被插入时生效，在下一个帧移除
   * activeClass 定义过渡的状态，在元素整个过渡过程中作用，在元素被插入时生效，在 transition/animation 完成之后移除；
   * toClass 定义进入过渡的结束状态，在元素被插入一帧后生效 (与此同时 startClass 被删除)，在 <transition>/animation 完成之后移除
   * 
   * beforeEnterHook 是过渡开始前执行的钩子函数
   * enterHook 是在元素插入后或者是 v-show 显示切换后执行的钩子函数
   * afterEnterHook 是在过渡动画执行完后的钩子函数。
   * 
   * explicitEnterDuration 表示 enter 动画执行的时间。
   * expectsCSS 表示过渡动画是受 CSS 的影响。
   * cb 定义的是过渡完成执行的回调函数。
   */
  const startClass = isAppear && appearClass
    ? appearClass
    : enterClass
  const activeClass = isAppear && appearActiveClass
    ? appearActiveClass
    : enterActiveClass
  const toClass = isAppear && appearToClass
    ? appearToClass
    : enterToClass

  const beforeEnterHook = isAppear
    ? (beforeAppear || beforeEnter)
    : beforeEnter
  const enterHook = isAppear
    ? (typeof appear === 'function' ? appear : enter)
    : enter
  const afterEnterHook = isAppear
    ? (afterAppear || afterEnter)
    : afterEnter
  const enterCancelledHook = isAppear
    ? (appearCancelled || enterCancelled)
    : enterCancelled

  const explicitEnterDuration: any = toNumber(
    isObject(duration)
      ? duration.enter
      : duration
  )

  if (process.env.NODE_ENV !== 'production' && explicitEnterDuration != null) {
    checkDuration(explicitEnterDuration, 'enter', vnode)
  }

  const expectsCSS = css !== false && !isIE9
  const userWantsControl = getHookArgumentsLength(enterHook)

  //  把 toClass 和 activeClass 移除
  // 如果还取消了动画则移除startClass
  const cb = el._enterCb = once(() => {
    if (expectsCSS) {
      removeTransitionClass(el, toClass)
      removeTransitionClass(el, activeClass)
    }
    if (cb.cancelled) {
      if (expectsCSS) {
        removeTransitionClass(el, startClass)
      }
      enterCancelledHook && enterCancelledHook(el)
    } else {
      afterEnterHook && afterEnterHook(el)
    }
    el._enterCb = null
  })


  /**
   * 合并 insert 钩子函数
   * mergeVNodeHook 的定义在 src/core/vdom/helpers/merge-hook.js 中
   * mergeVNodeHook就是把hook 函数合并到 def.data.hook[hookey] 中
   * mergeVNodeHook会把这里定义的insert合并到vnode里的insert 下
   */
  if (!vnode.data.show) {
    // remove pending leave element on enter by injecting an insert hook
    mergeVNodeHook(vnode, 'insert', () => {
      const parent = el.parentNode
      const pendingNode = parent && parent._pending && parent._pending[vnode.key]
      if (pendingNode &&
        pendingNode.tag === vnode.tag &&
        pendingNode.elm._leaveCb
      ) {
        pendingNode.elm._leaveCb()
      }
      enterHook && enterHook(el, cb)
    })
  }

  // start enter transition 开始执行过渡动画
  beforeEnterHook && beforeEnterHook(el)
  // expectsCSS表示用css控制动画
  if (expectsCSS) {
    // 添加了enter和enter-active
    addTransitionClass(el, startClass)
    addTransitionClass(el, activeClass)
    // nextFrame是requestAnimationFrame（requestAnimationFrame是下一帧刷新前执行，所以extFrame套了两层，表示下下帧之前，也就是下一帧???应该没错哈）的实现，表示下一帧执行（大约是1/60秒）
    nextFrame(() => {
      // 这里移除了enter
      removeTransitionClass(el, startClass)
      // 若动画未取消则继续添加enter-to
      if (!cb.cancelled) {
        addTransitionClass(el, toClass)
        // 用户是否通过钩子函数控制动画
        if (!userWantsControl) {
          // 用户是否有定义延迟时间
          if (isValidDuration(explicitEnterDuration)) {
            setTimeout(cb, explicitEnterDuration)
          } else {
            // 没有定延时则根据渡动画的结束事件来执行cb
            whenTransitionEnds(el, type, cb)
          }
        }
      }
    })
  }

  if (vnode.data.show) {
    toggleDisplay && toggleDisplay()
    enterHook && enterHook(el, cb)
  }

  if (!expectsCSS && !userWantsControl) {
    cb()
  }
}

export function leave (vnode: VNodeWithData, rm: Function) {
  const el: any = vnode.elm

  // call enter callback now
  if (isDef(el._enterCb)) {
    el._enterCb.cancelled = true
    el._enterCb()
  }

  const data = resolveTransition(vnode.data.transition)
  if (isUndef(data) || el.nodeType !== 1) {
    return rm()
  }

  /* istanbul ignore if */
  if (isDef(el._leaveCb)) {
    return
  }

  const {
    css,
    type,
    leaveClass,
    leaveToClass,
    leaveActiveClass,
    beforeLeave,
    leave,
    afterLeave,
    leaveCancelled,
    delayLeave,
    duration
  } = data

  const expectsCSS = css !== false && !isIE9
  const userWantsControl = getHookArgumentsLength(leave)

  const explicitLeaveDuration: any = toNumber(
    isObject(duration)
      ? duration.leave
      : duration
  )

  if (process.env.NODE_ENV !== 'production' && isDef(explicitLeaveDuration)) {
    checkDuration(explicitLeaveDuration, 'leave', vnode)
  }

  const cb = el._leaveCb = once(() => {
    if (el.parentNode && el.parentNode._pending) {
      el.parentNode._pending[vnode.key] = null
    }
    if (expectsCSS) {
      removeTransitionClass(el, leaveToClass)
      removeTransitionClass(el, leaveActiveClass)
    }
    if (cb.cancelled) {
      if (expectsCSS) {
        removeTransitionClass(el, leaveClass)
      }
      leaveCancelled && leaveCancelled(el)
    } else {
      rm()
      afterLeave && afterLeave(el)
    }
    el._leaveCb = null
  })

  if (delayLeave) {
    delayLeave(performLeave)
  } else {
    performLeave()
  }

  function performLeave () {
    // the delayed leave may have already been cancelled
    if (cb.cancelled) {
      return
    }
    // record leaving element
    if (!vnode.data.show && el.parentNode) {
      (el.parentNode._pending || (el.parentNode._pending = {}))[(vnode.key: any)] = vnode
    }
    beforeLeave && beforeLeave(el)
    if (expectsCSS) {
      addTransitionClass(el, leaveClass)
      addTransitionClass(el, leaveActiveClass)
      nextFrame(() => {
        removeTransitionClass(el, leaveClass)
        if (!cb.cancelled) {
          addTransitionClass(el, leaveToClass)
          if (!userWantsControl) {
            if (isValidDuration(explicitLeaveDuration)) {
              setTimeout(cb, explicitLeaveDuration)
            } else {
              whenTransitionEnds(el, type, cb)
            }
          }
        }
      })
    }
    leave && leave(el, cb)
    if (!expectsCSS && !userWantsControl) {
      cb()
    }
  }
}

// only used in dev mode
function checkDuration (val, name, vnode) {
  if (typeof val !== 'number') {
    warn(
      `<transition> explicit ${name} duration is not a valid number - ` +
      `got ${JSON.stringify(val)}.`,
      vnode.context
    )
  } else if (isNaN(val)) {
    warn(
      `<transition> explicit ${name} duration is NaN - ` +
      'the duration expression might be incorrect.',
      vnode.context
    )
  }
}

function isValidDuration (val) {
  return typeof val === 'number' && !isNaN(val)
}

/**
 * Normalize a transition hook's argument length. The hook may be:
 * - a merged hook (invoker) with the original in .fns
 * - a wrapped component method (check ._length)
 * - a plain function (.length)
 */
function getHookArgumentsLength (fn: Function): boolean {
  if (isUndef(fn)) {
    return false
  }
  const invokerFns = fn.fns
  if (isDef(invokerFns)) {
    // invoker
    return getHookArgumentsLength(
      Array.isArray(invokerFns)
        ? invokerFns[0]
        : invokerFns
    )
  } else {
    return (fn._length || fn.length) > 1
  }
}

function _enter (_: any, vnode: VNodeWithData) {
  if (vnode.data.show !== true) {
    enter(vnode)
  }
}

export default inBrowser ? {
  create: _enter,
  activate: _enter,
  remove (vnode: VNode, rm: Function) {
    /* istanbul ignore else */
    if (vnode.data.show !== true) {
      leave(vnode, rm)
    } else {
      rm()
    }
  }
} : {}
