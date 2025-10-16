/**
 * Expo config plugin to add modular headers support for Firebase and Google pods
 * This fixes the CocoaPods issue with Swift pods that don't define modules
 */

const { withDangerousMod } = require('@expo/config-plugins');
const fs = require('fs');
const path = require('path');

const withModularHeaders = (config) => {
  return withDangerousMod(config, [
    'ios',
    async (config) => {
      const podfilePath = path.join(config.modRequest.platformProjectRoot, 'Podfile');
      
      if (!fs.existsSync(podfilePath)) {
        console.warn('Podfile not found, skipping modular headers injection');
        return config;
      }

      let podfileContent = fs.readFileSync(podfilePath, 'utf-8');

      // Check if our modifications are already present
      if (podfileContent.includes('# Fix for Firebase Swift pods')) {
        console.log('Modular headers already configured in Podfile');
        return config;
      }

      // Add use_frameworks and use_modular_headers after prepare_react_native_project!
      const marker = 'prepare_react_native_project!';
      const insertion = `
# Fix for Firebase Swift pods - use static frameworks with modular headers
use_frameworks! :linkage => :static
use_modular_headers!
`;

      if (podfileContent.includes(marker)) {
        podfileContent = podfileContent.replace(
          marker,
          marker + '\n' + insertion
        );
      }

      // Add GoogleUtilities pod with modular headers inside the target
      const targetMarker = 'target \'';
      const targetInsertion = `
  # Ensure GoogleUtilities uses modular headers
  pod 'GoogleUtilities', :modular_headers => true
`;

      // Find the first target and add the pod right after use_expo_modules!
      const expoModulesMarker = 'use_expo_modules!';
      if (podfileContent.includes(expoModulesMarker)) {
        podfileContent = podfileContent.replace(
          expoModulesMarker,
          expoModulesMarker + '\n' + targetInsertion
        );
      }

      fs.writeFileSync(podfilePath, podfileContent, 'utf-8');
      console.log('✅ Successfully added modular headers configuration to Podfile');

      return config;
    },
  ]);
};

module.exports = withModularHeaders;

