import React from 'react';
import { View, Text, StyleSheet } from 'react-native';
import DraggableFlatList, {
  RenderItemParams,
  ScaleDecorator,
} from 'react-native-draggable-flatlist';
import { Gesture, GestureDetector } from 'react-native-gesture-handler';
import Animated, {
  useSharedValue,
  useAnimatedStyle,
  withSpring,
  runOnJS,
} from 'react-native-reanimated';

interface DragDropListProps<T> {
  data: T[];
  onDragEnd: (data: T[]) => void;
  renderItem: (params: RenderItemParams<T>) => React.ReactElement;
  keyExtractor: (item: T, index: number) => string;
}

export function DragDropList<T>({
  data,
  onDragEnd,
  renderItem,
  keyExtractor,
}: DragDropListProps<T>) {
  const scale = useSharedValue(1);

  const animatedStyle = useAnimatedStyle(() => ({
    transform: [{ scale: scale.value }],
  }));

  const longPressGesture = Gesture.LongPress()
    .onStart(() => {
      scale.value = withSpring(1.05);
    })
    .onEnd(() => {
      scale.value = withSpring(1);
    });

  const renderItemWithGesture = (params: RenderItemParams<T>) => {
    return (
      <ScaleDecorator>
        <GestureDetector gesture={longPressGesture}>
          <Animated.View style={animatedStyle}>
            {renderItem(params)}
          </Animated.View>
        </GestureDetector>
      </ScaleDecorator>
    );
  };

  return (
    <DraggableFlatList
      data={data}
      onDragEnd={({ data: newData }) => onDragEnd(newData)}
      keyExtractor={keyExtractor}
      renderItem={renderItemWithGesture}
      style={styles.container}
    />
  );
}

// Example usage component
export interface ExampleItem {
  id: string;
  title: string;
  description: string;
}

export const ExampleDragDropList: React.FC = () => {
  const [data, setData] = React.useState<ExampleItem[]>([
    { id: '1', title: 'Item 1', description: 'Description 1' },
    { id: '2', title: 'Item 2', description: 'Description 2' },
    { id: '3', title: 'Item 3', description: 'Description 3' },
  ]);

  const renderItem = ({ item, drag, isActive }: RenderItemParams<ExampleItem>) => (
    <View style={[styles.item, isActive && styles.activeItem]}>
      <Text style={styles.title}>{item.title}</Text>
      <Text style={styles.description}>{item.description}</Text>
    </View>
  );

  return (
    <DragDropList
      data={data}
      onDragEnd={setData}
      renderItem={renderItem}
      keyExtractor={(item) => item.id}
    />
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
  },
  item: {
    backgroundColor: '#f0f0f0',
    padding: 16,
    marginVertical: 4,
    marginHorizontal: 16,
    borderRadius: 8,
  },
  activeItem: {
    backgroundColor: '#e0e0e0',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.25,
    shadowRadius: 4,
    elevation: 5,
  },
  title: {
    fontSize: 16,
    fontWeight: 'bold',
    marginBottom: 4,
  },
  description: {
    fontSize: 14,
    color: '#666',
  },
});
