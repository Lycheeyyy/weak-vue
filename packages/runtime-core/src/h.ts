// h函数的作用==>生成vnode（createVNode原理可以回去前面的内容看），核心之一==>处理参数
import { isObject,isArray } from "@vue/shared";
import { createVNode,isVnode } from "./vnode";

export function h(type, propsOrChildren, children) {
    // 先根据参数个数来处理
    const i = arguments.length;
    if (i === 2) {
      // 情况1：元素+属性(传入一个对象)
      if (isObject(propsOrChildren) && !isArray(propsOrChildren)) {
        //h("div", vnode)	vnode 作为子节点	createVNode(type, null, [vnode])
        //h("div", [vnode])	vnode数组作为 children	createVNode(type, null, propsOrChildren)
        if (isVnode(propsOrChildren)) {
          // h("div", vnode)
          // 是vnode，不是属性
          return createVNode(type, null, [propsOrChildren]);
        }
        //是普通对象=>是props
        // h("div", { id: 'app' })
        return createVNode(type, propsOrChildren); // 没有儿子
      } else {
        // 情况2：元素+children
        // h("div", 'hello') 或 h("div", [vnode, vnode])
        return createVNode(type, null, propsOrChildren);
      }
    } else {
      if (i > 3) {
        children = Array.prototype.slice.call(arguments, 2); // 第二个参数后面的所有参数，都应该放在children数组里面
      } else if (i === 3 && isVnode(children)) {//h("div", { id: "box" }, h("span"))，第三个参数是一个vnode，是一个子节点而不是数组
        children = [children];//把vnode包装成一个数组
      }
      return createVNode(type, propsOrChildren, children);
    }
  }
  



