import React, {useMemo} from 'react';
import {StyleSheet, View, type ViewStyle} from 'react-native';
import {useTheme} from '@app/context/ThemeContext';
import {getFinanceCardFrameStyle} from '@app/utils/financeCardFrame';
import {getListCardStyle} from '@shared/theme/themeHelpers';

interface Props {
  children: React.ReactNode;
  style?: ViewStyle;
}

const FinanceGroupedListCard: React.FC<Props> = ({children, style}) => {
  const {theme} = useTheme();
  const listCard = useMemo(
    () => ({...getListCardStyle(theme), ...getFinanceCardFrameStyle(theme)}),
    [theme],
  );

  const styles = useMemo(
    () =>
      StyleSheet.create({
        card: {
          overflow: 'hidden',
        },
      }),
    [],
  );

  return <View style={[listCard, styles.card, style]}>{children}</View>;
};

export default FinanceGroupedListCard;
