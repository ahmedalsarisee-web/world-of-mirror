import React from 'react';
import {StyleSheet, type ViewStyle} from 'react-native';
import {LinearGradient} from 'expo-linear-gradient';

interface Props {
  colors: string[];
  style?: ViewStyle;
  children: React.ReactNode;
}

const GradientCard: React.FC<Props> = ({colors, style, children}) => {
  const gradientColors = colors.length >= 2 ? colors : [colors[0] ?? '#6C4DFF', colors[0] ?? '#8B5CF6'];

  return (
    <LinearGradient
      colors={gradientColors as [string, string, ...string[]]}
      start={{x: 0, y: 0}}
      end={{x: 1, y: 1}}
      style={[styles.root, style]}
    >
      {children}
    </LinearGradient>
  );
};

const styles = StyleSheet.create({
  root: {overflow: 'hidden'},
});

export default GradientCard;
