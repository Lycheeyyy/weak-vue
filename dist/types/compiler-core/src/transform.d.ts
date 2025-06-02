export declare function createTransformContext(// 这个函数是用来“准备变换工作的环境的”
root: any, //根节点
{ nodeTransforms, directiveTransforms }: {
    nodeTransforms?: any[];
    directiveTransforms?: {};
}): {
    nodeTransforms: any[];
    directiveTransforms: {};
    root: any;
    parent: any;
    currentNode: any;
};
export declare function transform(root: any, options: any): void;
export declare function traverseNode(node: any, context: any): void;
export declare function traverseChildren(parent: any, context: any): void;
export declare function createRootCodegen(root: any): void;
