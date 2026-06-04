import React from 'react';
import {StyleSheet, Text, View} from 'react-native';
import {MaterialCommunityIcons} from '@expo/vector-icons';
import {useDirection} from '@app/hooks/useDirection';
import {useTheme} from '@app/context/ThemeContext';

interface Props {
  icon: string;
  message: string;
}

const EmptyState: React.FC<Props> = ({icon, message}) => {
  const {theme} = useTheme();
  const {textStyle} = useDirection();

  return (
    <View style={styles.container}>
      <MaterialCommunityIcons name={icon as any} size={48} color={theme.typography.secondary} />
      <Text style={[styles.message, textStyle, {color: theme.typography.secondary}]}>{message}</Text>
    </View>
  );
};

const styles = StyleSheet.create({
  container: {alignItems: 'center', paddingVertical: 48, gap: 12},
  message: {fontSize: 15},
});

export default EmptyState;
