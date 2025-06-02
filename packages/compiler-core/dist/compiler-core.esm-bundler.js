import { isString, isVoidTag, isHTMLTag, isArray, PatchFlagNames, isOn, toHandlerKey, capitalize, isObject, extend } from '@vue/shared';

// 创建AST的根节点
const createRoot = (children) => {
    return {
        type: 0 /* NodeTypes.ROOT */,
        children,
    };
};
/**
 * 下面是与创建codegenNode相关的工具函数
 */
// 创建一个简单的表达式节点
const createSimpleExpression = (content, isStatic = false) => {
    return {
        type: 3 /* NodeTypes.SIMPLE_EXPRESSION */,
        content,
        isStatic,
    };
};
// 创建一个对象属性节点
const createObjectProperty = (key, value) => {
    return {
        type: 10 /* NodeTypes.JS_PROPERTY */,
        key: isString(key) ? createSimpleExpression(key, true) : key,
        value,
    };
};
// 创建一个函数调用表达式节点
const createCallExpression = (args = []) => {
    return {
        type: 11 /* NodeTypes.JS_CALL_EXPRESSION */,
        arguments: args,
    };
};
// 创建一个对象表达式节点
const createObjectExpression = (properties) => {
    return {
        type: 13 /* NodeTypes.JS_OBJECT_EXPRESSION */,
        properties,
    };
};
// 这个函数是用来生成 codegenNode 的
const createVNodeCall = (type, tag, props, children, patchFlag, dynamicProps, directives, isComponent) => {
    // 源码这里还会处理 helper，这里为了方便暂不处理
    return {
        // 源码这里是 type：NodeTypes.VNODE_CALL，这里为了方便后面处理直接赋值为原本的节点类型
        type,
        tag,
        props,
        children,
        patchFlag,
        dynamicProps,
        directives,
        isComponent,
    };
};

// 创建parse解析上下文
const createParserContext = (content) => {
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
const baseParse = (content) => {
    const context = createParserContext(content);
    // 具体的解析逻辑
    const children = parseChildren(context); //真正开始递归解析 HTML 模板，返回所有子节点的数组 children。
    return createRoot(children); //最终返回一个根节点包裹子节点，形成完整的AST结构
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
        ? 0 /* ElementTypes.ELEMENT */
        : 1 /* ElementTypes.COMPONENT */;
    return {
        type: 1 /* NodeTypes.ELEMENT */,
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
    while (context.source.length > 0 &&
        !startsWith(context.source, ">") &&
        !startsWith(context.source, "/>")) {
        // 调用前
        // class="a" v-bind:b="c">parse {{ element }}</div>
        // parseAttributes 下面再实现
        const attr = parseAttribute(context);
        // 调用后
        // v-bind:b="c">parse {{ element }}</div>
        if (attr.type === 5 /* NodeTypes.DIRECTIVE */) {
            directives.push(attr);
        }
        else {
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
    if (/^(:|@|v-[A-Za-z0-9-])/.test(name)) { //判断这个 name 是不是 Vue 的指令，比如 :xx / @xx / v-xxx
        let dirName, argContent;
        // 类似 <div :a="b" />
        if (startsWith(name, ":")) {
            dirName = "bind";
            argContent = name.slice(1); //去掉冒号，拿到属性名 比如'a'
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
            type: 5 /* NodeTypes.DIRECTIVE */,
            name: dirName,
            exp: value && {
                type: 3 /* NodeTypes.SIMPLE_EXPRESSION */,
                content: value,
                isStatic: false,
            },
            arg: argContent && {
                type: 3 /* NodeTypes.SIMPLE_EXPRESSION */,
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
    const endIndex = context.source.indexOf(quote); //.indexOf(...) 是 JavaScript 中字符串的一个 方法，用于查找某个字符或字符串在另一个字符串中第一次出现的位置（索引）。
    // 获取属性值
    const content = parseTextData(context, endIndex); //会取出 context.source.slice(0, endIndex)，也就是 "a" 里的 a。
    // 分割掉结尾引号前面的部分
    advanceBy(context, 1);
    return content; //最终返回属性值（不带引号的），如 "a" → a
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
    const content = parseTextData(context, closeIndex).trim(); //trim() 是 JavaScript 字符串的方法，用来 删除字符串两端的空白字符（不包括中间的）
    advanceBy(context, close.length);
    // 这时变成
    // </div>
    return {
        type: 6 /* NodeTypes.INTERPOLATION */,
        content: {
            type: 3 /* NodeTypes.SIMPLE_EXPRESSION */,
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
        type: 2 /* NodeTypes.TEXT */,
        content,
    };
};
/**
 * ----------------解析模板字符串用到的一些工具函数----------------
 */
// 分割字符串
const advanceBy = (context, numberOfCharacters) => {
    const { source } = context;
    context.source = source.slice(numberOfCharacters);
};
// 删除空格
const advanceSpaces = (context) => {
    const spacesReg = /^[\t\r\n\f ]+/;
    const match = spacesReg.exec(context.source); //exec()用于在一个字符串中执行匹配操作，如果匹配成功，它返回一个 数组，数组的第一个元素是匹配到的文本。如果匹配失败，返回null
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
    return !s || startsWith(s, "</"); //source是空字符串？或者source 是以 </ 开头的？（说明遇到了闭合标签）
};
// 分割文本数据
const parseTextData = (context, length) => {
    const rawText = context.source.slice(0, length); //slice(0, 9) 表示从索引 0 到 9（不包含 9）截取字符串。
    advanceBy(context, length);
    return rawText;
};

// 创建处理节点的上下文
// 当对AST做各种处理的时候，需要一个上下文来：记录当前遍历到哪一个节点、保存各种转换规则、保存根节点引用、管理状态
function createTransformContext(// 这个函数是用来“准备变换工作的环境的”
root, //根节点
//nodeTransforms：节点转换函数数组（处理 AST 中所有类型的节点）。里面放的是方法
//directiveTransforms：指令转换器对象（处理 v-if、v-model 等）。
{ nodeTransforms = [], directiveTransforms = {} }) {
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
function transform(root, options) {
    const context = createTransformContext(root, options);
    traverseNode(root, context); //遍历处理每个节点，这里的处理也就是上文提到过的转换插件transform plugins
    createRootCodegen(root); //生成根节点的codegenNode
}
// 遍历并转换节点
function traverseNode(node, context) {
    context.currentNode = node;
    // 获取转换插件序列
    const { nodeTransforms } = context;
    const exitFns = []; //初始化退出函数数组
    // 通过插件依次对当前节点进行处理
    for (let i = 0; i < nodeTransforms.length; i++) {
        // 获取退出函数并缓存
        const onExit = nodeTransforms[i](node, context);
        if (onExit) {
            if (isArray(onExit)) {
                exitFns.push(...onExit);
            }
            else {
                exitFns.push(onExit);
            }
        }
        if (!context.currentNode) { //检查当前节点是否被删除，有些 transform 可能“删除”当前节点（比如过滤注释节点），这时就不继续递归了。
            return;
        }
        else {
            node = context.currentNode;
        }
    }
    // 根据节点类型递归遍历子节点
    switch (node.type) { //如果节点是一个容器节点（如元素、根节点），递归处理它的子节点。
        case 1 /* NodeTypes.ELEMENT */:
        case 0 /* NodeTypes.ROOT */:
            traverseChildren(node, context);
            break;
    }
    context.currentNode = node; //再次设置 currentNode（以防被 transform 修改）
    // 倒序执行退出函数，从子树回到当前节点
    // 从叶子节点往根节点执行
    let i = exitFns.length;
    while (i--) {
        exitFns[i]();
    }
    //所以的退出函数会在子节点处理完成之后倒序执行，实现后序处理逻辑
}
// 遍历子节点
function traverseChildren(parent, context) {
    for (let i = 0; i < parent.children.length; i++) {
        const child = parent.children[i];
        // 如果子节点是字符串就直接跳过，因为在 AST 的语义中，字符串不是合法的子节点类型，它们只是临时的中间数据，编译器不会对它们做 transform 处理。
        if (isString(child))
            continue;
        // 函数开头中 traverseChildren(parent, context)的parent是函数内部的一个局部变量，其他函数比如后面的traverseNode是访问不到这个parent的
        context.parent = parent; // 在遍历子节点前，把当前正在遍历的“父节点”记录在上下文中，方便后续的转换逻辑（比如插值、表达式、标签等）知道自己的“父亲是谁”。
        traverseNode(child, context);
    }
}
// 生成根节点的 codegenNode
function createRootCodegen(root) {
    const { children } = root;
    if (children.length === 1) {
        const child = children[0];
        if (child.type === 1 /* NodeTypes.ELEMENT */ && child.codegenNode) { //如果 child 是元素节点，并且它自己已经有 codegenNode
            const codegenNode = child.codegenNode; // 说明这个元素节点已经转换完毕，可以直接拿来当作渲染起点：
            root.codegenNode = codegenNode;
        }
        else {
            root.codegenNode = child;
        }
    }
    // 源码中实现了多根节点的支持
    // else if (children.length > 1) {}
}

/**
 * 编译模块用到的一些工具函数
 */
// 判断传入节点是否是静态的简单表达式节
const isStaticExp = (p) => {
    return p.type === 3 /* NodeTypes.SIMPLE_EXPRESSION */ && p.isStatic;
};
// 判断传入节点是否是文本节点或插值节点
const isText = (node) => {
    return node.type === 6 /* NodeTypes.INTERPOLATION */ || node.type === 2 /* NodeTypes.TEXT */;
};

// 负责创建 codegenNode 的函数，主要工作有处理 props、children、patchFlag然后最终返回一个codegenNode 对象
const transformElement = (node, context) => {
    return function postTransformElement() {
        node = context.currentNode;
        // 只对元素节点进行处理
        if (node.type !== 1 /* NodeTypes.ELEMENT */) {
            return;
        }
        // 初始化如下变量
        const { tag, props } = node;
        const isComponent = node.tagType === 1 /* ElementTypes.COMPONENT */;
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
                const hasDynamicTextChild = type === 6 /* NodeTypes.INTERPOLATION */ ||
                    type === 8 /* NodeTypes.COMPOUND_EXPRESSION */;
                // 有动态文本子节点则修改 patchFlag
                if (hasDynamicTextChild) {
                    patchFlag |= 1 /* PatchFlags.TEXT */;
                }
                // 获取 vnodeChildren
                // type === NodeTypes.TEXT判断一个AST节点的类型是不是纯静态文本节点
                if (hasDynamicTextChild || type === 2 /* NodeTypes.TEXT */) {
                    vnodeChildren = child;
                }
                else {
                    vnodeChildren = node.children;
                }
            }
            else {
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
                    .filter((n) => n > 0 && patchFlag & n) // patchFlag & n：当前 patchFlag 包含这个标志位（按位与成立）
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
        node.codegenNode = createVNodeCall(node.type, vnodeTag, vnodeProps, vnodeChildren, vnodePatchFlag, vnodeDynamicProps, vnodeDirectives, isComponent);
    };
};
// 处理 props(这里跟源码的处理不同，源码的parse将所有属性都处理成了props，我们前面实现的parse分开处理props和directives)
// 所以可以将directives也合并到props中，这样就可以一起处理了
const buildProps = (node, context, props = [...node.props, ...node.directives]) => {
    // 初始化一些变量
    const isComponent = node.tagType === 1 /* ElementTypes.COMPONENT */;
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
            if (!isComponent &&
                isEventHandler && //当前属性是事件处理函数 是不是事件监听器 比如@click->onClick
                //toLowerCase()大写字母转换为小写字母
                name.toLowerCase() !== "onclick" // 特别排除掉 onClick，因为在 SSR 模式下，onClick 事件行为特殊（比如内联脚本攻击风险）。
            // 源码这里还会忽略 v-model 双向绑定
            // 源码这里还会忽略 onVnodeXXX hooks
            ) {
                hasHydrationEventBinding = true; // 标记当前 VNode 在 hydration 时需要附加事件
            }
            // 源码在这里会忽略 cacheHandler 以及有静态值的属性
            // 这里根据属性的名称进行分析
            if (name === "class") {
                hasClassBinding = true;
            }
            else if (name === "style") {
                hasStyleBinding = true;
            }
            else if (name !== "key" && !dynamicPropNames.includes(name)) { //收集“动态属性名”，但排除 key 属性和已经添加过的属性名
                dynamicPropNames.push(name);
            }
            // 将组件上绑定的类名以及样式视为动态属性
            if (isComponent &&
                (name === "class" || name === "style") &&
                !dynamicPropNames.includes(name)) {
                dynamicPropNames.push(name);
            }
        }
        else {
            // 属性名不是简单表达式 (SIMPLE_EXPRESSION) 的话
            // 则视为有动态键名
            hasDynamicKeys = true;
        }
    };
    // 将静态属性筛选出来并封装成相应的节点
    for (let i = 0; i < props.length; i++) {
        const prop = props[i];
        // 处理静态属性static attribute
        if (prop.type === 4 /* NodeTypes.ATTRIBUTE */) {
            const { name, value } = prop;
            let valueNode = createSimpleExpression(value || "", true);
            properties.push(createObjectProperty(createSimpleExpression(name, true), valueNode));
        }
        else {
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
                if (exp) { //  如果有表达式（例如 v-bind="obj" 中的 obj），则说明需要合并。
                    if (properties.length) { // 如果前面已经积累了一些静态或普通 props（如 :id="foo"、:class="bar"），先将它们打包成一个对象表达式，加入合并参数中。然后清空 properties，准备下一个合并。
                        mergeArgs.push(createObjectExpression(properties));
                        properties = [];
                    }
                    if (isVBind) {
                        // 是 v-bind
                        mergeArgs.push(exp);
                    }
                    else {
                        // 是 v-on
                        mergeArgs.push({
                            type: 11 /* NodeTypes.JS_CALL_EXPRESSION */,
                            arguments: [exp],
                        });
                    }
                }
                continue;
            }
            // 运行时指令处理
            // context.directiveTransforms 是 Vue 编译器内部提供的一个 “内置指令转换器表”，是一个对象，键是指令名（不带v-），值是一个转换函数（也叫directiveTransform）
            const directiveTransform = context.directiveTransforms[name]; // 尝试获取这个指令名，（如 model、show）对应的内置指令处理函数。
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
            }
            else {
                // 自定义指令
                runtimeDirectives.push(prop); // 如果是自定义指令（如 v-focus, v-permission），Vue 编译器不懂，只能保留原样并标记它需要运行时处理。
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
        if (mergeArgs.length > 1) { // 如果需要合并多个对象（mergeArgs.length > 1），就创建一个函数调用表达式,比如Object.assign({}, obj1, obj2, obj3)
            propsExpression = createCallExpression(mergeArgs);
        }
        else {
            // 只有一个 v-bind,就直接使用，不需要合并
            propsExpression = mergeArgs[0];
        }
    }
    else if (properties.length) { // 如果没有v-bind 等，只是普通静态属性，那就用 createObjectExpression(properties) 生成一个对象：
        propsExpression = createObjectExpression(properties);
    }
    // TODO 分析 patchFlag
    if (hasDynamicKeys) { // 判断是不是有动态的Key
        patchFlag |= 16 /* PatchFlags.FULL_PROPS */; // FULL_PROPS（全属性都需要 patch）。
    }
    else {
        if (hasClassBinding && !isComponent) {
            patchFlag |= 2 /* PatchFlags.CLASS */;
        }
        if (hasStyleBinding && !isComponent) {
            patchFlag |= 4 /* PatchFlags.STYLE */;
        }
        if (dynamicPropNames.length) { // 有指定属性变化
            patchFlag |= 8 /* PatchFlags.PROPS */;
        }
        if (hasHydrationEventBinding) {
            patchFlag |= PatchFlags.NEED_HYDRATION;
        }
    }
    // 这里在源码中还会考虑 ref 以及 vnodeHook
    if ((patchFlag === 0 || patchFlag === PatchFlags.NEED_HYDRATION) &&
        runtimeDirectives.length > 0) {
        patchFlag |= 512 /* PatchFlags.NEED_PATCH */; //Vue 为了确保指令如 v-show, v-model 这类运行时处理的逻辑能生效，即使这个节点看起来是“静态的”，也需要 patch 一次。 
    }
    // TODO 规范化 props
    if (propsExpression) { // 只有存在 propsExpression 才继续处理，propsExpression 是一个 AST 节点，表示组件的属性表达式。
        switch (propsExpression.type) {
            // 说明 props 中没有 v-bind，只需要处理动态的属性绑定
            case 13 /* NodeTypes.JS_OBJECT_EXPRESSION */: //JS对象表达式
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
                        }
                        else if (key.content === "style") {
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
                    if (styleProp &&
                        !isStaticExp(styleProp.value) &&
                        (hasStyleBinding ||
                            styleProp.value.type === 12 /* NodeTypes.JS_ARRAY_EXPRESSION */) // 这一行，表示样式是数组形式的绑定，比如:style="[style1, style2]"，这种情况 value 是一个数组表达式（JS_ARRAY_EXPRESSION），需要在运行时进行合并解析。
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
            case 11 /* NodeTypes.JS_CALL_EXPRESSION */:
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
        if (i < l - 1)
            propsNamesString += ",";
    }
    return propsNamesString + "]";
};

// 处理组合表达式
const transformText = (node) => {
    // 只有元素节点和根节点需要处理
    if (node.type === 0 /* NodeTypes.ROOT */ || node.type === 1 /* NodeTypes.ELEMENT */) {
        return function postTransformText() {
            console.log("调用transformText方法处理组合表达式，当前节点为", node);
            const children = node.children;
            let currentContainer = undefined;
            // 遍历查找文本/插值表达式节点
            for (let i = 0; i < children.length; i++) {
                const child = children[i];
                // 找到则将 hasText 置为 true 并查找后面的节点
                if (isText(child)) {
                    // 查找后面的节点
                    for (let j = i + 1; j < children.length; j++) {
                        const next = children[j];
                        // 找到了则进行合并
                        if (isText(next)) {
                            if (!currentContainer) {
                                currentContainer = children[i] = {
                                    type: 8 /* NodeTypes.COMPOUND_EXPRESSION */,
                                    children: [child],
                                };
                            }
                            // 合并相邻文本/插值表达式节点到 currentContainer 内，currentContainer 只是children[i]的一个引用，改变currentContainer的值，children[i]也会改变
                            currentContainer.children.push(next);
                            children.splice(j, 1);
                            j--;
                        }
                        else {
                            // 没找到就直接退出
                            currentContainer = undefined;
                            break;
                        }
                    }
                }
            }
            console.log("处理组合表达式后的结果currentContainer", currentContainer);
        };
    }
};

//v-on 需要驼峰化事件监听、处理事件监听缓存、应用拓展插件等
//简化之后的transformOn要做的事情非常简单，只需要驼峰化事件监听，然后包装成 JS_PROPERTY 类型的对象返回即可
// 处理 v-on 指令
const transformOn = (dir) => {
    const { arg } = dir;
    // 驼峰化
    let eventName;
    if (arg.type === 3 /* NodeTypes.SIMPLE_EXPRESSION */) {
        if (arg.isStatic) {
            const rawName = arg.content; //获取事件名字符串，如 "click"。
            eventName = createSimpleExpression(toHandlerKey(capitalize(rawName)), //capitalize(rawName)：把事件名首字母大写;  toHandlerKey("Click")：添加 on 前缀;  createSimpleExpression("onClick", true)：包装成一个静态表达式节点。  
            true);
        }
        // 源码在这里将动态的事件名处理成组合表达式
    }
    else {
        eventName = arg;
    }
    // 处理表达式
    let exp = dir.exp; // 获取指令绑定的表达式（handler 函数名）：例子：@click="doSomething" → exp.content === "doSomething"
    if (exp && !exp.content.trim()) { // 如果exp存在但是空字符串
        exp = undefined;
    }
    // 源码在这里会处理事件缓存
    // 源码在这里会处理外部插件 extended compiler augmentor
    // 包装并返回 JS_PROPERTY 节点
    const ret = {
        props: [
            createObjectProperty(//生成形如 { key: value } 的 AST 结构。
            eventName, exp || createSimpleExpression("() => {}", false) //exp：处理函数表达式，如 "handleClick"；如果为空就用 () => {} 兜底（避免运行时报错）
            ),
        ],
    };
    return ret;
};

// 处理 v-bind 指令
const transformBind = (dir) => {
    // dir 是指令对象，包含如 exp（表达式）和 arg（属性名）等信息。v-bind:class="myClass" 中：dir.arg.content === "class";dir.exp.content === "myClass"
    const { exp } = dir;
    const arg = dir.arg;
    // 容错处理，如果为空则输出一个空字符串
    // 因为 arg 是一个简单的表达式，并且是动态的（因为它的值可能会改变），所以 transformBind 函数会在 myClass 前后添加条件运算符||，
    // 以确保如果 myClass 的值为 undefined 或''（空字符串），它将返回一个空字符串而不是错误。（即容错处理）
    if (arg.type !== 3 /* NodeTypes.SIMPLE_EXPRESSION */) {
        arg.children.unshift("("); //动态 key 的安全处理：将表达式包装为 (foo) || ""，防止 foo 为 undefined 时报错。
        arg.children.push(') || ""');
    }
    else if (!arg.isStatic) {
        arg.content = `${arg.content} || ""`;
    }
    // 包装并返回 JS_PROPERTY 节点
    if (!exp ||
        (exp.type === 3 /* NodeTypes.SIMPLE_EXPRESSION */ && !exp.content.trim())) {
        return {
            props: [createObjectProperty(arg, createSimpleExpression("", true))], // createSimpleExpression("", true) 表示一个静态空字符串表达式。
        };
    }
    const ret = {
        props: [createObjectProperty(arg, exp)],
    };
    return ret;
    // 最终，transformBind 函数会返回一个新的对象，它包含了一个属性，这个属性的键是带有前缀的属性名（.class），值是我们的表达式（myClass）。（即包装节点）
};

// codegen 代码生成
const generate = (ast) => {
    // 获取上下文（包含生成代码所需的状态和工具函数）
    const context = createCodegenContext();
    // push用于添加代码到上下文中，indent和deindent用于增加或减少代码的缩进级别。
    const { push, indent, deindent } = context; //解构出三个函数
    //context.code是字符串缓冲区，用于收集最终形成的js渲染函数代码
    indent(); // 增加当前代码缩进层级，使输出的代码格式化美观。
    // vue编译器的目标，是把我的模版编译成js渲染函数->  return h("div", null, ctx.count)
    // 但是但 Vue 不想手动在每个地方都加 ctx.，太麻烦、代码冗余。因此它用了 JavaScript 的 with 语句：
    // with (ctx) { ... } 表示，把 ctx 这个对象的属性当作局部变量来用。
    // 如果你写 with(ctx){console.log(count)}，虽然count没有声明，但是JS会在ctx中查找属性，等价于console.log(ctx.count);
    push("with (ctx) {"); // with语句用于确保ctx中的属性和方法可以在代码块内部直接访问，用于后面的new Function生成代码(因此此时生成的是字符串，里面的h函数、渲染的值以及函数等都需要传入)
    indent(); // 再次缩进，进入 with 语句内部
    push("return function render(){return ");
    if (ast.codegenNode) {
        genNode(ast.codegenNode, context); // 递归生成代码
    }
    else {
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
        push(code) {
            context.code += code;
        },
        indent() {
            newline(++context.indentLevel);
        },
        deindent(witoutNewLine = false) {
            if (witoutNewLine) { // witoutNewLine 为 true，则只减小缩进，而不会添加换行符。
                --context.indentLevel;
            }
            else {
                newline(--context.indentLevel);
            }
        },
        newline() {
            newline(context.indentLevel); // 这一步的目的是封装 newline(n)，方便后续使用，只需要调用 newline() 就能自动传递 indentLevel。
        },
    };
    function newline(n) {
        context.push("\n" + "  ".repeat(n)); // " ".repeat(n) 会生成 n 个空格
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
        case 1 /* NodeTypes.ELEMENT */:
            genElement(node, context);
            break;
        case 2 /* NodeTypes.TEXT */:
        case 6 /* NodeTypes.INTERPOLATION */:
            genTextData(node, context);
            break;
        case 8 /* NodeTypes.COMPOUND_EXPRESSION */:
            genCompoundExpression(node, context);
            break;
    }
};
// 生成元素节点
const genElement = (node, context) => {
    const { push, deindent } = context;
    const { tag, children, props } = node;
    // tag
    push(`h(${tag}, `); // 用来生成虚拟 DOM 节点的 h 函数调用。虚拟 DOM 中的元素通常通过 h(tag, props, children) 来创建。
    // props
    if (props) {
        genProps(props.properties, context);
    }
    else {
        push("null, "); // 表示没有子节点
    }
    // children
    if (children) {
        genChildren(children, context);
    }
    else {
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
        }
        else {
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
    if (children.type === 8 /* NodeTypes.COMPOUND_EXPRESSION */) {
        genCompoundExpression(children, context);
    }
    // 单独处理 TEXT
    else if (isObject(children) && children.type === 2 /* NodeTypes.TEXT */) {
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
    const textContent = type === 2 /* NodeTypes.TEXT */
        ? JSON.stringify(content)
        : content.content
            ;
    if (type === 2 /* NodeTypes.TEXT */) {
        push(textContent);
    }
    if (type === 6 /* NodeTypes.INTERPOLATION */) {
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
        }
        else {
            genNode(child, context);
        }
        if (i !== node.children.length - 1) {
            push(", ");
        }
    }
};

const getBaseTransformPreset = () => {
    // 插件预设
    return [
        [transformElement, transformText],
        {
            on: transformOn,
            bind: transformBind,
        },
    ];
};
// 完整编译过程：template -> ast -> codegen -> render
const baseCompile = (template, options = {}) => {
    // 第一步：将模板字符串转换成AST
    const ast = isString(template) ? baseParse(template) : template;
    // 第二步：AST加工
    const [nodeTransforms, directiveTransforms] = getBaseTransformPreset();
    transform(ast, extend({}, options, {
        nodeTransforms: [...nodeTransforms, ...(options.nodeTransforms || [])],
        directiveTransforms: extend({}, directiveTransforms, options.directiveTransforms || {} // user transforms
        ),
    }));
    // 第三步：将AST转换成渲染函数，最终得到一个render渲染函数
    return generate(ast);
};

export { baseCompile };
//# sourceMappingURL=compiler-core.esm-bundler.js.map
