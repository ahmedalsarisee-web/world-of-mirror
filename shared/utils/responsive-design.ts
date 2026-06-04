import {moderateScale, scale, verticalScale} from 'react-native-size-matters';

export const getWidth = (value: number) => scale(value);
export const getHeight = (value: number) => verticalScale(value);
export {moderateScale};
