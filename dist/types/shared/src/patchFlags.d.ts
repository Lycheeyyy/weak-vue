export declare const enum PatchFlags {
    TEXT = 1,// 1 动态的文本节点
    CLASS = 2,// 2 动态的 class
    STYLE = 4,// 4 动态的 style
    PROPS = 8,// 8 动态属性，不包括类名和样式
    FULL_PROPS = 16,// 16 动态 key，当 key 变化时需要完整的 diff 算法做比较
    NEED_HYDRATION = 32,// 32 表示带有事件监听器的节点
    STABLE_FRAGMENT = 64,// 64 一个不会改变子节点顺序的 Fragment
    KEYED_FRAGMENT = 128,// 128 带有 key 属性的 Fragment
    UNKEYED_FRAGMENT = 256,// 256 子节点没有 key 的 Fragment
    NEED_PATCH = 512,// 512  表示只需要non-props修补的元素 (non-props不知道怎么翻才恰当~)
    DYNAMIC_SLOTS = 1024,// 1024 动态的solt
    DEV_ROOT_FRAGMENT = 2048,//2048 表示仅因为用户在模板的根级别放置注释而创建的片段。 这是一个仅用于开发的标志，因为注释在生产中被剥离。
    HOISTED = -1,// 表示已提升的静态vnode,更新时调过整个子树
    BAIL = -2
}
/**
 * dev only flag -> name mapping
 */
export declare const PatchFlagNames: {
    1: string;
    2: string;
    4: string;
    8: string;
    16: string;
    32: string;
    64: string;
    128: string;
    256: string;
    512: string;
    1024: string;
    2048: string;
    [-1]: string;
    [-2]: string;
};
