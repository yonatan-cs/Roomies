import React, { useState } from 'react';
import { View, Pressable, LayoutAnimation, Platform, UIManager } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { ThemedText } from '../theme/components/ThemedText';
import { useThemedStyles } from '../theme/useThemedStyles';
import { useIsRTL } from '../hooks/useIsRTL';
import { selection } from '../utils/haptics';
import { cn } from '../utils/cn';

// Enable LayoutAnimation on Android
if (Platform.OS === 'android' && UIManager.setLayoutAnimationEnabledExperimental) {
  UIManager.setLayoutAnimationEnabledExperimental(true);
}

interface AccordionProps {
  title: string;
  icon?: keyof typeof Ionicons.glyphMap;
  children: React.ReactNode;
  defaultExpanded?: boolean;
  onToggle?: (isExpanded: boolean) => void;
}

/**
 * Accordion component for collapsible content sections
 * Commonly known as Accordion or Expansion Panel in design systems
 * iOS also refers to this pattern as "Disclosure"
 */
export function Accordion({ 
  title, 
  icon, 
  children, 
  defaultExpanded = false,
  onToggle 
}: AccordionProps) {
  const [isExpanded, setIsExpanded] = useState(defaultExpanded);
  const isRTL = useIsRTL();
  const themed = useThemedStyles(tk => ({
    textPrimary: { color: tk.colors.text.primary },
    borderColor: { borderColor: tk.colors.border.primary },
  }));

  const handleToggle = () => {
    // Configure smooth animation
    LayoutAnimation.configureNext(
      LayoutAnimation.create(
        300,
        LayoutAnimation.Types.easeInEaseOut,
        LayoutAnimation.Properties.opacity
      )
    );
    
    selection(); // Haptic feedback
    const newExpandedState = !isExpanded;
    setIsExpanded(newExpandedState);
    onToggle?.(newExpandedState);
  };

  return (
    <View>
      {/* Accordion Header */}
      <Pressable
        onPress={handleToggle}
        className="items-center mb"
        style={{
          flexDirection: isRTL ? 'row-reverse' : 'row',
          alignItems: 'center',
          justifyContent: 'space-between'
        }}
      >
        <View
          className="items-center flex-1"
          style={{
            flexDirection: isRTL ? 'row-reverse' : 'row',
            alignItems: 'center'
          }}
        >
          {icon && (
            <Ionicons 
              name={icon} 
              size={20} 
              color="#6b7280" 
              style={isRTL ? { marginLeft: 8 } : { marginRight: 8 }}
            />
          )}
          <ThemedText className="text-lg font-semibold flex-1">{title}</ThemedText>
        </View>
        
        {/* Chevron indicator */}
        <Ionicons
          name={isExpanded ? 'chevron-up' : 'chevron-down'}
          size={20}
          color="#6b7280"
          style={{
            transform: [{ rotate: isRTL ? '0deg' : '0deg' }]
          }}
        />
      </Pressable>

      {/* Accordion Content */}
      {isExpanded && (
        <View>
          {children}
        </View>
      )}
    </View>
  );
}

