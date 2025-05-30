(function (exports, shared) {
  'use strict';

  /**
  * @vue/reactivity v3.5.14
  * (c) 2018-present Yuxi (Evan) You and Vue contributors
  * @license MIT
  **/
  const pausedQueueEffects = /* @__PURE__ */ new WeakSet();
  class ReactiveEffect {
    constructor(fn) {
      this.fn = fn;
      /**
       * @internal
       */
      this.deps = void 0;
      /**
       * @internal
       */
      this.depsTail = void 0;
      /**
       * @internal
       */
      this.flags = 1 | 4;
      /**
       * @internal
       */
      this.next = void 0;
      /**
       * @internal
       */
      this.cleanup = void 0;
      this.scheduler = void 0;
    }
    pause() {
      this.flags |= 64;
    }
    resume() {
      if (this.flags & 64) {
        this.flags &= -65;
        if (pausedQueueEffects.has(this)) {
          pausedQueueEffects.delete(this);
          this.trigger();
        }
      }
    }
    /**
     * @internal
     */
    notify() {
      if (this.flags & 2 && !(this.flags & 32)) {
        return;
      }
      if (!(this.flags & 8)) {
        batch(this);
      }
    }
    run() {
      if (!(this.flags & 1)) {
        return this.fn();
      }
      this.flags |= 2;
      cleanupEffect(this);
      prepareDeps(this);
      try {
        return this.fn();
      } finally {
        cleanupDeps(this);
        this.flags &= -3;
      }
    }
    stop() {
      if (this.flags & 1) {
        for (let link = this.deps; link; link = link.nextDep) {
          removeSub(link);
        }
        this.deps = this.depsTail = void 0;
        cleanupEffect(this);
        this.onStop && this.onStop();
        this.flags &= -2;
      }
    }
    trigger() {
      if (this.flags & 64) {
        pausedQueueEffects.add(this);
      } else if (this.scheduler) {
        this.scheduler();
      } else {
        this.runIfDirty();
      }
    }
    /**
     * @internal
     */
    runIfDirty() {
      if (isDirty(this)) {
        this.run();
      }
    }
    get dirty() {
      return isDirty(this);
    }
  }
  let batchedSub;
  let batchedComputed;
  function batch(sub, isComputed = false) {
    sub.flags |= 8;
    if (isComputed) {
      sub.next = batchedComputed;
      batchedComputed = sub;
      return;
    }
    sub.next = batchedSub;
    batchedSub = sub;
  }
  function prepareDeps(sub) {
    for (let link = sub.deps; link; link = link.nextDep) {
      link.version = -1;
      link.prevActiveLink = link.dep.activeLink;
      link.dep.activeLink = link;
    }
  }
  function cleanupDeps(sub) {
    let head;
    let tail = sub.depsTail;
    let link = tail;
    while (link) {
      const prev = link.prevDep;
      if (link.version === -1) {
        if (link === tail) tail = prev;
        removeSub(link);
        removeDep(link);
      } else {
        head = link;
      }
      link.dep.activeLink = link.prevActiveLink;
      link.prevActiveLink = void 0;
      link = prev;
    }
    sub.deps = head;
    sub.depsTail = tail;
  }
  function isDirty(sub) {
    for (let link = sub.deps; link; link = link.nextDep) {
      if (link.dep.version !== link.version || link.dep.computed && (refreshComputed(link.dep.computed) || link.dep.version !== link.version)) {
        return true;
      }
    }
    if (sub._dirty) {
      return true;
    }
    return false;
  }
  function refreshComputed(computed) {
    if (computed.flags & 4 && !(computed.flags & 16)) {
      return;
    }
    computed.flags &= -17;
    if (computed.globalVersion === globalVersion) {
      return;
    }
    computed.globalVersion = globalVersion;
    if (!computed.isSSR && computed.flags & 128 && (!computed.deps && !computed._dirty || !isDirty(computed))) {
      return;
    }
    computed.flags |= 2;
    const dep = computed.dep;
    try {
      prepareDeps(computed);
      const value = computed.fn(computed._value);
      if (dep.version === 0 || shared.hasChanged(value, computed._value)) {
        computed.flags |= 128;
        computed._value = value;
        dep.version++;
      }
    } catch (err) {
      dep.version++;
      throw err;
    } finally {
      cleanupDeps(computed);
      computed.flags &= -3;
    }
  }
  function removeSub(link, soft = false) {
    const { dep, prevSub, nextSub } = link;
    if (prevSub) {
      prevSub.nextSub = nextSub;
      link.prevSub = void 0;
    }
    if (nextSub) {
      nextSub.prevSub = prevSub;
      link.nextSub = void 0;
    }
    if (dep.subs === link) {
      dep.subs = prevSub;
      if (!prevSub && dep.computed) {
        dep.computed.flags &= -5;
        for (let l = dep.computed.deps; l; l = l.nextDep) {
          removeSub(l, true);
        }
      }
    }
    if (!soft && !--dep.sc && dep.map) {
      dep.map.delete(dep.key);
    }
  }
  function removeDep(link) {
    const { prevDep, nextDep } = link;
    if (prevDep) {
      prevDep.nextDep = nextDep;
      link.prevDep = void 0;
    }
    if (nextDep) {
      nextDep.prevDep = prevDep;
      link.nextDep = void 0;
    }
  }
  function effect(fn, options) {
    if (fn.effect instanceof ReactiveEffect) {
      fn = fn.effect.fn;
    }
    const e = new ReactiveEffect(fn);
    try {
      e.run();
    } catch (err) {
      e.stop();
      throw err;
    }
    const runner = e.run.bind(e);
    runner.effect = e;
    return runner;
  }
  function cleanupEffect(e) {
    const { cleanup } = e;
    e.cleanup = void 0;
    if (cleanup) {
      try {
        cleanup();
      } finally {
      }
    }
  }

  let globalVersion = 0;
  new Set(
    /* @__PURE__ */ Object.getOwnPropertyNames(Symbol).filter((key) => key !== "arguments" && key !== "caller").map((key) => Symbol[key]).filter(shared.isSymbol)
  );

  //h函数的基本使用：第一个参数不一定为根组件而是元素，第二个参数是包含一些属性的对象，第三个参数为渲染的子内容（可能是文本/元素/自内容数组）
  //h("div", { style: { color: "red" }, onClick: fn }, `hello ${proxy.state.age}`)
  // 生成vnode
  const createVNode = (type, props, children = null) => {
      // console.log(rootComponent, rootProps);
      // 区分是组件的虚拟dom还是元素的虚拟dom
      // 如果是字符串，说明是是一个普通的 HTML 元素节点；如果不是字符串且是一个对象，说明是一个组件（这里简化处理，直接默认有状态组件）
      let shapeFlag = shared.isString(type)
          ? shared.ShapeFlags.ELEMENT
          : shared.isObject(type)
              ? shared.ShapeFlags.STATEFUL_COMPONENT
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
      if (children === null) ;
      else if (shared.isArray(children)) {
          // 说明该虚拟节点包含数组形式的子节点
          type = shared.ShapeFlags.ARRAY_CHILDREN;
      }
      else {
          // 简化处理，表示该虚拟节点包含纯文本子节点
          type = shared.ShapeFlags.TEXT_CHILDREN;
      }
      //位运算（按位或 |）按位或操作会对 两个数字的二进制每一位进行比较：只要其中 有一位是 1，结果就为 1。只有两个位都为 0，结果才是 0。
      vnode.shapeFlag = vnode.shapeFlag | type; // 可能标识会受儿子影响
  }
  function isVnode(vnode) {
      return vnode._v_isVNode;
  }
  // 元素的chldren变成vnode
  const TEXT = Symbol("text");
  function CVnode(child) {
      if (shared.isObject(child)) {
          return child;
      }
      else {
          return createVNode(TEXT, null, String(child));
      }
  }

  // apiCreateApp是起到将组件变成虚拟dom的作用（返回一个对象，对象具有mount挂载方法，该挂载方法做了两件事：1、生成vnode；2、render渲染vnode）
  function apiCreateApp(render) {
      // createApp方法用于指明渲染的组件以及上面的属性
      return function createApp(rootComponent, rootProps) {
          let app = {
              // 添加相关的属性
              _components: rootComponent,
              _props: rootProps,
              _container: null,
              mount(container) {
                  // 挂载的位置
                  // console.log(renderOptionDom, rootComponent, rootProps, container);
                  // 1、创建虚拟dom vnode
                  //vnode 是 虚拟 DOM 节点（virtual DOM node）的缩写。
                  //本质上是一个用 JavaScript 对象描述 DOM 结构的数据结构，也就是用 JS 模拟真实 DOM 树的结构。
                  let vnode = createVNode(rootComponent, rootProps);
                  //console.log(vnode);
                  // 2、将虚拟dom渲染到实际的位置
                  render(vnode, container);
                  app._container = container;
              },
          };
          return app;
      };
  }

  // 处理组件实例代理时的配置对象
  const componentPublicInstance = {
      // target即{ _: instance }
      get({ _: instance }, key) {
          // 获取值的时候返回正确的结果，如proxy.xxx==>proxy.props.xxx
          const { props, data, setupState } = instance;
          if (key[0] === "$") {
              // 表示该属性不能获取
              return;
          }
          if (shared.hasOwn(props, key)) {
              return props[key];
          }
          else if (shared.hasOwn(setupState, key)) {
              return setupState[key];
          }
      },
      set({ _: instance }, key, value) {
          const { props, data, setupState } = instance;
          if (shared.hasOwn(props, key)) {
              props[key] = value;
          }
          else if (shared.hasOwn(setupState, key)) {
              setupState[key] = value;
          }
      },
  };

  // 创建组件实例
  const createComponentInstance = (vnode) => {
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
      instance.ctx = { _: instance }; //是一个 Vue 内部的约定写法，表示 “这个上下文来自哪个组件实例”
      return instance;
  };
  // 解析数据到该组件实例
  const setupComponet = (instance) => {
      // 代理
      instance.proxy = new Proxy(instance.ctx, componentPublicInstance);
      // 拿到值（上面instance的props等）
      const { props, children } = instance.vnode;
      // 把值设置到组件实例上
      instance.props = props;
      instance.children = children; // 相当于slot插槽
      // 看一下这个组件有无状态（有状态代表有setup入口函数或者render函数）
      const shapeFlag = instance.vnode.shapeFlag & shared.ShapeFlags.STATEFUL_COMPONENT;
      if (shapeFlag) {
          setupStateComponent(instance);
      }
  };
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
      }
      else {
          // 没有setup则会有instance.type.render方法的（处理无setup有render的情况）
          finishComponentSetup(instance); // 通过vnode拿到render方法
      }
  }
  // 处理context上下文对象（包含了父组件传递下来的非 prop 属性attrs、可以用来触发父组件中绑定的事件函数emit、一个指向当前组件实例的引用root、用来获取插槽内容的函数slot等）
  function createContext(instance) {
      return {
          sttrs: instance.attrs,
          slots: instance.slots,
          emit: () => { },
          expose: () => { },
      };
  }
  // 处理setup函数的返回结果
  function handlerSetupResult(instance, setupResult) {
      if (shared.isFunction(setupResult)) {
          instance.render = setupResult; // 处理有setup且返回函数的情况==>没必要使用组件的render方法了
      }
      else if (shared.isObject(setupResult)) {
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
          if (!Component.render && Component.template) ;
          instance.render = Component.render;
      }
      //console.log(instance.render);
  }

  //import { ShapeFlags } from "@vue/shared";
  //import { effect } from "@vue/reactivity";
  //import { apiCreateApp } from "./apiCreateApp";
  //import { createComponentInstance, setupComponet } from "./component";
  //
  //  // 实现渲染Vue3组件==>vnode==>render
  //export function createRender(renderOptionDom) {
  //
  //  const processComponent = (n1, n2, container) => {//负责处理组件的渲染（初次渲染和更新两种情况）
  //    if (n1 === null) {
  //      // 组件第一次加载
  //      mountComponent(n2, container);
  //    } else {
  //      // 更新
  //    }
  //  };
  //
  //  // 组件渲染的真正方法（实现由虚拟dom变成真实dom），步骤（核心）：
  //const mountComponent = (InitialVnode, container) => {
  //  //InitialVnode是当前要挂载的虚拟节点
  //  // 1、先有一个组件的实例对象（即Vue3组件渲染函数render传入的第一个参数proxy，其实proxy参数将组件定义的所有属性合并了，等效于在setup入口函数里面返回一个函数，可以用proxy.来获取属性）
  //  const instanece = (InitialVnode.component =//InitialVnode.component是指当前组件虚拟节点所关联的组件实例对象
  //    //createComponentInstance会基于当前虚拟节点 InitialVnode 创建一个组件实例对象（包含 props、setup 返回值、render 函数等）
  //    createComponentInstance(InitialVnode)); // 记得在weak-vue\packages\runtime-core\src\vnode.ts文件给vnode定义中加上这个属性
  //    //↑vnode.component 本来是 null，你需要手动创建一个组件实例对象并挂载回 vnode.component，
  //  // 2、解析数据到这个实例对象中
  //  setupComponet(instanece);
  //  // 3、创建一个effect让render函数执行
  //  setupRenderEffect(instanece);
  //};
  //
  //// 创建一个effect让render函数执行(响应式)
  //function setupRenderEffect(instance) {
  //  // 创建effect(原理可以回前面的内容找)
  //  //effect作用： 收集副作用函数，当依赖的数据发生变化时，这个副作用函数就会重新执行。
  //  //componentEffect() 是副作用函数，也就是渲染函数。每次响应式数据变了，它都会重新调用。
  //  effect(function componentEffect() {
  //    // 判断是否是初次渲染
  //    if (!instance.isMounted) {//isMounted是一个标志属性，用来 标识当前组件是否已经挂载过（即是否是第一次渲染）。
  //      // 获取到render返回值
  //      const proxy = instance.proxy; // 已经代理了组件，可以访问到组件的所有属性和所有方法
  //      //.call(proxy, proxy) 的意思是：用 proxy 来作为 this，也作为参数传进去。这样写可以确保在 render 函数中可以写成 this.xxx 或直接访问 proxy.xxx。
  //      // render函数执行，即调用render函数，第一个参数表示render函数的this指向组件实例proxy，第二个参数表示执行render函数的参数也是proxy
  //    
  //      const subTree = instance.render.call(proxy, proxy);
  //      console.log("h函数生成的vnode树：", subTree);
  //    }
  //
  //  });
  //}
  //
  //
  //  
  //  // patch函数负责根据vnode的不同情况（组件、元素）来实现对应的渲染
  //const patch = (n1, n2, container) => {
  //  // 针对不同的类型采取不同的渲染方式（vnode有一个shapeFlag标识来标识组件/元素）
  //  const { shapeFlag } = n2;
  //  // 等效于shapeFlag && shapeFlag === ShapeFlags.ELEMENT
  //  //因为一个vnode可以有多个类型，比如是元素，又有子元素，不能只用===判断唯一性，要用位运算表示多个特征
  //  //按位与:两个数的对应位都为 1，结果才是 1，否则就是 0
  //  if (shapeFlag & ShapeFlags.ELEMENT) {//判断 shapeFlag 是否包含 ShapeFlags.ELEMENT 这个标志。它返回一个数字，若结果不为 0，则说明包含。
  //    // 处理元素
  //    // console.log("元素");
  //  } else if (shapeFlag & ShapeFlags.STATEFUL_COMPONENT) {
  //    // 处理组件
  //    processComponent(n1, n2, container);
  //  }
  //};
  //  // 真正实现渲染的函数（渲染vnode)
  //  let render = (vnode, container) => {
  //        // 第一次渲染（三个参数：旧的节点、当前节点、位置）
  //        patch(null, vnode, container);
  //  };
  //
  ///** ---------------处理元素--------------- */
  //const processElement = (n1, n2, container) => {
  //  if (n1 === null) {
  //    // 元素第一次挂载
  //    mountElement(n2, container);
  //  } else {
  //    // 更新
  //  }
  //};
  //
  //const mountElement = (vnode, container) => {
  //  // 递归渲染子节点==>dom操作==》挂载到container/页面上
  //  const { shapeFlag, props, type, children } = vnode;
  //  // 1、创建元素--记得把真实dom挂载到vnode上，方便后面更新时使用
  //  let el = (vnode.el = hostCreateElement(type));
  //  // 2、创建元素的属性
  //  if (props) {
  //    for (const key in props) {
  //      hostPatchProp(el, key, null, props[key]);
  //    }
  //  }
  //  // 3、放入到对应的容器中
  //  hostInsert(el, container);
  //};
  //
  //
  //
  //
  //  // 返回一个具有createApp方法的对象，其中createApp负责生成一个具有mount挂载方法的app对象（包含属性、方法等），进而实现1、生成vnode；2、render渲染vnode
  //  return {
  //    createApp: apiCreateApp(render),
  //  };
  //
  //}
  //
  //
  //
  // 实现渲染Vue3组件==>vnode==>render
  function createRender(renderOptionDom) {
      // 获取所有的dom操作
      const { insert: hostInsert, remove: hostRemove, patchProps: hostPatchProp, createElement: hostCreateElement, createText: hostCreateText, createComment: hostCreateComment, setText: hostSetText, setElementText: hostSetElementText, } = renderOptionDom;
      // 创建一个effect让render函数执行(响应式)
      const setupRenderEffect = (instance, container) => {
          // 创建effect(原理可以回前面的内容找)
          effect(function componentEffect() {
              // 判断是否是初次渲染
              if (!instance.isMounted) {
                  // 获取到render返回值
                  const proxy = instance.proxy; // 已经代理了组件，可以访问到组件的所有属性和所有方法
                  // console.log("这是组件实例proxy：");
                  // console.log(proxy);
                  const subTree = instance.render.call(proxy, proxy); // render函数执行，即调用render函数，第一个参数表示render函数的this指向组件实例proxy，第二个参数表示执行render函数的参数也是proxy
                  // console.log("h函数生成的vnode树：", subTree);
                  patch(null, subTree, container); // 渲染vnode（此时是元素的vnode）
              }
          });
      };
      /** ---------------处理组件--------------- */
      // 组件的创建方法（分为初次渲染和更新两种情况）
      const processComponent = (n1, n2, container) => {
          {
              // 组件第一次加载
              mountComponent(n2, container);
          }
      };
      // 组件渲染的真正方法（实现由虚拟dom变成真实dom），步骤（核心）：
      const mountComponent = (InitialVnode, container) => {
          // 1、先有一个组件的实例对象（即Vue3组件渲染函数render传入的第一个参数proxy，其实proxy参数将组件定义的所有属性合并了，等效于在setup入口函数里面返回一个函数，可以用proxy.来获取属性）
          const instanece = (InitialVnode.component =
              createComponentInstance(InitialVnode)); // 记得在Vue3.0\packages\runtime-core\src\vnode.ts文件给vnode定义中加上这个属性
          // 2、解析数据到这个实例对象中
          setupComponet(instanece);
          // 3、创建一个effect让render函数执行
          setupRenderEffect(instanece, container);
      };
      /** ---------------处理元素--------------- */
      const processElement = (n1, n2, container) => {
          {
              // 元素第一次挂载
              mountElement(n2, container);
          }
      };
      // 元素的渲染方法
      const mountElement = (vnode, container) => {
          // 递归渲染子节点==>dom操作==》挂载到container/页面上
          const { shapeFlag, props, type, children } = vnode;
          // 1、创建元素
          let el = hostCreateElement(type);
          // 2、创建元素的属性
          if (props) {
              for (const key in props) {
                  hostPatchProp(el, key, null, props[key]);
              }
          }
          // 3、处理children
          if (children) {
              if (shapeFlag & shared.ShapeFlags.TEXT_CHILDREN) {
                  console.log("这是文本字符串形式子节点：", children);
                  hostSetElementText(el, children); // 文本形式子节点，比如这种情况：h('div',{},'张三')，将children直接插入到el中
              }
              else if (shapeFlag & shared.ShapeFlags.ARRAY_CHILDREN) {
                  // 递归渲染子节点
                  console.log("这是数组形式子节点：", children);
                  mountChildren(el, children); // 数组形式子节点，比如这种情况：h('div',{},['张三',h('p',{},'李四')])，将children递归渲染插入到el中
              }
          }
          // 4、放入到对应的容器中
          hostInsert(el, container);
      };
      // 递归渲染子节点
      const mountChildren = (container, children) => {
          for (let i = 0; i < children.length; i++) {
              // children[i]两种情况：1、['张三']这种元素，字符串的形式；2、h('div',{},'张三')这种元素，对象的形式（vnode）
              // 但两种情况都需要转换成vnode来处理，方便借助patch函数来渲染
              const child = CVnode(children[i]); // 第一种情况转换成vnode
              // 递归渲染子节点（vnode包含了元素、组件、文本三种情况）
              patch(null, child, container);
          }
      };
      /** ---------------处理文本--------------- */
      const processTxt = (n1, n2, container) => {
          {
              // 创建文本==>直接渲染到页面中（变成真实dom==>插入）
              hostInsert(hostCreateText(n2.children), container);
          }
      };
      /**---------------------------------------------------------- */
      // patch函数负责根据vnode的不同情况（组件、元素、文本）来实现对应的渲染
      const patch = (n1, n2, container) => {
          // 针对不同的类型采取不同的渲染方式（vonode有一个shapeFlag标识来标识组件/元素）
          const { shapeFlag, type } = n2;
          switch (type) {
              case TEXT:
                  // 处理文本
                  processTxt(n1, n2, container);
                  break;
              default:
                  // 等效于shapeFlag && shapeFlag === ShapeFlags.ELEMENT
                  if (shapeFlag & shared.ShapeFlags.ELEMENT) {
                      // 处理元素(h函数)
                      // console.log("此时处理的是元素！！！");
                      processElement(n1, n2, container);
                  }
                  else if (shapeFlag & shared.ShapeFlags.STATEFUL_COMPONENT) {
                      // 处理组件
                      processComponent(n1, n2, container);
                  }
          }
      };
      // 真正实现渲染的函数（渲染vnode)
      const render = (vnode, container) => {
          // 第一次渲染（三个参数：旧的节点、当前节点、位置）
          patch(null, vnode, container);
      };
      // 返回一个具有createApp方法的对象，其中createApp负责生成一个具有mount挂载方法的app对象（包含属性、方法等），进而实现1、生成vnode；2、render渲染vnode
      return {
          createApp: apiCreateApp(render),
      };
  }

  // h函数的作用==>生成vnode（createVNode原理可以回去前面的内容看），核心之一==>处理参数
  function h(type, propsOrChildren, children) {
      // 先根据参数个数来处理
      const i = arguments.length;
      if (i === 2) {
          // 情况1：元素+属性(传入一个对象)
          if (shared.isObject(propsOrChildren) && !shared.isArray(propsOrChildren)) {
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
          }
          else {
              // 情况2：元素+children
              // h("div", 'hello') 或 h("div", [vnode, vnode])
              return createVNode(type, null, propsOrChildren);
          }
      }
      else {
          if (i > 3) {
              children = Array.prototype.slice.call(arguments, 2); // 第二个参数后面的所有参数，都应该放在children数组里面
          }
          else if (i === 3 && isVnode(children)) { //h("div", { id: "box" }, h("span"))，第三个参数是一个vnode，是一个子节点而不是数组
              children = [children]; //把vnode包装成一个数组
          }
          return createVNode(type, propsOrChildren, children);
      }
  }

  exports.apiCreateApp = apiCreateApp;
  exports.createRender = createRender;
  exports.h = h;

})(this.VueRuntimeCore = this.VueRuntimeCore || {}, VueShared);
if(typeof window !== 'undefined') window.VueShared = VueShared;
//# sourceMappingURL=runtime-core.global.js.map
