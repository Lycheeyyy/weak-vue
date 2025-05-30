import { effect } from "./effect";
import { isFunction } from "@vue/shared";

export function computed(getterOptions) {
    // 注意，传过来的可能是函数（此时只能读不能写），也可能是对象({get{}、set{}})
    let getter;
    let setter;
    if (isFunction(getterOptions)) {
      getter = getterOptions;
      setter = () => {
        console.warn("computed value must be readonly");
      };
    } else {
        //对象本身就有get和set
      getter = getterOptions.get;
      setter = getterOptions.set;
    }
  
    return new ComputedRefImpl(getter, setter);
  }
  

  class ComputedRefImpl {
    public _dirty = true; // 控制使得获取时才去执行，是否需要重新计算
    public _value; // 计算属性的值
    public effect; // 每个传入的getterOptions对应的effect高阶函数
    constructor(getter, public setter) {
        //创建了一个懒执行的响应式副作用函数，不立即执行getter，而是在真正访问.value的时候再去执行
      this.effect = effect(getter, {
        lazy: true, // 实现特性1
        //由于 computed 计算属性是 readonly 的，因此不能在 set value(){}里面进行相关操作，而是在 effect 里面进行操作。
        //sch 调度副作用函数执行的时机
        //effect 作为参数传进去，是为了让 scheduler (sch) 能“决定”要不要以及“何时”执行这个 effect 函数本体，而不是 sch 一定要把 _dirty 设置为 true。
        //是否将 _dirty 设置为 true，是由具体的 trigger 情况 + scheduler (sch) 的实现逻辑决定的，与传入 sch(effect) 的参数 effect 本身没有直接关系，它只是被调度的“执行目标”。
        sch: () => {
            // 实现特性3，修改数据时使得有机会被重新执行
            if (!this._dirty) {
              //this.dirty可以看作是，用于表示计算属性的缓存值是否过时的标志
              this._dirty = true;
            }
        },
      });
    }
      

  
    // 获取值的时候触发依赖（实现特性1）
    get value() {
      if (this._dirty) {
        // 此时里面的方法执行，this._value的值就是getterOptions返回return的结果，因此需要this.effect()返回的结果是就是用户传入的fn执行返回的结果（weak-vue\packages\reactivity\src\effect.ts里面改为return fn())
        //this.effect其实就是执行了前面提到的getter函数，让value拿到计算结果
        this._value = this.effect();
        //this.effect() 执行的 getter 👉 就是 computed(getterOrOptions) 中传进来的那个 getterOrOptions！
        this._dirty = false; // 这个是为了实现缓存机制，再去获取值的时候，直接返回旧的value即可（实现特性2）
      }
      return this._value;
    }
  
    set value(newValue) {
      this.setter(newValue);
    }
  }
  effectSet.forEach((effect: any) => {
    if (effect.options.sch) {
      effect.options.sch(effect); // 用于实现computed计算属性的特性3，触发更新时使得this._dirty = true，以便执行computed里面的方法
    } else {
      effect();
    }
  });