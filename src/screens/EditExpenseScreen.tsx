import React, { useState, useEffect } from 'react';
import {
  View,
  Text,
  TextInput,
  Pressable,
  ScrollView,
  Alert,
  KeyboardAvoidingView,
  Platform,
  TouchableWithoutFeedback,
  Keyboard
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useNavigation, useRoute } from '@react-navigation/native';
import { useStore } from '../state/store';
import { ExpenseCategory, Expense } from '../types';
import { cn } from '../utils/cn';

const CATEGORIES: { key: ExpenseCategory; label: string; icon: keyof typeof Ionicons.glyphMap }[] = [
  { key: 'groceries', label: 'מכולת', icon: 'basket-outline' },
  { key: 'utilities', label: 'שירותים', icon: 'flash-outline' },
  { key: 'rent', label: 'שכירות', icon: 'home-outline' },
  { key: 'cleaning', label: 'ניקיון', icon: 'brush-outline' },
  { key: 'internet', label: 'אינטרנט', icon: 'wifi-outline' },
  { key: 'other', label: 'אחר', icon: 'ellipsis-horizontal-outline' }
];

type RouteParams = {
  expenseId: string;
};

export default function EditExpenseScreen() {
  const navigation = useNavigation();
  const route = useRoute();
  const { expenseId } = route.params as RouteParams;
  
  const { currentUser, currentApartment, expenses, updateExpense } = useStore();

  const [title, setTitle] = useState('');
  const [amount, setAmount] = useState('');
  const [category, setCategory] = useState<ExpenseCategory>('groceries');
  const [description, setDescription] = useState('');
  const [selectedParticipants, setSelectedParticipants] = useState<string[]>([]);
  const [loading, setLoading] = useState(false);
  const [showImpactPreview, setShowImpactPreview] = useState(false);

  // Find the expense to edit
  const expense = expenses.find(e => e.id === expenseId);

  useEffect(() => {
    if (expense) {
      setTitle(expense.title);
      setAmount(expense.amount.toString());
      setCategory(expense.category);
      setDescription(expense.description || '');
      setSelectedParticipants(expense.participants);
    }
  }, [expense]);

  const handleUpdateExpense = async () => {
    if (!title.trim()) {
      Alert.alert('שגיאה', 'אנא הכנס שם להוצאה');
      return;
    }

    const numAmount = parseFloat(amount);
    if (!numAmount || numAmount <= 0) {
      Alert.alert('שגיאה', 'אנא הכנס סכום תקין');
      return;
    }

    if (selectedParticipants.length === 0) {
      Alert.alert('שגיאה', 'אנא בחר לפחות משתתף אחד');
      return;
    }

    if (!currentUser) {
      Alert.alert('שגיאה', 'משתמש לא מחובר');
      return;
    }

    // Check if there are significant changes that might affect balances
    const originalAmount = expense?.amount || 0;
    const originalParticipants = expense?.participants || [];
    const amountChanged = Math.abs(numAmount - originalAmount) > 0.01;
    const participantsChanged = 
      selectedParticipants.length !== originalParticipants.length ||
      !selectedParticipants.every(id => originalParticipants.includes(id));

    if (amountChanged || participantsChanged) {
      const changePercentage = originalAmount > 0 ? Math.abs((numAmount - originalAmount) / originalAmount) * 100 : 0;
      
      if (changePercentage > 50) {
        Alert.alert(
          'שינוי משמעותי',
          `השינוי בסכום הוא ${changePercentage.toFixed(0)}%. האם אתה בטוח שברצונך להמשיך?`,
          [
            { text: 'ביטול', style: 'cancel' },
            { text: 'המשך', onPress: () => performUpdate() }
          ]
        );
        return;
      }
      
      // Show impact preview for any changes
      setShowImpactPreview(true);
      return;
    }

    await performUpdate();
  };

  const calculateImpact = () => {
    if (!expense || !currentApartment) return null;

    const numAmount = parseFloat(amount);
    const originalAmount = expense.amount;
    const originalParticipants = expense.participants;
    
    const originalShare = originalAmount / originalParticipants.length;
    const newShare = numAmount / selectedParticipants.length;
    
    const impact = currentApartment.members.map(member => {
      const wasParticipant = originalParticipants.includes(member.id);
      const isParticipant = selectedParticipants.includes(member.id);
      const isPayer = expense.paidBy === member.id;
      
      let change = 0;
      let description = '';
      
      if (isPayer) {
        // The payer's change is the difference in total amount
        change = numAmount - originalAmount;
        description = change > 0 ? `תשלם יותר ${Math.abs(change).toFixed(2)} ₪` : 
                     change < 0 ? `תשלם פחות ${Math.abs(change).toFixed(2)} ₪` : 
                     'אין שינוי';
      } else if (wasParticipant && isParticipant) {
        // Participant in both - change in their share
        change = newShare - originalShare;
        description = change > 0 ? `ישלם יותר ${Math.abs(change).toFixed(2)} ₪` : 
                     change < 0 ? `ישלם פחות ${Math.abs(change).toFixed(2)} ₪` : 
                     'אין שינוי';
      } else if (!wasParticipant && isParticipant) {
        // New participant
        change = newShare;
        description = `ישלם ${change.toFixed(2)} ₪ (חדש)`;
      } else if (wasParticipant && !isParticipant) {
        // No longer participant
        change = -originalShare;
        description = `לא ישלם יותר (חסכון של ${Math.abs(change).toFixed(2)} ₪)`;
      }
      
      return {
        member,
        change,
        description,
        wasParticipant,
        isParticipant,
        isPayer
      };
    }).filter(impact => impact.change !== 0 || impact.wasParticipant !== impact.isParticipant);
    
    return impact;
  };

  const performUpdate = async () => {
    const numAmount = parseFloat(amount);
    setLoading(true);
    try {
      await updateExpense(expenseId, {
        title: title.trim(),
        amount: numAmount,
        participants: selectedParticipants,
        category,
        description: description.trim() || undefined,
      });

      Alert.alert('הצלחה', 'ההוצאה עודכנה בהצלחה', [
        { text: 'אישור', onPress: () => navigation.goBack() }
      ]);
    } catch (error) {
      Alert.alert('שגיאה', 'לא ניתן לעדכן את ההוצאה');
      console.error('Error updating expense:', error);
    } finally {
      setLoading(false);
    }
  };

  const toggleParticipant = (userId: string) => {
    setSelectedParticipants(prev => 
      prev.includes(userId) 
        ? prev.filter(id => id !== userId)
        : [...prev, userId]
    );
  };

  const selectAllParticipants = () => {
    if (!currentApartment) return;
    setSelectedParticipants(currentApartment.members.map(m => m.id));
  };

  const clearAllParticipants = () => {
    setSelectedParticipants([]);
  };

  if (!currentUser || !currentApartment) {
    return (
      <View className="flex-1 bg-white justify-center items-center">
        <Text className="text-gray-500">טוען...</Text>
      </View>
    );
  }

  if (!expense) {
    return (
      <View className="flex-1 bg-white justify-center items-center">
        <Text className="text-gray-500">ההוצאה לא נמצאה</Text>
      </View>
    );
  }

  const amountPerPerson = selectedParticipants.length > 0 
    ? parseFloat(amount) / selectedParticipants.length 
    : 0;

  return (
    <KeyboardAvoidingView 
      className="flex-1 bg-white" 
      behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
    >
      <TouchableWithoutFeedback onPress={Keyboard.dismiss}>
        <ScrollView className="flex-1 px-6 py-6">
          {/* Header */}
          <View className="flex-row items-center justify-between mb-6">
            <Pressable
              onPress={() => navigation.goBack()}
              className="w-10 h-10 rounded-full items-center justify-center bg-gray-100"
            >
              <Ionicons name="arrow-forward" size={24} color="#374151" />
            </Pressable>
            
            <Text className="text-xl font-bold text-gray-900">
              עריכת הוצאה
            </Text>
            
            <View className="w-10" />
          </View>

          {/* Title */}
          <View className="mb-6">
            <Text className="text-gray-700 text-base mb-2 font-medium">
              שם ההוצאה *
            </Text>
            <TextInput
              value={title}
              onChangeText={setTitle}
              placeholder="למשל: קניות בסופר"
              className="border border-gray-300 rounded-xl px-4 py-3 text-base"
              textAlign="right"
            />
          </View>

          {/* Amount */}
          <View className="mb-6">
            <Text className="text-gray-700 text-base mb-2 font-medium">
              סכום *
            </Text>
            <View className="flex-row items-center">
              <TextInput
                value={amount}
                onChangeText={setAmount}
                placeholder="0"
                className="flex-1 border border-gray-300 rounded-xl px-4 py-3 text-base"
                keyboardType="numeric"
                textAlign="center"
              />
              <Text className="text-gray-700 text-lg mr-3">₪</Text>
            </View>
            {selectedParticipants.length > 0 && parseFloat(amount) > 0 && (
              <Text className="text-sm text-gray-500 mt-2 text-center">
                {amountPerPerson.toFixed(2)}₪ לכל אחד
              </Text>
            )}
          </View>

          {/* Category */}
          <View className="mb-6">
            <Text className="text-gray-700 text-base mb-3 font-medium">
              קטגוריה
            </Text>
            <View className="flex-row flex-wrap gap-2">
              {CATEGORIES.map((cat) => (
                <Pressable
                  key={cat.key}
                  onPress={() => setCategory(cat.key)}
                  className={cn(
                    "flex-row items-center px-3 py-2 rounded-lg border",
                    category === cat.key
                      ? "bg-blue-100 border-blue-300"
                      : "bg-gray-50 border-gray-200"
                  )}
                >
                  <Ionicons 
                    name={cat.icon} 
                    size={16} 
                    color={category === cat.key ? "#3b82f6" : "#6b7280"} 
                  />
                  <Text className={cn(
                    "mr-2 text-sm font-medium",
                    category === cat.key ? "text-blue-700" : "text-gray-700"
                  )}>
                    {cat.label}
                  </Text>
                </Pressable>
              ))}
            </View>
          </View>

          {/* Participants */}
          <View className="mb-6">
            <View className="flex-row items-center justify-between mb-3">
              <Text className="text-gray-700 text-base font-medium">
                משתתפים *
              </Text>
              <View className="flex-row">
                <Pressable
                  onPress={selectAllParticipants}
                  className="bg-blue-100 py-1 px-3 rounded-lg mr-2"
                >
                  <Text className="text-blue-700 text-sm">בחר הכל</Text>
                </Pressable>
                <Pressable
                  onPress={clearAllParticipants}
                  className="bg-gray-100 py-1 px-3 rounded-lg"
                >
                  <Text className="text-gray-700 text-sm">נקה הכל</Text>
                </Pressable>
              </View>
            </View>
            
            <View className="space-y-2">
              {currentApartment.members.map((member) => (
                <Pressable
                  key={member.id}
                  onPress={() => toggleParticipant(member.id)}
                  className={cn(
                    "flex-row items-center justify-between p-3 rounded-xl border",
                    selectedParticipants.includes(member.id)
                      ? "bg-blue-50 border-blue-200"
                      : "bg-gray-50 border-gray-200"
                  )}
                >
                  <Text className={cn(
                    "font-medium",
                    selectedParticipants.includes(member.id)
                      ? "text-blue-700"
                      : "text-gray-700"
                  )}>
                    {member.name} {member.id === currentUser?.id && '(אתה)'}
                  </Text>
                  
                  <View className={cn(
                    "w-5 h-5 rounded-full border-2 items-center justify-center",
                    selectedParticipants.includes(member.id)
                      ? "bg-blue-500 border-blue-500"
                      : "border-gray-300"
                  )}>
                    {selectedParticipants.includes(member.id) && (
                      <Ionicons name="checkmark" size={12} color="white" />
                    )}
                  </View>
                </Pressable>
              ))}
            </View>
          </View>

          {/* Description */}
          <View className="mb-8">
            <Text className="text-gray-700 text-base mb-2 font-medium">
              תיאור (אופציונלי)
            </Text>
            <TextInput
              value={description}
              onChangeText={setDescription}
              placeholder="פרטים נוספים..."
              className="border border-gray-300 rounded-xl px-4 py-3 text-base"
              textAlign="right"
              multiline
              numberOfLines={3}
            />
          </View>

          {/* Impact Preview */}
          {showImpactPreview && (
            <View className="mb-6 p-4 bg-yellow-50 border border-yellow-200 rounded-xl">
              <Text className="text-yellow-800 text-base font-semibold mb-3">
                השפעת השינויים:
              </Text>
              {calculateImpact()?.map((impact, index) => (
                <View key={index} className="flex-row items-center justify-between mb-2">
                  <Text className="text-yellow-700 text-sm flex-1">
                    {impact.member.name}:
                  </Text>
                  <Text className={cn(
                    "text-sm font-medium",
                    impact.change > 0 ? "text-red-600" : 
                    impact.change < 0 ? "text-green-600" : "text-gray-600"
                  )}>
                    {impact.description}
                  </Text>
                </View>
              ))}
              <View className="flex-row mt-3">
                <Pressable
                  onPress={() => setShowImpactPreview(false)}
                  className="flex-1 bg-yellow-200 py-2 px-4 rounded-lg mr-2"
                >
                  <Text className="text-yellow-800 text-center font-medium">ביטול</Text>
                </Pressable>
                <Pressable
                  onPress={() => {
                    setShowImpactPreview(false);
                    performUpdate();
                  }}
                  className="flex-1 bg-green-500 py-2 px-4 rounded-lg"
                >
                  <Text className="text-white text-center font-medium">אשר שינויים</Text>
                </Pressable>
              </View>
            </View>
          )}

          {/* Update Button */}
          <Pressable
            onPress={handleUpdateExpense}
            disabled={loading || showImpactPreview}
            className={cn(
              "py-4 px-6 rounded-xl mb-6",
              loading || showImpactPreview ? "bg-gray-300" : "bg-blue-500"
            )}
          >
            <Text className={cn(
              "text-lg font-semibold text-center",
              loading || showImpactPreview ? "text-gray-500" : "text-white"
            )}>
              {loading ? 'מעדכן...' : 'עדכן הוצאה'}
            </Text>
          </Pressable>

          {/* Cancel Button */}
          <Pressable
            onPress={() => navigation.goBack()}
            disabled={loading}
            className="py-3"
          >
            <Text className="text-gray-500 text-center">
              ביטול
            </Text>
          </Pressable>
        </ScrollView>
      </TouchableWithoutFeedback>
    </KeyboardAvoidingView>
  );
}
