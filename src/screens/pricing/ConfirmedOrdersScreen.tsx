import React, {useMemo} from 'react';
import {ScrollView, StyleSheet} from 'react-native';
import MirrorPricingConfirmedOrdersPanel from '@app/components/pricing/MirrorPricingConfirmedOrdersPanel';
import ScreenContainer from '@app/components/common/ScreenContainer';
import {useTheme} from '@app/context/ThemeContext';

const ConfirmedOrdersScreen: React.FC = () => {
  const {theme} = useTheme();
  const styles = useMemo(
    () =>
      StyleSheet.create({
        scroll: {padding: theme.spacing.md, paddingBottom: theme.spacing.xxl},
      }),
    [theme],
  );

  return (
    <ScreenContainer scroll={false} style={{padding: 0}} contentStyle={{flex: 1, padding: 0}}>
      <ScrollView contentContainerStyle={styles.scroll} keyboardShouldPersistTaps="handled">
        <MirrorPricingConfirmedOrdersPanel showTitle={false} />
      </ScrollView>
    </ScreenContainer>
  );
};

export default ConfirmedOrdersScreen;
