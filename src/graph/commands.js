// Shaders
import POINT_FS from './shaders/point.fs'
import POINT_VS from './shaders/point.vs'
import CIRCLE_FS from './shaders/circle.fs'
import CIRCLE_VS from './shaders/circle.vs'
import INTERLEAVED_VS from './shaders/interleaved.segments.vs'
import INTERLEAVED_FS from './shaders/interleaved.segments.fs'

/**
 * Cria um círculo com N pontos e retorna a matriz de vetores dos pontos
 * @param {Number} N N úmero de pontos do círculo (quanto mais pontos melhor a resolução)
 * @returns Array de vetores vec2 com as posições [x, y] dos pontos
 */
function makeCircle (N) {
  return Array(N).fill().map((_, i) => {
    var phi = 2 * Math.PI * (i / N)
    return [Math.cos(phi), Math.sin(phi)]
  })
}

/**
 * Retorna o comando regl para renderização de círculos
 * @param {Object} regl Instância da biblioteca regl
 * @returns Comando (função) de plotagem de círculos
 */
export const drawCircle = (regl) => {
  return regl({

    frag: CIRCLE_FS,
    vert: CIRCLE_VS,

    attributes: {
      circlePoint: (context, props) => makeCircle(props.points)
    },

    uniforms: {
      zoom: regl.prop('zoom'),
      transform: regl.prop('transform'),
      projection: regl.prop('projection'),
      position: regl.prop('position'),
      size: regl.prop('size'),
      color: regl.prop('color'),
      points: regl.prop('points')
    },

    count: regl.prop('points'),

    lineWidth: Math.min(2, regl.limits.lineWidthDims[1]),

    primitive: 'line loop'
  })
}

/**
 * Retorna o comando regl para renderização de pontos (nós da rede)
 * @param {Object} regl Instância da biblioteca regl
 * @returns Comando (função) de plotagem de pontos
 */
export const drawPoints = (regl) => {
  return regl({

    frag: POINT_FS,
    vert: POINT_VS,

    attributes: {
      position: regl.prop('nodes'),
      color: regl.prop('colors'),
      size: regl.prop('sizes')
    },

    uniforms: {
      zoom: regl.prop('zoom'),
      transform: regl.prop('transform'),
      projection: regl.prop('projection'),
      stageWidth: regl.prop('stageWidth'),
      stageHeight: regl.prop('stageHeight'),
      hovered: regl.prop('hovered'),
      selected: regl.prop('selected'),
      highlighted: regl.prop('highlighted')
    },

    blend: {
      enable: true,
      func: {
        srcRGB: 'src alpha',
        srcAlpha: 1,
        dstRGB: 'one minus src alpha',
        dstAlpha: 1
      },
      equation: {
        rgb: 'add',
        alpha: 'add'
      },
      color: [0, 0, 0, 0]
    },

    count: (context, props) => props.length,

    depth: { enable: false },

    primitive: 'points'
  })
}

/**
 * Geometria utilizada para instanciamento de linhas com melhor performance
 * e melhor customização do estilo da linha (espessura, cor etc).
 * Instanced Line Rendering (https://wwwtyro.net/2019/11/18/instanced-lines.html)
 */
const segmentInstanceGeometry = [
  [0, -0.5],
  [1, -0.5],
  [1,  0.5],
  [0, -0.5],
  [1,  0.5],
  [0,  0.5]
];

/**
 * Retorna o comando regl para renderização de instâncias de linhas (arestas da rede)
 * @param {Object} regl Instância da biblioteca regl
 * @returns Comando (função) de plotagem de instâncias de linhas
 */
export const drawEdges = (regl) => {
  return regl({

    frag: INTERLEAVED_FS,
    vert: INTERLEAVED_VS,

    attributes: {
      position: {
        buffer: regl.buffer(segmentInstanceGeometry),
        divisor: 0
      },
      pointA: {
        buffer: regl.prop("points"),
        divisor: 1,
        offset: Float32Array.BYTES_PER_ELEMENT * 0,
        stride: Float32Array.BYTES_PER_ELEMENT * 6
      },
      pointB: {
        buffer: regl.prop("points"),
        divisor: 1,
        offset: Float32Array.BYTES_PER_ELEMENT * 3,
        stride: Float32Array.BYTES_PER_ELEMENT * 6
      },
      // width: regl.prop("width")
      /* width: {
        buffer: regl.prop("width"),
        divisor: 0
      }, */
    },

    uniforms: {
      zoom: regl.prop('zoom'),
      width: regl.prop("width"),
      transform: regl.prop('transform'),
      projection: regl.prop('projection'),
      stageWidth: regl.prop('stageWidth'),
      stageHeight: regl.prop('stageHeight'),
      color: regl.prop("color"),
      hovered: regl.prop('hovered'),
      selected: regl.prop('selected'),
    },

    blend: {
      enable: true,
      func: {
        srcRGB: 'src alpha',
        srcAlpha: 1,
        dstRGB: 'one minus src alpha',
        dstAlpha: 1
      },
      equation: {
        rgb: 'add',
        alpha: 'add'
      },
      color: [0, 0, 0, 0]
    },

    count: segmentInstanceGeometry.length,
    instances: regl.prop("segments"),
    depth: { enable: false }
    // viewport: regl.prop("viewport")
  })
}

export default {
  drawCircle,
  drawPoints,
  drawEdges
}
