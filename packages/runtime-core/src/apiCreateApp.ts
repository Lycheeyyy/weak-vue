import { createVNode } from "./vnode";

// apiCreateApp是起到将组件变成虚拟dom的作用（返回一个对象，对象具有mount挂载方法，该挂载方法做了两件事：1、生成vnode；2、render渲染vnode）
export function apiCreateApp(render) {
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



