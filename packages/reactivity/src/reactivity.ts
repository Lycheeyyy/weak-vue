//为 Vue 3 的响应式系统 导入工具方法 和 准备各种响应式配置对象（handlers）
import { isObject } from "@vue/shared";
export const shallowReadonlyHandlers = {};
import {
  reactiveHandlers,
  shallowReactiveHandlers,
  readonlyHandlers,
} from "./baseHandlers";


//WeakMap 是 JavaScript 中的一个内置对象，它的主要作用是存储键值对，并且键必须是对象。与普通的 Map 不同，WeakMap 的键是 弱引用，即 当键不再被引用时，它会被垃圾回收机制自动清理。
//所以，WeakMap 特别适合用于存储与对象生命周期相关的数据
//WeakMap 不支持 forEach() 和迭代器方法（例如 for...of），因此无法遍历它的键值对。
const reactiveMap = new WeakMap();
const readonlyeMap = new WeakMap();

// 核心代理实现，baseHandlers用于每个api用的代理配置，用于数据劫持具体操作（get()、set()方法）
function createReactObj(target, isReadonly, baseHandlers) {
    // 1、首先要判断对象，这个是公共的方法，放到shared包中
    if (!isObject(target)) {//target是原始对象
      return target;
    }
    // 2、核心--优化处理，已经被代理的对象不能重复代理，因此新建一个数据结构来存储
    const proxyMap = isReadonly ? readonlyeMap : reactiveMap;
    const proxyEs = proxyMap.get(target);//尝试从 proxyMap 中获取 target 对象的代理实例（即代理对象 proxy）
    if (proxyEs) {
      return proxyEs;
    }
    const proxy = new Proxy(target, baseHandlers);//创建了一个新的代理对象 proxy，并使用了 baseHandlers 作为拦截器
    proxyMap.set(target, proxy);//将新的代理对象 proxy 和原始对象 target 进行关联，然后存储
    return proxy;
  }

//true和false代表是否是只读的
  export function reactive(target) {
    return createReactObj(target, false, reactiveHandlers);
  }
  export function shallowReactive(target) {
    return createReactObj(target, false, shallowReactiveHandlers);
  }
  export function readonly(target) {
    return createReactObj(target, true, readonlyHandlers);
  }
  export function shallowReadonly(target) {
    return createReactObj(target, true, shallowReadonlyHandlers);
  }