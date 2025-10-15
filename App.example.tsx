import React, { useEffect, useState } from 'react';
import { View, Text, StyleSheet, ScrollView, Alert } from 'react-native';
import { StatusBar } from 'expo-status-bar';
import { initializeApp } from './src/config';
import AdMobBanner from './src/components/AdMobBanner';
import { DragDropList, ExampleItem } from './src/components/DragDropList';

export default function App() {
  const [isInitialized, setIsInitialized] = useState(false);
  const [fcmToken, setFcmToken] = useState<string | null>(null);

  useEffect(() => {
    // Initialize all services
    const initServices = async () => {
      try {
        const result = await initializeApp();
        if (result.success) {
          setIsInitialized(true);
          console.log('All services initialized successfully');
        } else {
          console.error('Failed to initialize services:', result.error);
        }
      } catch (error) {
        console.error('Error initializing services:', error);
      }
    };

    initServices();
  }, []);

  // Example data for drag and drop
  const [dragData, setDragData] = useState<ExampleItem[]>([
    { id: '1', title: 'Task 1', description: 'Complete project setup' },
    { id: '2', title: 'Task 2', description: 'Test FCM notifications' },
    { id: '3', title: 'Task 3', description: 'Test AdMob integration' },
    { id: '4', title: 'Task 4', description: 'Test drag and drop' },
  ]);

  const renderDragItem = ({ item, drag, isActive }: any) => (
    <View style={[styles.dragItem, isActive && styles.activeDragItem]}>
      <Text style={styles.dragTitle}>{item.title}</Text>
      <Text style={styles.dragDescription}>{item.description}</Text>
    </View>
  );

  if (!isInitialized) {
    return (
      <View style={styles.container}>
        <Text style={styles.loadingText}>Initializing services...</Text>
      </View>
    );
  }

  return (
    <View style={styles.container}>
      <StatusBar style="auto" />
      
      <ScrollView style={styles.scrollView}>
        <Text style={styles.title}>Roomies App</Text>
        <Text style={styles.subtitle}>Development Build with FCM, AdMob & Drag & Drop</Text>
        
        {/* AdMob Banner */}
        <View style={styles.section}>
          <Text style={styles.sectionTitle}>AdMob Banner</Text>
          <AdMobBanner />
        </View>
        
        {/* Drag & Drop List */}
        <View style={styles.section}>
          <Text style={styles.sectionTitle}>Drag & Drop Tasks</Text>
          <Text style={styles.sectionDescription}>
            Long press and drag items to reorder
          </Text>
          <DragDropList
            data={dragData}
            onDragEnd={setDragData}
            renderItem={renderDragItem}
            keyExtractor={(item) => item.id}
          />
        </View>
        
        {/* Status */}
        <View style={styles.section}>
          <Text style={styles.sectionTitle}>Status</Text>
          <Text style={styles.statusText}>
            ✅ Firebase/FCM: {isInitialized ? 'Initialized' : 'Not initialized'}
          </Text>
          <Text style={styles.statusText}>
            ✅ AdMob: {isInitialized ? 'Initialized' : 'Not initialized'}
          </Text>
          <Text style={styles.statusText}>
            ✅ Reanimated: {isInitialized ? 'Initialized' : 'Not initialized'}
          </Text>
        </View>
      </ScrollView>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#fff',
  },
  scrollView: {
    flex: 1,
    padding: 16,
  },
  loadingText: {
    fontSize: 18,
    textAlign: 'center',
    marginTop: 50,
  },
  title: {
    fontSize: 24,
    fontWeight: 'bold',
    textAlign: 'center',
    marginBottom: 8,
  },
  subtitle: {
    fontSize: 16,
    textAlign: 'center',
    color: '#666',
    marginBottom: 24,
  },
  section: {
    marginBottom: 24,
  },
  sectionTitle: {
    fontSize: 18,
    fontWeight: 'bold',
    marginBottom: 8,
  },
  sectionDescription: {
    fontSize: 14,
    color: '#666',
    marginBottom: 12,
  },
  dragItem: {
    backgroundColor: '#f0f0f0',
    padding: 16,
    marginVertical: 4,
    borderRadius: 8,
  },
  activeDragItem: {
    backgroundColor: '#e0e0e0',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.25,
    shadowRadius: 4,
    elevation: 5,
  },
  dragTitle: {
    fontSize: 16,
    fontWeight: 'bold',
    marginBottom: 4,
  },
  dragDescription: {
    fontSize: 14,
    color: '#666',
  },
  statusText: {
    fontSize: 14,
    marginBottom: 4,
  },
});