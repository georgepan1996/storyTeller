import React from 'react';
import { StyleSheet, View, Text, TouchableOpacity, TextInput } from 'react-native';
import { Icon } from 'react-native-elements'
import styles from '../../assets/Styles'

function SignIn(props) {
  const { navigation } = props;
  const [email, onChangeEmail] = React.useState(null);
  const [password, onChangePassword] = React.useState(null);
  return (
    <View>
      <View style={styles.headerContainer}>
        <Text style={styles.text}>Welcome!</Text>
      </View>

      <View style={styles.sectionContainer}>
        <TextInput
            style={styles.input}
            onChangeText={onChangeEmail}
            value={email}
            placeholder='Email'
        />
        <TextInput
            style={styles.input}
            onChangeText={onChangePassword}
            value={password}
            placeholder='Password'
        />
        <TouchableOpacity
            style={styles.buttonContainer}
            onPress={() => navigation.navigate('SignUp')}
        >
          <Text style={styles.buttonText}>Sign in</Text>
        </TouchableOpacity>
        <TouchableOpacity
            onPress={() => console.log('pressed')}
        >
          <Text style={styles.smallLinkText}>I forgot my password</Text>
        </TouchableOpacity>
      </View>

      <View style={styles.footerContainer}>
        <View style={styles.iconsContainer}>
          <Icon
              name='google'
              type='font-awesome-5'
              color='red'
              iconStyle={styles.iconStyle}
              onPress={() => console.log('pressed')}
          />
          <Icon
              name='facebook'
              type='font-awesome-5'
              color='blue'
              iconStyle={styles.iconStyle}
              onPress={() => console.log('pressed')}
          />
          <Icon
              name='instagram'
              type='font-awesome-5'
              color='black'
              iconStyle={styles.iconStyle}
              onPress={() => console.log('pressed')}
          />
        </View>

      </View>

    </View>
  );
}

// const styles = StyleSheet.create({
//
// });

export default SignIn;
