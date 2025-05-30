// 处理style
// 已经渲染到页面上{style：{color:'red'}}=>当前（新的）样式{style:{background:'green'，font-size:20px}}
export const patchStyle = (el, prev, next) => {
    const style = el.style;
  
    // 说明样式删除

    //新样式整体为 null（不是一个对象，而是整个没了）→ 意味着：元素彻底不需要任何样式了。所以干脆把整个 style 属性从 DOM 中删除（更彻底、更高效）。
    if (next === null) {//如果新的样式next是null，说明这个元素不再需要样式了，就直接把原来的样式删掉
      el.removeAttribute("style");
    } else {//next 是一个对象，但可能缺少某些字段（比如删了 color）。如果 prev 有 color: "red"，而 next.color === null，那就清掉这一条具体样式。只清除有差异的单个样式项。
      // 如果是已经渲染的样式有某样式，但是新的样式没有，则要清除老的样式
      if (prev) {
        for (const key in prev) {
          if (next[key] === null) {
            style[key] = "";
          }
        }
      }
      // 如果是新的有，老的没有，则直接打点获取属性后覆盖
      for (const key in next) {
        style[key] = next[key];
      }
    }
  };
  
