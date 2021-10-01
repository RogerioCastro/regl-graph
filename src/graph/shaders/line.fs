precision mediump float;
uniform vec4 color;

void main () {
  float alpha = 0.1;
  gl_FragColor = color * alpha;
}
