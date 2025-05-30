//（1）引入相关依赖
const ts = require("rollup-plugin-typescript2");
const json = require("@rollup/plugin-json");
const resolvePlugin = require("@rollup/plugin-node-resolve");
const path = require("path");
const fs = require("fs");
const replace = require("@rollup/plugin-replace");
//const __dirname = path.resolve();

//const __dirname = path.dirname(new URL(import.meta.url).pathname);//因为在package.json里面设置了"type":module，使得rollup.config.js被处理为ES模块，而ES模块中__dirname不可用

//（2）获取文件路径，并拿到路径下的包
////path.resolve 用于将路径序列化成绝对路径（会根据提供的路径片段，逐一从右到左解析每个路径，直到它找到第一个绝对路径，并以此为基础拼接剩余路径。）
//const packagesDir = path.resolve(__dirname, "packages");//这行代码会返回当前文件夹下的 packages 目录的绝对路径。
////__dirname是当前模块的目录名称，它是一个全局变量，指向当前执行脚本所在的目录。
//const packageDir = path.resolve(packagesDir, process.env.TARGET);//会将 TARGET 解析成一个绝对路径，指向 packages 下的特定包目录。
const packagesDir = path.resolve(__dirname, "packages");
const packageDir = path.resolve(packagesDir, process.env.TARGET);
//const packageDir = __dirname; // 当前包目录
const resolve = (p) => path.resolve(packageDir, p);//这个 resolve 函数接收一个相对路径 p，并返回一个绝对路径，具体是以 packageDir 为基准路径解析 p。
const pkg = require(resolve(`package.json`)); // resolve会返回目标包下的package.json文件的绝对路径，require会加载这个JSON文件并返回其内容
const options = pkg.buildOptions; // 获取每个子包配置中的buildOptions配置
// 获取文件名字
const name = path.basename(packageDir);
// 根目录路径
const rootDir = path.resolve(__dirname, "..");  // 根目录（父目录）
//(3)创建一个映射输出表
const outputOpions = {
    "esm-bundler": {
      // 输出文件的名字
      file: resolve(`dist/${name}.esm-bundler.js`),//.esm-bundler.js为文件扩展名
      // 输出文件的格式
      format: "es",//表示ES Module格式，ESM 是 JavaScript 模块的原生标准格式，支持 import 和 export
    },
    cjs: {
      // 输出文件的名字
      file: resolve(`dist/${name}.cjs.js`),
      // 输出文件的格式
      format: "cjs",
    },
    global: {
      // 输出文件的名字
      file: resolve(`dist/${name}.global.js`),
      // 输出文件的格式
      format: "iife",
      globals: {
        "@vue/shared": "VueShared",
        ...(process.env.TARGET === 'runtime-dom' && { 
          "@vue/runtime-core": "VueRuntimeCore" 
        })
      }
    },
  };

// （4）创建一个打包的配置对象
function createConfig(format, output) {
    // 进行打包
    const globalName = pkg.buildOptions.name; // 从 package.json 的 buildOptions 获取
    output.name = options.name; //指定一个名字
    // 用于调整代码
    output.sourcemap = true;
    const isGlobalFormat = format === 'global';
  
    //sourcemap 是一个调试工具，可以帮助开发者在浏览器中调试压缩后的代码。启用 sourcemap 会生成一个 .map 文件，它能将压缩后的代码映射回源代码，方便开发者调试。//
    // 生成rollup配置
    return {
      // resolve表示当前包
      //input 是打包的入口文件，表示从哪个文件开始打包。
      input: resolve("src/index.ts"), 
      // 输出
      output: {
        ...output,
        ...(isGlobalFormat && {
          name: globalName,
          extend: true,
          footer: `if(typeof window !== 'undefined') window.${globalName} = ${globalName};`,
          // 在 shared 的 output 配置中添加
          footer: `if(typeof window !== 'undefined') window.VueShared = VueShared;`,
          globals: {
            '@vue/shared': 'VueShared',
            ...(globalName === 'VueRuntimeDom' && { 
              '@vue/runtime-core': 'VueRuntimeCore' 
            })
          }
        })
      },
      //plugins 是一个插件数组，包含了 Rollup 在打包过程中需要使用的插件。这些插件用于处理不同类型的资源，比如 TypeScript 文件、JSON 文件等。
      plugins: [
        json(),
        ts({
            tsconfig: path.resolve(__dirname, "tsconfig.json"), // 强制使用本地配置
            check: false,                     // 完全关闭类型检查
            clean: true,                      // 每次构建清除缓存
            useTsconfigDeclarationDir: true,
            tsconfigOverride: {
              compilerOptions: {
                declarationDir: "dist/types", // 明确指定声明文件输出目录
                skipLibCheck: true,           // 跳过库类型检查
                baseUrl: ".",                 // 基本路径设为当前目录
                paths: {
                  "@vue/*": ["../../packages/*/src"]
                }                     // 清空路径映射
              }
            }
          }),
        resolvePlugin(), //解析第三方插件
        replace({
          'process.env.NODE_ENV': JSON.stringify('production'),
          preventAssignment: true,
          values: {  // 明确指定要替换的值
            'process.env.NODE_ENV': JSON.stringify('production')
          }
        })
      ],
      external: [
       //// 显式排除 runtime-core 和其他不必要的模块
       //...Object.keys(pkg.dependencies || {}),
       //...Object.keys(pkg.peerDependencies || {}),
       ///^@vue\//,
       ///^vue/
         // 暴力排除所有可能的污染
        /^@vue\/runtime-core/,
        /^@vue\/runtime-dom/,
        /^vue/,
       '@vue/runtime-core',
       ...Object.keys(pkg.dependencies || {}),
       ...Object.keys(pkg.peerDependencies || {}),
       '@vue/shared',
       ...(process.env.TARGET === 'runtime-dom' ? ['@vue/runtime-core'] : []),
      ],

    };
  }


  // （5）rollup需要导出一个配置
  //export default 导出了配置数组。通过 export default，模块将导出一个默认值，其他模块可以通过 import 语句导入这个配置。
  //这里的 map 方法会遍历 options.formats 数组，为每个格式生成一个配置对象，并返回一个新的数组。
  //format：表示当前正在打包的格式;outputOpions[format] 则是根据这个 format 值从 outputOpions 对象中获取到相应的输出配置。
  //  export default options.formats.map((format) =>
  //      createConfig(format, outputOpions[format])
  //  );

  module.exports = options.formats.map((format) =>
    createConfig(format, outputOpions[format])
  );







