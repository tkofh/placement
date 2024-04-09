import { defineComponent } from 'vue'

export const RelativeFrame = defineComponent({
  name: 'RelativeFrame',
  props: {
    width: { type: [String, Number], required: false },
    height: { type: [String, Number], required: false },
    aspectRatio: { type: [String, Number], required: false },
    x: { type: [String, Number], required: false },
    y: { type: [String, Number], required: false },
  },
  setup(_props) {
    return () => {
      // return h('')
    }
  },
})
