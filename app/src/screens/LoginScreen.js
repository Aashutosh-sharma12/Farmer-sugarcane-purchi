import AuthForm from './AuthForm';

export default function LoginScreen({ navigation }) {
  return <AuthForm mode="login" navigation={navigation} />;
}
