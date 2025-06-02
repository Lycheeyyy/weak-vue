import { NodeTypes } from "./ast";
export declare const createParserContext: (content: any) => {
    source: any;
};
export declare const baseParse: (content: any) => {
    type: NodeTypes;
    children: any;
};
