export default class ModuleCollection {
  /**
   * modules: {a: moduleA,b: moduleB} == rawRootModule
   * @param {*} rawRootModule 
   */
  constructor (rawRootModule) {
    // register root module (Vuex.Store options)
    this.register([], rawRootModule, false)
  }

  get (path) {
    return path.reduce((module, key) => {
      return module.getChild(key)
    }, this.root)
  }

  getNamespace (path) {
    let module = this.root
    return path.reduce((namespace, key) => {
      module = module.getChild(key)
      return namespace + (module.namespaced ? key + '/' : '')
    }, '')
  }

  update (rawRootModule) {
    update([], this.root, rawRootModule)
  }

  register (path, rawModule, runtime = true) {
    if (process.env.NODE_ENV !== 'production') {
      assertRawModule(path, rawModule)
    }

    // 创建模块类-单个模块实例
    const newModule = new Module(rawModule, runtime)
    // path表示路径，为空时，先把模块定义为根模块
    if (path.length === 0) {
      this.root = newModule
    } else {
      // 子模块注册时会进入这里
      // 如果是根模块的子模块进入这里；path是[],get函数不走reduce里的函数，所以parent返回的是root
      const parent = this.get(path.slice(0, -1))
      parent.addChild(path[path.length - 1], newModule)
    }

    // register nested modules
    // 当有modules时表示有模块区分，要遍历创建子模块
    // forEachValue就是循环遍历对象，执行后面的方法
    if (rawModule.modules) {
      forEachValue(rawModule.modules, (rawChildModule, key) => {
        this.register(path.concat(key), rawChildModule, runtime)
      })
    }
  }

  unregister (path) {
    const parent = this.get(path.slice(0, -1))
    const key = path[path.length - 1]
    if (!parent.getChild(key).runtime) return

    parent.removeChild(key)
  }
}