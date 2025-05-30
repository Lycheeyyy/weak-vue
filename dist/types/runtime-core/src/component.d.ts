export declare const getCurrentInstance: () => any;
export declare const setCurrentInstance: (target: any) => void;
export declare const createComponentInstance: (vnode: any) => {
    vnode: any;
    type: any;
    props: {};
    attrs: {};
    setupState: {};
    ctx: {};
    proxy: {};
    render: boolean;
    isMounted: boolean;
};
export declare const setupComponet: (instance: any) => void;
export declare let currentInstance: any;
