import React from 'react';
import {Text, type TextProps} from 'react-native';
import {useDirection} from '@app/hooks/useDirection';

interface Props extends TextProps {
  ltr?: boolean;
}

const AppText: React.FC<Props> = ({style, ltr, ...props}) => {
  const {textStyle, ltrTextStyle} = useDirection();
  return <Text style={[ltr ? ltrTextStyle : textStyle, style]} {...props} />;
};

export default AppText;
