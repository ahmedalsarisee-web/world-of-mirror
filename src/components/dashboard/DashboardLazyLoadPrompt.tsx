import React, {useMemo} from 'react';
import {ActivityIndicator, Pressable, StyleSheet, Text, View} from 'react-native';
import {MaterialCommunityIcons} from '@expo/vector-icons';
import {useDirection} from '@app/hooks/useDirection';
import {useTheme} from '@app/context/ThemeContext';
import {getListCardStyle} from '@shared/theme/themeHelpers';

interface Props {
  label: string;
  hint?: string;
  onPress: () => void;
  loading?: boolean;
}

const DashboardLazyLoadPrompt: React.FC<Props> = ({label, hint, onPress, loading = false}) => {
  const {theme} = useTheme();
  const {textStyle, row, layoutStyle, chevronForward} = useDirection();
  const listCard = useMemo(() => getListCardStyle(theme), [theme]);

  const styles = useMemo(
    () =>
      StyleSheet.create({
        root: {
          minHeight: 72,
          paddingVertical: theme.spacing.md,
          paddingHorizontal: theme.spacing.md,
          alignItems: 'center',
          justifyContent: 'center',
        },
        content: {
          width: '100%',
          flexDirection: row,
          alignItems: 'center',
          gap: theme.spacing.sm,
        },
        textWrap: {
          flex: 1,
          minWidth: 0,
          gap: 2,
        },
        label: {
          fontSize: theme.typographyScale.size.sm,
          fontWeight: '700',
        },
        hint: {
          fontSize: theme.typographyScale.size.xs,
          lineHeight: 16,
        },
      }),
    [row, theme],
  );

  return (
    <Pressable
      accessibilityRole="button"
      disabled={loading}
      onPress={onPress}
      style={({pressed}) => [listCard, styles.root, {opacity: pressed ? 0.88 : 1}]}
    >
      {loading ? (
        <ActivityIndicator size="small" color={theme.colors.primary} />
      ) : (
        <View style={[styles.content, layoutStyle]}>
          <MaterialCommunityIcons name="gesture-tap" size={22} color={theme.colors.primary} />
          <View style={styles.textWrap}>
            <Text style={[styles.label, textStyle, {color: theme.typography.primary}]}>{label}</Text>
            {hint ? (
              <Text style={[styles.hint, textStyle, {color: theme.typography.secondary}]}>{hint}</Text>
            ) : null}
          </View>
          <MaterialCommunityIcons name={chevronForward} size={20} color={theme.typography.secondary} />
        </View>
      )}
    </Pressable>
  );
};

export default DashboardLazyLoadPrompt;
