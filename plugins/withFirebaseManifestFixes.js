const { withAndroidManifest } = require('@expo/config-plugins');

const withFirebaseManifestFixes = (config) => {
  return withAndroidManifest(config, (config) => {
    const androidManifest = config.modResults;
    
    // Find the application element
    const application = androidManifest.manifest.application?.[0];
    if (!application) {
      return config;
    }

    // Ensure meta-data array exists
    if (!application['meta-data']) {
      application['meta-data'] = [];
    }

    // Find and update Firebase messaging meta-data elements
    application['meta-data'].forEach((metaData) => {
      if (metaData.$ && metaData.$['android:name']) {
        const name = metaData.$['android:name'];
        
        if (name === 'com.google.firebase.messaging.default_notification_color') {
          // Add tools:replace attribute
          if (!metaData.$['tools:replace']) {
            metaData.$['tools:replace'] = 'android:resource';
          }
        }
        
        if (name === 'com.google.firebase.messaging.default_notification_icon') {
          // Add tools:replace attribute
          if (!metaData.$['tools:replace']) {
            metaData.$['tools:replace'] = 'android:resource';
          }
        }
      }
    });

    return config;
  });
};

module.exports = withFirebaseManifestFixes;
