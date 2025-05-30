export declare const createVNode: (type: any, props: any, children?: any) => {
    _v_isVNode: boolean;
    type: any;
    props: any;
    children: any;
    key: any;
    el: any;
    shapeFlag: number;
};
export declare function isVnode(vnode: any): any;
export declare const TEXT: unique symbol;
export declare function CVnode(child: any): Record<any, any> | {
    _v_isVNode: boolean;
    type: any;
    props: any;
    children: any;
    key: any;
    el: any;
    shapeFlag: number;
};
