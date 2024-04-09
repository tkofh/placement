import { createApp, defineComponent, h } from 'vue'
import { RootFrame } from './components/RootFrame'
// import App from './App.vue'
import './style.css'

createApp(
  defineComponent({
    name: 'App',
    render() {
      return h(RootFrame, {
        width: '900',
        // height: '100%',
        aspectRatio: '1',
        // fit: 'cover',
      })
    },
  }),
).mount('#app')
