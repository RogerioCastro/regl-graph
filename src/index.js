import ReglGraph from './graph/graph'
import './style.scss'

const reglGraph = window.ReglGraph
  ? window.ReglGraph
  : ReglGraph

// Elementos HTML
const container = document.createElement('div')
container.id = 'graph-container'
document.body.appendChild(container)

fetch('data.json')
  .then((response) => response.json())
  .then((data) => {
    // 'graph' ficará disponível via console para testes
    const graph = window.graph = new reglGraph(container, data, {
      defaultEdgesColor: '#00FF00',
      selectedCircleColor: '#FFFFFF',
      defaultEdgesOpacity: 0.1,
      tooltipAttributes: ['size'],
      nodesSizeRange: [5, 40]
    })
    loadGUI(graph)
  })
  .catch((error) => {
    // eslint-disable-next-line no-console
    console.error('Erro na leitura dos dados JSON:', error)
  })

/* GUI */
function loadGUI(graph) {
  const settings = {
    showEdges: graph.getOption('showEdges'),
    showEdgesOnMove: graph.getOption('showEdgesOnMove'),
    defaultEdgesOpacity: graph.getOption('defaultEdgesOpacity'),
    defaultEdgesColor: graph.getOption('defaultEdgesColor'),
    highlight: () => {
      graph.highlight(['underscore', 'async'])
    },
    reset: () => {
      graph.reset()
    },
    focusNode: () => {
      graph.focusNode('optimist')
    }
  }
  const gui = new dat.GUI({ name: 'graph' })
  gui.width = 250

  const render = gui.addFolder('Rendering')

  render
    .add(settings, 'showEdges')
    .name('Show edges')
    .onChange(e => {
      graph.setOption('showEdges', e)
    })
  render
    .add(settings, 'showEdgesOnMove')
    .name('Edges on move')
    .onChange(e => {
      graph.setOption('showEdgesOnMove', e)
    })
  render
    .add(settings, 'defaultEdgesOpacity', 0.05, 1, 0.05)
    .name('Edges opacity')
    .onChange(e => {
      graph.setOption('defaultEdgesOpacity', e)
    })
  render
    .addColor(settings, 'defaultEdgesColor')
    .name('Edges color')
    .onChange(e => {
      graph.setOption('defaultEdgesColor', e)
    })
  render
    .add(settings, 'highlight')
    .name('Highlight nodes')

  const controls = gui.addFolder('Controls')
  controls
    .add(settings, 'focusNode')
    .name('Focus node')
  controls
    .add(settings, 'reset')
    .name('Reset zoom')
}

/* console.log('Data:', data)
console.log('Graph:', graph)
console.log('Settings:', graph.getOption())
console.log('Graph model:', graph.getAppInstance('graph')) */

// Events
/* graph.on('nodeselect', (node) => {
  console.log('=> nodeselect:', node)
})
graph.on('click', (params) => {
  console.log('=> click:', params)
})
graph.on('nodeover', (node) => {
  console.log('=> nodeover:', node)
})
graph.on('nodeout', (node) => {
  console.log('=> nodeout:', node)
}) */
