import { effect } from '@vue/reactivity';
import { isString, isObject, isArray, hasOwn, isFunction, extend as extend$1 } from '@vue/shared';
import { baseCompile } from '@vue/compiler-core';
export * from '@vue/runtime-core';

/**公共方法 */
// 判断是否为对象
// 合并两个对象
const extend = Object.assign; //直接将 ES 的 Object.assign() 方法赋值为 extend 名称

//在vnode.ts生成虚拟DOM节点中，第一个参数 type 不一定为根组件也可能是元素，生成的虚拟 dom 也要据此做出区分。
//至于怎么区分，源码里面为了精确地获取节点的特性信息的同时提高渲染性能，借助了枚举，每个枚举值都是一个二进制位掩码
//至于为什么用二进制源码表示，这是因为经过大量的实践证明，二进制表示、位运算可以节省内存空间的同时大大优化对比性能，同时也可以方便组合、提高代码简洁度，可以用于标记虚拟节点的具体类型和特性
var ShapeFlags;
(function (ShapeFlags) {
    ShapeFlags[ShapeFlags["ELEMENT"] = 1] = "ELEMENT";
    ShapeFlags[ShapeFlags["FUNCTIONAL_COMPONENT"] = 2] = "FUNCTIONAL_COMPONENT";
    ShapeFlags[ShapeFlags["STATEFUL_COMPONENT"] = 4] = "STATEFUL_COMPONENT";
    //为 TEXT_CHILDREN 这个标志位分配一个唯一的 二进制位，具体值是 1 左移 3 位
    ShapeFlags[ShapeFlags["TEXT_CHILDREN"] = 8] = "TEXT_CHILDREN";
    ShapeFlags[ShapeFlags["ARRAY_CHILDREN"] = 16] = "ARRAY_CHILDREN";
    ShapeFlags[ShapeFlags["SLOTS_CHILDREN"] = 32] = "SLOTS_CHILDREN";
    ShapeFlags[ShapeFlags["TELEPORT"] = 64] = "TELEPORT";
    ShapeFlags[ShapeFlags["SUSPENSE"] = 128] = "SUSPENSE";
    ShapeFlags[ShapeFlags["COMPONENT_SHOULD_KEEP_ALIVE"] = 256] = "COMPONENT_SHOULD_KEEP_ALIVE";
    ShapeFlags[ShapeFlags["COMPONENT_KEPT_ALIVE"] = 512] = "COMPONENT_KEPT_ALIVE";
    ShapeFlags[ShapeFlags["COMPONENT"] = 6] = "COMPONENT";
})(ShapeFlags || (ShapeFlags = {}));

console.log(ShapeFlags);

// 操作节点（增删改查）
const nodeOps = {
    // 对节点的一些操作
    // 创建元素，createElement(runtime-dom本质是运行时操作dom，但因为每个平台操作dom的方法不同，vue的runtime-dom模块的createElement方法是针对浏览器的)
    createElement: (tagName) => document.createElement(tagName),
    // 删除元素
    remove: (child) => {
        const parent = child.parentNode;
        if (parent) {
            parent.removeChild(child);
        }
    },
    // 插入元素
    //anchor表示插入的位置锚点，要插入的内容再这个的前面
    //anchor为空的时候，insert(p1,parent,null)就相当于parent.appendChild(p1)
    insert: (child, parent, ancher = null) => {
        //insertBefore函数：两个参数：newNode和referenceNode,前者代表想要插入/加进去的元素，后者代表插入位置的参照节点，newNode会被插到它之前
        parent.insertBefore(child, ancher); // anchor为空相当于appendchild
    },
    // 选择节点
    querySelector: (select) => document.querySelector(select),
    // 设置节点的文本
    setElementText: (el, text) => {
        el.textContent = text;
    },
    // 对文本的一些操作
    createText: (text) => document.createTextNode(text),
    setText: (node, text) => (node.nodeValue = text),
};

// 处理class
const patchClass = (el, value) => {
    // 对这个标签的class赋值（如果没有赋值为空，如果有则直接打点获取属性后覆盖）
    if (value === null) {
        value = "";
    }
    el.className = value;
};

// 处理style
// 已经渲染到页面上{style：{color:'red'}}=>当前（新的）样式{style:{background:'green'，font-size:20px}}
const patchStyle = (el, prev, next) => {
    const style = el.style;
    // 说明样式删除
    //新样式整体为 null（不是一个对象，而是整个没了）→ 意味着：元素彻底不需要任何样式了。所以干脆把整个 style 属性从 DOM 中删除（更彻底、更高效）。
    if (next === null) { //如果新的样式next是null，说明这个元素不再需要样式了，就直接把原来的样式删掉
        el.removeAttribute("style");
    }
    else { //next 是一个对象，但可能缺少某些字段（比如删了 color）。如果 prev 有 color: "red"，而 next.color === null，那就清掉这一条具体样式。只清除有差异的单个样式项。
        // 如果是已经渲染的样式有某样式，但是新的样式没有，则要清除老的样式
        if (prev) {
            for (const key in prev) {
                if (next[key] === null) {
                    style[key] = "";
                }
            }
        }
        // 如果是新的有，老的没有，则直接打点获取属性后覆盖
        for (const key in next) {
            style[key] = next[key];
        }
    }
};

// 处理一些自定义的属性
const patchAttr = (el, key, value) => {
    if (value === null) {
        el.removeAttribute(key);
    }
    else {
        el.setAttribute(key, value);
    }
};

// 注意：对事件的处理比较特殊，因为事件和样式类名自定义属性不一样，绑定不同的事件不能直接覆盖，如@click="fn1"、@click = "fn2"。
// 因为 addEventListener 重复添加事件监听时，不能替换之前的监听，导致有多个监听同时存在。
// 所以这里借助一个 map 结构存储所有的事件映射，然后 addEventListener 监听对应的映射值，然后重复绑定时直接改变映射值即可（相当于改变引用）。
// 源码对这个处理使用了缓存，用一个map结构存储元素key上面绑定的元素
// el为元素，key是触发事件的方法，即事件名（如click），value为绑定的函数方法
const patchEvent = (el, key, value) => {
    //确保当前 DOM 元素 el 上有一个事件缓存对象 _vei，如果没有，就创建一个空对象 {}。
    //el._vei 是挂在 DOM 元素上的自定义属性，用来缓存所有绑定在这个元素上的事件监听器。
    //如果这个元素之前已经绑定过事件，el._vei 就已经存在，直接使用。如果这个元素还没有绑定过任何事件，就创建一个新的空对象，并赋值给 el._vei。
    //el._vei存的是一个元素上所有事件的缓存对象，它记录了事件类型（如 click）和它对应的事件执行器（invoker）。
    const invokers = el._vei || (el._vei = {}); // el._vei相当于一个元素的事件map缓存结构，可能为空{}。拿上面的例子来说的话，此时应该是{"click":{value:fn1}}
    //如果之前就已经绑定了这个事件，exists 就是那个事件的处理器（invoker）
    const exists = invokers[key]; // 拿上面的例子来说的话，此时应该是 {value:fn1}
    if (exists && value) { //事件存在，并且传入了新的value
        // 不能进行覆盖（情况1）==>改变缓存中的value指向最新的事件即可，相当于改变exists的fn引用
        exists.value = value; //exists.value就是你最新绑定的事件处理函数
    }
    else {
        // 如果该触发方式还未绑定事件或者传入的函数为空，可能是新的绑定，也可能是清除事件
        //下面这行代码的作用举例：从 "onClick" 得到 "click"，即浏览器认识的事件名
        const eventName = key.slice(2).toLowerCase(); //toLowerCase()是JavaScript 字符串的一个方法，用来将 字符串中的所有字母转换为小写。
        if (value) {
            //  新的事件绑定，且将该绑定放入缓存器（情况2）
            //invokers是一个map对象
            //把新创建的 invoker 缓存在 invokers 这个对象中，并使用事件名（如 "click"）作为 key，对应这个 invoker 作为 value。这样后续就可以通过事件名快速找到对应的 invoker，实现高效的事件管理。
            let invoker = (invokers[eventName] = createInvoker(value)); // 返回一个包装后的函数
            el.addEventListener(eventName, invoker);
        }
        else {
            //  移除事件（情况3）
            //为什么下面这里使用的是exists 而不是 invokers[eventName]？
            //因为上述变化中，exists = invokers[key]; // 注意 key 是 "onClick"；但是eventName是去掉了on并且变成小写了的click
            el.removeEventListener(eventName, exists);
            //补充：element.removeEventListener(type, listener, options);
            // type: 事件类型（字符串），比如 'click'、'input' 等。listener: 要移除的事件处理函数（必须是同一个函数引用）。options: 可选参数（和 addEventListener 的第三个参数一样）。
            invokers[eventName] = null;
        }
    }
};
//尤其在 高效更新 的场景下，我们不希望每次更新事件处理时都重新绑定事件。为了实现这个高效更新的目标，Vue 采用了包装函数的方式，使得我们可以 动态更新事件处理函数，而不必解绑再重新绑定。
//这个函数的目的是生成一个包装函数
function createInvoker(value) {
    //value 就是你实际绑定的事件处理函数（比如 fn1 或 fn2）。
    //invoker是一个包装函数，目的：让事件处理函数（即 value）通过 invoker 来触发，invoker 本身是一个函数，但是它是代理函数，调用它实际上是调用 invoker.value。
    //invoker的任务是将事件参数传递给实际的事件处理函数。
    // 为什么用他呢？如果事件处理函数（value）发生变化，我们不需要重新绑定事件，而是只需要更新 invoker.value。
    const invoker = (e) => {
        invoker.value(e);
    };
    invoker.value = value; //这样传进去之后，invoker.value中存储了我们传入的事件处理函数（比如 fn1、fn2）。
    //invoker.value 可以在后续的某个时刻被更新，这就意味着我们可以在不重新绑定事件的情况下，动态改变事件处理逻辑。
    return invoker;
}

// 操作属性（增删改查）
//意思是：给某个 DOM 元素 el，根据属性名 key，把旧值 prevValue 更新为新值 nextValue。
const patchProps = (el, key, prevValue, nextValue) => {
    switch (key) {
        case "class":
            patchClass(el, nextValue); // 只用传节点和新的class值
            //更新类名，不需要旧值参与
            break;
        case "style":
            patchStyle(el, prevValue, nextValue); //会智能对比 prevValue 和 nextValue，只更新有变化的部分，删除不需要的旧样式。
            break;
        default:
            // 事件要另外处理(事件的特征：@、onclick等==>正则匹配，如以on开头，后面跟小写字母，这里简化判断，知道思想即可)
            //^ 在方括号内，表示否定，即“不属于这个范围”。
            //[^a-z] - 排除小写字母
            if (/^on[^a-z]/.test(key)) {
                patchEvent(el, key, nextValue);
            }
            else {
                patchAttr(el, key, nextValue);
            }
    }
};

//h函数的基本使用：第一个参数不一定为根组件而是元素，第二个参数是包含一些属性的对象，第三个参数为渲染的子内容（可能是文本/元素/自内容数组）
//h("div", { style: { color: "red" }, onClick: fn }, `hello ${proxy.state.age}`)
// 生成vnode
const createVNode = (type, props, children = null) => {
    // console.log(rootComponent, rootProps);
    // 区分是组件的虚拟dom还是元素的虚拟dom
    // 如果是字符串，说明是是一个普通的 HTML 元素节点；如果不是字符串且是一个对象，说明是一个组件（这里简化处理，直接默认有状态组件）
    let shapeFlag = isString(type)
        ? 1 /* ShapeFlags.ELEMENT */
        : isObject(type)
            ? 4 /* ShapeFlags.STATEFUL_COMPONENT */
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
    else if (isArray(children)) {
        // 说明该虚拟节点包含数组形式的子节点
        type = 16 /* ShapeFlags.ARRAY_CHILDREN */;
    }
    else {
        // 简化处理，表示该虚拟节点包含纯文本子节点
        type = 8 /* ShapeFlags.TEXT_CHILDREN */;
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
    if (isObject(child)) {
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
                // 第二件事：挂载模版到vnode上（container.innerHTML被清空之前，已先把模版字符串挂载到container上）
                vnode.type.template = container.template;
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
        if (hasOwn(props, key)) {
            return props[key];
        }
        else if (hasOwn(setupState, key)) {
            return setupState[key];
        }
    },
    set({ _: instance }, key, value) {
        const { props, data, setupState } = instance;
        if (hasOwn(props, key)) {
            props[key] = value;
        }
        else if (hasOwn(setupState, key)) {
            setupState[key] = value;
        }
    },
};

// h函数的作用==>生成vnode（createVNode原理可以回去前面的内容看），核心之一==>处理参数
function h(type, propsOrChildren, children) {
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
    const shapeFlag = instance.vnode.shapeFlag & 4 /* ShapeFlags.STATEFUL_COMPONENT */;
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
    if (isFunction(setupResult)) {
        instance.render = setupResult; // 处理有setup且返回函数的情况==>没必要使用组件的render方法了
    }
    else if (isObject(setupResult)) {
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
            const { code } = baseCompile(template); // Vue 内部的 baseCompile会把 template 编译为 JavaScript 代码字符串
            // 比如：<div>{{ count }}</div> 编译成 return h("div", null, count)
            // console.log("这是编译后的代码", code);
            const fn = new Function("ctx", code); // 用 new Function("ctx", code) 创建一个 动态渲染函数 比如const fn = (ctx) => h("div", null, ctx.count)
            const ctx = extend$1(// 构造了一个上下文对象ctx
            { h: h }, // h：Vue 的虚拟 DOM 创建函数
            instance.attrs, instance.props, instance.setupState);
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

// weak-vue\packages\runtime-core\src\apilifecycle.ts
// 生命周期的执行
function invokeArrayFns(fns) {
    fns.forEach((fn) => fn());
}

// 实现渲染Vue3组件==>vnode==>render
function createRender(renderOptionDom) {
    // 创建一个effect让render函数执行(响应式)
    const setupRenderEffect = (instance, container) => {
        // 创建effect(原理可以回前面的内容找)
        effect(function componentEffect() {
            // 判断是否是初次渲染
            if (!instance.isMounted) { //false表示组件是第一次渲染
                // 渲染之前的阶段
                let { bm, m } = instance;
                if (bm) {
                    invokeArrayFns(bm);
                }
                // 获取到render返回值
                const proxy = instance.proxy; // 已经代理了组件，可以访问到组件的所有属性和所有方法
                // console.log("这是组件实例proxy：");
                // console.log(proxy);
                const subTree = instance.render.call(proxy, proxy); // render函数执行，即调用render函数，第一个参数表示render函数的this指向组件实例proxy，第二个参数表示执行render函数的参数也是proxy
                // console.log("h函数生成的vnode树：", subTree);
                patch(null, subTree, container); // 渲染vnode（此时是元素的vnode）
                // 渲染完成的阶段
                if (m) {
                    invokeArrayFns(m);
                }
                instance.isMounted = true;
            }
            else { //组件已经挂载了，不是第一次渲染
                // TODO: 更新
                let { bu, u } = instance;
                if (bu) {
                    invokeArrayFns(bu);
                }
                // 对比新旧vnode--diff算法
                let proxy = instance.proxy; //拿到组件实例的代理对象 proxy，它是通过 setupComponent 创建的，绑定了组件的属性、方法等
                //拿到上一次渲染生成的虚拟 DOM（VNode），也就是“旧的 vnode 树”。之前在首次挂载的时候应该保存过一次const prevVnode = instance.subTree;
                const prevVnode = instance.subTree; // 旧vnode，记得上面首次渲染在实例上挂载
                const nextVnode = instance.render.call(proxy, proxy); // 新vnode，第一个 proxy 是 this，第二个 proxy 是参数（你实现 render 的时候需要用）。
                instance.subTree = nextVnode;
                patch(prevVnode, nextVnode, container); // 此时在patch方法中会对比新旧vnode，然后更新
                if (u) {
                    invokeArrayFns(u);
                }
            }
        });
    };
    /** ---------------处理组件--------------- */
    const processComponent = (n1, n2, container) => {
        if (n1 === null) {
            // 组件第一次加载
            mountComponent(n2, container);
        }
    };
    // 组件渲染的真正方法（实现由虚拟dom变成真实dom），步骤（核心）：
    const mountComponent = (InitialVnode, container) => {
        //InitialVnode是当前要挂载的虚拟节点
        // 1、先有一个组件的实例对象（即Vue3组件渲染函数render传入的第一个参数proxy，其实proxy参数将组件定义的所有属性合并了，等效于在setup入口函数里面返回一个函数，可以用proxy.来获取属性）
        const instanece = (InitialVnode.component = //InitialVnode.component是指当前组件虚拟节点所关联的组件实例对象
            //createComponentInstance会基于当前虚拟节点 InitialVnode 创建一个组件实例对象（包含 props、setup 返回值、render 函数等）
            createComponentInstance(InitialVnode)); // 记得在weak-vue\packages\runtime-core\src\vnode.ts文件给vnode定义中加上这个属性
        //↑vnode.component 本来是 null，你需要手动创建一个组件实例对象并挂载回 vnode.component，
        // 2、解析数据到这个实例对象中
        setupComponet(instanece);
        // 3、创建一个effect让render函数执行
        setupRenderEffect(instanece, container);
    };
    /** ---------------处理元素--------------- */
    const processElement = (n1, n2, container) => {
        if (n1 === null) {
            // 元素第一次挂载
            mountElement(n2, container);
        }
        else {
            // 更新
            console.log("同一个元素更新！！！");
            patchElement(n1, n2);
        }
    };
    // 元素的更新方法
    const patchElement = (n1, n2, container) => {
        const oldProps = n1.props || {};
        const newProps = n2.props || {};
        // 1、对比属性
        //把 n1.el 赋值给 n2.el，同时赋值给局部变量 el 以供后续使用。
        let el = (n2.el = n1.el); // 获取真实dom
        patchProps(el, oldProps, newProps);
        // 2、对比子节点--与初次挂载一样，需要将可能的字符串也要转换成vnode
        //将 n1.children（旧的子节点数组）统一转换成虚拟节点（VNode）格式 
        n1.children = n1.children.map((item) => {
            //map:对数组中的每一个元素执行一次函数处理，并生成一个新的数组，不会改变原数组。
            return CVnode(item);
        });
        n2.children = n2.children.map((item) => {
            return CVnode(item);
        });
        patchChildren(n1, n2, el);
    };
    // 对比属性有三种情况：
    // 1、新旧属性都有，但是值不一样
    // 2、旧属性有，新属性没有
    // 3、新属性有，旧属性没有
    const patchProps = (el, oldProps, newProps) => {
        if (oldProps !== newProps) {
            // 1、新旧属性都有，但是值不一样
            for (const key in newProps) {
                const prev = oldProps[key];
                const next = newProps[key];
                if (prev !== next) {
                    hostPatchProp(el, key, prev, next); // 替换属性
                }
            }
            // 2、新属性有，旧属性没有
            for (const key in oldProps) {
                if (!(key in newProps)) {
                    hostPatchProp(el, key, oldProps[key], null); // 删除属性
                }
            }
            // 3、旧属性有，新属性没有
            for (const key in newProps) {
                if (!(key in oldProps)) {
                    hostPatchProp(el, key, null, newProps[key]); // 新增属性
                }
            }
        }
    };
    // 对比子节点有四种情况：
    // 1、旧的有子节点，新的没有子节点
    // 2、旧的没有子节点，新的有子节点
    // 3、旧的有子节点，新的也有子节点，但是是文本节点（最简单的情况）
    // 4、旧的有子节点，新的也有子节点，但是可能是数组
    const patchChildren = (n1, n2, el) => {
        const c1 = n1.children;
        const c2 = n2.children;
        const prevShapeFlag = n1.shapeFlag;
        const newShapeFlag = n2.shapeFlag;
        if (newShapeFlag & 8 /* ShapeFlags.TEXT_CHILDREN */) {
            // 新的是文本节点，直接替换
            if (c2 !== c1) {
                hostSetElementText(el, c2);
            }
        }
        else {
            // 新的是数组，此时要判断旧的
            if (prevShapeFlag & 16 /* ShapeFlags.ARRAY_CHILDREN */) {
                // 旧的也是数组（较复杂）
                patchKeyChildren(c1, c2, el);
            }
            else {
                // 旧的是文本节点，将文本节点清空，然后再将新的节点进行渲染
                hostSetElementText(el, "");
                mountChildren(el, c2);
            }
        }
    };
    //i: 从前往后，第一个不同节点的索引。
    //e1: 从后往前，旧节点列表中最后一个非复用节点的索引。
    //e2: 从后往前，新节点列表中最后一个非复用节点的索引。
    const patchKeyChildren = (c1, c2, el) => {
        // 下面是vue3的diff算法，处理简单情况时也用到了双端diff：
        let i = 0;
        let e1 = c1.length - 1;
        let e2 = c2.length - 1;
        // 1、diff from start，即从头开始对比--简单情况1：旧的排列和新的排列前面节点一致，这些节点是可以复用的
        while (i <= e1 && i <= e2) {
            const n1 = c1[i];
            const n2 = c2[i];
            if (isSameVnode(n1, n2)) {
                // 递归对比子节点，先渲染出来，相当于重新走一次流程
                patch(n1, n2, el);
            }
            else {
                break;
            }
            i++;
        }
        // 2、diff from end，即从尾开始对比--简单情况2：旧的排列和新的排列后面节点一致，这些节点是可以复用的
        while (i <= e1 && i <= e2) {
            const n1 = c1[e1];
            const n2 = c2[e2];
            if (isSameVnode(n1, n2)) {
                // 递归对比子节点，先渲染出来，相当于重新走一次流程
                patch(n1, n2, el);
            }
            else {
                break;
            }
            e1--;
            e2--;
        }
        // 1、新的子节点数量多的情况--要新增，又分为两种情况：1、新增的节点在旧的节点之前，2、新增的节点在旧的节点之后
        if (i > e1) { //判断是否 旧节点全部处理完了，而新节点还有剩余的。
            const nextPos = e2 + 1; // e2+1要么表示后面部分可复用的节点的倒数最后一个，要么为null（即后面部分没有可复用的节点）
            //c2[nextPos].el 是 “新子节点列表中，位于 nextPos 位置的虚拟节点（VNode）所对应的真实 DOM 元素”。
            //.el是vnode的一个属性，表示这个虚拟节点对应的真实dom元素
            const anchor = nextPos < c2.length ? c2[nextPos].el : null; //如果 nextPos < c2.length，说明后面还有元素，我们就插入到它前面；否则说明是末尾插入，anchor 就是 null，表示插入到末尾。
            while (i <= e2) {
                console.log("要插入的节点：", c2[i].key, "，插入到：", anchor || "null", "节点之前");
                patch(null, c2[i], el, anchor); // 记得给patch函数以及里面使用的相关方法传入anchor参数
                i++;
            }
        }
        else if (i > e2) {
            // 2、旧的子节点数量多的情况--要删除
            while (i <= e1) {
                console.log("要删除的节点：", c1[i].key);
                unmount(c1[i]);
                i++;
            }
        }
        else {
            // 3、乱序，并不是简单将中间乱序节点全部删除再全部新增，而是要尽可能的复用节点
            // 解决思路：（1）以新的乱序个数创建一个映射表；（2）再用旧的乱序的数据去映射表中查找，如果有，说明是可以复用的，如果没有，说明是该旧节点需要删除的
            const s1 = i; // 旧的乱序开始位置
            const s2 = i; // 新的乱序开始位置
            // 创建表
            let keyToNewIndexMap = new Map();
            // 解决两个问题：1、复用的节点渲染位置不对；2、要新增的节点没有插入。
            const toBePatched = e2 - s2 + 1; // 新的乱序的数量
            //这个数组，每个位置代表：“新 vnode 中的一个乱序子节点”，目的是记录这个位置的 vnode 是否在旧 vnode 中找到匹配的 key
            const newIndexToOldIndexMap = new Array(toBePatched).fill(0); // 新的乱序的数量的数组，每个元素都是0
            // 用新的乱序数据去创建映射表
            for (let i = s2; i <= e2; i++) {
                const nextChild = c2[i];
                keyToNewIndexMap.set(nextChild.key, i); //「新子节点的 key -> 新索引位置」 比如'E'=>2
            }
            //console.log("映射表：", keyToNewIndexMap);
            // 新：A B C D E F G==>乱序映射表：D=>3，E=>4，F=>5。
            // 旧：A B C M F E Q G==>乱序映射表：M=>3，F=>4，E=>5，Q=>6。
            // 去旧的乱序数据中查找
            for (let i = s1; i <= e1; i++) {
                const oldChildVnode = c1[i];
                const newIndex = keyToNewIndexMap.get(oldChildVnode.key);
                if (!newIndex) {
                    // 说明旧的节点需要删除（即M和Q）
                    console.log("要删除的节点：", oldChildVnode.key);
                    unmount(oldChildVnode);
                }
                else {
                    console.log("要复用的节点：", oldChildVnode.key);
                    //我们找到了一个“可以复用的旧 vnode”，就把它在旧 children 中的位置（i）记录下来：
                    //i 是旧节点的下标，说明我们当前处理的是旧的第几个 vnode
                    newIndexToOldIndexMap[newIndex - s2] = i + 1; // 现在将复用的节点的位置改为旧的乱序的位置+1（为了区分是否被使用过）
                    patch(oldChildVnode, c2[newIndex], el);
                }
            }
            // 获取最长递增子序列的索引
            console.log("乱序节点的索引数组newIndexToOldIndexMap:", newIndexToOldIndexMap);
            //increasingNewIndexSequence不是记录完整路径，只是告诉你“哪些节点位置是对的，不需要动”。存的不是值 是索引下标
            const increasingNewIndexSequence = getSequence(newIndexToOldIndexMap);
            console.log("newIndexToOldIndexMap数组中最长递增子序列数组increasingNewIndexSequence:", increasingNewIndexSequence);
            let j = increasingNewIndexSequence.length - 1;
            // 此时根据这个位置数组去移动或者新增我们的节点(从后往前处理)
            for (let i = toBePatched - 1; i >= 0; i--) {
                const currentIndex = s2 + i; // 当前要处理的新的乱序的节点的位置
                const anchor = currentIndex + 1 < c2.length ? c2[currentIndex + 1].el : null;
                if (newIndexToOldIndexMap[i] === 0) {
                    // 说明是新增的节点
                    console.log("新增的节点：", c2[currentIndex].key, "，插入到：", anchor || "null", "节点之前");
                    patch(null, c2[currentIndex], el, anchor); // 比如从后往前遍历到D时，插入到E的前面。
                }
                else {
                    // 说明是要移动的可复用节点
                    console.log("要移动的节点：", c2[currentIndex].key, "，移动到：", anchor || "null", "节点之前");
                    // 这个插入需要一个个的插入，大量情况下会可能导致性能问题。
                    // 用最长递增子序列去优化，如果在区间内，就不用移动，如果不在区间内，就移动。
                    //increasingNewIndexSequence是	newIndexToOldIndexMap 上的 最长递增子序列的下标列表
                    if (i !== increasingNewIndexSequence[j]) {
                        hostInsert(c2[currentIndex].el, el, anchor); // 比如从后往前遍历到F时，应该移动到G的前面；从后往前遍历到E时，应该移动到F的前面。此时已渲染序列为A B C E F G
                    }
                    else {
                        j--;
                    }
                }
            }
        }
    };
    const mountElement = (vnode, container) => {
        // 递归渲染子节点==>dom操作==》挂载到container/页面上
        const { shapeFlag, props, type, children } = vnode;
        // 1、创建元素--记得把真实dom挂载到vnode上，方便后面更新时使用
        let el = (vnode.el = hostCreateElement(type)); //这是简写写法，相当于vnode.el = hostCreateElement(type); // 1. 创建真实 DOM 元素并挂载到 vnode.el 上；let el = vnode.el;                  // 2. 将 vnode.el 赋值给局部变量 el
        // 2、创建元素的属性
        if (props) {
            for (const key in props) {
                hostPatchProp(el, key, null, props[key]);
            }
        }
        //处理children
        if (children) {
            if (shapeFlag & 8 /* ShapeFlags.TEXT_CHILDREN */) {
                console.log("这是文本字符串形式子节点：", children);
                hostSetElementText(el, children); // 文本形式子节点，比如这种情况：h('div',{},'张三')，将children直接插入到el中
            }
            else if (shapeFlag & 16 /* ShapeFlags.ARRAY_CHILDREN */) {
                // 递归渲染子节点
                console.log("这是数组形式子节点：", children);
                mountChildren(el, children); // 数组形式子节点，比如这种情况：h('div',{},['张三',h('p',{},'李四')])，将children递归渲染插入到el中
            }
        }
        // 3、放入到对应的容器中
        hostInsert(el, container);
    };
    // 递归渲染子节点
    const mountChildren = (container, children) => {
        for (let i = 0; i < children.length; i++) {
            // children[i]两种情况：1、['张三']这种元素，字符串的形式；2、h('div',{},'张三')这种元素，对象的形式（vnode）
            // 但两种情况都需要转换成vnode来处理，方便借助patch函数来渲染
            const child = (children[i] = CVnode(children[i])); // 第一种情况转换成vnode，记得将children[i]重新赋值
            // 递归渲染子节点（vnode包含了元素、组件、文本三种情况）
            patch(null, child, container);
        }
    };
    /** ---------------处理文本--------------- */
    const processText = (n1, n2, container) => {
        if (n1 === null) {
            // 创建文本==>直接渲染到页面中（变成真实dom==>插入）
            //hostCreateText(n2.children):调用平台相关的 createTextNode，生成真实文本节点。
            //n2.el = ...:将创建的 DOM 文本节点挂到 vnode 上，便于后续更新。
            //hostInsert(..., container):将文本插入容器中
            hostInsert((n2.el = hostCreateText(n2.children)), container);
        }
        else {
            // 如果前后不一致，更新文本
            if (n2.children !== n1.children) {
                const el = (n2.el = n1.el); // el是上面初次创建的真实文本节点
                hostSetText(el, n2.children);
            }
        }
    };
    /**---------------------------------------------------------- */
    // 判断是否是同一个元素
    const isSameVnode = (n1, n2) => {
        return n1.type === n2.type && n1.key === n2.key;
    };
    // 卸载老的元素
    const unmount = (vnode) => {
        hostRemove(vnode.el);
    };
    // patch函数负责根据vnode的不同情况（组件、元素、文本）来实现对应的渲染
    const patch = (n1, n2, container, anchor = null) => {
        // 针对不同的类型采取不同的渲染方式（vnode有一个shapeFlag标识来标识组件/元素）
        // diff算法
        // 1、判断是不是同一个元素
        if (n1 && n2 && !isSameVnode(n1, n2)) {
            // 卸载老的元素
            unmount(n1);
            n1 = null; // n1置空，可以重新走组件挂载了，即传给processElement的n1为null，走mountElement方法
        }
        // 2、如果是同一个元素，对比props、children，此时传给processElement的n1为老的vnode，走patchElement方法
        // 针对不同的类型采取不同的渲染方式（vonode有一个shapeFlag标识来标识组件/元素）
        const { shapeFlag, type } = n2;
        switch (type) {
            case TEXT:
                // 处理文本
                processText(n1, n2, container);
                break;
            default:
                // 等效于shapeFlag && shapeFlag === ShapeFlags.ELEMENT
                //因为一个vnode可以有多个类型，比如是元素，又有子元素，不能只用===判断唯一性，要用位运算表示多个特征
                //按位与:两个数的对应位都为 1，结果才是 1，否则就是 0
                if (shapeFlag & 1 /* ShapeFlags.ELEMENT */) { //判断 shapeFlag 是否包含 ShapeFlags.ELEMENT 这个标志。它返回一个数字，若结果不为 0，则说明包含。
                    // 处理元素(h函数)
                    // console.log("此时处理的是元素！！！");
                    processElement(n1, n2, container);
                }
                else if (shapeFlag & 4 /* ShapeFlags.STATEFUL_COMPONENT */) {
                    // 处理组件
                    // console.log("此时处理的是组件！！！");
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

//nodeOps 是一组与 DOM 相关的操作方法，通常包含多个方法,patchProps 只是一个单一的函数，用于处理 DOM 属性的更新
//nodeOps 是一个对象，包含多个与 DOM 节点相关的操作方法，因此需要作为对象传递。
//patchProps 是一个函数，专门用于处理 DOM 属性更新，因此它直接作为一个函数传递。
//这里有简写，等价于{ patchProps: patchProps }
//{ patchProps }：这是一个对象，它的键是 patchProps，值是 patchProps 函数。花括号的作用是创建一个包含 patchProps 属性的对象。
//const VueRuntimeDom = extend({ patchProps }, nodeOps);
// Vue3的全部dom操作
extend({ patchProps }, nodeOps);
//rootComponent根组件，用户传入的Vue组件，rootProps根组件的props
const createApp = (rootComponent, rootProps) => {
    // 创建一个渲染的容器
    let app = createRender().createApp(rootComponent, rootProps); // createRender返回的是一个具有createApp属性方法的对象，打点执行该createApp方法后返回一个app对象，里面有一个mount属性方法
    let { mount } = app; //解构赋值，意思是从 app 对象中取出原始的 mount 方法，赋值给一个变量 mount。
    //重写mount方法,但是前面保存的变量 mount 仍然保留对原始函数的引用！
    //参数 container 是选择器或 DOM 元素，表示挂载的目标容器。
    app.mount = function (container) {
        // 挂载组件之前要清空原来的内容
        container = nodeOps.querySelector(container); //获取实际的DOM元素
        // 第一件事：将模版字符串挂载到container上（把标签前后的空格换行去除，防止对codegen环节造成影响），因为后续会清空container.innerHTML
        container.template = container.innerHTML
            .replace(/\n\s*/g, "")
            .replace(/\s+</g, "<")
            .replace(/>\s+/g, ">");
        container.innerHTML = "";
        // 渲染新的内容(挂载dom)
        mount(container);
    };
    return app;
};

export { createApp };
//# sourceMappingURL=runtime-dom.esm-bundler.js.map
