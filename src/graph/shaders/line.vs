precision mediump float;
attribute vec2 position;

// uniform mat3 transform;
// uniform mat3 projection;

uniform float stageWidth;
uniform float stageHeight;

vec2 normalizeCoords(vec2 position) {
  float x = position[0];
  float y = position[1];

  return vec2(
  2.0 * ((x / stageWidth) - 0.5),
  (2.0 * ((y / stageHeight) - 0.5)));
}

void main () {
  // vec3 final =  projection * transform * vec3(position, 1);
  // gl_Position = vec4(final.xy, 0, 1);
  gl_Position = vec4(normalizeCoords(position), 0, 1);
}
