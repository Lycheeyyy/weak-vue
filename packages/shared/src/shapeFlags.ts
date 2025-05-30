//在vnode.ts生成虚拟DOM节点中，第一个参数 type 不一定为根组件也可能是元素，生成的虚拟 dom 也要据此做出区分。
//至于怎么区分，源码里面为了精确地获取节点的特性信息的同时提高渲染性能，借助了枚举，每个枚举值都是一个二进制位掩码
//至于为什么用二进制源码表示，这是因为经过大量的实践证明，二进制表示、位运算可以节省内存空间的同时大大优化对比性能，同时也可以方便组合、提高代码简洁度，可以用于标记虚拟节点的具体类型和特性

export enum ShapeFlags {
    ELEMENT = 1, // 表示该虚拟节点是一个普通的 HTML 元素节点
    FUNCTIONAL_COMPONENT = 1 << 1, // 表示该虚拟节点是一个函数式组件节点
    STATEFUL_COMPONENT = 1 << 2, // 表示该虚拟节点是一个有状态的组件节点
    //为 TEXT_CHILDREN 这个标志位分配一个唯一的 二进制位，具体值是 1 左移 3 位
    TEXT_CHILDREN = 1 << 3, // 表示该虚拟节点包含纯文本子节点
    ARRAY_CHILDREN = 1 << 4, // 表示该虚拟节点包含数组形式的子节点
    SLOTS_CHILDREN = 1 << 5, // 表示该虚拟节点包含插槽形式的子节点
    TELEPORT = 1 << 6, // 表示该虚拟节点是一个传送门（Teleport）节点
    SUSPENSE = 1 << 7, // 表示该虚拟节点是一个异步加载（Suspense）节点
    COMPONENT_SHOULD_KEEP_ALIVE = 1 << 8, // 表示该虚拟节点的组件应该被缓存而不是销毁
    COMPONENT_KEPT_ALIVE = 1 << 9, // 表示该虚拟节点的组件已被缓存
    COMPONENT = ShapeFlags.STATEFUL_COMPONENT | ShapeFlags.FUNCTIONAL_COMPONENT, // 表示该虚拟节点是一个组件节点，可以是函数式组件或者有状态的组件
  }
  
