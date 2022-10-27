precision mediump float;

attribute vec3 position;
attribute vec4 color;
attribute float size;

uniform mat3 transform;
uniform mat3 projection;
uniform float stageWidth;
uniform float stageHeight;
uniform float zoom;
uniform float hovered;
uniform bool highlighted;

varying vec4 nodeColor;

void main () {
  nodeColor = color;
  vec3 final = projection * transform * vec3(position.xy, 1);
  gl_Position = vec4(final.xy, 0, 1.0);
  gl_PointSize = size * (exp(log2(zoom) * 0.5));
  if (highlighted) nodeColor.a = 0.2;
  if (hovered != -1. && position.z != hovered) nodeColor.a = 0.2;
}
