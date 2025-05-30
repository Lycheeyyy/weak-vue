/**公共方法 */
// 判断是否为对象
export const isObject = (target) =>
    typeof target === "object" && target !== null;//因为 typeof null 也是 "object"，需要排除它。
export const isArray = Array.isArray;
export const isFunction = (val) => typeof val === "function";
export const isString = (val) => typeof val === "string";
export const isNumber = (val) => typeof val === "number";
// 合并两个对象
export const extend = Object.assign;//直接将 ES 的 Object.assign() 方法赋值为 extend 名称
  
// 判断对象是否有某个属性（两个参数，返回值为布尔型，key is keyof typeof val使用了ts的类型守卫语法）
const hasOwnProperty = Object.prototype.hasOwnProperty;
//下面这个函数；函数名是hasOwn，参数是val和key，): key is keyof typeof val =>是箭头函数的返回类型注解；真正的函数体是箭头后面的
export const hasOwn = (
  val: object,
  key: string | symbol //第二个参数叫key，可以是字符串或Symbol类型
): key is keyof typeof val => hasOwnProperty.call(val,key);
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
export const isIntegerKey = (key) => {
  isString(key) &&
    key !== "NaN" &&
    key[0] !== "-" &&
    "" + parseInt(key, 10) === key;//只有当 key 是纯数字字符串，并且没有多余字符（如前导零、单位 px、字母等）时，这个表达式才为 true。
    //parseInt(key, 10)：把 key 转换为整数（忽略后面非数字字符）。
    //"" + ...：把解析出来的数字 转成字符串。
    //"" + parseInt(key, 10)即(比如"08"->8->"8")
};

// 判断值是否更新
export const hasChange = (value, oldValue) => value !== oldValue;

// 创建map映射关系
export function makeMap(
  str: string, //如"div,span,p"
  expectsLowerCase?: boolean //是否在判断时把传入的key转为小写
): (key: string) => boolean { //makeMap 这个函数会返回一个函数，这个函数： 接收一个字符串参数 key: string；返回一个布尔值 boolean
  const set = new Set(str.split(",")); //拆分字符串，变成数组（split），然后用Set储存成集合
  return expectsLowerCase
    ? (val) => set.has(val.toLowerCase()) //转小写
    : (val) => set.has(val);
}



// 驼峰化
export const capitalize = (str) => {
  // e.g
  // my-first-name
  // myFirstName
  // replace 第二个参数可以是一个函数
  // 这个函数接收两个参数
  //      match: 匹配到的子串
  //      p1,p2,p3...: 假如 replace 第一个参数是正则表达式
  //                   则代表第 n 个括号匹配到的字符串
  // 如上例子中
  // nerverUse 是 -f、-n
  // c 是 f、n
  return str.replace(/-(\w)/g, (neverUse, c) => (c ? c.toUpperCase() : ""));
};

// 这里是一个将 xxx-xx 转化为 onxxxXx 的工具函数
export const toHandlerKey = (str) => (str ? `on${capitalize(str)}` : "");

