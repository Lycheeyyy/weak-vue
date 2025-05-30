export declare function computed(getterOptions: any): ComputedRefImpl;
declare class ComputedRefImpl {
    setter: any;
    _dirty: boolean;
    _value: any;
    effect: any;
    constructor(getter: any, setter: any);
    get value(): any;
    set value(newValue: any);
}
export {};
