<div align="center">

# 🏠 **Roomies**

<p align="center">
  <img
    src="https://readme-typing-svg.demolab.com?font=Inter&size=26&pause=1200&color=%231e3a8a&center=true&vCenter=true&width=600&height=40&lines=The+Smart+Way+to+Manage+Shared+Living"
    alt="animated typing"
  />
</p>

[![Version](https://img.shields.io/badge/Version-1.0.0-blue?style=for-the-badge)](https://github.com/yonatan-cs/Roomies)
[![React Native](https://img.shields.io/badge/React%20Native-0.79.5-61DAFB?style=for-the-badge&logo=react&logoColor=white)](https://reactnative.dev/)
[![Firebase](https://img.shields.io/badge/Firebase-12.2.1-FF6B6B?style=for-the-badge&logo=firebase&logoColor=white)](https://firebase.google.com/)
[![TypeScript](https://img.shields.io/badge/TypeScript-5.8.3-007ACC?style=for-the-badge&logo=typescript&logoColor=white)](https://www.typescriptlang.org/)
[![Expo](https://img.shields.io/badge/Expo-53.0.23-000020?style=for-the-badge&logo=expo&logoColor=white)](https://expo.dev/)

### **Transform Shared Living into Seamless Harmony** ✨

*Built with cutting-edge technology for modern roommates*

> ⚠️ **License**: Not open-source. All rights reserved.  
> No copying, redistribution, or derivative works without permission.

---

## 📋 **Table of Contents**

- [🚀 Downloads](#-downloads)
- [🎯 What is Roomies?](#-what-is-roomies)
- [✨ Features](#-features)
- [🏗️ Architecture](#️-architecture)
- [🛠️ Technology Stack](#️-technology-stack)
- [🔧 Technical Overview](#-technical-overview)
- [🌍 Internationalization](#-internationalization)
- [🔒 Security & Privacy](#-security--privacy)
- [📊 Performance](#-performance)
- [🖼️ Branding & Assets](#️-branding--assets)
- [📄 License](#-license)
- [👥 Team](#-team)
- [🙏 Acknowledgments](#-acknowledgments)

---

## 🚀 **Downloads**

<div align="center">

### **Download & Install** 📱

[![Download iOS](https://img.shields.io/badge/Download-iOS-000000?style=for-the-badge&logo=apple&logoColor=white)](https://apps.apple.com/app/roomies)
[![Download Android](https://img.shields.io/badge/Download-Android-3DDC84?style=for-the-badge&logo=android&logoColor=white)](https://play.google.com/store/apps/details?id=com.yonrotem.roomies)

</div>

---

## 🎯 **What is Roomies?**

**Roomies** is a revolutionary roommate management app that transforms shared living into a seamless, organized experience. Built with cutting-edge technology and designed for modern roommates who want to live harmoniously while managing their shared responsibilities efficiently.

### 🌟 **Key Highlights**
- **Real-time synchronization** across all devices
- **Intelligent expense tracking** with automatic debt calculations
- **Smart cleaning rotation** with notifications
- **Collaborative shopping lists** with purchase tracking
- **Beautiful, intuitive UI** with dark/light mode support
- **Full Hebrew & English support** with RTL layout

---

## ✨ **Features**

<div align="center">

### 🧹 **Smart Cleaning Management**
![Cleaning](https://img.shields.io/badge/Cleaning%20Rotation-Automated-4CAF50?style=for-the-badge&logo=cleaning&logoColor=white)

- **Automatic rotation** of cleaning responsibilities
- **Real-time notifications** for upcoming cleaning tasks
- **Customizable cleaning schedules** and preferences
- **Task completion tracking** with history
- **Smart reminders** to keep everyone on track

### 💰 **Intelligent Expense Tracking**
![Expenses](https://img.shields.io/badge/Expense%20Tracking-Smart-2196F3?style=for-the-badge&logo=money&logoColor=white)

- **Automatic debt calculations** between roommates
- **Category-based expense organization**
- **Real-time balance updates** across all devices
- **Expense history** and detailed analytics
- **Settlement tracking** and debt management

### 🛒 **Collaborative Shopping**
![Shopping](https://img.shields.io/badge/Shopping%20Lists-Collaborative-FF9800?style=for-the-badge&logo=shopping-cart&logoColor=white)

- **Shared shopping lists** with real-time updates
- **Purchase tracking** with automatic expense integration
- **Priority-based item organization**
- **Quantity and notes management**
- **Smart repurchase suggestions**

### 🏠 **Apartment Management**
![Apartment](https://img.shields.io/badge/Apartment%20Management-Streamlined-9C27B0?style=for-the-badge&logo=home&logoColor=white)

- **Easy apartment creation** and joining
- **Secure invite codes** for roommate invitations
- **Member management** with role-based permissions
- **Profile customization** and preferences
- **Data synchronization** across all devices


</div>

---

## 🏗️ **Architecture**

<div align="center">

```mermaid
graph TB
    subgraph "📱 Mobile App"
        A[React Native App] --> B[Zustand State]
        A --> C[NativeWind UI]
        A --> D[React Navigation]
        A --> E[Screen Components]
    end
    
    subgraph "🎯 Core Screens"
        E --> F[Dashboard]
        E --> G[Expense Management]
        E --> H[Cleaning Rotation]
        E --> I[Shopping Lists]
        E --> J[Group Debts]
        E --> K[Settings]
    end
    
    subgraph "🔥 Backend Services"
        L[Firebase Auth] --> M[Firestore Database]
        M --> N[Cloud Functions]
        N --> O[FCM Notifications]
    end
    
    subgraph "💰 External Services"
        P[AdMob] --> Q[Monetization]
    end
    
    A --> L
    A --> P
    
    style A fill:#61DAFB,stroke:#333,stroke-width:3px,color:#fff
    style B fill:#FF6B6B,stroke:#333,stroke-width:2px,color:#fff
    style C fill:#06B6D4,stroke:#333,stroke-width:2px,color:#fff
    style D fill:#61DAFB,stroke:#333,stroke-width:2px,color:#fff
    style E fill:#8B5CF6,stroke:#333,stroke-width:2px,color:#fff
    style F fill:#10B981,stroke:#333,stroke-width:2px,color:#fff
    style G fill:#F59E0B,stroke:#333,stroke-width:2px,color:#fff
    style H fill:#EF4444,stroke:#333,stroke-width:2px,color:#fff
    style I fill:#8B5CF6,stroke:#333,stroke-width:2px,color:#fff
    style J fill:#06B6D4,stroke:#333,stroke-width:2px,color:#fff
    style K fill:#6B7280,stroke:#333,stroke-width:2px,color:#fff
    style L fill:#FF6B6B,stroke:#333,stroke-width:3px,color:#fff
    style M fill:#FF6B6B,stroke:#333,stroke-width:2px,color:#fff
    style N fill:#FF6B6B,stroke:#333,stroke-width:2px,color:#fff
    style O fill:#FF6B6B,stroke:#333,stroke-width:2px,color:#fff
    style P fill:#FF6B6B,stroke:#333,stroke-width:3px,color:#fff
    style Q fill:#FF6B6B,stroke:#333,stroke-width:2px,color:#fff
```

</div>

### **System Overview**
- **Frontend**: React Native with TypeScript for type safety
- **State Management**: Zustand for efficient global state
- **Backend**: Firebase for real-time data and authentication
- **Core Features**: Expense tracking, cleaning rotation, shopping lists, debt management
- **Real-time**: Firestore for instant data synchronization across all devices
- **Monetization**: AdMob integration for revenue generation

---

## 🛠️ **Technology Stack**

<div align="center">

### **Frontend & Mobile**
![React Native](https://img.shields.io/badge/React%20Native-0.79.5-61DAFB?style=for-the-badge&logo=react&logoColor=white)
![Expo](https://img.shields.io/badge/Expo-53.0.23-000020?style=for-the-badge&logo=expo&logoColor=white)
![TypeScript](https://img.shields.io/badge/TypeScript-5.8.3-007ACC?style=for-the-badge&logo=typescript&logoColor=white)
![NativeWind](https://img.shields.io/badge/NativeWind-4.1.23-06B6D4?style=for-the-badge&logo=tailwindcss&logoColor=white)

### **Backend & Database**
![Firebase](https://img.shields.io/badge/Firebase-12.2.1-FF6B6B?style=for-the-badge&logo=firebase&logoColor=white)
![Firestore](https://img.shields.io/badge/Firestore-Real--time-FF6B6B?style=for-the-badge&logo=firebase&logoColor=white)
![Cloud Functions](https://img.shields.io/badge/Cloud%20Functions-v2-FF6B6B?style=for-the-badge&logo=firebase&logoColor=white)
![FCM](https://img.shields.io/badge/FCM-Push%20Notifications-FF6B6B?style=for-the-badge&logo=firebase&logoColor=white)

### **State Management & Navigation**
![Zustand](https://img.shields.io/badge/Zustand-5.0.4-FF6B6B?style=for-the-badge&logo=zustand&logoColor=white)
![React Navigation](https://img.shields.io/badge/React%20Navigation-7.3.10-61DAFB?style=for-the-badge&logo=react&logoColor=white)
![AsyncStorage](https://img.shields.io/badge/AsyncStorage-2.1.2-61DAFB?style=for-the-badge&logo=react&logoColor=white)

### **UI & Styling**
![React Native Reanimated](https://img.shields.io/badge/Reanimated-3.17.4-61DAFB?style=for-the-badge&logo=react&logoColor=white)
![Lottie](https://img.shields.io/badge/Lottie-7.2.2-61DAFB?style=for-the-badge&logo=lottie&logoColor=white)
![Expo Vector Icons](https://img.shields.io/badge/Expo%20Vector%20Icons-14.1.0-000020?style=for-the-badge&logo=expo&logoColor=white)

### **Monetization**
![AdMob](https://img.shields.io/badge/AdMob-15.8.0-FF6B6B?style=for-the-badge&logo=google&logoColor=white)

### **Analytics & Monitoring**
![Firebase Analytics](https://img.shields.io/badge/Firebase%20Analytics-12.2.1-FF6B6B?style=for-the-badge&logo=firebase&logoColor=white)

### **Development & Build**
![EAS Build](https://img.shields.io/badge/EAS%20Build-7.0.0-000020?style=for-the-badge&logo=expo&logoColor=white)
![Metro](https://img.shields.io/badge/Metro-0.80.0-61DAFB?style=for-the-badge&logo=react&logoColor=white)
![Babel](https://img.shields.io/badge/Babel-7.25.2-F9DC3E?style=for-the-badge&logo=babel&logoColor=white)

</div>

---

> **Source code is private.** This repository showcases product information, screenshots, and release notes only.

---

## 🔧 **Technical Overview**

### **Architecture Highlights**
- **Modern React Native** with Expo framework
- **Real-time Firebase** backend integration
- **TypeScript** for type safety and better development experience
- **Zustand** for efficient state management
- **NativeWind** for responsive styling

### **Performance Features**
- **Optimized bundle size** with code splitting
- **Smooth animations** with React Native Reanimated
- **Offline-first architecture** with data caching
- **Real-time synchronization** across all devices
- **Efficient memory management** and battery optimization

---

## 🌍 **Internationalization**

Roomies supports multiple languages with full RTL support:

- **English** (Default)
- **Hebrew** (עברית) - Full RTL support
- **Easy to extend** for additional languages

---

## 🔒 **Security & Privacy**

- **End-to-end encryption** for sensitive data
- **Firebase Security Rules** for data protection
- **User authentication** with Firebase Auth
- **Secure API endpoints** with proper validation
- **Privacy-first design** - no unnecessary data collection
- **GDPR compliant** data handling

---

## 📊 **Performance**

- **Real-time synchronization** with Firestore
- **Optimized bundle size** with code splitting
- **Efficient state management** with Zustand
- **Smooth animations** with React Native Reanimated
- **Fast startup time** with optimized loading
- **Offline-first architecture** with data caching

---

## 🖼️ **Branding & Assets**

All Roomies names, logos, icons, screenshots, and related assets are copyright © Yonatan Rotem. All rights reserved. Not licensed for reuse.

### **Intellectual Property**
- **Trademark**: "Roomies" and associated branding
- **Design Assets**: UI/UX designs, icons, and visual elements
- **Screenshots**: Application interface and user experience
- **Documentation**: Technical specifications and user guides
- **Source Code**: All implementation and business logic

### **Usage Rights**
This repository is provided for demonstration and portfolio purposes only. No permission is granted for:
- Copying or redistributing any content
- Creating derivative works
- Commercial use of any assets
- Reverse engineering or decompilation

For licensing inquiries, please contact: yonatan.rotem@example.com

---

## 📄 **License**

This project is **NOT open-source**. All rights reserved.

- **Copyright © 2025 Yonatan Rotem**
- **All Rights Reserved**
- **No copying, redistribution, or derivative works permitted**
- **Source code is private and proprietary**

See the [LICENSE](LICENSE) file for complete terms and conditions.

---

## 👥 **Team**

<div align="center">

### **Developed with ❤️ by**

**Yonatan Rotem**

[![GitHub](https://img.shields.io/badge/GitHub-100000?style=for-the-badge&logo=github&logoColor=white)](https://github.com/yonatan-cs)
[![LinkedIn](https://img.shields.io/badge/LinkedIn-0077B5?style=for-the-badge&logo=linkedin&logoColor=white)](https://linkedin.com/in/yonatan-rotem)

</div>

---

## 🙏 **Acknowledgments**

- **Firebase** for providing an amazing backend platform
- **Expo** for simplifying React Native development
- **React Native Community** for excellent libraries and tools
- **All contributors** who helped make this project possible

---

<div align="center">

### **⭐ Star this repository if you found it helpful!**

[![GitHub stars](https://img.shields.io/github/stars/yonatan-cs/Roomies?style=social)](https://github.com/yonatan-cs/Roomies/stargazers)
[![GitHub forks](https://img.shields.io/github/forks/yonatan-cs/Roomies?style=social)](https://github.com/yonatan-cs/Roomies/network/members)
[![GitHub watchers](https://img.shields.io/github/watchers/yonatan-cs/Roomies?style=social)](https://github.com/yonatan-cs/Roomies/watchers)

---

**Made with ❤️ and lots of hot chocolate ☕**

</div>