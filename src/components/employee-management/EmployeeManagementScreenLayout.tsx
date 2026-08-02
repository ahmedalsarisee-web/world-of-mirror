import React, {useMemo} from 'react';
import {Pressable, StyleSheet} from 'react-native';
import {useNavigation} from '@react-navigation/native';
import {MaterialCommunityIcons} from '@expo/vector-icons';
import DirectionalView from '@app/components/common/DirectionalView';
import ScreenContainer from '@app/components/common/ScreenContainer';
import ScreenHeader from '@app/components/common/ScreenHeader';
import {useDirection} from '@app/hooks/useDirection';
import {useTheme} from '@app/context/ThemeContext';

interface Props {
  title: string;
  endAction?: React.ReactNode;
  children: React.ReactNode;
  scroll?: boolean;
}

const EmployeeManagementScreenLayout: React.FC<Props> = ({
  title,
  endAction,
  children,
  scroll = true,
}) => {
  const navigation = useNavigation();
  const {chevronBack} = useDirection();
  const {theme} = useTheme();

  const styles = useMemo(
    () =>
      StyleSheet.create({
        container: {flex: 1, backgroundColor: theme.backgrounds.background},
      }),
    [theme.backgrounds.background],
  );

  const backButton = (
    <Pressable
      onPress={() => navigation.goBack()}
      hitSlop={10}
      accessibilityRole="button"
      style={({pressed}) => [{opacity: pressed ? 0.65 : 1}]}
    >
      <MaterialCommunityIcons name={chevronBack} size={24} color={theme.typography.primary} />
    </Pressable>
  );

  return (
    <DirectionalView style={styles.container}>
      <ScreenHeader title={title} startAction={backButton} endAction={endAction} />
      <ScreenContainer scroll={scroll}>{children}</ScreenContainer>
    </DirectionalView>
  );
};

export default EmployeeManagementScreenLayout;
