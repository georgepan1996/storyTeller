import React from 'react';
import { StyleSheet, View, Text, TouchableOpacity } from 'react-native';

const character = {
  name: 'TestName',
  home: 'TestHome',
  species: 'human',
};

function SignUp(props) {
  const { navigation } = props;
  return (
    <View style={styles.container}>
      <Text style={styles.text}>Sign Up Screen</Text>
      <TouchableOpacity
        style={styles.buttonContainer}
        onPress={() => navigation.navigate('SignIn', { item: character })}
      >
        <Text style={styles.buttonText}>Who is {character.name}?</Text>
      </TouchableOpacity>
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
});

export default SignUp;
