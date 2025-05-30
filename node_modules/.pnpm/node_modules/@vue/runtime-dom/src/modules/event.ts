// 注意：对事件的处理比较特殊，因为事件和样式类名自定义属性不一样，绑定不同的事件不能直接覆盖，如@click="fn1"、@click = "fn2"。
// 因为 addEventListener 重复添加事件监听时，不能替换之前的监听，导致有多个监听同时存在。
// 所以这里借助一个 map 结构存储所有的事件映射，然后 addEventListener 监听对应的映射值，然后重复绑定时直接改变映射值即可（相当于改变引用）。

// 源码对这个处理使用了缓存，用一个map结构存储元素key上面绑定的元素

// el为元素，key是触发事件的方法，即事件名（如click），value为绑定的函数方法
export const patchEvent = (el, key, value) => {
    //确保当前 DOM 元素 el 上有一个事件缓存对象 _vei，如果没有，就创建一个空对象 {}。
    //el._vei 是挂在 DOM 元素上的自定义属性，用来缓存所有绑定在这个元素上的事件监听器。
    //如果这个元素之前已经绑定过事件，el._vei 就已经存在，直接使用。如果这个元素还没有绑定过任何事件，就创建一个新的空对象，并赋值给 el._vei。

    //el._vei存的是一个元素上所有事件的缓存对象，它记录了事件类型（如 click）和它对应的事件执行器（invoker）。
    const invokers = el._vei || (el._vei = {}); // el._vei相当于一个元素的事件map缓存结构，可能为空{}。拿上面的例子来说的话，此时应该是{"click":{value:fn1}}
    //如果之前就已经绑定了这个事件，exists 就是那个事件的处理器（invoker）
    const exists = invokers[key]; // 拿上面的例子来说的话，此时应该是 {value:fn1}
    if (exists && value) {//事件存在，并且传入了新的value
      // 不能进行覆盖（情况1）==>改变缓存中的value指向最新的事件即可，相当于改变exists的fn引用
      exists.value = value;//exists.value就是你最新绑定的事件处理函数
    } else {
      // 如果该触发方式还未绑定事件或者传入的函数为空，可能是新的绑定，也可能是清除事件
      //下面这行代码的作用举例：从 "onClick" 得到 "click"，即浏览器认识的事件名
      const eventName = key.slice(2).toLowerCase();//toLowerCase()是JavaScript 字符串的一个方法，用来将 字符串中的所有字母转换为小写。
      if (value) {
        //  新的事件绑定，且将该绑定放入缓存器（情况2）
        //invokers是一个map对象
        //把新创建的 invoker 缓存在 invokers 这个对象中，并使用事件名（如 "click"）作为 key，对应这个 invoker 作为 value。这样后续就可以通过事件名快速找到对应的 invoker，实现高效的事件管理。
        let invoker = (invokers[eventName] = createInvoker(value)); // 返回一个包装后的函数
        el.addEventListener(eventName, invoker);
      } else {
        //  移除事件（情况3）
        //为什么下面这里使用的是exists 而不是 invokers[eventName]？
        //因为上述变化中，exists = invokers[key]; // 注意 key 是 "onClick"；但是eventName是去掉了on并且变成小写了的click
        el.removeEventListener(eventName, exists);
        //补充：element.removeEventListener(type, listener, options);
        // type: 事件类型（字符串），比如 'click'、'input' 等。listener: 要移除的事件处理函数（必须是同一个函数引用）。options: 可选参数（和 addEventListener 的第三个参数一样）。
        invokers[eventName] = null;
      }
    }
  };
  
  //尤其在 高效更新 的场景下，我们不希望每次更新事件处理时都重新绑定事件。为了实现这个高效更新的目标，Vue 采用了包装函数的方式，使得我们可以 动态更新事件处理函数，而不必解绑再重新绑定。
  
  //这个函数的目的是生成一个包装函数
  function createInvoker(value) {
    //value 就是你实际绑定的事件处理函数（比如 fn1 或 fn2）。
    //invoker是一个包装函数，目的：让事件处理函数（即 value）通过 invoker 来触发，invoker 本身是一个函数，但是它是代理函数，调用它实际上是调用 invoker.value。
    //invoker的任务是将事件参数传递给实际的事件处理函数。
    // 为什么用他呢？如果事件处理函数（value）发生变化，我们不需要重新绑定事件，而是只需要更新 invoker.value。
    const invoker = (e) => {//
      invoker.value(e);
    };
    invoker.value = value;//这样传进去之后，invoker.value中存储了我们传入的事件处理函数（比如 fn1、fn2）。
    //invoker.value 可以在后续的某个时刻被更新，这就意味着我们可以在不重新绑定事件的情况下，动态改变事件处理逻辑。
    return invoker;
  }
  