import ReglGraph from './graph/graph'
import data from './data/npm-deps.json'
// import data from './data/mobile-banking.json'
import './style.scss'

const reglGraph = window.ReglGraph
  ? window.ReglGraph
  : ReglGraph

// Elementos HTML
const container = document.createElement('div')
container.id = 'graph-container'
document.body.appendChild(container)

const graph = new reglGraph(container, data, {
  containerMargin: 20,
  defaultEdgesColor: '#00FF00',
  selectedCircleColor: '#FFFFFF',
  tooltipAttributes: ['size'],
  tooltipFormat: (node) => `${node.data.label}`
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
