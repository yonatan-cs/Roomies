const { withXcodeProject } = require('@expo/config-plugins');

const withIosBuildFixes = (config) => {
  return withXcodeProject(config, (config) => {
    const xcodeProject = config.modResults;
    
    // Add build settings to fix compilation issues
    xcodeProject.addBuildProperty('IPHONEOS_DEPLOYMENT_TARGET', '15.1');
    xcodeProject.addBuildProperty('CLANG_WARN_QUOTED_INCLUDE_IN_FRAMEWORK_HEADER', 'NO');
    xcodeProject.addBuildProperty('CLANG_WARN_DOCUMENTATION_COMMENTS', 'NO');
    xcodeProject.addBuildProperty('GCC_WARN_INHIBIT_ALL_WARNINGS', 'YES');
    
    // Fix for react-native-ios-utilities compilation
    xcodeProject.addBuildProperty('CLANG_CXX_LANGUAGE_STANDARD', 'c++17');
    xcodeProject.addBuildProperty('CLANG_CXX_LIBRARY', 'libc++');
    
    return config;
  });
};

module.exports = withIosBuildFixes;
