import React from 'react';
import { View, TextInput } from 'react-native';

function TextInputBlock(op) {
  const [{ text }, onChangeText] = React.useState(null);

  return (
    <View>
      <TextInput onChangeText={onChangeText} value={op} placeholder={op} />
    </View>
  );
}

export default TextInputBlock;
