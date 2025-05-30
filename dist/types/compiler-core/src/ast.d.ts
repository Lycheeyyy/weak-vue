export declare const NodeTypes: {
    ROOT: string;
    ELEMENT: string;
    TEXT: string;
    SIMPLE_EXPRESSION: string;
    ATTRIBUTE: string;
    DIRECTIVE: string;
    INTERPOLATION: string;
};
export declare const enum ElementTypes {
    ELEMENT = 0,
    COMPONENT = 1
}
export declare const createRoot: (children: any) => {
    type: string;
    children: any;
};
