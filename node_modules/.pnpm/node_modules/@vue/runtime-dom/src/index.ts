import { extend } from "../../shared/src";
// runtime-dom是用于操作dom（节点、属性）的模块
// 创建两个文件，分别用于处理节点nodeOps.ts与属性patchProp.ts
import { nodeOps } from "./nodeOps";
import { patchProps } from "./patchProp";
import { createRender } from "../../runtime-core/src";

//nodeOps 是一组与 DOM 相关的操作方法，通常包含多个方法,patchProps 只是一个单一的函数，用于处理 DOM 属性的更新

//nodeOps 是一个对象，包含多个与 DOM 节点相关的操作方法，因此需要作为对象传递。
//patchProps 是一个函数，专门用于处理 DOM 属性更新，因此它直接作为一个函数传递。

//这里有简写，等价于{ patchProps: patchProps }
//{ patchProps }：这是一个对象，它的键是 patchProps，值是 patchProps 函数。花括号的作用是创建一个包含 patchProps 属性的对象。
//const VueRuntimeDom = extend({ patchProps }, nodeOps);

// Vue3的全部dom操作
const renderOptionDom = extend({ patchProps }, nodeOps);

//rootComponent根组件，用户传入的Vue组件，rootProps根组件的props
export const createApp = (rootComponent, rootProps) => {
  // 创建一个渲染的容器
  let app = createRender(renderOptionDom).createApp(rootComponent, rootProps); // createRender返回的是一个具有createApp属性方法的对象，打点执行该createApp方法后返回一个app对象，里面有一个mount属性方法
  let { mount } = app;//解构赋值，意思是从 app 对象中取出原始的 mount 方法，赋值给一个变量 mount。
  //重写mount方法,但是前面保存的变量 mount 仍然保留对原始函数的引用！
  //参数 container 是选择器或 DOM 元素，表示挂载的目标容器。
  app.mount = function (container) {
    // 挂载组件之前要清空原来的内容
    container = nodeOps.querySelector(container);//获取实际的DOM元素
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
}

export * from "@vue/runtime-core";

