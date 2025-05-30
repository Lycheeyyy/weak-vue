export declare function Track(target: any, type: any, key: any): void;
export declare function effect(fn: any, options?: any): {
    (): void;
    id: number;
    _isEffect: boolean;
    raw: any;
    options: any;
};
export declare function trigger(target: any, type: any, key?: any, newValue?: any, oldValue?: any): void;
