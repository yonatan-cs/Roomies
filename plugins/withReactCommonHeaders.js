/**
 * Expo config plugin to ensure ReactCommon headers are available to all pods
 * This fixes the "ReactCommon/RCTHost.h file not found" error
 */

const { withDangerousMod } = require('@expo/config-plugins');
const fs = require('fs');
const path = require('path');

const withReactCommonHeaders = (config) => {
  return withDangerousMod(config, [
    'ios',
    async (config) => {
      const podfilePath = path.join(config.modRequest.platformProjectRoot, 'Podfile');
      
      if (!fs.existsSync(podfilePath)) {
        console.warn('Podfile not found, skipping ReactCommon headers injection');
        return config;
      }

      let podfileContent = fs.readFileSync(podfilePath, 'utf-8');

      // Check if our modifications are already present
      if (podfileContent.includes('# Fix for ReactCommon headers')) {
        console.log('ReactCommon headers configuration already present in Podfile');
        return config;
      }

      // Add header search paths in post_install to ensure ReactCommon headers are visible
      const postInstallMarker = 'post_install do |installer|';
      const headerSearchPathsInsertion = `
    # Fix for ReactCommon headers - ensure RCTHost.h and other New Architecture headers are findable
    installer.pods_project.targets.each do |target|
      target.build_configurations.each do |config|
        # Add ReactCommon to header search paths
        config.build_settings['HEADER_SEARCH_PATHS'] ||= ['$(inherited)']
        config.build_settings['HEADER_SEARCH_PATHS'] << '$(PODS_ROOT)/../../node_modules/react-native/ReactCommon'
        config.build_settings['HEADER_SEARCH_PATHS'] << '$(PODS_ROOT)/../../node_modules/react-native/ReactCommon/react/nativemodule/core'
        config.build_settings['HEADER_SEARCH_PATHS'] << '$(PODS_ROOT)/Headers/Public/React-RCTAppDelegate'
      end
    end
`;

      if (podfileContent.includes(postInstallMarker)) {
        // Insert right after the post_install marker
        podfileContent = podfileContent.replace(
          postInstallMarker,
          postInstallMarker + '\n' + headerSearchPathsInsertion
        );
      } else {
        // If no post_install block exists, create one before the final 'end'
        const targetEndMarker = /^end\s*$/m;
        const newPostInstall = `
  post_install do |installer|
${headerSearchPathsInsertion}
  end
end`;
        podfileContent = podfileContent.replace(targetEndMarker, newPostInstall);
      }

      fs.writeFileSync(podfilePath, podfileContent, 'utf-8');
      console.log('✅ Successfully added ReactCommon header search paths to Podfile');

      return config;
    },
  ]);
};

module.exports = withReactCommonHeaders;

