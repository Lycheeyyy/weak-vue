import { baseCompile } from "@vue/compiler-core";
import { extend, isFunction, isObject, ShapeFlags } from "@vue/shared";
import { componentPublicInstance } from "./componentPublicInstance";
import { h } from "./h";

// 获取到当前组件实例
export const getCurrentInstance = () => {
  return currentInstance;
};

// 设置当前组件实例
export const setCurrentInstance = (target) => {
  currentInstance = target;
};


// 创建组件实例
export const createComponentInstance = (vnode) => {
// instance本质是一个对象(包含组件的vnode，前面实现的组件的一些属性如参数props、自定义属性attrs，setup入口函数的状态等)
const instance = {
  vnode,
  type: vnode.type, // 组件的所有属性都在这里面
  props: {}, // 组件的参数
  attrs: {}, // 自定义属性
  setupState: {}, // 用来存储setup入口函数的返回值
  //ctx是渲染上下文
  ctx: {}, // 用来处理代理，保存实例的值，和下面的proxy一起用。没有这个会导致用类似instance.props.xxx才能获取属性，有了之后直接proxy.xxx便能直接获取了
  proxy: {}, // 和上面的ctx一起用
  render: false, // 存储组件实例的渲染函数
  isMounted: false, // 是否挂载
};
//这个语句的重点是：给 instance.ctx 赋一个对象，这个对象里有一个键 _，它的值是 instance 本身。
instance.ctx = { _: instance };//是一个 Vue 内部的约定写法，表示 “这个上下文来自哪个组件实例”
return instance;
};

// 解析数据到该组件实例
export const setupComponet = (instance) => {
  // 代理
  instance.proxy = new Proxy(instance.ctx, componentPublicInstance as any);

  // 拿到值（上面instance的props等）
  const { props, children } = instance.vnode;
  // 把值设置到组件实例上
  instance.props = props;
  instance.children = children; // 相当于slot插槽
  // 看一下这个组件有无状态（有状态代表有setup入口函数或者render函数）
  const shapeFlag = instance.vnode.shapeFlag & ShapeFlags.STATEFUL_COMPONENT;
  if (shapeFlag) {
    setupStateComponent(instance);
  } else {
    // 如果无状态，说明是简单组件，直接渲染即可。
  }
};

// 将全局的组件实例暴露出去
export let currentInstance;


// 处理有状态的组件
function setupStateComponent(instance) {
    // setup方法的返回值是我们的render函数的参数
    // 拿到组件的setup方法
    //   其中我们可以知道：
    // 1、setup方法的参数是组件参数props、上下文对象context（包含了父组件传递下来的非 prop 属性attrs、可以用来触发父组件中绑定的事件函数emit、一个指向当前组件实例的引用root、用来获取插槽内容的函数slot等）
    // 2、setup方法的返回值可以是一个对象（包含代理的响应式属性以供渲染函数使用），也可以是直接返回渲染函数
    const Component = instance.type; // createVNode时传入给type的是rootComponent，本质是一个对象，组件的所有属性都在这里，比如setup方法，比如render方法
    const { setup } = Component;
    //处理参数
    //const setupContext = createContext(instance); // 返回一个上下文对象
    //setup(instance.props, setupContext); // 实际执行的setup函数（实参）

    //instance.proxy = new Proxy(instance.ctx, componentPublicInstance as any);

    if (setup) {
        const setupContext = createContext(instance); // 返回一个上下文对象
        //调用组件定义中的 setup 函数，传入 props 和上下文
        const setupResult = setup(instance.props, setupContext); // 实际执行的setup函数（实参）
        // setup返回值有两种情况：1、对象；2、函数==>根据不同情况进行处理
        // 如果是对象，则将值放在instance.setupState；如果是函数，则就是render函数
        handlerSetupResult(instance, setupResult); 
      } else {
        // 没有setup则会有instance.type.render方法的（处理无setup有render的情况）
        finishComponentSetup(instance); // 通过vnode拿到render方法
      }
      
}


// 处理context上下文对象（包含了父组件传递下来的非 prop 属性attrs、可以用来触发父组件中绑定的事件函数emit、一个指向当前组件实例的引用root、用来获取插槽内容的函数slot等）
function createContext(instance) {
  return {
    sttrs: instance.attrs,
    slots: instance.slots,
    emit: () => {},
    expose: () => {},
  };
}

// 处理setup函数的返回结果
function handlerSetupResult(instance, setupResult) {
    if (isFunction(setupResult)) {
      instance.render = setupResult; // 处理有setup且返回函数的情况==>没必要使用组件的render方法了
    } else if (isObject(setupResult)) {
        //setupState是vue组件实例instance中用于存储setup()返回对象中的状态的属性
      instance.setupState = setupResult; // 处理有setup且返回对象的情况==>要使用组件的render方法了
    }
  
    // 最终也会走render（把render挂载到实例上去）
    finishComponentSetup(instance);
  }

// 处理render（把render挂载到实例上去）
function finishComponentSetup(instance) {
    // 判断组件中有没有render方法，没有则
    const Component = instance.type; // createVNode时传入给type的是rootComponent，本质是一个对象，组件的所有属性都在这里，比如setup方法，比如render方法
    if (!instance.render) {
      // 这里的render指的是上面instance实例的render属性，在handlerSetupResult函数中会赋值（赋值的情况：组件有setup且返回函数），如果没有setup则此时会为false，则需要赋组件的render方法
      //template 是 HTML 字符串。Vue 会用它的模板编译器（@vue/compiler-dom）把它编译成 JS 渲染函数。
      if (!Component.render && Component.template) {
        // 模版编译
        let { template } = Component;
        if (template[0] === "#") { // Vue 支持你传一个选择器作为 template，比如：template: '#my-template'。这时你不是直接写模板字符串，而是让 Vue 去页面上找这个元素的 innerHTML 来用作模板。
          const el = document.querySelector(template);
          template = el ? el.innerHTML : "";
        }
      
        const { code } = baseCompile(template);// Vue 内部的 baseCompile会把 template 编译为 JavaScript 代码字符串
        // 比如：<div>{{ count }}</div> 编译成 return h("div", null, count)
        // console.log("这是编译后的代码", code);
        const fn = new Function("ctx", code);// 用 new Function("ctx", code) 创建一个 动态渲染函数 比如const fn = (ctx) => h("div", null, ctx.count)
        const ctx = extend( // 构造了一个上下文对象ctx
          { h: h }, // h：Vue 的虚拟 DOM 创建函数
          instance.attrs,
          instance.props,
          instance.setupState
        );
        const render = fn(ctx); // 将字符串里面的h函数、渲染的值以及函数都变成需要的值，而不是字符串
        Component.render = render;
      }
      instance.render = Component.render;
    }
    //console.log(instance.render);
  }



// new Function()是js提供的一个构造函数，用于动态创建一个函数对象，语法：const func = new Function([arg1, arg2, ...], functionBody);arg1,arg2,...是可选的参数名；functionBody是函数体，必须是一个字符串
// 比如这个const add = new Function('a', 'b', 'return a + b;');——————>console.log(add(2, 3)); // 输出 5,其实就相当于function add(a,b){return a+b;}
// const render = new Function("ctx", code);其中ctx是传进来的参数，code里面需要用到ctx里面的值
  
  

  