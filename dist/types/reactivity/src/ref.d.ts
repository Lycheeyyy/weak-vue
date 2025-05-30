export declare function ref(target: any): RefImpl;
export declare function shallowRef(target: any): RefImpl;
declare class RefImpl {
    rawValue: any;
    shallow: any;
    __v_isRef: boolean;
    _value: any;
    constructor(rawValue: any, shallow: any);
    get value(): any;
    set value(newValue: any);
}
declare class ObjectRefImlp {
    target: any;
    key: any;
    __v_isRef: boolean;
    constructor(target: any, key: any);
    get value(): any;
    set value(newValue: any);
}
export declare function toRef(target: any, key: any): ObjectRefImlp;
export declare function toRefs(target: any): {};
export {};
