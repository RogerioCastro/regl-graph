precision mediump float;

varying vec4 edgeColor;

void main () {
  // float alpha = 1.0;
  // gl_FragColor = edgeColor * alpha;
  gl_FragColor = edgeColor;
}
