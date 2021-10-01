precision highp float;

attribute vec2 position;
// esses pontos são vc3 porque levam o índice do nó no z
attribute vec3 pointA, pointB;

uniform mat3 transform;
uniform mat3 projection;
uniform float zoom;
uniform float stageWidth;
uniform float stageHeight;
uniform float width;
uniform float hovered;
uniform float selected;
uniform vec4 color;

varying vec4 edgeColor;

void main() {
  edgeColor = color;
  vec2 xyPointA = vec2(pointA.xy);
  vec2 xyPointB = vec2(pointB.xy);
  vec2 xBasis = xyPointB - xyPointA;
  vec2 yBasis = normalize(vec2(-xBasis.y, xBasis.x));
  vec2 point = xyPointA + xBasis * position.x + yBasis * width * position.y;
  vec3 final = projection * transform * vec3(point, 1);
  gl_Position = vec4(final.xy, 0, 1);
  if (selected != -1.0 && pointA.z != selected && pointB.z != selected) edgeColor.a = 0.0;
  if (hovered != -1.0 && pointA.z != hovered && pointB.z != hovered) edgeColor.a = 0.0;
  if (pointA.z == hovered || pointB.z == hovered) edgeColor.a = 1.0;
  if (hovered == -1.0 && (pointA.z == selected || pointB.z == selected)) edgeColor.a = 1.0;
}
