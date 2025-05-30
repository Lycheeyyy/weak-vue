//h函数的基本使用：第一个参数不一定为根组件而是元素，第二个参数是包含一些属性的对象，第三个参数为渲染的子内容（可能是文本/元素/自内容数组）
//h("div", { style: { color: "red" }, onClick: fn }, `hello ${proxy.state.age}`)
import { isArray, isObject, isString, ShapeFlags } from "@vue/shared";
// 生成vnode
export const createVNode = (type, props, children = null) => {
    // console.log(rootComponent, rootProps);
  
    // 区分是组件的虚拟dom还是元素的虚拟dom
    // 如果是字符串，说明是是一个普通的 HTML 元素节点；如果不是字符串且是一个对象，说明是一个组件（这里简化处理，直接默认有状态组件）
    let shapeFlag = isString(type)
      ? ShapeFlags.ELEMENT
      : isObject(type)
      ? ShapeFlags.STATEFUL_COMPONENT
      : 0;
    const vnode = {
      _v_isVNode: true, //表示是一个虚拟dom
      type,
      props,
      children,
      key: props && props.key, // 后面的diff算法会用到
      el: null, // 虚拟dom对应的真实dom
      shapeFlag,
    };
    // 儿子标识
    normalizeChildren(vnode, children);
    return vnode;
  };
  
  function normalizeChildren(vnode, children) {
    let type = 0;
    if (children === null) {
    } else if (isArray(children)) {
      // 说明该虚拟节点包含数组形式的子节点
      type = ShapeFlags.ARRAY_CHILDREN;
    } else {
      // 简化处理，表示该虚拟节点包含纯文本子节点
      type = ShapeFlags.TEXT_CHILDREN;
    }
    //位运算（按位或 |）按位或操作会对 两个数字的二进制每一位进行比较：只要其中 有一位是 1，结果就为 1。只有两个位都为 0，结果才是 0。
    vnode.shapeFlag = vnode.shapeFlag | type; // 可能标识会受儿子影响
  }
  
  export function isVnode(vnode) {
    return vnode._v_isVNode;
  }
  
  // 元素的chldren变成vnode
  export const TEXT = Symbol("text");
  export function CVnode(child) {
    if (isObject(child)) {
      return child;
    } else {
      return createVNode(TEXT, null, String(child));
    }
  }

