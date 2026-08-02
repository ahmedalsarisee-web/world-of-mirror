const {getDefaultConfig} = require('expo/metro-config');
const path = require('path');

const projectRoot = __dirname;
const config = getDefaultConfig(projectRoot);

const localFunctionsDir = path.join(projectRoot, 'firebase', 'functions');
const npmFunctionsEntry = require.resolve('firebase/functions');

const {assetExts} = config.resolver;
if (!assetExts.includes('webp')) {
  config.resolver.assetExts = [...assetExts, 'webp'];
}

const defaultResolveRequest = config.resolver.resolveRequest;

config.resolver.resolveRequest = (context, moduleName, platform) => {
  if (moduleName === 'firebase/functions') {
    return {
      type: 'sourceFile',
      filePath: npmFunctionsEntry,
    };
  }

  if (defaultResolveRequest) {
    return defaultResolveRequest(context, moduleName, platform);
  }

  return context.resolveRequest(context, moduleName, platform);
};

config.resolver.blockList = [
  ...(Array.isArray(config.resolver.blockList) ? config.resolver.blockList : []),
  new RegExp(`${localFunctionsDir.replace(/[/\\]/g, '[/\\\\]')}[/\\\\].*`),
];

module.exports = config;
