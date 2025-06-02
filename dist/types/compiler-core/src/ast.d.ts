export declare const enum NodeTypes {
    ROOT = 0,// 表示根节点
    ELEMENT = 1,// 表示元素节点，可能是div、span等原生标签，也可能是自定义组件
    TEXT = 2,// 表示文本节点
    SIMPLE_EXPRESSION = 3,// 表示简单表达式节点
    ATTRIBUTE = 4,// 表示属性节点
    DIRECTIVE = 5,// 表示指令节点
    INTERPOLATION = 6,// 表示插值节点
    TEXT_CALL = 7,// 表示文本节点中的插值节点，比如parse {{ element }}</div>中的{{ element }}
    COMPOUND_EXPRESSION = 8,// 表示复合表达式节点，比如{{ a + b }}中的a + b
    VNODE_CALL = 9,// 表示创建VNode节点的代码
    JS_PROPERTY = 10,// 表示JS对象的属性
    JS_CALL_EXPRESSION = 11,// 表示JS的调用表达式
    JS_ARRAY_EXPRESSION = 12,// 表示JS的数组表达式
    JS_OBJECT_EXPRESSION = 13
}
export declare const enum ElementTypes {
    ELEMENT = 0,
    COMPONENT = 1
}
export declare const createRoot: (children: any) => {
    type: NodeTypes;
    children: any;
};
/**
 * 下面是与创建codegenNode相关的工具函数
 */
export declare const createSimpleExpression: (content: any, isStatic?: boolean) => {
    type: NodeTypes;
    content: any;
    isStatic: boolean;
};
export declare const createObjectProperty: (key: any, value: any) => {
    type: NodeTypes;
    key: any;
    value: any;
};
export declare const createCallExpression: (args?: any[]) => {
    type: NodeTypes;
    arguments: any[];
};
export declare const createObjectExpression: (properties: any) => {
    type: NodeTypes;
    properties: any;
};
export declare const createVNodeCall: (type: any, tag: any, props: any, children: any, patchFlag: any, dynamicProps: any, directives: any, isComponent: any) => {
    type: any;
    tag: any;
    props: any;
    children: any;
    patchFlag: any;
    dynamicProps: any;
    directives: any;
    isComponent: any;
};
