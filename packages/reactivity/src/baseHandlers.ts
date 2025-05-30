import {
  isObject,
  isArray,
  isIntegerKey,
  extend,
  hasOwn,
  hasChange,
} from "../../shared/src";
import { reactive, readonly } from "./reactivity";
import { TrackOpType, TriggerOpType } from "./operations";
import { Track, trigger } from "./effect";

// 代理-获取get()配置
function createGetter(isReadonly = false, shallow = false) {
    return function get(target, key, receiver) {
      // proxy一般和Reflect反射使用，用于拿到目标对象中的某个属性
      //target——原始目标对象（被代理的那一个）
      //key——当前访问的属性名
      //receiver——触发该操作的代理对象本身
      const res = Reflect.get(target, key, receiver); // 相当于target[key]，但Reflect.get() 方法可以处理更复杂的情况
  
      // 判断
      if (!isReadonly) {
        // 不是只读则收集依赖（三个参数为代理的变量/对象，对该变量做的操作（增删改等），操作对应的属性）
        Track(target, TrackOpType.GET, key);
      }
      if (shallow) {
        // 如果只是浅层处理，直接返回浅层代理处理即可，否则继续向下递归
        return res;
      }
  
      // 如果是一个对象，递归处理。
      // 这里有一个优化处理，判断子对象是否只读，防止没必要的代理，即懒代理处理。————面试题之一
      //懒代理：只有在访问某个对象的属性值的时候，才对这个属性值进行代理处理，而不是在一开始就全部代理
      if (isObject(res)) {
        return isReadonly ? readonly(res) : reactive(res);
      }
      return res;
    };
  }
  const get = createGetter(); // 不是只读，是深度代理
  const shallowGet = createGetter(false, true); // 不是只读，是浅代理
  const readonlyGet = createGetter(true, true); // 只读，深度
  const shallowReadonlyGet = createGetter(true, true); // 只读，浅层
  
  // 代理-获取set()配置
function createSetter(shallow = false) {//默认开启深层响应式，即为递归代理所有子对象
  //proxy监听到对target[key]=value的操作
    return function set(target, key, value, receiver) {

  //(1)获取老值
    const oldValue = target[key];
  //(2)判断target是数组还是对象，此时target已经是被代理过的对象了，所以要另写方法判断
  // 如果是数组，key的位置小于target.length，说明是修改值；如果是对象，则直接用hasOwn方法判断
  let hasKey = ((isArray(target) && isIntegerKey(key)) as unknown as boolean)
  //as unknown as boolean是ts的一种双重类型断言，用于强制将某个表达式转换为boolean类型
  ? Number(key) < target.length
  : hasOwn(target, key);

  //3）设置新值
    const res = Reflect.set(target, key, value, receiver); // 获取最新的值，相当于target[key] = value
  
  //(4)触发更新
  if (!hasKey) {
    // 此时说明是新增
    trigger(target, TriggerOpType.ADD, key, value);
  } else if (hasChange(value, oldValue)) {
    // 修改的时候，要去判断新值和旧值是否相同
    trigger(target, TriggerOpType.SET, key, value, oldValue);
  }

  return res;
    };
  }
  const set = createSetter(); // 深层响应式 set
  const shallowSet = createSetter(true); // 浅层响应式 set

  // 代理-readonly只读情况下的set()配置
  // 只读属性里面也可以写set方法，但这个 set 方法的目的是为了拦截和阻止写操作，而不是执行赋值操作。（不是不写 set，而是要写一个“拦截并阻止”的 set。）
const readonlyObj = {
    set: (target, key, value) => {
      console.warn(`set ${target} on key ${key} is failed`);//提示警告而不做任何操作，是保护措施
    },
  };
  
  export const reactiveHandlers = {
    get,
    set,
  };
  export const shallowReactiveHandlers = {
    get: shallowGet,
    set: shallowSet,
  };
  //extend是一个对象合并工具函数,浅拷贝合并函数（类似 Object.assign）
  export const readonlyHandlers = extend(//把 readonlyGet 和 readonlyObj 中的内容合并成一个新的对象，作为 readonly 的代理 handler 配置。
    {
      get: readonlyGet,
    },
    readonlyObj
  );
  export const shallowReadonlyHandlers = extend(
    {
      get: shallowReadonlyGet,
    },
    readonlyObj
  );
  
