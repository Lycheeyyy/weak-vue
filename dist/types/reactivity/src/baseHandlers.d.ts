export declare const reactiveHandlers: {
    get: (target: any, key: any, receiver: any) => any;
    set: (target: any, key: any, value: any, receiver: any) => boolean;
};
export declare const shallowReactiveHandlers: {
    get: (target: any, key: any, receiver: any) => any;
    set: (target: any, key: any, value: any, receiver: any) => boolean;
};
export declare const readonlyHandlers: {
    get: (target: any, key: any, receiver: any) => any;
} & {
    set: (target: any, key: any, value: any) => void;
};
export declare const shallowReadonlyHandlers: {
    get: (target: any, key: any, receiver: any) => any;
} & {
    set: (target: any, key: any, value: any) => void;
};
