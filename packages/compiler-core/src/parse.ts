import { isHTMLTag, isVoidTag } from "@vue/shared";
import { createRoot, ElementTypes, NodeTypes } from "./ast";

// 创建parse解析上下文
export const createParserContext = (content) => { 
  return {
    source: content, // 模板字符串
    // 源码中还有很多
    // 比如
    // options,
    // column: 1,
    // line: 1,
    // offset: 0,
    // 但这里只用到了 source
  };
};

// 生成完整的AST
export const baseParse = (content) => { //const content = "<div><p>Hello</p></div>";
  const context = createParserContext(content);
  // 具体的解析逻辑
  const children = parseChildren(context); //真正开始递归解析 HTML 模板，返回所有子节点的数组 children。
  return createRoot(children);//最终返回一个根节点包裹子节点，形成完整的AST结构
};

// 解析模板字符串
const parseChildren = (context) => {
    // 具体的解析逻辑，需要调用多个工具函数根据实际情况解析
    // 模版是一个长长的存在嵌套的字符串，我们需要递归的解析
    const nodes = [];
    while (!isEnd(context)) {
      const s = context.source;
  
      let node;
  
      // 此处做了简化
      // 源码这里有一大串的 if else if else
      // 但是很多都是处理比如
      // '<!--' '<!DOCTYPE' '<![CDATA['
      // 还有很多容错处理
  
      // 以 < 开头则是元素
      if (s[0] === "<") {
        node = parseElement(context);
      }
      // 以 {{ 开头则是插值表达式
      else if (startsWith(s, "{{")) {
        node = parseInterpolation(context);
      }
      // 否则就是文本节点
      else {
        node = parseText(context);
      }
  
      // 源码中写了个 pushNode 方法来控制，这里直接写出来了
      nodes.push(node);
    }
  
    return nodes;
  };
  

// 解析元素节点
const parseElement = (context) => {
    // 返回一个对象结构表示解析出来的元素节点
    const element = parseTag(context);
  
    // 如果是自闭合标签就不用解析子节点和闭合标签了
    // 但是 <br /> 合法，<br> 也是合法的
    // 因此用 isVoidTag 判断一下
    if (element.isSelfClosing || isVoidTag(element.tag)) {
      return element;
    }
  
    element.children = parseChildren(context);
  
    // 里面要负责一个功能：只是要分割掉闭合标签 </div>，因此不用接收
    parseTag(context);
  
    return element;
  };

// 解析标签内容
// 进来时长这样
// <div class="a" v-bind:b="c">parse {{ element }}</div>
const parseTag = (context) => {
    //其中 /?	表示匹配 0 个或 1 个 /，用于区分起始标签和结束标签（如 <div> vs </div>）
    //</?：匹配斜杠和标签名前面的可选斜杠（表示闭合标签）
    //[a-z]	标签名第一个字符必须是英文字母      [^\t\r\n\f />]*	后面可以跟任意多个不是 空白字符、/ 或 > 的字符（即标签名的其它部分）
    //i表示忽略大小写
    const tagReg = /^<\/?([a-z][^\t\r\n\f />]*)/i;

    // tagReg.exec() 方法会返回一个数组作为匹配结果，其中第一个元素是整个匹配到的字符串，而后面的元素则是每个捕获组（如果有的话）匹配到的内容。
    // 这时的 match 是 ['<div', 'div']
    //match[0] 是 <div，而 match[1] 是 div——————>match[0] 总是完整匹配的那一段,match[1] 是括号 () 内捕获的那一段，也就是你想要的标签名。
    const match = tagReg.exec(context.source);
    const tag = match[1];

    advanceBy(context, match[0].length);
    advanceSpaces(context);

    // 此时 context.source
    // class="a" v-bind:b="c">parse {{ element }}</div>

    // parseAttributes 下面再实现
    const { props, directives } = parseAttributes(context);

    // 此时 context.source 会变成
    // >parse {{ element }}</div>

    const isSelfClosing = startsWith(context.source, "/>");

    // 分割掉 "/>" 或 ">"
    advanceBy(context, isSelfClosing ? 2 : 1);

    // 判断是组件还是原生元素
    const tagType = isHTMLTag(tag)
      ? ElementTypes.ELEMENT
      : ElementTypes.COMPONENT;
  
    return {
      type: NodeTypes.ELEMENT,
      tag,
      tagType,
      props,
      directives,
      isSelfClosing,
      children: [],
    };
};

// 解析所有属性
// 进来时长这样
// class="a" v-bind:b="c">parse {{ element }}</div>
const parseAttributes = (context) => {
    const props = [];
    const directives = [];
  
    // 循环解析
    // 遇到 ">" 或者 "/>" 或者 context.source 为空字符串了才停止解析
    while (
      context.source.length > 0 &&
      !startsWith(context.source, ">") &&
      !startsWith(context.source, "/>")
    ) {
      // 调用前
      // class="a" v-bind:b="c">parse {{ element }}</div>
      // parseAttributes 下面再实现
      const attr = parseAttribute(context);
      // 调用后
      // v-bind:b="c">parse {{ element }}</div>
  
      if (attr.type === NodeTypes.DIRECTIVE) {
        directives.push(attr);
      } else {
        props.push(attr);
      }
    }
  
    return { props, directives };
};

// 解析单个属性
// 进来时长这样
// class="a" v-bind:b="c">parse {{ element }}</div>
const parseAttribute = (context) => {
    // 匹配属性名的正则
    //^（在方括号里）表示“不匹配以下字符”。
    const namesReg = /^[^\t\r\n\f />][^\t\r\n\f />=]*/;
  
    // match 这时是 ["class"]
    const match = namesReg.exec(context.source);
    const name = match[0];
  
    // 分割掉属性名和前面的空格
    advanceBy(context, name.length);
    advanceSpaces(context);
    // context.source 这时是
    // ="a" v-bind:b="c">parse {{ element }}</div>
  
    let value;
    if (startsWith(context.source, "=")) {
      // 分割掉 "="
      advanceBy(context, 1);
      advanceSpaces(context);
  
      // parseAttributeValue 负责解析属性值，后面再实现
      // 调用前
      // "a" v-bind:b="c">parse {{ element }}</div>
      value = parseAttributeValue(context);
      advanceSpaces(context);
      // 调用后
      // v-bind:b="c">parse {{ element }}</div>
    }
  
    // 上面获取了属性名 name 和属性值 value
    // TODO--解析指令
    if (/^(:|@|v-[A-Za-z0-9-])/.test(name)) {//判断这个 name 是不是 Vue 的指令，比如 :xx / @xx / v-xxx
      let dirName, argContent;
  
    // 类似 <div :a="b" />
    if (startsWith(name, ":")) {
      dirName = "bind";
      argContent = name.slice(1);//去掉冒号，拿到属性名 比如'a'
    }
  
    // 类似 <div @click="a" />
    else if (startsWith(name, "@")) {
      dirName = "on";
      argContent = name.slice(1);
    }
  
    // 类似 <div v-bind:a="b" />
    else if (startsWith(name, "v-")) {
      [dirName, argContent] = name.slice(2).split(":");
    }
  
    // 返回指令节点
    return {
      type: NodeTypes.DIRECTIVE,
      name: dirName,
      exp: value && {
        type: NodeTypes.SIMPLE_EXPRESSION,
        content: value,
        isStatic: false,
      },
      arg: argContent && {
        type: NodeTypes.SIMPLE_EXPRESSION,
        content: argContent,
        isStatic: true,
      },
    };
  }

};

  // 获取属性值
// 进来时是这样的
// "a" v-bind:b="c">parse {{ element }}</div>
const parseAttributeValue = (context) => {
    // 获取引号的第一部分
    const quote = context.source[0];
  
    // 分割掉引号的第一部分
    // a" v-bind:b="c">parse {{ element }}</div>
    advanceBy(context, 1);
  
    // 找到匹配的结尾引号
    const endIndex = context.source.indexOf(quote);//.indexOf(...) 是 JavaScript 中字符串的一个 方法，用于查找某个字符或字符串在另一个字符串中第一次出现的位置（索引）。
  
    // 获取属性值
    const content = parseTextData(context, endIndex);//会取出 context.source.slice(0, endIndex)，也就是 "a" 里的 a。
  
    // 分割掉结尾引号前面的部分
    advanceBy(context, 1);
  
    return content;//最终返回属性值（不带引号的），如 "a" → a
  };
  
  
                                                                       
  /**
 * ----------------解析文本节点parseInterpolation----------------
 */
// 解析插值表达式
// 进来时是这样的
// {{ element }}</div>
const parseInterpolation = (context) => {
    const [open, close] = ["{{", "}}"];
  
    advanceBy(context, open.length);
    // 这时变成
    //  element }}</div>
  
    // 找 "}}" 的索引
    const closeIndex = context.source.indexOf(close, open.length);
  
    const content = parseTextData(context, closeIndex).trim();//trim() 是 JavaScript 字符串的方法，用来 删除字符串两端的空白字符（不包括中间的）
    advanceBy(context, close.length);
    // 这时变成
    // </div>
  
    return {
      type: NodeTypes.INTERPOLATION,
      content: {
        type: NodeTypes.SIMPLE_EXPRESSION,
        isStatic: false,
        content,
      },
    };
  };
  

/**
 * ----------------解析文本节点parseText----------------
 */
// 解析文本节点
// 进来时是这样的
// parse {{ element }}</div>
const parseText = (context) => {
    // 两个结束标识
    const endTokens = ["<", "{{"];
    let endIndex = context.source.length;
  
    for (let i = 0; i < endTokens.length; i++) {
      // 找结束标识
      const index = context.source.indexOf(endTokens[i]);
  
      // 找最靠前的一个结束标识
      if (index !== -1 && index < endIndex) {
        endIndex = index;
      }
    }
  
    // 把结束标识前的所有内容分割出来
    const content = parseTextData(context, endIndex);
  
    return {
      type: NodeTypes.TEXT,
      content,
    };
  };
  


/**
 * ----------------解析模板字符串用到的一些工具函数----------------
 */
// 分割字符串
const advanceBy = (context, numberOfCharacters) => { //把已经解析完的字符串从source中切掉
  const { source } = context;
  context.source = source.slice(numberOfCharacters);
};
// 删除空格
const advanceSpaces = (context) => {
  const spacesReg = /^[\t\r\n\f ]+/;
  const match = spacesReg.exec(context.source);//exec()用于在一个字符串中执行匹配操作，如果匹配成功，它返回一个 数组，数组的第一个元素是匹配到的文本。如果匹配失败，返回null
  if (match) {
    advanceBy(context, match[0].length);
  }
};
// 判断字符串是否以 xxx 开头
const startsWith = (source, searchString) => {
  return source.startsWith(searchString);
};
// 判断字符串是否解析结束（为空或者是否以 </ 开头）
const isEnd = (context) => {
  const s = context.source;
  return !s || startsWith(s, "</");//source是空字符串？或者source 是以 </ 开头的？（说明遇到了闭合标签）
};
// 分割文本数据
const parseTextData = (context, length) => {
  const rawText = context.source.slice(0, length);//slice(0, 9) 表示从索引 0 到 9（不包含 9）截取字符串。
  advanceBy(context, length);
  return rawText;
};
  

