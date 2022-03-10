# vue组件模板：
```vue
  <html>
    <body>
      <div id='app'></div>
    </body>
  </html>
  new Vue({
    el:"#app",
    data:{
      msg: 2
    },
    mounted: function(){
      console.log('app say hi')//后输出
    },
    methods:{
      foo(){
        console.log('Parent foo()'+this.msg)
      }
    }
  })
```

# 总体流程：
## 类转换顺序
  > vue-ast-code-vnode-dom
  - 初始化一个vue对象（new vue），执行各类init函数，合并vue的n多初始值和方法，接着执行$mounted挂载方法
  - parseHTML解析template模板中的vue格式html，形成ast语法树（就是个带一堆vue参数的对象）；这里会处理父子标签的关系，相互链接上
  - 把ast转换成可执行的code函数（字符串方式拼接成的函数，字符串里很多vue的简写方法：_C、_l...）;render函数就是 返回code函数的with函数，render: `with(this){return ${code}}`,
  - render是通过调用createElement和createEmptyVNode两个函数进行转化成vnode，createElemen根据不同情形选择new VNode或者调用createComponent实例化VNode；
  - vnode通过_update变成dom，_update里的主要步骤是执行patch方法
## 方法执行顺序
  - new Vue调用./instance/index 里的Vue()
  - 执行_init（挂在原型上）:各种初始化，及creat系列钩子的调用，最后执行$mount。 src\core\instance\init.js
  - $mount：进行编译转换（compile），vue格式内容转成render函数；执行mountComponent函数 src\platforms\web\entry-runtime-with-compiler.js
  - mountComponent :执行beforeMount钩子；实例化Watcher，回调里执行updateComponent；最后执行mounted钩子。 src\core\instance\lifecycle.js
  - updateComponent：执行_render()生成Node，_update更新 DOM。vm._update(vm._render(), hydrating)。  src\core\instance\render.js
  - _render：执行$mount中生成的render函数，render函数的传参$createElement就是createElement回调（createElement是_createElement的封装），最终是通过createElement生成Node。 src\core\instance\render.js
  - _update：不同环境执行不同的__patch__ 方法，web浏览器端__patch__是createPatchFunction的返回 src\core\instance\lifecycle.js