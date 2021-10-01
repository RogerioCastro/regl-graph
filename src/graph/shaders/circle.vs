precision mediump float;

attribute vec2 circlePoint;

uniform float size;
uniform vec3 position;
uniform mat3 transform;
uniform mat3 projection;
uniform float zoom;

void main () {

  float circleSize = size * (0.5 * (exp(log(zoom) * -0.5)));

  vec2 xy = vec2(position.xy) + circlePoint * (circleSize * 1.5);
  vec3 final = projection * transform * vec3(xy, 1);

  gl_Position = vec4(final.xy, 0, 1.0);
}
