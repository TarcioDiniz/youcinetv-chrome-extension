const path = require('path');
const CopyPlugin = require('copy-webpack-plugin');

module.exports = {
  mode: 'development',
  entry: './src/application/index.ts',
  output: {
    path: path.resolve(__dirname, 'dist'),
    filename: 'bundle.js',
    publicPath: '/', // Ajuste para referência correta dos recursos no navegador
  },
  resolve: {
    extensions: ['.ts', '.js'],
    alias: {
      '@src': path.resolve(__dirname, 'src'),
    },
  },
  module: {
    rules: [
      {
        test: /\.ts$/,
        exclude: /node_modules/,
        use: {
          loader: 'babel-loader',
          options: {
            presets: [
              "@babel/preset-env",
              "@babel/preset-typescript"
            ]
          },
        },
      },
    ],
  },
  plugins: [

    new CopyPlugin({
      patterns: [
        {from: 'manifest.json', to: 'manifest.json'},
      ],
    }),
  ],
  devtool: 'source-map', // Para mapear o código-fonte durante o desenvolvimento
};
