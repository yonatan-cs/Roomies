import React from 'react';
import { Modal, View, Text, Pressable, Platform } from 'react-native';
import { useThemedStyles } from '../theme/useThemedStyles';
import { ThemedText } from '../theme/components/ThemedText';
import { ThemedView } from '../theme/components/ThemedView';
import { useTranslation } from 'react-i18next';

interface AlertButton {
  text: string;
  onPress?: () => void;
  style?: 'default' | 'cancel' | 'destructive';
}

interface ThemedAlertProps {
  visible: boolean;
  title: string;
  message?: string;
  buttons?: AlertButton[];
  onDismiss?: () => void;
}

/**
 * A themed alert component that adapts to dark mode and RTL
 * Replacement for React Native's Alert.alert()
 */
export function ThemedAlert({ 
  visible, 
  title, 
  message, 
  buttons = [], 
  onDismiss 
}: ThemedAlertProps) {
  const { t } = useTranslation();
  const themed = useThemedStyles(tk => ({
    overlay: { backgroundColor: 'rgba(0, 0, 0, 0.5)' },
    container: { 
      backgroundColor: tk.colors.card,
      borderColor: tk.colors.border.primary,
    },
    titleText: { color: tk.colors.text.primary },
    messageText: { color: tk.colors.text.secondary },
    buttonBorder: { borderColor: tk.colors.border.primary },
    defaultButton: { color: tk.colors.primary },
    cancelButton: { color: tk.colors.text.secondary },
    destructiveButton: { color: tk.colors.status.error },
  }));

  // Default button if none provided
  const alertButtons = buttons.length > 0 ? buttons : [
    { text: t('common.ok'), style: 'default' as const }
  ];

  const handleButtonPress = (button: AlertButton) => {
    button.onPress?.();
    onDismiss?.();
  };

  return (
    <Modal
      transparent
      visible={visible}
      animationType="fade"
      onRequestClose={onDismiss}
    >
      <View 
        style={[
          themed.overlay,
          { 
            flex: 1, 
            justifyContent: 'center', 
            alignItems: 'center',
            padding: 20,
          }
        ]}
      >
        <Pressable 
          style={{ position: 'absolute', top: 0, left: 0, right: 0, bottom: 0 }}
          onPress={onDismiss}
        />
        
        <View 
          style={[
            themed.container,
            {
              width: '100%',
              maxWidth: 320,
              borderRadius: 16,
              borderWidth: 1,
              padding: 20,
              shadowColor: '#000',
              shadowOffset: { width: 0, height: 4 },
              shadowOpacity: 0.3,
              shadowRadius: 8,
              elevation: 8,
            }
          ]}
        >
          {/* Title */}
          <ThemedText 
            style={[
              themed.titleText,
              { 
                fontSize: 18, 
                fontWeight: '600',
                marginBottom: message ? 12 : 20,
                textAlign: 'center',
              }
            ]}
          >
            {title}
          </ThemedText>

          {/* Message */}
          {message && (
            <ThemedText 
              style={[
                themed.messageText,
                { 
                  fontSize: 15, 
                  lineHeight: 22,
                  marginBottom: 20,
                  textAlign: 'center',
                }
              ]}
            >
              {message}
            </ThemedText>
          )}

          {/* Buttons */}
          <View style={{ gap: 8 }}>
            {alertButtons.map((button, index) => {
              const isLast = index === alertButtons.length - 1;
              const buttonColor = 
                button.style === 'destructive' ? themed.destructiveButton.color :
                button.style === 'cancel' ? themed.cancelButton.color :
                themed.defaultButton.color;

              return (
                <Pressable
                  key={index}
                  onPress={() => handleButtonPress(button)}
                  style={({ pressed }) => [
                    {
                      paddingVertical: 12,
                      paddingHorizontal: 16,
                      borderRadius: 10,
                      backgroundColor: pressed 
                        ? (button.style === 'destructive' 
                          ? 'rgba(239, 68, 68, 0.1)' 
                          : 'rgba(59, 130, 246, 0.1)')
                        : 'transparent',
                    },
                    !isLast && { 
                      borderBottomWidth: 1, 
                      ...themed.buttonBorder 
                    },
                  ]}
                >
                  <Text
                    style={{
                      color: buttonColor,
                      fontSize: 16,
                      fontWeight: button.style === 'cancel' ? '400' : '600',
                      textAlign: 'center',
                    }}
                  >
                    {button.text}
                  </Text>
                </Pressable>
              );
            })}
          </View>
        </View>
      </View>
    </Modal>
  );
}

/**
 * Imperative API similar to Alert.alert()
 * Usage: showThemedAlert('Title', 'Message', [{ text: 'OK', onPress: () => {} }])
 */
let alertQueue: Array<{
  title: string;
  message?: string;
  buttons?: AlertButton[];
  resolve: () => void;
}> = [];

let currentAlertResolver: (() => void) | null = null;
let alertVisible = false;
let setAlertState: ((state: any) => void) | null = null;

export function showThemedAlert(
  title: string,
  message?: string,
  buttons?: AlertButton[]
): Promise<void> {
  return new Promise((resolve) => {
    alertQueue.push({ title, message, buttons, resolve });
    processAlertQueue();
  });
}

function processAlertQueue() {
  if (alertQueue.length === 0 || alertVisible) {
    return;
  }

  const alert = alertQueue.shift()!;
  currentAlertResolver = alert.resolve;
  alertVisible = true;

  if (setAlertState) {
    setAlertState({
      visible: true,
      title: alert.title,
      message: alert.message,
      buttons: alert.buttons,
    });
  }
}

function dismissCurrentAlert() {
  alertVisible = false;
  if (currentAlertResolver) {
    currentAlertResolver();
    currentAlertResolver = null;
  }
  
  if (setAlertState) {
    setAlertState({
      visible: false,
      title: '',
      message: '',
      buttons: [],
    });
  }

  // Process next alert in queue
  setTimeout(processAlertQueue, 300);
}

/**
 * Alert Provider Component - Add this to your App root
 */
export function ThemedAlertProvider({ children }: { children: React.ReactNode }) {
  const [alertState, _setAlertState] = React.useState({
    visible: false,
    title: '',
    message: '',
    buttons: [] as AlertButton[],
  });

  React.useEffect(() => {
    setAlertState = _setAlertState;
    return () => {
      setAlertState = null;
    };
  }, []);

  return (
    <>
      {children}
      <ThemedAlert
        visible={alertState.visible}
        title={alertState.title}
        message={alertState.message}
        buttons={alertState.buttons}
        onDismiss={dismissCurrentAlert}
      />
    </>
  );
}

