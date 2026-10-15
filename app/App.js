import { NavigationContainer } from '@react-navigation/native';
import { createNativeStackNavigator } from '@react-navigation/native-stack';
import { StatusBar } from 'expo-status-bar';
import { ActivityIndicator, Platform, StyleSheet, View } from 'react-native';
import { AuthProvider, useAuth } from './src/context/AuthContext';
import { LangProvider, useLang } from './src/context/LangContext';
import LoginScreen from './src/screens/LoginScreen';
import RegisterScreen from './src/screens/RegisterScreen';
import HomeScreen from './src/screens/HomeScreen';
import ScanScreen from './src/screens/ScanScreen';
import ReviewScreen from './src/screens/ReviewScreen';
import DetailScreen from './src/screens/DetailScreen';
import { COLORS } from './src/constants/fields';

const Stack = createNativeStackNavigator();

function RootNavigator() {
  const { user, loading } = useAuth();
  const { t } = useLang();

  if (loading) {
    return (
      <View style={{ flex: 1, justifyContent: 'center', alignItems: 'center' }}>
        <ActivityIndicator size="large" color={COLORS.primary} />
      </View>
    );
  }

  return (
    <Stack.Navigator
      screenOptions={{ headerTintColor: COLORS.primary, headerRightContainerStyle: { paddingRight: 16 } }}
    >
      {user ? (
        <>
          <Stack.Screen name="Home" component={HomeScreen} options={{ title: t('titleHome') }} />
          <Stack.Screen name="Scan" component={ScanScreen} options={{ title: t('titleScan') }} />
          <Stack.Screen name="Review" component={ReviewScreen} options={{ title: t('titleReview') }} />
          <Stack.Screen name="Detail" component={DetailScreen} options={{ title: t('titlePurchi') }} />
        </>
      ) : (
        <>
          <Stack.Screen name="Login" component={LoginScreen} options={{ headerShown: false }} />
          <Stack.Screen name="Register" component={RegisterScreen} options={{ headerShown: false }} />
        </>
      )}
    </Stack.Navigator>
  );
}

// On a wide browser window, show the app as a centered column instead of stretching it edge to edge.
const Shell = ({ children }) =>
  Platform.OS === 'web' ? (
    <View style={styles.page}>
      <View style={styles.column}>{children}</View>
    </View>
  ) : (
    children
  );

export default function App() {
  return (
    <LangProvider>
      <AuthProvider>
        <StatusBar style="auto" />
        <Shell>
          <NavigationContainer>
            <RootNavigator />
          </NavigationContainer>
        </Shell>
      </AuthProvider>
    </LangProvider>
  );
}

const styles = StyleSheet.create({
  page: { flex: 1, alignItems: 'center', backgroundColor: '#DDE7DD' },
  column: {
    flex: 1,
    width: '100%',
    maxWidth: 720,
    backgroundColor: COLORS.bg,
    shadowColor: '#000',
    shadowOpacity: 0.15,
    shadowRadius: 20,
  },
});
