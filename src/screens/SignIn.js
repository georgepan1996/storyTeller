import React from 'react';
import { StyleSheet, View, Text, TouchableOpacity, TextInput } from 'react-native';
import { Icon } from 'react-native-elements'


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

const styles = StyleSheet.create({
  container: {
    backgroundColor: '#ebebeb',
  },
  iconsContainer: {
    height: '100%',
    display: 'flex',
    justifyContent: 'center',
    alignItems: 'center',
    flexDirection: 'row'
  },
  iconStyle: {
    padding: 20
  },
  headerContainer: {
    height: '35%',
  },
  sectionContainer: {
    height: '35%',
  },
  footerContainer: {
    height: '30%',
  },
  text: {
    color: '#101010',
    fontSize: 24,
    fontWeight: 'bold',
  },
  smallLinkText: {
    color: 'blue',
    fontSize: 12,
    paddingLeft: 20
  },
  card: {
    width: 350,
    height: 100,
    borderRadius: 10,
    backgroundColor: '#101010',
    margin: 10,
    padding: 10,
    alignItems: 'center',
  },
  cardText: {
    fontSize: 18,
    color: '#ffd700',
    marginBottom: 5,
  },
  buttonContainer: {
    borderRadius: 5,
    padding: 20,
    paddingBottom: 0
  },
  buttonText: {
    fontSize: 20,
    color: 'black',
  },
  input: {
    height: 40,
    margin: 12,
    borderWidth: 1,
    padding: 10,
  },
});

export default SignIn;
