declare module 'vite' {
  export interface PluginContext {
    config: { root: string }
    getModuleInfo(id: string): any
    getModuleIds(): IterableIterator<string>
  }
}