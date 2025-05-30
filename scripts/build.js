//import fs from "fs";
//import {execa} from "execa";
//
////检查是否为目录,获取目录
//const dirs = fs.readdirSync("packages").filter((p)=>{
//    return fs.statSync(`packages/${p}`).isDirectory();
//})
//
////并行打包
//async function build(target){
//    await execa(
//        "rollup",//调用命令行工具
//        ["-c","--bundleConfigAsCjs","--environment",`TARGET:${target}`],//-c 参数表示使用当前目录下的 rollup 配置文件进行打包，使用 --bundleConfigAsCjs 标志来指定配置文件为 CommonJS 模块
//        //stdio:"inherit"表示，子进程将共享父进程的标准输入。标准输出和标准错误流
//        {
//            stdio:"inherit",
//        }
//    );
//}
//
//
////并行处理多个任务
//async function runParaller(dirs,itemfn){
//    let result = [];
//    for(let item of dirs){
//        result.push(itemfn(item));
//    }
//    return Promise.all(result);
//}
//
//runParaller(dirs,build).then(()=>{});

import fs from "fs";
import { execa } from "execa";

// 获取命令行参数中传入的 TARGET 环境变量
const target = process.env.TARGET;

// 如果指定了 target，就只打包这个
async function build(target) {
  await execa(
    "rollup",
    ["-c", "--bundleConfigAsCjs", "--environment", `TARGET:${target}`],
    {
      stdio: "inherit",
    }
  );
}

// 扫描所有 packages 目录下的模块
const dirs = fs.readdirSync("packages").filter((p) => {
  return fs.statSync(`packages/${p}`).isDirectory();
});

async function runParallel(dirs, itemFn) {
  const results = [];
  for (const item of dirs) {
    results.push(itemFn(item));
  }
  return Promise.all(results);
}

// 只打包指定模块，否则打包全部
if (target) {
  build(target);
} else {
  runParallel(dirs, build).then(() => {});
}
