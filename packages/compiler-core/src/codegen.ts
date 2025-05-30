import { isObject } from "@vue/shared";
import { NodeTypes } from "./ast";
// codegen 代码生成
export const generate = (ast) => {
    // 获取上下文（包含生成代码所需的状态和工具函数）
    const context = createCodegenContext();
    // push用于添加代码到上下文中，indent和deindent用于增加或减少代码的缩进级别。
    const { push, indent, deindent } = context; //解构出三个函数
    //context.code是字符串缓冲区，用于收集最终形成的js渲染函数代码
  
    indent();// 增加当前代码缩进层级，使输出的代码格式化美观。

    // vue编译器的目标，是把我的模版编译成js渲染函数->  return h("div", null, ctx.count)
    // 但是但 Vue 不想手动在每个地方都加 ctx.，太麻烦、代码冗余。因此它用了 JavaScript 的 with 语句：
    // with (ctx) { ... } 表示，把 ctx 这个对象的属性当作局部变量来用。
    // 如果你写 with(ctx){console.log(count)}，虽然count没有声明，但是JS会在ctx中查找属性，等价于console.log(ctx.count);


    push("with (ctx) {"); // with语句用于确保ctx中的属性和方法可以在代码块内部直接访问，用于后面的new Function生成代码(因此此时生成的是字符串，里面的h函数、渲染的值以及函数等都需要传入)
    indent(); // 再次缩进，进入 with 语句内部
  
    push("return function render(){return ");
    if (ast.codegenNode) {
      genNode(ast.codegenNode, context); // 递归生成代码
    } else {
      push("null");
    }
  
    deindent();
    push("}}");
  
    return {
      ast,
      code: context.code,
    };
  };
  


// 获取上下文
const createCodegenContext = () => {
    const context = {
      // state
      code: "", // 目标代码   字符串，储存了最终生成的代码内容
      indentLevel: 0, // 缩进等级
  
      // method
      push(code) { // 追加代码片段
        context.code += code;
      },
      indent() { // 用于增加缩进级别，表示进入一个新的代码块。作用是调用 newline 函数，传入增加后的缩进等级。
        newline(++context.indentLevel);
      },
      deindent(witoutNewLine = false) {// witoutNewLine 为 false（默认），会调用 newline 方法，先减小缩进，再添加换行符。
        if (witoutNewLine) { // witoutNewLine 为 true，则只减小缩进，而不会添加换行符。
          --context.indentLevel;
        } else {
          newline(--context.indentLevel);
        }
      },
      newline() { // newline() 方法调用时，实际上是通过调用 newline(context.indentLevel)，将当前的 indentLevel（缩进级别）传递给局部的 newline(n) 函数。
        newline(context.indentLevel);// 这一步的目的是封装 newline(n)，方便后续使用，只需要调用 newline() 就能自动传递 indentLevel。
      },
    };
    function newline(n) {
      context.push("\n" + "  ".repeat(n));// " ".repeat(n) 会生成 n 个空格
    }
    return context;
};



// 生成代码
const genNode = (node, context) => {
    // 如果是字符串就直接 push
    if (typeof node === "string") {
      context.push(node);
      return;
    }
  
    switch (node.type) {
      case NodeTypes.ELEMENT:
        genElement(node, context);
        break;
      case NodeTypes.TEXT:
      case NodeTypes.INTERPOLATION:
        genTextData(node, context);
        break;
      case NodeTypes.COMPOUND_EXPRESSION:
        genCompoundExpression(node, context);
        break;
    }
};
  

// 生成元素节点
const genElement = (node, context) => {
    const { push, deindent } = context;
    const { tag, children, props } = node;
  
    // tag
    push(`h(${tag}, `);// 用来生成虚拟 DOM 节点的 h 函数调用。虚拟 DOM 中的元素通常通过 h(tag, props, children) 来创建。
  
    // props
    if (props) {
      genProps(props.properties, context);
    } else {
      push("null, ");// 表示没有子节点
    }
  
    // children
    if (children) {
      genChildren(children, context);
    } else {
      push("null");
    }
  
    deindent();
    push(")");
};


// genProps要做的就是获取节点中的属性数据，并拼接成一个对象的样子push进目标代码
const genProps = (props, context) => {
    const { push } = context;
  
    if (!props.length) {
      push("{}");
      return;
    }
  
    push("{ ");
    for (let i = 0; i < props.length; i++) {
      // 遍历每个 prop 对象，获取其中的 key 节点和 value 节点
      const prop = props[i];
      const key = prop ? prop.key : "";
      const value = prop ? prop.value : prop;
  
      if (key) {
        // key
        genPropKey(key, context);
        // value
        genPropValue(value, context);
      } else {
        // 如果 key 不存在就说明是一个 v-bind
        // ↑当 Vue 处理 v-bind 时，会把属性名作为一个动态的表达式来处理，而不是一个普通的字符串常量。所以，通常在编译过程中，当遇到没有静态 key 的情况时，就可以推测出这是一个 v-bind 的动态属性。
        const { content, isStatic } = value;
        const contentStr = JSON.stringify(content);
        push(`${contentStr}: ${isStatic ? contentStr : content}`);
      }
  
      if (i < props.length - 1) {
        push(", ");
      }
    }
    push(" }, ");
  };
  
  // 生成键
  const genPropKey = (node, context) => {
    const { push } = context;
    const { isStatic, content } = node;
    push(isStatic ? JSON.stringify(content) : content);
    push(": ");
  };
  
  // 生成值
  const genPropValue = (node, context) => {
    const { push } = context;
    const { isStatic, content } = node;
    push(isStatic ? JSON.stringify(content.content) : JSON.stringify(content));
};
  
  
// 生成子节点
const genChildren = (children, context) => {
    const { push, indent } = context;
  
    push("[");
    indent();
  
    // 单独处理 COMPOUND_EXPRESSION
    if (children.type === NodeTypes.COMPOUND_EXPRESSION) {
      genCompoundExpression(children, context);
    }
  
    // 单独处理 TEXT
    else if (isObject(children) && children.type === NodeTypes.TEXT) {
      genNode(children, context);
    }
  
    // 其余节点直接递归
    else {
      for (let i = 0; i < children.length; i++) {
        const child = children[i];
        genNode(child.codegenNode || child.children, context);
        push(", ");
      }
    }
  
    push("]");
};


// 生成文本节点和插值表达式节点
const genTextData = (node, context) => {
    const { push } = context;
    const { type, content } = node;
  
    // 如果是文本节点直接拿出 content
    // 如果是插值表达式需要拿出 content.content，因为插值表达式节点在vue中是一个嵌套结构
    const textContent =
      type === NodeTypes.TEXT
        ? JSON.stringify(content)
        : NodeTypes.INTERPOLATION
        ? content.content
        : "";
  
    if (type === NodeTypes.TEXT) {
      push(textContent);
    }
    if (type === NodeTypes.INTERPOLATION) {
      push("`${");
      push(`${textContent}`);
      push("}`");
    }
};
  
// 生成复合表达式
const genCompoundExpression = (node, context) => {
    const { push } = context;
    for (let i = 0; i < node.children.length; i++) {
      const child = node.children[i];
      if (typeof child === "string") {
        push(child);
      } else {
        genNode(child, context);
      }
  
      if (i !== node.children.length - 1) {
        push(", ");
      }
    }
};
  

  
