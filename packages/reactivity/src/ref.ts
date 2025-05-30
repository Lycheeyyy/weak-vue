import { Track, trigger } from "./effect";
import { TrackOpType, TriggerOpType } from "./operations";
import { hasChange, isArray } from "../../shared/src";

export function ref(target) {
    return createRef(target);
  }

  //ref 本质是一个方法，将我们需要代理的基本数据包装成一个可以访问 value 属性的实例对象。
  
  // 如果target是一个对象，则浅层代理
  export function shallowRef(target) {
    return createRef(target, true);
  }
  
  // 创建ref类
  class RefImpl {
    // 给实例添加一些公共属性（实例对象都有的，相当于this.XXX = XXX）
    public __v_isRef = true; // 用来表示target是通过ref实现代理的
    public _value; // 值的声明
    //constructor用来设置对象的初始状态，语法结构： class 类名 {constructor(参数){this.属性名 = 值}}
    constructor(public rawValue, public shallow) {
      // 参数前面添加public标识相当于在构造函数调用了this.target = target,this.shallow = shallow
      this._value = rawValue; // 用户传入的值赋给_value
    }
  
    // 借助类的属性访问器实现value属性的访问以及更改
    // 响应式的实现需要借助两个方法：收集依赖（Track）和触发更新（trigger）。
  // 借助类的属性访问器实现value属性的访问以及更改
  get value() {
    Track(this, TrackOpType.GET, "value"); // get的时候实现依赖收集
    return this._value;
  }
  set value(newValue) {
    // 如果值已变，则赋新值并触发更新
    if (hasChange(newValue, this._value)) {
      this._value = newValue;//_value是响应式处理之后的值，用于依赖追踪和更新
      this.rawValue = newValue;//rawValue是未经处理的原始值，用于比较和原始数据访问
      //只有最新的值会被保留，所以raw也要变，旧值如果以后在没有用会直接抛弃
      trigger(this, TriggerOpType.SET, "value", newValue);
    }
  }
  }


  class ObjectRefImlp {
    public __v_isRef = true; // 用来表示target是通过ref实现代理的
    constructor(public target, public key) {}
  
    // 获取值
    get value() {
      return this.target[this.key];
    }
    // 设置值
    set value(newValue) {
      this.target[this.key] = newValue;
    }
  }
  
  // 创建toRef对象
  export function toRef(target, key) {
    return new ObjectRefImlp(target, key);
  }

  
  // 创建ref实例对象(rawValue表示传入的目标值)
  function createRef(rawValue, shallow = false) {
    return new RefImpl(rawValue, shallow);
  }


  // 实现toRefs
export function toRefs(target) {
    // 判断是否为数组
    let ret = isArray(target) ? new Array(target.length) : {};
    // 遍历target对象的每个属性key
    for (const key in target) {
      ret[key] = toRef(target, key); // 每个属性都有自己的toRef实例对象
    }
  
    return ret;
  }
  


