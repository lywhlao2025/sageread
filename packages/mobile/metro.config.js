const path = require('path');
const { getDefaultConfig } = require('expo/metro-config');

const projectRoot = __dirname;
const workspaceRoot = path.resolve(projectRoot, '../..');

const config = getDefaultConfig(projectRoot);
config.watchFolders = [workspaceRoot];
config.resolver.nodeModulesPaths = [
  path.join(projectRoot, 'node_modules'),
  path.join(workspaceRoot, 'node_modules'),
];
config.resolver.extraNodeModules = {
  react: path.join(projectRoot, 'node_modules', 'react'),
  'react-native': path.join(projectRoot, 'node_modules', 'react-native'),
  expo: path.join(projectRoot, 'node_modules', 'expo'),
  '@babel/runtime': path.join(projectRoot, 'node_modules', '@babel/runtime'),
};
config.resolver.unstable_enableSymlinks = true;

module.exports = config;
