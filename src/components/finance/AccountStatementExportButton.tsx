import React, {useMemo} from 'react';
import {ActivityIndicator, Pressable, StyleSheet, type ViewStyle} from 'react-native';
import {MaterialCommunityIcons} from '@expo/vector-icons';
import {useTheme} from '@app/context/ThemeContext';

type ExportIconName = React.ComponentProps<typeof MaterialCommunityIcons>['name'];

interface Props {
  onPress: () => void;
  loading?: boolean;
  disabled?: boolean;
  size?: number;
  style?: ViewStyle;
  iconName?: ExportIconName;
  accessibilityLabel?: string;
}

const AccountStatementExportButton: React.FC<Props> = ({
  onPress,
  loading = false,
  disabled = false,
  size = 22,
  style,
  iconName = 'file-pdf-box',
  accessibilityLabel = 'export account statement pdf',
}) => {
  const {theme} = useTheme();

  const styles = useMemo(
    () =>
      StyleSheet.create({
        button: {
          width: 36,
          height: 36,
          borderRadius: 18,
          alignItems: 'center',
          justifyContent: 'center',
          backgroundColor: theme.colors.surfaceSecondary,
        },
      }),
    [theme],
  );

  return (
    <Pressable
      style={({pressed}) => [styles.button, style, {opacity: pressed || disabled ? 0.65 : 1}]}
      onPress={onPress}
      disabled={disabled || loading}
      accessibilityRole="button"
      accessibilityLabel={accessibilityLabel}
    >
      {loading ? (
        <ActivityIndicator size="small" color={theme.colors.primary} />
      ) : (
        <MaterialCommunityIcons name={iconName} size={size} color={theme.colors.primary} />
      )}
    </Pressable>
  );
};

export default AccountStatementExportButton;
