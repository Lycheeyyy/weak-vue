import { NodeTypes } from "./ast";
import { isArray, isString } from "@vue/shared";

// 创建处理节点的上下文
// 当对AST做各种处理的时候，需要一个上下文来：记录当前遍历到哪一个节点、保存各种转换规则、保存根节点引用、管理状态
export function createTransformContext( // 这个函数是用来“准备变换工作的环境的”
    root,//根节点
    //nodeTransforms：节点转换函数数组（处理 AST 中所有类型的节点）。里面放的是方法
    //directiveTransforms：指令转换器对象（处理 v-if、v-model 等）。
    { nodeTransforms = [], directiveTransforms = {} } 
  ) {
    const context = {
      // plugin
      nodeTransforms,
      directiveTransforms,
  
      // state
      root,
      parent: null,
      currentNode: root,
    };
    return context;
  }
  

// 转换节点
export function transform(root, options) {
    const context = createTransformContext(root, options);
    traverseNode(root, context);//遍历处理每个节点，这里的处理也就是上文提到过的转换插件transform plugins
    createRootCodegen(root);//生成根节点的codegenNode
}

// 遍历并转换节点
export function traverseNode(node, context) {
    context.currentNode = node;
    // 获取转换插件序列
    const { nodeTransforms } = context;
    const exitFns = [];//初始化退出函数数组
    // 通过插件依次对当前节点进行处理
    for (let i = 0; i < nodeTransforms.length; i++) {
      // 获取退出函数并缓存
      const onExit = nodeTransforms[i](node, context);
      if (onExit) {
        if (isArray(onExit)) {
          exitFns.push(...onExit);
        } else {
          exitFns.push(onExit);
        }
      }
      if (!context.currentNode) {//检查当前节点是否被删除，有些 transform 可能“删除”当前节点（比如过滤注释节点），这时就不继续递归了。
        return;
      } else {
        node = context.currentNode;
      }
    }
    // 根据节点类型递归遍历子节点
    switch (node.type) { //如果节点是一个容器节点（如元素、根节点），递归处理它的子节点。
      case NodeTypes.ELEMENT:
      case NodeTypes.ROOT:
        traverseChildren(node, context);
        break;
  
      case NodeTypes.INTERPOLATION:
      case NodeTypes.TEXT:
        // TODO：处理插值节点和文本节点
        break;
    }
  
    context.currentNode = node;//再次设置 currentNode（以防被 transform 修改）
  
    // 倒序执行退出函数，从子树回到当前节点
    // 从叶子节点往根节点执行
    let i = exitFns.length;
    while (i--) {
      exitFns[i]();
    }
    //所以的退出函数会在子节点处理完成之后倒序执行，实现后序处理逻辑
  }
  
  
// 遍历子节点
export function traverseChildren(parent, context) {
    for (let i = 0; i < parent.children.length; i++) {
      const child = parent.children[i];
    // 如果子节点是字符串就直接跳过，因为在 AST 的语义中，字符串不是合法的子节点类型，它们只是临时的中间数据，编译器不会对它们做 transform 处理。
      if (isString(child)) continue;
      // 函数开头中 traverseChildren(parent, context)的parent是函数内部的一个局部变量，其他函数比如后面的traverseNode是访问不到这个parent的
      context.parent = parent; // 在遍历子节点前，把当前正在遍历的“父节点”记录在上下文中，方便后续的转换逻辑（比如插值、表达式、标签等）知道自己的“父亲是谁”。
      traverseNode(child, context);
    }
}
  

// 生成根节点的 codegenNode
export function createRootCodegen(root) {
    const { children } = root;
    if (children.length === 1) {
      const child = children[0];
      if (child.type === NodeTypes.ELEMENT && child.codegenNode) { //如果 child 是元素节点，并且它自己已经有 codegenNode
        const codegenNode = child.codegenNode;// 说明这个元素节点已经转换完毕，可以直接拿来当作渲染起点：
  
        root.codegenNode = codegenNode;
      } else {
        root.codegenNode = child;
      }
    }
  
    // 源码中实现了多根节点的支持
    // else if (children.length > 1) {}
  }
  