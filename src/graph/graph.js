/**
 * @license
 * ReglGraph
 * Released under MIT license
 * Copyright Rogério Castro
 */
import createRegl from 'regl' // https://github.com/regl-project/regl
import createGraph from 'ngraph.graph' // https://github.com/anvaka/ngraph.graph
import KDBush from 'kdbush' // https://github.com/mourner/kdbush
import {
  scaleLinear,
  select,
  extent as d3Extent,
  zoom as d3Zoom,
  zoomIdentity
} from 'd3' // https://github.com/d3/d3
import { mat3, vec3} from 'gl-matrix'; // https://glmatrix.net/docs/
import * as _get from 'lodash/get' // https://lodash.com/docs/
import * as _has from 'lodash/has' // https://lodash.com/docs/
import * as _set from 'lodash/set' // https://lodash.com/docs/
import { drawPoints, drawEdges, drawCircle } from './commands'
import { createTooltip } from './tooltip'
import './style.scss'

/**
 * Classe ReglGraph
 */
export default class ReglGraph {
  /**
   * Construtor do objeto ReglGraph
   * @param {HTMLElement} container Elemento HTML container. Ex.: div
   * @param {Object} data Dados da rede, com nós (nodes) e arestas (edges) { nodes, edges }
   * @param {Object[]} data.nodes Array de nós (nodes)
   * @param {Object[]} [data.edges] Array de arestas (edges)
   * @param {Object} [options] Configurações do grafo
   */
  constructor(container, data, options = {}) {
    /**
     * Verificações iniciais
     */
    if (!container) {
      throw new Error('Informe um elemento HTML como container para plotagem do grafo')
    }
    if (!data) {
      throw new Error('Informe os dados para a rede')
    }
    if (!_has(data, 'nodes')) {
      throw new Error('O objeto de dados da rede não contem a propriedade "nodes" (nós)')
    }
    if ((typeof options.showEdges === 'undefined' || options.showEdges) && !_has(data, 'edges')) {
      throw new Error('O objeto de dados da rede não contem a propriedade "edges" (arestas)')
    }

    /**
     * Propriedades gerais
     */
    // Container HTML (geralmente uma div)
    this.container = container
    // Matrizes de dados e atributos para os shaders
    this.matrices = null
    // Controla as tooltips
    this.tooltip = null
    // Módulo de buscas de pontos em uma área ou raio
    this.searchIndex = null
    // Eventos da biblioteca
    this.events = {}
    // Armazena os watchers que monitoram alterações em variáveis
    this.watchers = {}
    // Utilizada para converter valores RGB para valores de 0 a 1
    this.scaleRGBToVec4 = scaleLinear()
      .domain([0, 255])
      .range([0, 1])
    // Configurações gerais
    this.settings = {
      graphMargin: 50,
      showEdges: true,
      showEdgesOnMove: false,
      nodesSizeRange: [5, 30],
      defaultNodesOpacity: 1,
      defaultEdgesOpacity: 0.05,
      defaultEdgesColor: '#FFFFFF',
      edgesWeightRange: [1, 5],
      containerMargin: 0,
      zoomExtent: [1, 500],
      drawSelectedCircle: true,
      selectedCircleColor: '#dfff00',
      selectedCirclePoints: 30,
      tooltipAttributes: [],
      tooltipFormat: this.tooltipDefaultFormat,
      log: true
    }
    // Variáveis gerais do grafo
    this.app = {
      canvas: null,
      canvasID: null,
      width: null,
      height: null,
      regl: null,
      graph: null,
      nodeIndex: null,
      searchIndex: null,
      zoom: null,
      tooltip: null
    }
    // Variáveis de estado do grafo
    this.state = {
      transform: mat3.create(),
      projection: null,
      mousePosition: [0, 0],
      mouseDown: false,
      hoveredNode: -1,
      hoverNeighbors: [],
      selectedNode: -1,
      selectedNeighbors: [],
      highlightedNodes: [],
      inAnimation: false
    }
    // Variável dos buffers
    this.buffers = {
      nodes: null,
      edges: new Map()
    }

    /**
     * Juntando as configurações gerais com as opções informadas
     */
    this.settings = {...this.settings, ...options}

    // Iniciando os elementos HTML, a carga dos dados e plotagem do grafo
    this.init(data)
  }

  /**
   * ----------------------------------------------------------------------
   * Iniciando a plotagem do grafo
   * @param {Object} data Dados da rede com nós (nodes) e arestas (edges)
   */
  init (data) {
    // Iniciando os elementos HTML (criação do canvas)
    this.app.canvas = this.initCanvas()
    // Preenchendo dados relacionados ao canvas criado
    this.app.canvas.id = this.app.canvasID = `graph-${this.uuid()}`
    this.app.width = this.app.canvas.clientWidth
    this.app.height = this.app.canvas.clientHeight
    this.state.projection = mat3.projection(mat3.create(), this.app.width, this.app.height)
    // console.log('canvas criado:', this.app.canvas)

    // Iniciando o módulo de tooltips no canvas
    this.tooltip = createTooltip(this.app.canvas)

    // Carregando e formatando os dados do grafo (graph, nodeIndex, matrices)
    this.loadData(data)
    // console.log('dados gerais:', app)
    // console.log('Matrizes:', matrices)

    // Módulo que executa busca de nós pela posição do mouse (over e clique)
    this.searchIndex = new KDBush(this.matrices.nodesPositions)

    // Iniciando o estado de posicionamento e zoom do grafo
    mat3.translate(this.state.transform, this.state.transform, [0, 0])

    // Iniciando a funcionalidade de zoom
    this.app.zoom = d3Zoom()
      .extent([[0, 0], [this.app.width, this.app.height]])
      .scaleExtent(this.getOption('zoomExtent'))
      .on("zoom", this.handleZoom.bind(this))
      .on("end", this.handleMouseUp.bind(this))

    // Aplicando os tratamentos de eventos e funcionalidade de zoom ao canvas
    select(`#${this.app.canvasID}`)
      .on('mousedown', this.handleMouseDown.bind(this))
      .on('mousemove', this.handleMouseMove.bind(this))
      .on('click', this.handleClick.bind(this))
      .call(this.app.zoom)
      .on('dblclick.zoom', null)

    // Iniciando a biblioteca regl
    this.app.regl = createRegl({
      canvas: this.app.canvas,
      // Extensões: ANGLE_instanced_arrays (para as instâncias de linhas),
      // OES_standard_derivatives (para aplicar anti-aliasing nos pontos)
      extensions: ['ANGLE_instanced_arrays', 'OES_standard_derivatives']
    })

    // Preenchendo os buffers
    this.loadBuffers()

    // Registrando watchers
    this.registerWatcher('state.hoveredNode', this.hoveredNodeWatcher.bind(this))

    // Primeira renderização
    this.render()
  }

  /**
   * ----------------------------------------------------------------------
   * Cria o canvas e retorna o mesmo como resultado de uma Promise
   * @returns Promise que resolve para o elemento HTML canvas
   */
  initCanvas () {
    const canvas = document.createElement('canvas')
    // canvas.id = 'regl-graph-canvas'
    this.container.appendChild(canvas)
    const containerMargin = this.getOption('containerMargin')
    canvas.width = this.container.clientWidth - containerMargin
    canvas.height = this.container.clientHeight - containerMargin

    return canvas
  }

  /**
   * Carrega os dados da rede e formata outras variáveis necessárias para o grafo
   * @param {Object} data Dados da rede com nós (nodes) e arestas (edges)
   */
  loadData (data) {
    const nodes = data.nodes
    const edges = data.edges
    this.app.graph = createGraph()
    this.app.nodeIndex = new Map()
    this.matrices = {
      nodesPositions: [],
      edgesPositionsByWeight: new Map(),
      nodeColors: [],
      sizes: []
    }

    // Configurações
    const nodesSizeRange = this.getOption('nodesSizeRange')
    const graphMargin = this.getOption('graphMargin')
    const edgesWeightRange = this.getOption('edgesWeightRange')
    const defaultNodesOpacity = this.getOption('defaultNodesOpacity')
    const showEdges = this.getOption('showEdges')
    const defaultEdgesColor = this.getOption('defaultEdgesColor')

    // Obtendo todas as extensões em uma única iteração
    const extents = {
      size: [Number.POSITIVE_INFINITY, Number.NEGATIVE_INFINITY],
      x: [Number.POSITIVE_INFINITY, Number.NEGATIVE_INFINITY],
      y: [Number.POSITIVE_INFINITY, Number.NEGATIVE_INFINITY],
      weight: [Number.POSITIVE_INFINITY, Number.NEGATIVE_INFINITY]
    }
    // Verificando se existe a propriedade size nas arestas
    if (showEdges) {
      if (typeof edges[0].size !== 'undefined' || typeof edges[0].weight !== 'undefined') {
        const weightName = edges[0].size ? 'size' : 'weight'
        extents.weight = d3Extent(edges.map(e => e[weightName]))
      } else {
        extents.weight = [0, 1]
      }
    }
    nodes.forEach((node) => {
      if (node.size < extents.size[0]) {
        extents.size[0] = node.size
      }
      if (node.size > extents.size[1]) {
        extents.size[1] = node.size
      }
      const x = node.x ? node.x : node.position.x
      if (x < extents.x[0]) {
        extents.x[0] = x
      }
      if (x > extents.x[1]) {
        extents.x[1] = x
      }
      const y = node.y ? node.y : node.position.y
      if (y < extents.y[0]) {
        extents.y[0] = y
      }
      if (y > extents.y[1]) {
        extents.y[1] = y
      }
    })

    // Pegando os acréscimos de margem da plotagem para enquadrar a rede na tela sem deformar o layout
    const { marginXIncrease, marginYIncrease } = this.layoutAspectRatio(extents.x, extents.y)

    // Escalas
    const scales = {
      size: scaleLinear()
        .domain(extents.size)
        .range(nodesSizeRange),
      x: scaleLinear()
        .domain(extents.x)
        .range([graphMargin + marginXIncrease, this.app.width - graphMargin - marginXIncrease]),
      y: scaleLinear()
        .domain(extents.y)
        .range([graphMargin + marginYIncrease, this.app.height - graphMargin - marginYIncrease]),
      weight: scaleLinear()
        .domain(extents.weight)
        .rangeRound(extents.weight[0] === extents.weight[1] ? [1, 1] : edgesWeightRange)
    }

    // Nós
    nodes.forEach((node, i) => {
      const x = node.x ? node.x : node.position.x
      const y = node.y ? node.y : node.position.y
      const position = [scales.x(x), scales.y(y), i]
      const size = scales.size(node.size)
      // Adicionando o nó no modelo de grafo
      this.app.graph.addNode(node.id, {
        color: node.color,
        label: node.label,
        y,
        x,
        index: i,
        position,
        size,
        ...(node.attributes ? node.attributes : {})
      })
      // Alimentando o índice de nós
      this.app.nodeIndex.set(i, node.id)
      // Preenchendo os arrays para os shaders
      this.matrices.nodesPositions.push(position)
      this.matrices.nodeColors.push(node.color ? this.glslColor(node.color, defaultNodesOpacity) : [1, 1, 1, defaultNodesOpacity])
      this.matrices.sizes.push(size)
    })
    this.getOption('log') && console.info('Nós carregados:', nodes.length)
    // Arestas
    if (showEdges) {
      edges.forEach((edge, i) => {
        const weight = typeof edge.size !== 'undefined' ? scales.weight(edge.size) : typeof edge.weight !== 'undefined' ? scales.weight(edge.weight) : 1
        const color = typeof edge.color !== 'undefined' ? edge.color : defaultEdgesColor
        this.app.graph.addLink(edge.sourceID || edge.source, edge.targetID || edge.target, {
          weight,
          color,
          index: i,
          ...(edge.attributes ? edge.attributes : {})
        });
        // Preenchendo os arrays para os shaders
        const source = this.app.graph.getNode(edge.sourceID || edge.source)
        const target = this.app.graph.getNode(edge.targetID || edge.target)
        // Separando as arestas por peso
        if (!this.matrices.edgesPositionsByWeight.has(weight)) {
          this.matrices.edgesPositionsByWeight.set(weight, [])
        }
        this.matrices.edgesPositionsByWeight.get(weight).push(source.data.position)
        this.matrices.edgesPositionsByWeight.get(weight).push(target.data.position)
        /* this.matrices.edgesPositionsByWeight.get(weight).push(source.data.position.slice(0,2))
        this.matrices.edgesPositionsByWeight.get(weight).push(target.data.position.slice(0,2)) */
      })
      this.getOption('log') && console.info('Arestas carregadas:', edges.length)
    }
  }

  /**
   * Cálculos para enquadrar a rede na tela de exibição sem alterar o layout da rede
   * @param {Number[]} xExtent Extensão das posições X do grafo
   * @param {Number[]} yExtent Extensão das posições Y do grafo
   * @returns {Object} Incrementos para as margens horizontal e vertical do grafo
   */
  layoutAspectRatio (xExtent, yExtent) {
    const graphMargin = this.getOption('graphMargin')
    const factorX = (this.app.width - graphMargin * 2) / Math.ceil(xExtent[1] - xExtent[0])
    const factorY = (this.app.height - graphMargin * 2) / Math.ceil(yExtent[1] - yExtent[0])
    const factor = Math.min(factorX, factorY)
    const marginXIncrease = ((this.app.width - graphMargin * 2) - (factor * Math.ceil(xExtent[1] - xExtent[0]))) / 2
    const marginYIncrease = ((this.app.height - graphMargin * 2) - (factor * Math.ceil(yExtent[1] - yExtent[0]))) / 2
    return { marginXIncrease, marginYIncrease }
  }

  /**
   * Atualiza o estado de posição e zoom do grafo
   * @param {Number} x Deslocamento do palco no eixo X
   * @param {Number} y Deslocamento do palco no eixo Y
   * @param {Number} scale Escala do zoom
   */
  updateTransform (x, y, scale) {
    mat3.identity(this.state.transform)
    mat3.translate(this.state.transform, this.state.transform, [x, y])
    mat3.scale(this.state.transform, this.state.transform, [scale, scale])
    mat3.translate(this.state.transform, this.state.transform, [0, 0])
    mat3.projection(this.state.projection, this.app.width, this.app.height)
  }

  /**
   * Retorna a posição x e y relativa do mouse (cursor)
   * @param {Object} event Evento
   * @returns {Number[]} Array com as posições do mouse [x, y]
   */
  getRelativeMousePosition (event) {
    const rect = event.target.getBoundingClientRect()
    const mousePosition = []

    mousePosition[0] = (event.clientX - rect.left) // devicePixelRatio
    mousePosition[1] = (event.clientY - rect.top) // devicePixelRatio

    return [...mousePosition]
  }

  /**
   * Manipulando o evento zoom no grafo
   * @param {Object} event Evento
   */
  handleZoom (event) {
    // settings.transform = e.transform
    const { x, y, k } = event.transform
    this.updateTransform(x, y, k)
    // console.log('zoom:', settings.transform)
    this.render()
    // Disponibilizando o evento na biblioteca
    this.raiseEvent('zoom', event.transform)
    if (this.state.mouseDown) {
      this.setCursorStyle('move')
      // console.log('mousedown:', this.state.mouseDown)
    }
  }

  /**
   * Reseta zoom e pan aplicando uma transição leve
   */
  reset () {
    this.state.inAnimation = true
    select(`#${this.app.canvasID}`)
      .transition()
      .duration(750)
      .call(this.app.zoom.transform, zoomIdentity)
  }

  /**
   * Manipulando o evento mousedown no grafo
   * @param {Object} event Evento
   */
  handleMouseDown (event) {
    this.state.mouseDown = true
    // console.log('mousedown', this.state.mouseDown)
  }

  /**
   * Manipulando o evento mouseup no grafo
   * @param {Object} event Evento
   */
  handleMouseUp (event) {
    this.state.mouseDown = false
    if (this.state.inAnimation) {
      this.state.inAnimation = false
    }
    this.render()
    // console.log('mouseup', this.state.mouseDown)
  }

  /**
   * Manipulando o evento mousemove no grafo
   * @param {Object} event Evento
   */
  handleMouseMove (event) {
    this.state.mousePosition = this.getRelativeMousePosition(event)
    if (!this.state.mouseDown) {
      const closestPoint = this.raycast()
      const format = this.getOption('tooltipFormat')
      if (closestPoint) {
        /* // setHoverNeighbors deve sempre vir antes de setHoveredNode
        if (closestPoint !== this.getHoveredNode()) {
          this.setHoverNeighbors(closestPoint)
          console.dir('Neighbors', getHoverNeighbors())
        } */
        const node = this.getNodeByIndex(closestPoint)
        this.setHoveredNode(closestPoint)
        this.setCursorStyle('pointer')
        this.tooltip.show(node, format.bind(this))
        // console.log('nó focus:', this.state.hoveredNode)
      } else {
        /* // setHoverNeighbors deve sempre vir antes de setHoveredNode
        this.setHoverNeighbors() */
        this.setHoveredNode()
        this.setCursorStyle('default')
        this.tooltip.hide()
      }
    }
  }

  /**
   * Manipulando o evento click no grafo
   * @param {Object} event Evento
   */
  handleClick (event) {
    const closestPoint = this.raycast()
    let node = null
    this.highlight()
    if (closestPoint) {
      this.setSelectedNode(closestPoint)
      node = this.getNodeByIndex(closestPoint)
    } else {
      this.setSelectedNode()
    }
    // Disponibilizando o evento na biblioteca
    this.raiseEvent('click', { event, node })
  }

  /**
   * Atribui o nó (ponto) selecionado
   * @param {Number} idx Índice do nó selecionado
   */
  setSelectedNode (idx = -1) {
    if (this.state.selectedNode !== idx) {
      this.state.selectedNode = idx
      if (idx !== -1) {
        const node = this.getNodeByIndex(idx)
        this.setSelectedNeighbors(idx)
        // console.log('nó selecionado:', node)
        // Disponibilizando o evento na biblioteca
        this.raiseEvent('nodeselect', node)
      } else {
        this.setSelectedNeighbors()
      }
      this.render()
    }
  }

  /**
   * Retorna o nó selecionado
   * @returns Nó selecionado ou -1 para nenhum
   */
  getSelectedNode () {
    return this.state.selectedNode
  }

  /**
   * Atribui os vizinhos do nó (ponto) selecionado
   * @param {Number[]} [index] Índice do nó selecionado
   */
  setSelectedNeighbors (index = null) {
    if (index !== null) {
      const nodeIndexes = this.getNodeNeighbors(this.app.nodeIndex.get(index), true)
      this.state.selectedNeighbors = nodeIndexes
    } else {
      this.state.selectedNeighbors = []
    }
  }

  /**
   * Retorna os vizinhos do nó selecionado ou [] para nenhum
   * @returns Vizinhos do nó selecionado ou [] para nenhum
   */
  getSelectedNeighbors () {
    return this.state.selectedNeighbors
  }

  /**
   * Atribui o nó (ponto) a ser realçado
   * @param {Number} idx Índice do nó a ser realçado
   */
  setHoveredNode (idx = -1) {
    if (this.state.hoveredNode !== idx) {
      // Atribuindo com 'this.set' porque há watcher para essa variável
      this.set('state.hoveredNode', idx)
      this.setHoverNeighbors(idx)
      this.render()
    } else {
      this.setHoverNeighbors()
    }
  }

  /**
   * Retorna o nó realçado ou -1 para nenhum
   * @returns Nó realçado ou -1 para nenhum
   */
  getHoveredNode () {
    return this.state.hoveredNode
  }

  /**
   * Atribui os vizinhos do nó (ponto) a ser realçado
   * @param {Number[]} [index] Índice do nó a ser realçado
   */
  setHoverNeighbors (index = null) {
    if (index !== null) {
      const nodeIndexes = this.getNodeNeighbors(this.app.nodeIndex.get(index), true)
      this.state.hoverNeighbors = nodeIndexes
    } else {
      this.state.hoverNeighbors = []
    }
  }

  /**
   * Retorna os vizinhos do nó realçado ou [] para nenhum
   * @returns Vizinhos do nó realçado ou [] para nenhum
   */
  getHoverNeighbors () {
    return this.state.hoverNeighbors
  }

  /**
   * Destaca nós no grafo baseado em uma lista de IDs desses nós
   * @param {String[]|Number[]} nodesIds Array de IDs dos nós
   */
  highlight (nodesIds = null) {
    if (nodesIds !== null) {
      const nodesIndexes = nodesIds.map(id => this.app.graph.getNode(id).data.index)
      this.state.highlightedNodes = nodesIndexes
      this.setSelectedNode()
    } else {
      this.state.highlightedNodes = []
    }
    this.render()
    // console.info('highlightedNodes:', this.state.highlightedNodes)
  }

  getHighlightedNodes () {
    return this.state.highlightedNodes
  }

  /**
   * Atribui um estilo ao cursor (mouse)
   * @param {String} value Tipo do cursor
   */
  setCursorStyle (value) {
    select(`#${this.app.canvasID}`).style('cursor', value)
  }

  /**
   * Função padrão de formatação do conteúdo das tooltips
   * @param {Object} node Objeto com os dados do nó
   */
  tooltipDefaultFormat (node) {
    const tooltipAttributes = this.getOption('tooltipAttributes')
    // Verificando se há atributos a serem acrescentados na tooltip
    if (tooltipAttributes.length) {
      let content = `<strong>${node.data.label}</strong><hr>`
      tooltipAttributes.forEach((attr) => {
        content += `<div class="tooltip-attributes"> `
        content += `<small>${attr}:</small> <strong>${node.data[attr]}</strong>`
        content += `</div> `
      })
      return content
    }
    return `<strong>${node.data.label}</strong>`
  }

  /**
   * Retorna o objeto do nó baseado em seu índice de leitura inicial
   * @param {Number} index Índice do nó
   * @returns Objeto ngraph do nó
   */
  getNodeByIndex (index) {
    return this.app.graph.getNode(this.app.nodeIndex.get(index))
  }

  /**
   * Retorna os nós lincados (vizinhos) do nó informado
   * @param {String} nodeID ID do nó
   * @param {Boolean} onlyIndex Indica se serão retornados apenas os índices dos nós
   * @returns Array de nós lincados ou apenas seus índices
   */
  getNodeNeighbors (nodeID, onlyIndex = false) {
    const nodes = []
    this.app.graph.forEachLinkedNode(nodeID, (linkedNode) => {
      nodes.push(onlyIndex ? linkedNode.data.index : linkedNode)
    })
    return nodes
  }

  /**
   * Retorna a posição x do mouse independente da posição ou zoom
   * @param {Number} x Posição x do mouse
   * @returns {Number} Posição x do mouse normalizada
   */
  getNdcX (x) {
    return -1 + (x / this.app.width) * 2
  }

  /**
   * Retorna a posição y do mouse independente da posição ou zoom
   * @param {Number} y Posição y do mouse
   * @returns {Number} Posição y do mouse normalizada
   */
  getNdcY (y) {
    return 1 + (y / this.app.height) * -2
  }

  /**
   * Get relative WebGL position
   * @returns Posição WebGL relativa do mouse [x, y]
   */
  getMouseGlPos () {
    return [
      this.getNdcX(this.state.mousePosition[0]),
      this.getNdcY(this.state.mousePosition[1])
    ]
  }

  getScatterGlPos (pos) {
    const [xGl, yGl] = pos ?? this.getMouseGlPos()
    const scratch = new Float32Array(9)

    // Homogeneous vector
    const v = [xGl, yGl, 1]

    // projection^-1 * view^-1 * model^-1 is the same as
    // model * view^-1 * projection
    let mvp = mat3.invert(
      scratch,
      mat3.multiply(
        scratch,
        this.state.projection,
        this.state.transform
      )
    )

    // Translate vector
    if (!mvp) mvp = [
      1, 0, 0,
      0, 1, 0,
      0, 0, 1,
    ];
    vec3.transformMat3(v, v, mvp)

    return v.slice(0, 2)
  }

  /**
   * Elencando um ponto em um raio ou área
   * @returns Índice do ponto encontrado
   */
  raycast () {
    let pointSize = 1000; //scale to zoom level
    const [mouseX, mouseY] = this.getScatterGlPos()
    const scaling = 1

    const scaledPointSize =
      5 *
      pointSize *
      (this.minNumber(1.0, scaling) + Math.log2(this.maxNumber(1.0, scaling))) *
      window.devicePixelRatio

    const xNormalizedScaledPointSize = scaledPointSize / this.app.width
    const yNormalizedScaledPointSize = scaledPointSize / this.app.height

    // Obtendo todos os pontos em uma faixa próxima
    const pointsInBBox = this.searchIndex.range(
      mouseX - xNormalizedScaledPointSize,
      mouseY - yNormalizedScaledPointSize,
      mouseX + xNormalizedScaledPointSize,
      mouseY + yNormalizedScaledPointSize
    )
    // console.log('pointsInBBox:', pointsInBBox)
    // Find the closest point
    let minDist = scaledPointSize
    let closestPoint

    pointsInBBox.forEach(idx => {
      const [x, y] = this.searchIndex.points[idx]
      const d = this.distance(x, y, mouseX, mouseY)
      // if (d < minDist && attributes.stateIndex[1] !== 0) {
      if (d < minDist) {
        minDist = d
        closestPoint = idx
      }
    })
    return closestPoint
  }

  /**
   * Cria os buffers para o grafo (nós e arestas)
   * @param {String} type tipo de buffer a ser criado: nodes | edges
   */
  loadBuffers (type = null) {
    const showEdges = this.getOption('showEdges')
    if (type === 'nodes' || type === null) {
      this.buffers.nodes = this.app.regl.buffer(this.matrices.nodesPositions)
    }
    if (showEdges && (type === 'edges' || type === null)) {
      this.matrices.edgesPositionsByWeight.forEach((value, key) => {
        this.buffers.edges.set(key, this.app.regl.buffer(value))
      })
    }
  }

  /**
   * Renderiza o grafo
   */
  render () {
    // Limpando o stage (transparente)
    this.app.regl.clear({
      color: [0, 0, 0, 0]
    })
    // Configurações
    const showEdgesOnMove = this.getOption('showEdgesOnMove')
    const showEdgesOption = this.getOption('showEdges')
    const defaultEdgesColor = this.getOption('defaultEdgesColor')
    const defaultEdgesOpacity = this.getOption('defaultEdgesOpacity')
    // Indetificando alguma restrição na exibição de arestas (configuração e ação de arastar grafo)
    const noEdgesRestrictions = showEdgesOnMove ? true : !this.state.mouseDown
    const showEdges = showEdgesOption || this.state.hoveredNode !== -1 || this.state.selectedNode !== -1
    // Plotagem das arestas
    if (showEdges && noEdgesRestrictions) {
      this.buffers.edges.forEach((value, key) => {
        drawEdges(this.app.regl)({
          points: value,
          width: Number(key),
          color: this.glslColor(defaultEdgesColor, defaultEdgesOpacity),
          stageWidth: this.app.width,
          stageHeight: this.app.height,
          transform: this.state.transform,
          projection: this.state.projection,
          zoom: this.state.transform[0],
          segments: this.matrices.edgesPositionsByWeight.get(key).length / 2,
          hovered: this.getHoveredNode(),
          selected: this.getSelectedNode()
        })
      })
    }
    // Plotagem dos nós (pontos)
    drawPoints(this.app.regl)({
      nodes: this.buffers.nodes,
      length: this.matrices.nodesPositions.length,
      colors: this.matrices.nodeColors,
      sizes: this.matrices.sizes,
      stageWidth: this.app.width,
      stageHeight: this.app.height,
      transform: this.state.transform,
      projection: this.state.projection,
      zoom: this.state.transform[0],
      hovered: this.getHoveredNode(),
      selected: this.getSelectedNode(),
      highlighted: this.state.highlightedNodes.length > 0
    })
    // Plotando o nó destacado e seus vizinhos, caso haja
    if (this.state.hoveredNode !== -1) {
      const neighbors = this.getHoverNeighbors()
      const hPositions = [
        this.matrices.nodesPositions[this.getHoveredNode()],
        ...neighbors.map(i => this.matrices.nodesPositions[i])
      ]
      const hColors = [
        // this.matrices.nodeColors[this.getHoveredNode()],
        // ...neighbors.map(i => this.matrices.nodeColors[i])
        [...this.matrices.nodeColors[this.getHoveredNode()].slice(0, 3), 1.0],
        ...neighbors.map(i => [...this.matrices.nodeColors[i].slice(0, 3), 1.0])
      ]
      const hSizes = [
        this.matrices.sizes[this.getHoveredNode()] * 1.1,
        ...neighbors.map(i => this.matrices.sizes[i])
      ]
      drawPoints(this.app.regl)({
        nodes: this.app.regl.buffer(hPositions),
        length: hPositions.length,
        colors: hColors,
        sizes: hSizes,
        stageWidth: this.app.width,
        stageHeight: this.app.height,
        transform: this.state.transform,
        projection: this.state.projection,
        zoom: this.state.transform[0],
        hovered: -1,
        highlighted: false
      })
    }
    // Plotando o nó selecionado e seus vizinhos, caso haja
    if (this.state.selectedNode !== -1) {
      const neighbors = this.getSelectedNeighbors()
      const drawSelectedCircle = this.getOption('drawSelectedCircle')
      const selectedCirclePoints = this.getOption('selectedCirclePoints')
      const selectedCircleColor = this.getOption('selectedCircleColor')
      const hPositions = [
        this.matrices.nodesPositions[this.getSelectedNode()],
        ...neighbors.map(i => this.matrices.nodesPositions[i])
      ]
      const hColors = [
        // this.matrices.nodeColors[this.getSelectedNode()],
        // ...neighbors.map(i => this.matrices.nodeColors[i])
        [...this.matrices.nodeColors[this.getSelectedNode()].slice(0, 3), 1.0],
        ...neighbors.map(i => [...this.matrices.nodeColors[i].slice(0, 3), 1.0])
      ]
      const hSizes = [
        this.matrices.sizes[this.getSelectedNode()] * 1.1,
        ...neighbors.map(i => this.matrices.sizes[i])
      ]
      drawPoints(this.app.regl)({
        nodes: this.app.regl.buffer(hPositions),
        length: hPositions.length,
        colors: hColors,
        sizes: hSizes,
        stageWidth: this.app.width,
        stageHeight: this.app.height,
        transform: this.state.transform,
        projection: this.state.projection,
        zoom: this.state.transform[0],
        hovered: -1,
        highlighted: false
      })
      if (drawSelectedCircle) {
        drawCircle(this.app.regl)({
          position: this.matrices.nodesPositions[this.getSelectedNode()],
          points: selectedCirclePoints,
          color: this.glslColor(selectedCircleColor, 1.0),
          size: this.matrices.sizes[this.getSelectedNode()],
          transform: this.state.transform,
          projection: this.state.projection,
          zoom: this.state.transform[0]
        })
      }
    }
    // Plotando dos nós em destaque highlightedNodes
    if (this.state.highlightedNodes.length > 0) {
      const nodes = this.getHighlightedNodes()
      const hPositions = nodes.map(i => this.matrices.nodesPositions[i])
      const hColors = nodes.map(i => this.matrices.nodeColors[i])
      const hSizes = nodes.map(i => this.matrices.sizes[i] * 1.1)
      drawPoints(this.app.regl)({
        nodes: this.app.regl.buffer(hPositions),
        length: hPositions.length,
        colors: hColors,
        sizes: hSizes,
        stageWidth: this.app.width,
        stageHeight: this.app.height,
        transform: this.state.transform,
        projection: this.state.projection,
        zoom: this.state.transform[0],
        hovered: -1,
        highlighted: false
      })
    }
  }

  /**
   * Adiciona ações (funções) aos eventos da biblioteca
   * @param {String} eventName Nome do evento
   * @param {Function} handler Função a ser executada no evento
   */
  on (eventName, handler) {
    if(!(eventName in this.events)) {
      this.events[eventName] = []
    }
    this.events[eventName].push(handler)
  }

  /**
   * Cria eventos da biblioteca que podem ser utilizados pelo usuário
   * @param {String} eventName Nome do evento
   * @param {*} args Argumento a ser entregue à função atribuída ao evento
   */
  raiseEvent(eventName, args) {
    const actions = this.events[eventName]
    if(!actions) {
      return
    }
    for (let i = 0, l = actions.length; i < l; i++) {
      if(typeof actions[i] == 'function') {
        actions[i](args)
      }
    }
  }

  /**
   * Monitora as modificações na variável 'this.state.hoveredNode' para disparar os
   * eventos nodeover e nodeout
   * @param {Number} value Novo índice do nó ou -1 para nenhum
   * @param {Number} oldValue Antigo valor de 'this.state.hoveredNode'
   */
  hoveredNodeWatcher (value, oldValue) {
    // console.info('[hoveredNode] Valor modificado:', value)
    if (value === -1 && oldValue !== -1) {
      // Disponibilizando o evento na biblioteca
      this.raiseEvent('nodeout', this.getNodeByIndex(oldValue))
    } else {
      // Disponibilizando o evento na biblioteca
      this.raiseEvent('nodeover', this.getNodeByIndex(value))
    }
  }

  /**
   * Obtem o valor de uma variável em 'this.app'.
   * As principais instâncias para utilização são: regl, graph e tooltip
   * @param {String} option Nome da variável (instância)
   * @returns Valor da variável ou todas se option não for informado
   */
  getAppInstance (option = null) {
    if (option === null) {
      return this.app
    }
    if (_has(this.app, option)) {
      return this.app[option]
    }
    return null
  }

  /**
   * Obtem o valor de uma configuração
   * @param {String} option Nome da configuração (setting)
   * @returns Valor da configuração ou todas se option não for informado
   */
  getOption (option = null) {
    if (option === null) {
      return this.settings
    }
    if (_has(this.settings, option)) {
      return this.settings[option]
    }
    return null
  }

  /**
   * Atribui um novo valor a uma configuração e chama a renderização do grafo.
   * Obs.: Algumas configurações não surtirão efeito pois são aplicadas fora da renderização.
   * @param {String} option Nome da configuração (setting)
   * @param {*} value Novo valor da configuração
   */
  setOption (option, value) {
    if (_has(this.settings, option) && typeof value !== 'undefined') {
      this.settings[option] = value
      // Algumas configurações não serão aplicadas no render
      this.render()
    }
  }

  /**
   * Atribui o valor de uma variável para disparar um watcher
   * @param {String|String[]} property Nome ou path da variável. Ex.: 'foo.bar'
   * @param {*} value Novo valor da variável
   * @returns
   */
  set (property, value) {
    if (_has(this, property)) {
      let oldValue = _get(this, property)
      if (typeof oldValue === 'undefined' || oldValue === value) {
        return
      }
      // Armazenando o valor antigo e evitando a imutabilidade
      oldValue = JSON.stringify(oldValue)
      _set(this, property, value)
      // Verificando se há um watcher
      if (this.watchers[property]) {
        // Retornando o valor atual e o antigo para o watcher
        this.watchers[property](value, JSON.parse(oldValue))
      }
    }
  }

  /**
   * Registra um watcher para monitorar a modificação de uma variável.
   * Essa variável deve ser modificada via 'this.set(property, value)'
   * @param {String|String[]} property Nome ou path da variável. Ex.: 'foo.bar'
   * @param {Function} watcher Função a ser executada na alteração de property
   */
  registerWatcher (property, watcher) {
    this.watchers[property] = watcher
  }

  /**
   * Distância L2 entre um par de pontos 2D
   * @param {Number} x1  coordenada X do primeiro ponto
   * @param {Number} y1  coordenada Y do primeiro ponto
   * @param {Number} x2  coordenada X do segundo ponto
   * @param {Number} y2  coordenada Y do segundo ponto
   * @return {Number} Distância L2
   */
  distance (x1, y1, x2, y2) {
    return Math.sqrt((x1 - x2) ** 2 + (y1 - y2) ** 2)
  }

  /**
   * Compara dois números e retorna o maior (mais simples que Math.max())
   * @param {Number} a Primeiro número para comparação
   * @param {Number} b Segundo número para comparação
   * @returns Maior número
   */
  maxNumber (a, b) {
    return a > b ? a : b
  }

  /**
   * Compara dois números e retorna o menor (mais simples que Math.min())
   * @param {Number} a Primeiro número para comparação
   * @param {Number} b Segundo número para comparação
   * @returns Menor número
   */
  minNumber (a, b) {
    return a < b ? a : b
  }

  /**
   * Simples gerador de identificador GUID / UUID
   * @returns Identificador do tipo GUID / UUID
   */
  uuid () {
    return 'xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx'.replace(/[xy]/g, (c) => {
      var r = Math.random() * 16 | 0, v = c == 'x' ? r : (r & 0x3 | 0x8)
      return v.toString(16)
    })
  }

  /**
   * Converte uma cor RGB ou hexadecimal para o formato vec4 padrão WebGL
   * @param {String} color Cor no formato RGB ou hexadecimal
   * @param {Number} opacity Transparência de 0.0 a 1.0
   * @returns Cor no formato vec4. Ex.: [1,1,1,1]
   */
  glslColor (color, opacity = 1.0) {
    const rgb = /^(?:(?:rgb\((\d{1,3}),\s?(\d{1,3}),\s?(\d{1,3})\))|(?:rgba\((\d{1,3}),\s?(\d{1,3}),\s?(\d{1,3}),\s?([0-1]\.[0-9]|[0-1])\)))$/
    const hex = /^(#(?:[a-fA-F0-9]{3}|[a-fA-F0-9]{6}))$/

    if (rgb.test(color)) {
      const result = rgb.exec(color)
      // console.log('teste cor: rgb ou rgba')
      return result ? [
        this.scaleRGBToVec4(parseInt(result[1])),
        this.scaleRGBToVec4(parseInt(result[2])),
        this.scaleRGBToVec4(parseInt(result[3])),
        opacity
      ] : [1, 1, 1, opacity]
    }
    if (hex.test(color)) {
      // console.log('teste cor: hex')
      const result = this.hexToRgb(color)
      return result ? [
        this.scaleRGBToVec4(result.r),
        this.scaleRGBToVec4(result.g),
        this.scaleRGBToVec4(result.b),
        opacity
      ] : [1, 1, 1, opacity]
    }
    return null
  }

  /**
   * Converte uma cor hexadecimal (sem transparência) para o formato RGB
   * @param {String} hex Cor no formato hexadecimal
   * @returns Objecto com a representação da cor RGB { r, g, b }
   */
  hexToRgb (hex) {
    // Expande o formato abreviado ("03F") para o formato completo ("0033FF")
    const shorthandRegex = /^#?([a-f\d])([a-f\d])([a-f\d])$/i
    hex = hex.replace(shorthandRegex, function(m, r, g, b) {
      return r + r + g + g + b + b
    });

    const result = /^#?([a-f\d]{2})([a-f\d]{2})([a-f\d]{2})$/i.exec(hex)
    return result ? {
      r: parseInt(result[1], 16),
      g: parseInt(result[2], 16),
      b: parseInt(result[3], 16)
    } : null
  }
}
