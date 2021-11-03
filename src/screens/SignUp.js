import React from 'react';
import {
  StyleSheet,
  View,
  Text,
  TouchableOpacity,
  TextInput,
  autoCompleteType,
} from 'react-native';

import Icon from 'react-native-vector-icons/FontAwesome5';
import rightcircleo from 'react-native-vector-icons/AntDesign';

function SignUp(props) {
  const { navigation } = props;

  const [username, onChangeUserName] = React.useState(null);
  const [email, onChangeEmail] = React.useState(null);
  const [password, onChangePassword] = React.useState(null);
  const [hidePass, setHidePass] = React.useState(true);

  return (
    <View style={styles.container}>
      <View style={{ flex: 0.8 }}>
        <Text style={styles.title}>Create{'\n'}Account</Text>
      </View>
      <View style={{ flex: 1 }}>
        <TextInput
          style={styles.textInput}
          onChangeText={onChangeUserName}
          value={username}
          placeholder='Username'
        />
        <TextInput
          style={styles.textInput}
          onChangeText={onChangeEmail}
          keyboardType={'email-address'}
          value={email}
          placeholder='Email'
        />
        <View style={styles.searchSection}>
          <TextInput
            style={styles.textInputPassword}
            onChangeText={onChangePassword}
            value={password}
            placeholder='Password'
            secureTextEntry={hidePass ? true : false}
          />
          <Icon
            style={styles.eyeIcon}
            name={hidePass ? 'eye-slash' : 'eye'}
            size={15}
            color='grey'
            onPress={() => setHidePass(!hidePass)}
          />
        </View>
      </View>
      <View
        style={{
          flex: 1,
          alignItems: 'flex-end',
        }}
      >
        <View
          style={{
            flexDirection: 'row',
            alignItems: 'center',
            marginTop: '30%',
          }}
        >
          <Text style={styles.bottom}>Sign up</Text>
          <Icon
            style={styles.arrowIcon}
            name={'angle-right'}
            size={50}
            color='black'
          />
        </View>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    padding: 20,
    backgroundColor: '#ebebeb',
  },
  title: {
    marginTop: '10%',
    color: '#101010',
    fontSize: 50,
    fontWeight: 'bold',
  },
  textInput: {
    flexDirection: 'row',
    alignItems: 'center',
    fontSize: 25,
    width: '80%',
    paddingTop: '1%',
    paddingBottom: '1%',
    marginBottom: '5%',
    borderBottomColor: 'black',
    borderBottomWidth: 2,
    fontWeight: 'bold',
  },
  searchSection: {
    flexDirection: 'row',
    alignItems: 'center',
    width: '80%',
    paddingTop: '1%',
    paddingBottom: '1%',
    marginBottom: '5%',
    borderBottomColor: 'black',
    borderBottomWidth: 2,
  },
  textInputPassword: {
    fontSize: 25,
    fontWeight: 'bold',
  },
  eyeIcon: {
    paddingLeft: '50%',
  },
  arrowIcon: {
    marginRight: '10%',
  },
  bottom: {
    color: '#101010',
    marginEnd: 10,
    fontSize: 40,
    fontWeight: 'bold',
  },
});

export default SignUp;
