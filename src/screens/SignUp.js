import React from 'react';
import {
  StyleSheet,
  View,
  Text,
  TouchableOpacity,
  TextInput,
} from 'react-native';
import TextInputBlock from './SignUp/TextInputBlock';

function SignUp(props) {
  const { navigation } = props;

  const [username, onChangeUserName] = React.useState(null);
  const [email, onChangeEmail] = React.useState(null);
  const [password, onChangePassword] = React.useState(null);

  return (
    <View>
      <Text style={styles.text}>Create Account</Text>
      <TextInput
        onChangeText={onChangeUserName}
        value={username}
        placeholder='Username'
      />
      <TextInput
        onChangeText={onChangeEmail}
        value={email}
        placeholder='Email'
      />
      <TextInput
        onChangeText={onChangePassword}
        value={password}
        placeholder='Password'
      />
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    backgroundColor: '#ebebeb',
  },
  text: {
    color: '#101010',
    fontSize: 24,
    fontWeight: 'bold',
  },
  buttonContainer: {
    backgroundColor: '#222',
    borderRadius: 5,
    padding: 10,
    margin: 20,
  },
  buttonText: {
    fontSize: 20,
    color: '#fff',
  },

  input: {
    height: 40,
    margin: 12,
    borderWidth: 1,
    padding: 10,
  },
});

export default SignUp;
