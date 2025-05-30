'use strict';

/**公共方法 */
// 判断是否为对象
const isObject = (target) => typeof target === "object" && target !== null; //因为 typeof null 也是 "object"，需要排除它。
const isArray = Array.isArray;
const isFunction = (val) => typeof val === "function";
const isString = (val) => typeof val === "string";
const isNumber = (val) => typeof val === "number";
// 合并两个对象
const extend = Object.assign; //直接将 ES 的 Object.assign() 方法赋值为 extend 名称
// 判断对象是否有某个属性（两个参数，返回值为布尔型，key is keyof typeof val使用了ts的类型守卫语法）
const hasOwnProperty = Object.prototype.hasOwnProperty;
//下面这个函数；函数名是hasOwn，参数是val和key，): key is keyof typeof val =>是箭头函数的返回类型注解；真正的函数体是箭头后面的
const hasOwn = (val, key //第二个参数叫key，可以是字符串或Symbol类型
) => hasOwnProperty.call(val, key);
//typeof val：获取变量 val 的类型，相当于：name:string;age:number
//keyof typeof val:表示这个对象类型的所有“键名”组成的联合类型：type KeyType = "name" | "age";
//总体意思:如果函数返回true,那我保证这个key就是val对象的一个有效键
//这里的.call()作用是改变函数执行时候的this指向
//例子：const obj = Object.create(null)
//obj.name = '李四'
//obj.hasOwnProperty('name') // ❌ 报错！
//Object.prototype.hasOwnProperty.call(obj, 'name') // ✅ true
// 判断数组的key是否是整数
// 数组经过proxy代理之后，会变成对象的形式，如console.log(new Proxy([1,2,3],{})); ===》Proxy(Array) {'0': 1, '1': 2, '2': 3}（js对象的key类型为字符串），因此"" + parseInt(key, 10)这样是为了方便拿到正确的字符串key用于判断
// console.log(Array.isArray(new Proxy([1,2,3],{})))===》true
// 比如此时arr[2]=4，应该是
const isIntegerKey = (key) => {
    isString(key) &&
        key !== "NaN" &&
        key[0] !== "-" &&
        "" + parseInt(key, 10) === key; //只有当 key 是纯数字字符串，并且没有多余字符（如前导零、单位 px、字母等）时，这个表达式才为 true。
    //parseInt(key, 10)：把 key 转换为整数（忽略后面非数字字符）。
    //"" + ...：把解析出来的数字 转成字符串。
    //"" + parseInt(key, 10)即(比如"08"->8->"8")
};
// 判断值是否更新
const hasChange = (value, oldValue) => value !== oldValue;
// 创建map映射关系
function makeMap(str, //如"div,span,p"
expectsLowerCase //是否在判断时把传入的key转为小写
) {
    const set = new Set(str.split(",")); //拆分字符串，变成数组（split），然后用Set储存成集合
    return expectsLowerCase
        ? (val) => set.has(val.toLowerCase()) //转小写
        : (val) => set.has(val);
}

//在vnode.ts生成虚拟DOM节点中，第一个参数 type 不一定为根组件也可能是元素，生成的虚拟 dom 也要据此做出区分。
//至于怎么区分，源码里面为了精确地获取节点的特性信息的同时提高渲染性能，借助了枚举，每个枚举值都是一个二进制位掩码
//至于为什么用二进制源码表示，这是因为经过大量的实践证明，二进制表示、位运算可以节省内存空间的同时大大优化对比性能，同时也可以方便组合、提高代码简洁度，可以用于标记虚拟节点的具体类型和特性
exports.ShapeFlags = void 0;
(function (ShapeFlags) {
    ShapeFlags[ShapeFlags["ELEMENT"] = 1] = "ELEMENT";
    ShapeFlags[ShapeFlags["FUNCTIONAL_COMPONENT"] = 2] = "FUNCTIONAL_COMPONENT";
    ShapeFlags[ShapeFlags["STATEFUL_COMPONENT"] = 4] = "STATEFUL_COMPONENT";
    //为 TEXT_CHILDREN 这个标志位分配一个唯一的 二进制位，具体值是 1 左移 3 位
    ShapeFlags[ShapeFlags["TEXT_CHILDREN"] = 8] = "TEXT_CHILDREN";
    ShapeFlags[ShapeFlags["ARRAY_CHILDREN"] = 16] = "ARRAY_CHILDREN";
    ShapeFlags[ShapeFlags["SLOTS_CHILDREN"] = 32] = "SLOTS_CHILDREN";
    ShapeFlags[ShapeFlags["TELEPORT"] = 64] = "TELEPORT";
    ShapeFlags[ShapeFlags["SUSPENSE"] = 128] = "SUSPENSE";
    ShapeFlags[ShapeFlags["COMPONENT_SHOULD_KEEP_ALIVE"] = 256] = "COMPONENT_SHOULD_KEEP_ALIVE";
    ShapeFlags[ShapeFlags["COMPONENT_KEPT_ALIVE"] = 512] = "COMPONENT_KEPT_ALIVE";
    ShapeFlags[ShapeFlags["COMPONENT"] = 6] = "COMPONENT";
})(exports.ShapeFlags || (exports.ShapeFlags = {}));

console.log(exports.ShapeFlags);

exports.extend = extend;
exports.hasChange = hasChange;
exports.hasOwn = hasOwn;
exports.isArray = isArray;
exports.isFunction = isFunction;
exports.isIntegerKey = isIntegerKey;
exports.isNumber = isNumber;
exports.isObject = isObject;
exports.isString = isString;
exports.makeMap = makeMap;
//# sourceMappingURL=shared.cjs.js.map
