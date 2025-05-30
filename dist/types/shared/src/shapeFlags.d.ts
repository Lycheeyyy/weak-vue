export declare enum ShapeFlags {
    ELEMENT = 1,// 表示该虚拟节点是一个普通的 HTML 元素节点
    FUNCTIONAL_COMPONENT = 2,// 表示该虚拟节点是一个函数式组件节点
    STATEFUL_COMPONENT = 4,// 表示该虚拟节点是一个有状态的组件节点
    TEXT_CHILDREN = 8,// 表示该虚拟节点包含纯文本子节点
    ARRAY_CHILDREN = 16,// 表示该虚拟节点包含数组形式的子节点
    SLOTS_CHILDREN = 32,// 表示该虚拟节点包含插槽形式的子节点
    TELEPORT = 64,// 表示该虚拟节点是一个传送门（Teleport）节点
    SUSPENSE = 128,// 表示该虚拟节点是一个异步加载（Suspense）节点
    COMPONENT_SHOULD_KEEP_ALIVE = 256,// 表示该虚拟节点的组件应该被缓存而不是销毁
    COMPONENT_KEPT_ALIVE = 512,// 表示该虚拟节点的组件已被缓存
    COMPONENT = 6
}
