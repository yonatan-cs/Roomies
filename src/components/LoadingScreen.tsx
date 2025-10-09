import React, { useEffect } from 'react';
import { View, StyleSheet } from 'react-native';
import { Image } from 'expo-image';
import { useTheme } from '../theme/ThemeProvider';
import Animated, {
  useSharedValue,
  useAnimatedStyle,
  withRepeat,
  withSequence,
  withTiming,
  Easing,
} from 'react-native-reanimated';

export function LoadingScreen() {
  const { theme } = useTheme();
  const scale = useSharedValue(1);

  useEffect(() => {
    // Heartbeat animation: scale up slightly, then back, with a pause
    scale.value = withRepeat(
      withSequence(
        withTiming(1.1, { duration: 700, easing: Easing.ease }),
        withTiming(1, { duration: 700, easing: Easing.ease }),
        withTiming(1.1, { duration: 700, easing: Easing.ease }),
        withTiming(1, { duration: 700, easing: Easing.ease }),
        withTiming(1, { duration: 1000, easing: Easing.ease }) // pause
      ),
      -1, // infinite repeat
      false
    );
  }, []);

  const animatedStyle = useAnimatedStyle(() => ({
    transform: [{ scale: scale.value }],
  }));

  return (
    <View style={[styles.container, { backgroundColor: theme.colors.background }]}>
      <Animated.View style={animatedStyle}>
        <Image
          source={require('../../assets/splash-logo.png')}
          style={styles.logo}
          contentFit="contain"
          cachePolicy="memory-disk"
          priority="high"
        />
      </Animated.View>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
  },
  logo: {
    width: 200,
    height: 200,
    marginBottom: 20,
  },
  loader: {
    marginTop: 20,
  },
  text: {
    marginTop: 16,
    fontSize: 16,
  },
});

