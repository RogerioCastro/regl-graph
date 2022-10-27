import ReglGraph from './graph/graph'
import { json } from 'd3'
import './style.scss'

const reglGraph = window.ReglGraph
  ? window.ReglGraph
  : ReglGraph

// Elementos HTML
const container = document.createElement('div')
container.id = 'graph-container'
document.body.appendChild(container)

json('data.json').then((data) => {
  const graph = new reglGraph(container, data, {
    defaultEdgesColor: '#00FF00',
    selectedCircleColor: '#FFFFFF',
    defaultEdgesOpacity: 0.1,
    tooltipAttributes: ['size'],
    nodesSizeRange: [5, 40],
    // edgesWeightRange: [1, 15],
    tooltipFormat: (node) => `${node.data.label}`
  })
  // console.log('Graph:', graph)
})
.catch((error) => {
  // eslint-disable-next-line no-console
  console.error('Erro na leitura dos dados JSON:', error)
})

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
