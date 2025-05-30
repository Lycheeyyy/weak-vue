import {
    createObjectProperty,
    createSimpleExpression,
    NodeTypes,
  } from "../ast";
// 处理 v-bind 指令
export const transformBind = (dir) => {
    // dir 是指令对象，包含如 exp（表达式）和 arg（属性名）等信息。v-bind:class="myClass" 中：dir.arg.content === "class";dir.exp.content === "myClass"
    const { exp } = dir;
    const arg = dir.arg;
  
    // 容错处理，如果为空则输出一个空字符串
    // 因为 arg 是一个简单的表达式，并且是动态的（因为它的值可能会改变），所以 transformBind 函数会在 myClass 前后添加条件运算符||，
    // 以确保如果 myClass 的值为 undefined 或''（空字符串），它将返回一个空字符串而不是错误。（即容错处理）

    if (arg.type !== NodeTypes.SIMPLE_EXPRESSION) {
      arg.children.unshift("(");//动态 key 的安全处理：将表达式包装为 (foo) || ""，防止 foo 为 undefined 时报错。
      arg.children.push(') || ""');
    } else if (!arg.isStatic) {
      arg.content = `${arg.content} || ""`;
    }
  
    // 包装并返回 JS_PROPERTY 节点
    if (
      !exp ||
      (exp.type === NodeTypes.SIMPLE_EXPRESSION && !exp.content.trim())
    ) {
      return {
        props: [createObjectProperty(arg, createSimpleExpression("", true))],// createSimpleExpression("", true) 表示一个静态空字符串表达式。
      };
    }
  
    const ret = {
      props: [createObjectProperty(arg, exp)],
    };
  
    return ret;
    // 最终，transformBind 函数会返回一个新的对象，它包含了一个属性，这个属性的键是带有前缀的属性名（.class），值是我们的表达式（myClass）。（即包装节点）

  };
