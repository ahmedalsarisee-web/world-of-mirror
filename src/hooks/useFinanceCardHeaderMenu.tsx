import React, {useLayoutEffect} from 'react';
import type {NativeStackNavigationProp} from '@react-navigation/native-stack';
import {useNavigation} from '@react-navigation/native';
import {FinanceCardOverflowHeaderButton} from '@app/components/finance/FinanceCardOverflowMenu';

interface Options {
  title: string;
  visible: boolean;
  onOpenMenu: () => void;
}

export function useFinanceCardHeaderMenu({title, visible, onOpenMenu}: Options): void {
  const navigation = useNavigation<NativeStackNavigationProp<Record<string, object | undefined>>>();

  useLayoutEffect(() => {
    navigation.setOptions({
      title,
      headerRight: visible
        ? () => <FinanceCardOverflowHeaderButton onPress={onOpenMenu} />
        : undefined,
    });
  }, [navigation, onOpenMenu, title, visible]);
}
