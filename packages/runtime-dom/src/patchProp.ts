// 操作属性（增删改查）
import { patchClass } from "./modules/class";
import { patchStyle } from "./modules/style";
import { patchAttr } from "./modules/attrt";
import { patchEvent } from "./modules/event";
//意思是：给某个 DOM 元素 el，根据属性名 key，把旧值 prevValue 更新为新值 nextValue。
export const patchProps = (el, key, prevValue, nextValue) => {
  switch (key) {
    case "class":
      patchClass(el, nextValue); // 只用传节点和新的class值
      //更新类名，不需要旧值参与
      break;
    case "style":
      patchStyle(el, prevValue, nextValue);//会智能对比 prevValue 和 nextValue，只更新有变化的部分，删除不需要的旧样式。
      break;
    default:
      // 事件要另外处理(事件的特征：@、onclick等==>正则匹配，如以on开头，后面跟小写字母，这里简化判断，知道思想即可)
      //^ 在方括号内，表示否定，即“不属于这个范围”。
      //[^a-z] - 排除小写字母
      if (/^on[^a-z]/.test(key)) {
        patchEvent(el, key, nextValue);
      } else {
        patchAttr(el, key, nextValue);
      }
  }
};

