const path = require('path');
const HtmlWebpackPlugin = require('html-webpack-plugin');

module.exports = {
  entry: {
    'regl-graph': {
      import: './src/graph/graph.js',
      filename: '[name].min.js',
      publicPath: path.resolve(__dirname, 'dist'),
      library: {
        name: 'ReglGraph',
        type: 'umd',
        export: 'default'
      }
    },
    index: {
      dependOn: 'regl-graph',
      import: './src/index.js',
      filename: '[name].min.js',
      publicPath: path.resolve(__dirname, 'dist')
    }
  },
  plugins: [
    new HtmlWebpackPlugin({
      title: 'Regl Graph',
    }),
  ],
  /* output: {
    filename: '[name].min.js',
    path: path.resolve(__dirname, 'dist'),
    library: {
      name: 'ReglGraph',
      type: 'umd',
      export: 'default'
    },
    clean: false
  }, */
  /* optimization: {
    splitChunks: {
      chunks: 'all',
    },
  }, */
  module: {
    rules: [
      {
        test: /\.s[ac]ss$/i,
        use: [
          // Creates `style` nodes from JS strings
          "style-loader",
          // Translates CSS into CommonJS
          "css-loader",
          // Compiles Sass to CSS
          "sass-loader",
        ],
      },
      {
        test: /\.css$/i,
        use: ['style-loader', 'css-loader'],
      },
      {
        test: /\.(png|svg|jpg|jpeg|gif)$/i,
        type: 'asset/resource',
      },
      {
        test: /\.glsl$|\.vs$|\.fs$/,
        use: 'webpack-glsl-loader'
      }
    ],
  }
};
