import React from 'react';
import {ActivityIndicator, Modal, StyleSheet, View} from 'react-native';
import {useTheme} from '@app/context/ThemeContext';

interface Props {
  visible: boolean;
}

const LoadingOverlay: React.FC<Props> = ({visible}) => {
  const {theme} = useTheme();

  return (
    <Modal transparent visible={visible} animationType="fade">
      <View style={[styles.overlay, {backgroundColor: theme.colors.overlay}]}>
        <ActivityIndicator size="large" color={theme.colors.primary} />
      </View>
    </Modal>
  );
};

const styles = StyleSheet.create({
  overlay: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
  },
});

export default LoadingOverlay;
