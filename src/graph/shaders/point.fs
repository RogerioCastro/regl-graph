#ifdef GL_OES_standard_derivatives
#extension GL_OES_standard_derivatives : enable
#endif

precision mediump float;

varying vec4 nodeColor;

void main() {

  float r = 0.0, delta = 0.0, alpha = 1.0;
  vec2 cxy = 2.0 * gl_PointCoord - 1.0;
  r = dot(cxy, cxy);
  if (r > 1.0) {
      discard;
  }

  // #ifdef GL_OES_standard_derivatives
  //   delta = fwidth(r);
  //   alpha = 1.0 - smoothstep(1.0 - delta, 1.0 + delta, r);
  // #endif
  delta = fwidth(r);
  alpha = 1.0 - smoothstep(1.0 - delta, 1.0 + delta, r);

  // gl_FragColor = nodeColor * alpha;
  gl_FragColor = vec4( nodeColor.rgb, nodeColor.a * alpha );
  // gl_FragColor.rgb *= gl_FragColor.a;
}
