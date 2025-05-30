import { isArray, isIntegerKey } from "@vue/shared";
//import { TriggerOpType } from "./operations";
let uid = 0;
let activeEffect; // 保存当前的effect
const effectStack = [];// 用一个栈来保存所有的effect

//effect是一个高阶函数，同时也是一个和每个 fn 一一对应的对象，这个对象上面有很多属性，比如 id（唯一标识）、_isEffect（私有属性，区分是不是响应式的 effect）、raw（保存用户的方法）、options（保存用户的 effect 配置）
function createReactEffect(fn, options) {
    // effect是一个高阶函数
    const effect = function reactiveEffect() {
        // 确保effect唯一性
        //检查当前effect是否已在栈中（防止循环依赖）
        if (!effectStack.includes(effect)) {
          try {
            // 入栈，将activeEffect设置为当前的effect
            effectStack.push(effect);
            activeEffect = effect;
            fn(); // 执行用户的方法
          } finally {
            // 不管如何都会执行里面的方法，不论成功或者失败
            // 出栈，将当前的effect改为栈顶
            effectStack.pop();
            activeEffect = effectStack[effectStack.length - 1];
          }
        }
      };
    // effect也是一个对象
    effect.id = uid++; // 区分effect
    effect._isEffect = true; // 区分effect是不是响应式的effect
    effect.raw = fn; // 保存用户的方法
    //effect.options是用于存储副作用函数（effect）配置选项的内部属性
    effect.options = options; // 保存用户的effect配置
    activeEffect = effect;
    return effect;
}

let targetMap = new WeakMap();//存储所有的target对象和各自的Map的映射关系
//targetMap中的 key为一个target对象，value为依赖 Map
//实现target=>Map（key=>Set(n) {effect1, effect2, ..., effectn}）这种结构
export function Track(target, type, key) {
    if (activeEffect === undefined) {
        // 说明没有在effect中使用（变量不是响应式或者变量不存在）
        return;
    }
    //借助 targetMap，可以拿到每个 target 对象的依赖 Map，如果该依赖 Map 不存在则新插入一个
    let depMap = targetMap.get(target);
    if (!depMap) {
      targetMap.set(target, (depMap = new Map()));
    }

    //depMap 是一个依赖 map，它的 key 为 target 对象中的每个属性 key，value 为每个属性涉及的所有不重复 effect。可以借助 depMap 拿到每个属性 key 的所有 effect 的 Set 结构，如果该 Set 不存在则新建一个：
    let dep = depMap.get(key);
    if (!dep) {
      // 没有属性
      depMap.set(key, (dep = new Set()));
    }
    //拿到属性 key 的所有 effect 之后，可以去判断 activeEffect 是否已经在其中，没有则插入，实现 effect 依赖的收集：
    if (!dep.has(activeEffect)) {
        dep.add(activeEffect);
    }
    
    console.log(targetMap);
}

export function effect(fn, options: any = {}) {
    //options: any = {}表示：options是一个任意类型的参数（any），默认值是一个空对象
    // 对于每个fn，都能创建自己的effect
    const effect = createReactEffect(fn, options);
  
    // 判断一下
    //非lazy模式立即执行
    if (!options.lazy) {
      effect(); // 默认执行
    }
    return effect;
  }

  // 触发更新
export function trigger(target, type, key?, newValue?, oldValue?) {
   //console.log(target, type, key, newValue, oldValue);
   // 获取对应的effect
   const depMap = targetMap.get(target);
   if (!depMap) {
     return;//如果这个对象还没有被收集依赖，就不需要触发任何副作用
   }
   const effects = depMap.get(key);//获取该key对应的effects集合，effects 是一个 Set，其中包含了所有依赖这个属性的 effect 函数。

   // 不重复执行effect
   //为什么要去重？因为有些 effect 函数可能同时依赖多个属性，避免重复执行。
   //Set结构有天然去重特性，如果你尝试往一个 Set 中添加重复的内容，它不会报错，但也不会真正插入第二次
   let effectSet = new Set();//用于存放所有要执行的 effect
   const addEffect = (effects) => {
     if (effects) {
       effects.forEach((effect) => effectSet.add(effect));
     }
   };
   addEffect(effects);
   effectSet.forEach((effect: any) => effect());//(effect: any) => effect()：箭头函数，表示“拿到每个 effect 后执行它”

   // 对数组进行特殊处理，改变的key为length时(即直接修改数组的长度)时，要触发其它key的effect，否则其它key的effect不会被触发的，始终是旧的结果
   if (isArray(target) && key === "length") {
     depMap.forEach((dep, key) => {
       // 此时拿到depMap包含target对象所有key（包含'length'等属性以及所有下标'0'、'1'等等）的所有涉及effect
       // 如果下标key大于等于新的长度值，则要执行length的effect和超出length的那些key的effect（再去执行指的是比如刚开始拿到state.list[100]，
       // 现在将state.list.length直接改为1，重新触发state.list[100]这个语句，无法在内存中找到所以显示undefined）
       if (key === "length" || key >= newValue) {//如果这个副作用依赖于length，或者依赖的 key（数字索引）大于等于新的 length，也要重新执行。
         addEffect(dep);//把受影响的依赖 effect 收集起来,方便下面一块操作
       }
     });
   } else {
     // 数组或对象都会进行的正常操作
     if (key !== undefined) {
       const effects = depMap.get(key);
        addEffect(effects);
      }
    
    switch (type) {
      case TriggerOpType.ADD://表示新增属性的操作
        // 针对的是通过下标给数组不存在的key赋值，从而改变数组的长度的情况，此时要额外触发"length"的effect
        //情况举例：const arr = [1, 2];  // 初始长度是 2
                  //arr[5] = 100;
                  //console.log(arr);        // [1, 2, <3 empty items>, 100]
                  //console.log(arr.length); // 👉 6
        //稀疏数组，自动填补中间的空位
        if (isArray(target) && (isIntegerKey(key) as unknown as boolean)) {
           addEffect(depMap.get("length"));//收集并准备执行所有依赖于 .length 的 effect。depMap里面是一对属性和他们对应的依赖，需要在里面找出依赖于length的并执行（addEffect函数里面本身就可以执行）
        }
    }
}

}

  