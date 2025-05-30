import { capitalize, toHandlerKey } from "@vue/shared";
import {
  createObjectProperty,
  createSimpleExpression,
  NodeTypes,
} from "../ast";
//v-on 需要驼峰化事件监听、处理事件监听缓存、应用拓展插件等
//简化之后的transformOn要做的事情非常简单，只需要驼峰化事件监听，然后包装成 JS_PROPERTY 类型的对象返回即可

// 处理 v-on 指令
export const transformOn = (dir) => { // dir是一个描述v-on指令的节点对象
    const { arg } = dir;
  
    // 驼峰化
    let eventName;
    if (arg.type === NodeTypes.SIMPLE_EXPRESSION) {
      if (arg.isStatic) {
        const rawName = arg.content; //获取事件名字符串，如 "click"。
        eventName = createSimpleExpression(
          toHandlerKey(capitalize(rawName)),//capitalize(rawName)：把事件名首字母大写;  toHandlerKey("Click")：添加 on 前缀;  createSimpleExpression("onClick", true)：包装成一个静态表达式节点。  
          true
        );
      }
      // 源码在这里将动态的事件名处理成组合表达式
    } else {
      eventName = arg;
    }
  
    // 处理表达式
    let exp = dir.exp;// 获取指令绑定的表达式（handler 函数名）：例子：@click="doSomething" → exp.content === "doSomething"
    if (exp && !exp.content.trim()) { // 如果exp存在但是空字符串
      exp = undefined;
    }
    // 源码在这里会处理事件缓存
    // 源码在这里会处理外部插件 extended compiler augmentor
  
    // 包装并返回 JS_PROPERTY 节点
    const ret = {
      props: [
        createObjectProperty( //生成形如 { key: value } 的 AST 结构。
          eventName,
          exp || createSimpleExpression("() => {}", false) //exp：处理函数表达式，如 "handleClick"；如果为空就用 () => {} 兜底（避免运行时报错）
        ),
      ],
    };
    return ret;
};
  
