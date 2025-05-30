// weak-vue\packages\runtime-core\src\apilifecycle.ts
import { currentInstance, setCurrentInstance } from "./component";

// 处理生命周期
const enum lifeCycle {
  BEFOREMOUNT = "bm",
  MOUNTED = "m",
  BEFOREUPDATE = "bu",
  UPDATED = "u",
}

// 常用的生命周期钩子——柯里化操作
export const onBeforeMount = createHook(lifeCycle.BEFOREMOUNT);
export const onMounted = createHook(lifeCycle.MOUNTED);
export const onBeforeUpdate = createHook(lifeCycle.BEFOREUPDATE);
export const onUpdated = createHook(lifeCycle.UPDATED);

// 创建生命周期钩子
function createHook(lifecycle: lifeCycle) {//这个函数 createHook 接收一个参数 lifecycle，这个参数必须是 lifeCycle 类型。
  // 返回一个函数,这个函数接收两个参数，hook和target。hook是生命周期中的方法，target是当前组件实例
  return function (hook, target = currentInstance) {
    // 获取到当前组件的实例，然后和生命周期产生关联
    injectHook(lifecycle, hook, target);
  };
}

// 注入生命周期钩子
function injectHook(lifecycle: lifeCycle, hook, target = currentInstance) {
  console.log("当前组件实例：", target);
  // 注意：vue3.x中的生命周期都是在setup中使用的
  if (!target) {
    console.warn(`lifecycle: ${lifecycle} is used outside of setup`);
    return;
  }
  // 给这个实例添加生命周期
  //检查 target 上是否已经存在某个生命周期对应的钩子数组（例如 target['mounted']）,如果已经有了，就用它,没有，就新建一个空数组并赋值给 target[lifecycle]
  const hooks = target[lifecycle] || (target[lifecycle] = []);

  //hooks.push(hook);//添加当前这个生命周期


  // 注意：vue3.x中获取组件示例是通过getCurrentInstance()方法获取的
  //利用函数包装（劫持）技术，在生命周期钩子执行前自动设置当前组件实例，以便用户可以在钩子中通过getCurrentInstance（）拿到当前组件实例
  // 为了可以在生命周期中获取到组件实例，vue3.x通过切片的手段实现（即函数劫持的思路，修改传入的hook，使得hook执行前设置当前组件实例到全局）
  const rap = (hook) => {//rap是包装器的简写，用处是包裹用户传入的hook，注入实例上下文
      setCurrentInstance(target);//设置当前组件实例为target(全局变量)
      hook(); // 执行生命周期钩子前存放一下当前组件实例
      setCurrentInstance(null);//执行完清除全局实例，避免污染
    };
    
    hooks.push(rap);//跟上面相比，不是直接注册 hook，而是注册包装后的 rap，确保任何生命周期函数执行时，Vue 都能正确设置和清除 currentInstance。

}

// 生命周期的执行
export function invokeArrayFns(fns) {
    fns.forEach((fn) => fn());
  }
