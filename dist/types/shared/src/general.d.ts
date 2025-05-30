/**公共方法 */
export declare const isObject: (target: any) => boolean;
export declare const isArray: (arg: any) => arg is any[];
export declare const isFunction: (val: any) => boolean;
export declare const isString: (val: any) => val is string;
export declare const isNumber: (val: any) => val is number;
export declare const extend: {
    <T extends {}, U>(target: T, source: U): T & U;
    <T extends {}, U, V>(target: T, source1: U, source2: V): T & U & V;
    <T extends {}, U, V, W>(target: T, source1: U, source2: V, source3: W): T & U & V & W;
    (target: object, ...sources: any[]): any;
};
export declare const hasOwn: (val: object, key: string | symbol) => key is keyof typeof val;
export declare const isIntegerKey: (key: any) => void;
export declare const hasChange: (value: any, oldValue: any) => boolean;
export declare function makeMap(str: string, //如"div,span,p"
expectsLowerCase?: boolean): (key: string) => boolean;
