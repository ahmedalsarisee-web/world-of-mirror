import React from 'react';
import {View, type ViewProps} from 'react-native';
import {useDirection} from '@app/hooks/useDirection';

const DirectionalView: React.FC<ViewProps> = ({style, children, ...props}) => {
  const {layoutStyle} = useDirection();
  return (
    <View style={[layoutStyle, style]} {...props}>
      {children}
    </View>
  );
};

export default DirectionalView;
