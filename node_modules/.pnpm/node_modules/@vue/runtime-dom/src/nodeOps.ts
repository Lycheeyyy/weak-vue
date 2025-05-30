// 操作节点（增删改查）
export const nodeOps = {
    // 对节点的一些操作
    // 创建元素，createElement(runtime-dom本质是运行时操作dom，但因为每个平台操作dom的方法不同，vue的runtime-dom模块的createElement方法是针对浏览器的)
    createElement: (tagName) => document.createElement(tagName),
    // 删除元素
    remove: (child) => {
      const parent = child.parentNode;
      if (parent) {
        parent.removeChild(child);
      }
    },
    // 插入元素
    //anchor表示插入的位置锚点，要插入的内容再这个的前面
    //anchor为空的时候，insert(p1,parent,null)就相当于parent.appendChild(p1)
    insert: (child, parent, ancher = null) => {
        //insertBefore函数：两个参数：newNode和referenceNode,前者代表想要插入/加进去的元素，后者代表插入位置的参照节点，newNode会被插到它之前
      parent.insertBefore(child, ancher); // anchor为空相当于appendchild
    },
    // 选择节点
    querySelector: (select) => document.querySelector(select),
    // 设置节点的文本
    setElementText: (el, text) => {
      el.textContent = text;
    },
  
    // 对文本的一些操作
    createText: (text) => document.createTextNode(text),
    setText: (node, text) => (node.nodeValue = text),
  };
  