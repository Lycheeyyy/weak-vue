import { isOn, PatchFlagNames } from "@vue/shared";
import {
  createCallExpression,
  createObjectExpression,
  createObjectProperty,
  createSimpleExpression,
  createVNodeCall,
  ElementTypes,
  NodeTypes,
} from "../ast";
import { isStaticExp } from "../utils";
import { PatchFlags } from "@vue/shared";
// 负责创建 codegenNode 的函数，主要工作有处理 props、children、patchFlag然后最终返回一个codegenNode 对象
export const transformElement = (node, context) => { 
    return function postTransformElement() { //需要返回一个退出函数
      node = context.currentNode;
  
      // 只对元素节点进行处理
      if (node.type !== NodeTypes.ELEMENT) {
        return;
      }
  
      // 初始化如下变量
      const { tag, props } = node;
      const isComponent = node.tagType === ElementTypes.COMPONENT;
  
      let vnodeTag = `"${tag}"`;
      let vnodeProps;
      let vnodeChildren;
      let vnodePatchFlag;
      let patchFlag = 0;
      let vnodeDynamicProps;
      let dynamicPropNames;
      let vnodeDirectives;
  
      // TODO 处理 props
      // 获取属性解析结果
      const propsBuildResult = buildProps(node, context);
      vnodeProps = propsBuildResult.props;
      patchFlag = propsBuildResult.patchFlag;
      dynamicPropNames = propsBuildResult.dynamicPropNames;
      vnodeDirectives = propsBuildResult.directives;


      // TODO 处理 children
    if (node.children.length > 0) {
        if (node.children.length === 1) {
          const child = node.children[0];
          const type = child.type;
        
          // 分析是否存在动态文本子节点，插值表达式和复合文本节点
          const hasDynamicTextChild =
            type === NodeTypes.INTERPOLATION ||
            type === NodeTypes.COMPOUND_EXPRESSION;
        
          // 有动态文本子节点则修改 patchFlag
          if (hasDynamicTextChild) {
            patchFlag |= PatchFlags.TEXT;
          }
      
          // 获取 vnodeChildren
          // type === NodeTypes.TEXT判断一个AST节点的类型是不是纯静态文本节点
          if (hasDynamicTextChild || type === NodeTypes.TEXT) {
            vnodeChildren = child;
          } else {
            vnodeChildren = node.children;
          }
        } else {
          vnodeChildren = node.children;
        }
      }
  

      // TODO 处理 patchFlag


      if (patchFlag !== 0) {
        // patchFlag 为负数则说明不存在复合情况
        if (patchFlag < 0) {
          vnodePatchFlag = patchFlag + ` /* ${PatchFlagNames[patchFlag]} */`;
        }
      
        // patchFlag 为正数说明可能存在复合情况，特殊处理
        else {
          const flagNames =
            // 获取 PatchFlagNames 中所有的键名
            Object.keys(PatchFlagNames)
              // 全部转换为 Number 类型
              .map(Number)
              // 只保留 patchFlag 中存在的，并且值大于 0 的
              .filter((n) => n > 0 && patchFlag & n)// patchFlag & n：当前 patchFlag 包含这个标志位（按位与成立）
              // 将 patchFlag 数值转换成对应 patchFlag 名称
              .map((n) => PatchFlagNames[n])
              // 用逗号连接
              .join(", ");
      
          // 将上面的内容注释在 patchFlag 后面作为一个参考
          vnodePatchFlag = patchFlag + ` /* ${flagNames} */`;
        }
      
        // TODO 处理动态属性名
        if (dynamicPropNames && dynamicPropNames.length) {
            vnodeDynamicProps = stringifyDynamicPropNames(dynamicPropNames);
        }
      }
      
      node.codegenNode = createVNodeCall(
        node.type,
        vnodeTag,
        vnodeProps,
        vnodeChildren,
        vnodePatchFlag,
        vnodeDynamicProps,
        vnodeDirectives,
        isComponent
      );
    };
};
  


// 处理 props(这里跟源码的处理不同，源码的parse将所有属性都处理成了props，我们前面实现的parse分开处理props和directives)
// 所以可以将directives也合并到props中，这样就可以一起处理了
const buildProps = (
    node,
    context,
    props = [...node.props, ...node.directives]
  ) => {
    // 初始化一些变量
    const isComponent = node.tagType === ElementTypes.COMPONENT;
    let properties = []; // 遍历 props 生成的属性数组
    const mergeArgs = []; // 用于存储需要合并到组件属性中的参数。比如在 Vue 中，可以通过 v-bind 或者简写 : 来绑定一个对象作为组件的属性，这些对象的属性需要被合并到最终的属性对象中。
    const runtimeDirectives = []; // 用于存储运行时指令。在 Vue 中，指令（如 v-if, v-for, v-model 等）是特殊的标记，它们会在运行时对 DOM 元素进行额外的处理。这个数组将存储这些指令的相关信息。
  
    // 再初始化一些变量
    let patchFlag = 0; // 用于标记属性是否发生了变化，以及变化的类型。用于 diff算法。
    // 这两个布尔值用于标记节点是否有绑定的 class 或 style 属性。这些属性在 Vue 中是特殊的，因为它们可以绑定一个对象或者数组，而不是单个的字符串。
    let hasClassBinding = false;
    let hasStyleBinding = false;
    let hasHydrationEventBinding = false; // 用于标记是否有事件绑定需要在 hydration（Vue 3 中的服务器端渲染过程中的客户端激活）阶段处理。
    let hasDynamicKeys = false; // 用于标记是否有动态 key 属性，这对于列表渲染和虚拟 DOM 的高效更新非常重要。
    const dynamicPropNames = []; // 用于存储动态绑定的属性名。
  
    // analyzePatchFlag 在下面的属性遍历中被用于处理内置指令，来为后面的 patchFlag 分析过程提供参照标准
    const analyzePatchFlag = ({ key }) => {
        // isStatic 会判断传入节点是否是静态的简单表达式节点 (SIMPLE_EXPRESSION)
        if (isStaticExp(key)) {
          const name = key.content;
          // isOn 会判断传入属性是否是 onXxxx 事件注册
          const isEventHandler = isOn(name);
        
          if (
            !isComponent &&
            isEventHandler && //当前属性是事件处理函数 是不是事件监听器 比如@click->onClick
            //toLowerCase()大写字母转换为小写字母
            name.toLowerCase() !== "onclick" // 特别排除掉 onClick，因为在 SSR 模式下，onClick 事件行为特殊（比如内联脚本攻击风险）。
            // 源码这里还会忽略 v-model 双向绑定
            // 源码这里还会忽略 onVnodeXXX hooks
          ) {
            hasHydrationEventBinding = true;// 标记当前 VNode 在 hydration 时需要附加事件
          }
      
          // 源码在这里会忽略 cacheHandler 以及有静态值的属性
      
          // 这里根据属性的名称进行分析
          if (name === "class") {
            hasClassBinding = true;
          } else if (name === "style") {
            hasStyleBinding = true;
          } else if (name !== "key" && !dynamicPropNames.includes(name)) { //收集“动态属性名”，但排除 key 属性和已经添加过的属性名
            dynamicPropNames.push(name);
          }
      
          // 将组件上绑定的类名以及样式视为动态属性
          if (
            isComponent &&
            (name === "class" || name === "style") &&
            !dynamicPropNames.includes(name)
          ) {
            dynamicPropNames.push(name);
          }
        } else {
          // 属性名不是简单表达式 (SIMPLE_EXPRESSION) 的话
          // 则视为有动态键名
          hasDynamicKeys = true;
        }
    };

    // 将静态属性筛选出来并封装成相应的节点
    for (let i = 0; i < props.length; i++) {
        const prop = props[i];
        // 处理静态属性static attribute
        if (prop.type === NodeTypes.ATTRIBUTE) {
          const { name, value } = prop;
          let valueNode = createSimpleExpression(value || "", true);
      
          properties.push(
            createObjectProperty(createSimpleExpression(name, true), valueNode)
          );
        } else {
          // TODO 处理指令directives
          const { name, arg, exp } = prop;
          const isVBind = name === "bind";
          const isVOn = name === "on";
                  
          // 源码这里会跳过以下指令
          // v-slot
          // v-once/v-memo
          // v-is/:is
          // SSR 环境下的 v-on
                  
          // 处理无参数的 v-bind 以及 v-on（比如 v-bind="obj"此时上面绑定的内容可以动态更换，有参数的情况是 v-bind:xxx="obj"）
          if (!arg && (isVBind || isVOn)) {
          // 有动态的键
            hasDynamicKeys = true;
                  
            // 有值的话，则进行处理
            if (exp) {//  如果有表达式（例如 v-bind="obj" 中的 obj），则说明需要合并。
              if (properties.length) {// 如果前面已经积累了一些静态或普通 props（如 :id="foo"、:class="bar"），先将它们打包成一个对象表达式，加入合并参数中。然后清空 properties，准备下一个合并。
                mergeArgs.push(createObjectExpression(properties));
                properties = [];
              }

              if (isVBind) {
                // 是 v-bind
                mergeArgs.push(exp);
              } else { 
                // 是 v-on
                mergeArgs.push({
                  type: NodeTypes.JS_CALL_EXPRESSION,
                  arguments: [exp],
                });
              }
            }
            continue;
          }

          // 运行时指令处理
          // context.directiveTransforms 是 Vue 编译器内部提供的一个 “内置指令转换器表”，是一个对象，键是指令名（不带v-），值是一个转换函数（也叫directiveTransform）
          const directiveTransform = context.directiveTransforms[name];// 尝试获取这个指令名，（如 model、show）对应的内置指令处理函数。
          if (directiveTransform) {
            // 内置指令
            // props: 静态属性节点数组（用于 patch diff 和 DOM 渲染）；needRuntime: 是否仍然需要在运行时处理（如 v-model 还需要动态绑定事件）。
            const { props, needRuntime } = directiveTransform(prop, node, context);
            // 每个属性都去执行一遍 analyzePatchFlag
            props.forEach(analyzePatchFlag);
            properties.push(...props);
            if (needRuntime) {
              runtimeDirectives.push(prop);
            }
          } else {
            // 自定义指令
            runtimeDirectives.push(prop);// 如果是自定义指令（如 v-focus, v-permission），Vue 编译器不懂，只能保留原样并标记它需要运行时处理。
          }


        }
    }
      
  
    // 合并参数
    // 在这一步会根据参数不同进一步进行封装，mergeArgs 只会在处理无参数的 v-bind、v-on 时才会进行处理，因此这一步合并的其实就是 v-bind 和 v-on 。
    let propsExpression = undefined; // propsExpression 是一个表达式，它代表了组件的属性（props）的最终形式。
    // 如果有 v-bind
    if (mergeArgs.length) {
      // 如果有其他属性，那么将它们合并到 mergeArgs 中，因为最终的 propsExpression 是通过 mergeArgs 创建的。
      if (properties.length) {
        mergeArgs.push(createObjectExpression(properties));
      }

      if (mergeArgs.length > 1) {// 如果需要合并多个对象（mergeArgs.length > 1），就创建一个函数调用表达式,比如Object.assign({}, obj1, obj2, obj3)
        propsExpression = createCallExpression(mergeArgs);
      } else {
        // 只有一个 v-bind,就直接使用，不需要合并
        propsExpression = mergeArgs[0];
      }
    } else if (properties.length) { // 如果没有v-bind 等，只是普通静态属性，那就用 createObjectExpression(properties) 生成一个对象：
      propsExpression = createObjectExpression(properties);
    }


  
    // TODO 分析 patchFlag
    if (hasDynamicKeys) { // 判断是不是有动态的Key
        patchFlag |= PatchFlags.FULL_PROPS;// FULL_PROPS（全属性都需要 patch）。
      } else {
        if (hasClassBinding && !isComponent) {
          patchFlag |= PatchFlags.CLASS;
        }
        if (hasStyleBinding && !isComponent) {
          patchFlag |= PatchFlags.STYLE;
        }
        if (dynamicPropNames.length) {// 有指定属性变化
          patchFlag |= PatchFlags.PROPS;
        }
        if (hasHydrationEventBinding) {
          patchFlag |= PatchFlags.NEED_HYDRATION;
        }
    }
      
      // 这里在源码中还会考虑 ref 以及 vnodeHook
    if (
        (patchFlag === 0 || patchFlag === PatchFlags.NEED_HYDRATION) &&
        runtimeDirectives.length > 0
    ) {
        patchFlag |= PatchFlags.NEED_PATCH;//Vue 为了确保指令如 v-show, v-model 这类运行时处理的逻辑能生效，即使这个节点看起来是“静态的”，也需要 patch 一次。 
    }
      
    // TODO 规范化 props
    if (propsExpression) {// 只有存在 propsExpression 才继续处理，propsExpression 是一个 AST 节点，表示组件的属性表达式。
        switch (propsExpression.type) {
          // 说明 props 中没有 v-bind，只需要处理动态的属性绑定
          case NodeTypes.JS_OBJECT_EXPRESSION://JS对象表达式
            let classKeyIndex = -1;
            let styleKeyIndex = -1;
            let hasDynamicKey = false;
      
            // 遍历所有 props，获取类名以及样式的索引
            // 并判断是否有动态键名
            for (let i = 0; i < propsExpression.properties.length; i++) {
              const key = propsExpression.properties[i].key;
              // 是静态键名
              if (isStaticExp(key)) {
                if (key.content === "class") {
                  classKeyIndex = i;
                } else if (key.content === "style") {
                  styleKeyIndex = i;
                }
              }
              // 是动态键名
              else if (!key.isHandlerKey) {
                hasDynamicKey = true;
              }
            }
      
            const classProp = propsExpression.properties[classKeyIndex];
            const styleProp = propsExpression.properties[styleKeyIndex];
      
            // 没有动态键名
            if (!hasDynamicKey) {
              // 类名的值是动态的话则包装一下类名的值
              if (classProp && !isStaticExp(classProp.value)) {
                classProp.value = createCallExpression([classProp.value]);
              }
      
              // 样式的值是动态的则包装一下样式的值
              // styleprop表示 props 对象中是否存在 style 属性。<div :style="myStyle" />会被转换成  style: myStyle，此时styleProp 就是这个对象属性节点
              if (
                styleProp &&
                !isStaticExp(styleProp.value) &&
                (hasStyleBinding ||
                  styleProp.value.type === NodeTypes.JS_ARRAY_EXPRESSION)// 这一行，表示样式是数组形式的绑定，比如:style="[style1, style2]"，这种情况 value 是一个数组表达式（JS_ARRAY_EXPRESSION），需要在运行时进行合并解析。
              ) {
                styleProp.value = createCallExpression([styleProp.value]);
              }
            }
      
            // 有动态键名则直接包装整个 propsExpression
            else {
              propsExpression = createCallExpression([propsExpression]);
            }
            break;
      
          // 合并属性，不需要处理
          case NodeTypes.JS_CALL_EXPRESSION:
            break;
      
          // 只有 v-bind 直接包装整个 propsExpression
          default:
            propsExpression = createCallExpression([
              createCallExpression([propsExpression]),
            ]);
            break;
        }
      }
    // 返回结果
    return {
        props: propsExpression,
        directives: runtimeDirectives,
        patchFlag,
        dynamicPropNames,
    };
};
  


// 遍历所有节点并转换成数组结构的字符串返回
const stringifyDynamicPropNames = (props) => {
    let propsNamesString = "[";
    for (let i = 0, l = props.length; i < l; i++) {
      propsNamesString += JSON.stringify(props[i]);
      if (i < l - 1) propsNamesString += ",";
    }
    return propsNamesString + "]";
};
  

